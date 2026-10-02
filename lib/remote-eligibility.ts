import {hiringEvidence} from './hiring-regions';
export type Posting = {title: string; text: string; locations: string[]; requirements: string[]; remote: boolean | null; truncated: boolean; method: string};
export type RemoteEligibility = {scope: string; quotes: {text: string; source: string}[]; restrictions: string[]; reason?: string};
export function remoteEligibility(posting: Posting): RemoteEligibility {
  const unknown = (reason: string): RemoteEligibility => ({scope: 'Unknown', quotes: [], restrictions: [], reason});
  if (posting.truncated) return unknown('The description exceeded extraction bounds; later restrictions may be missing.');
  if (!posting.text.trim()) return unknown('The full posting was inaccessible or contained no readable description.');
  const explicitRemote = posting.remote === true || /\b(?:fully remote|100% remote|remote role|role is remote|work remotely|work from home|remote worldwide|worldwide remote|remote from|remote (?:US|EU|EMEA|APAC))\b/i.test(posting.title + '\n' + posting.text);
  if (!explicitRemote || posting.remote === false) return unknown('The posting does not clearly establish remote work for this role.');
  if (/\b(?:on[ -]site only|not (?:a )?remote|remote (?:eligibility|location) (?:is )?(?:unclear|unconfirmed|to be confirmed))\b/i.test(posting.text))
    return unknown('The posting contains contradictory or unconfirmed remote-work terms.');
  if (/\b(?:(?:may|might|could) (?:be |offer |allow )?(?:remote|hire|hiring)|(?:potentially|possibly) (?:remote|worldwide)|not (?:available )?worldwide|locations? (?:are |is )?(?:unconfirmed|to be confirmed))\b/i.test(posting.text))
    return unknown('The stated remote-work or hiring scope is conditional or unconfirmed.');
  // Analyze actual description evidence first; do not infer scope from title/HQ.
  let hiring = hiringEvidence({title: '', snippet: posting.text});
  let quotes = hiring.evidence.filter(phrase => /remote|worldwide|anywhere|hiring|only|reside|based in|located in|eligible|candidates|except|excluding/i.test(phrase)).map(text => ({text, source: 'Description'}));
  if (posting.requirements.length) {
    hiring = hiringEvidence({title: '', snippet: posting.text + '\nCandidates must reside in ' + posting.requirements.join(', ')});
    quotes = [...quotes, ...posting.requirements.map(text => ({text, source: 'applicantLocationRequirements'}))];
  } else if (hiring.unknown && posting.locations.length) {
    hiring = hiringEvidence({title: '', snippet: 'Job location: ' + posting.locations.join(', ')});
    quotes = posting.locations.map(text => ({text, source: 'jobLocation'}));
  }
  if (hiring.unknown || !hiring.regions.length) return unknown('No unambiguous permitted hiring location was established from the full posting.');
  const countries = hiring.countries.filter(country => hiring.permittedCountries.includes(country));
  const restrictions = [...countries.map(country => (hiring.restricted ? 'Restricted country: ' : 'Listed country: ') + country), ...hiring.excludedCountries.map(country => 'Excluded country: ' + country)];
  const phrases = [...hiring.evidence, ...posting.requirements].join('\n');
  const stated = [
    {name:'EU', matches:/\bEU\b|European Union/i, permitted:'EU'},
    {name:'EMEA', matches:/\bEMEA\b|Europe[, ]+Middle East[, ]+and Africa/i, permitted:'EMEA'},
    {name:'APAC', matches:/\bAPAC\b|Asia[ -]Pacific/i, permitted:'APAC'},
    {name:'Europe', matches:/\bEurope\b/i, permitted:'EMEA'}
  ].filter(region => region.matches.test(phrases) && hiring.regions.includes(region.permitted as 'EU'|'EMEA'|'APAC'));
  const worldwideWithExclusions = !hiring.restricted && hiring.excludedCountries.length > 0 && /\bworldwide\b/i.test(phrases);
  return {scope: hiring.worldwide ? 'Worldwide' : worldwideWithExclusions ? 'Worldwide (with exclusions)' : countries.length ? countries.join(', ') : stated.map(region => region.name).join(', ') || hiring.regions.join(', '), quotes: quotes.slice(-8), restrictions};
}
