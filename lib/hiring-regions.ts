import {normalizeText, normalizePlace, countryCode, regionCode} from './geography';
import {countryNames, extraCountryAliases, existingCountryNames, regionCountries, emeaEurope, type HiringRegion, type Regional} from './hiring-region-map';
export type HiringEvidence = {
  unknown: boolean; regions: Regional[]; worldwide: boolean; evidence: string[];
  countries: string[]; excludedCountries: string[]; restricted: boolean;
  permittedCountries: string[];
};
const contains = (text: string, phrase: string) => (' ' + text + ' ').includes(' ' + normalizeText(phrase) + ' ');
const allCountries = new Set(countryNames);
const regionAliases: [string[], Set<string>][] = [
  [['eu','e u','european union'], new Set(regionCountries.EU)],
  [['europe'], new Set(emeaEurope)],
  [['emea','europe middle east and africa'], new Set(regionCountries.EMEA)],
  [['apac','asia pacific'], new Set(regionCountries.APAC)],
  [['us','u s','usa','u s a','united states','united states of america'], new Set(regionCountries.US)]
];
function locations(value: string) {
  const text = normalizeText(value);
  const spans = countryNames.flatMap(country => [country, ...(extraCountryAliases[country] ?? [])].flatMap(alias =>
    [...text.matchAll(new RegExp('(^| )(' + normalizeText(alias) + ')(?= |$)', 'g'))].map(match => ({country, start: match.index! + match[1].length, end: match.index! + match[0].length}))
  )).sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const accepted: typeof spans = [];
  for (const span of spans) if (!accepted.some(other => other.start < span.end && other.end > span.start)) accepted.push(span);
  const countries = accepted.map(span => span.country);
  const place = normalizePlace({label: value});
  // Avoid reading the pronoun "us" or lowercase prepositions as ISO codes.
  if (place.country && existingCountryNames[place.country] &&
      (place.country !== 'US' || /\b(?:US|USA|U\.S\.|United States)\b|\busa\b/.test(value))) countries.push(existingCountryNames[place.country]);
  for (const part of value.split(/[,/|()]/)) {
    const segment = part.trim().replace(/^(?:(?:job )?location|remote)\s*[:\-]?\s*/i, '').replace(/(?:[ -]only)?\.?$/, '').trim();
    if (!/^(?:[A-Z]{2,3}|us|usa|uk)$/.test(segment) || segment === 'CA') continue;
    const code = countryCode(segment);
    if (code && existingCountryNames[code]) countries.push(existingCountryNames[code]);
  }
  const matched = new Set(countries);
  for (const [aliases, members] of regionAliases) {
    if (aliases.some(alias => contains(text, alias) && (alias !== 'us' || /\bUS\b/.test(value))))
      for (const country of members) matched.add(country);
  }
  // Reuse the existing aliases for broad region phrases.
  for (const segment of value.split(/[,/|()]/)) {
    const alias = regionCode(segment.trim());
    const members = alias === 'europe' ? regionCountries.EU : alias === 'emea' ? regionCountries.EMEA : alias === 'apac' ? regionCountries.APAC : [];
    for (const country of members) matched.add(country);
  }
  return {matched, countries: [...new Set(countries)]};
}
export function hiringEvidence(card: {title: string; snippet: string}): HiringEvidence {
  const evidence: string[] = [], countries = new Set<string>(), excludedCountries = new Set<string>();
  let permitted = new Set<string>(), excluded = new Set<string>(), limits: Set<string> | null = null, worldwide = false, positiveEvidence = false;
  const strong = /\b(?:hir(?:ing|e|es)|candidates?|applicants?|job location|location\s*:|eligible|residents?|must (?:be|live|reside)|work from|this (?:role|position)|you (?:must|can))\b/i;
  for (const [field, value] of [['title', card.title], ['snippet', card.snippet]]) {
    for (const phrase of value.split(/[;\n]|(?<=[.!?])\s+(?=[A-Z])|[…]/u).map(s => s.trim()).filter(Boolean)) {
      let job = phrase;
      const cue = strong.exec(job);
      const company = /\b(?:company|employer|headquarters?|headquartered|hq|offices?|customers?|clients?|markets?|sales territory)\b/i;
      if (company.test(job)) {
        if (!cue) continue;
        job = job.slice(cue.index).split(/\b(?:headquarters?|headquartered|hq|offices?|customers?|clients?|markets?|to support|to serve)\b/i)[0];
      }
      if (/\b(?:time\s*zones?|working hours|business hours|overlap)\b/i.test(job)) continue;
      const explicit = cue || /\b(?:remote|remotely|location|based in|located in|reside in|live in|restricted to|limited to|only|except|excluding|not in)\b/i.test(job) ||
        field === 'title' && /[-–—|()]/.test(job);
      if (!explicit) continue;
      const negative = /\b(?:except|excluding|not in|not (?:available|hiring|eligible) in|cannot (?:hire|work) in|outside of)\b/i.exec(job);
      const positiveText = negative ? job.slice(0, negative.index) : job;
      const negativeText = negative ? job.slice(negative.index + negative[0].length) : '';
      const positive = locations(positiveText), denied = locations(negativeText);
      const broad = /\b(?:worldwide|anywhere|work from anywhere|remote globally|globally remote|hiring globally|hire globally|remote global|global remote|location\s*:\s*global)\b/i.test(positiveText);
      const narrow = /\b(?:only|restricted to|limited to|must (?:be|live|reside)|residents?|based in|located in|job location|location\s*:|hiring (?:in|from)|eligible (?:in|from)|candidates? (?:in|from))\b/i.test(positiveText) && !/\bnot only\b/i.test(positiveText);
      evidence.push(phrase);
      if (!positive.matched.size && !denied.matched.size && !broad) continue;
      if (positive.matched.size || broad) positiveEvidence = true;
      positive.countries.forEach(country => countries.add(country));
      denied.countries.forEach(country => excludedCountries.add(country));
      denied.matched.forEach(country => excluded.add(country));
      if (broad) { worldwide = true; allCountries.forEach(country => permitted.add(country)); }
      positive.matched.forEach(country => permitted.add(country));
      if (narrow && positive.matched.size) limits = limits === null ? positive.matched : new Set<string>([...limits].filter((country: string) => positive.matched.has(country)));
    }
  }
  const unknown = !positiveEvidence || limits !== null && !limits.size;
  if (limits !== null) permitted = new Set([...permitted].filter(country => limits!.has(country)));
  permitted = new Set([...permitted].filter(country => !excluded.has(country)));
  const regions = (Object.keys(regionCountries) as Regional[]).filter(region => regionCountries[region].some(country => permitted.has(country)));
  return {unknown, regions: unknown ? [] : regions, worldwide: worldwide && limits === null && !excluded.size,
    evidence: [...new Set(evidence)], countries: [...countries], excludedCountries: [...excludedCountries], restricted: limits !== null, permittedCountries: [...permitted]};
}
export function matchesHiringRegion(evidence: HiringEvidence, region: HiringRegion, includeUnknown = false) {
  return region === 'Global' || (evidence.unknown ? includeUnknown : evidence.regions.includes(region));
}
