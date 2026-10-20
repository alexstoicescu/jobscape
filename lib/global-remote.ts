import type {Posting} from './remote-eligibility';
import {normalizeText} from './geography';
import {countryNames,extraCountryAliases,existingCountryNames} from './hiring-region-map';

export type GlobalCheck = {
  status: 'verified'|'restricted'|'unknown'; reason: string;
  evidence: {quote:string;source:string}[]; restrictions: string[];
  checkedAt: string; sourceUrl: string; method: string; cached?: boolean;
};
export type PostingRead = {posting?: Posting; context?:string; reason?: string; sourceUrl:string; method:string; checkedAt:string};
const worldwide = /\b(?:worldwide|globally|anywhere in the world|any country in the world|all countries)\b/i;
const role = /\b(?:this|the) (?:(?:fully|100%) remote )?(?:role|position|job|opportunity)\b/i;
const timezone = /\b(?:time ?zones?|(?:working|business|core) hours|overlap|UTC|GMT|CET|EST|PST)\b/i;
// Compile the existing geographic aliases once; do not run the legacy regional
// estimator (which expands entire regions) for every sentence in a full posting.
const aliases=[...new Set(countryNames.flatMap(name=>[name,...(extraCountryAliases[name]??[])]).map(normalizeText).filter(name=>name!=='us'))].sort((a,b)=>b.length-a.length);
const geographicNames=aliases.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
const countryPattern=new RegExp('(?:^| )('+geographicNames+')(?: |$)');
const countryOnly=new RegExp('(?:^| )('+geographicNames+') only(?: |$)');

// Deliberately separate from legacy snippet/region estimates. Only a complete
// source posting is accepted; neither Google text nor employer HQ is an input.
export function strictGlobal(read: PostingRead): GlobalCheck {
  const result = (status:GlobalCheck['status'],reason:string,evidence:GlobalCheck['evidence']=[],restrictions:string[]=[]):GlobalCheck =>
    ({status,reason,evidence,restrictions,checkedAt:read.checkedAt,sourceUrl:read.sourceUrl,method:read.method});
  const p=read.posting;
  if(!p || p.truncated || !p.text.trim())return result('unknown',read.reason??'A complete original posting description was not available.');
  const phrases=p.text.split(/\n+|;|(?<=[.!?])\s+(?=[A-Z])/u).map(s=>s.trim()).filter(Boolean);
  const context=(read.context??'').split(/\n+|;|(?<=[.!?])\s+(?=[A-Z])/u).map(s=>s.trim()).filter(Boolean);
  const evidence:GlobalCheck['evidence']=[],restrictions:string[]=[];
  const add=(quote:string,source='Posting description')=>evidence.push({quote:quote.slice(0,650),source});
  let limited=false,unclear=false;
  // applicantLocationRequirements is role-specific. jobLocation/HQ is not used.
  const universal=(s:string)=>/^(?:worldwide|world|anywhere in the world|all countries)$/i.test(s.trim());
  const requirements=p.requirements.filter(s=>s.trim());
  const explicitWorld=requirements.length>0&&requirements.every(universal);
  if(requirements.some(s=>!universal(s))){
    requirements.forEach(s=>add(s,'applicantLocationRequirements'));
    const namedLimit=requirements.some(s=>!universal(s)&&(countryPattern.test(normalizeText(s))||
      !!existingCountryNames[s.toUpperCase()]||/\b(?:US|UK|EU|EMEA|APAC|Europe|Americas|except|excluding|\d+ countries)\b/.test(s)));
    if(!namedLimit)unclear=true;
    else {limited=true;restrictions.push('The posting declares a limited or non-worldwide applicant location set.');}
  }
  if(explicitWorld)requirements.forEach(s=>add(s,'applicantLocationRequirements'));
  let remote=p.remote===true;
  for(const phrase of [...new Set([...phrases,...context])]){
    if(/\b(?:fully remote|100\s*% remote|entirely remote)\b/i.test(phrase)&&
       !/\b(?:company|team|customers?|clients?)\b/i.test(phrase))remote=true;
    // Mandatory physical attendance/residency overrides remote metadata/benefits.
    const office=/\b(?:hybrid (?:role|position|schedule)|(?:this|the) (?:role|position) is hybrid|not (?:a )?(?:(?:fully|entirely|100%) )?remote|on[ -]site only|(?:office|on[ -]site)(?: attendance| presence)? (?:is )?(?:required|mandatory)|(?:mandatory|required) office (?:attendance|presence)|(?:must|required to|need to|have to|expected to) (?:work |be |attend |come |go )?(?:in[ -]office|on[ -]site|(?:to |in |at )?(?:the |our |an? )?office)|\d+ (?:days?|times?) (?:per |a |each )?week[^.!?\n]{0,60}(?:office|on[ -]site)|(?:office|on[ -]site)[^.!?\n]{0,60}\d+ (?:days?|times?) (?:per |a |each )?week)\b/i.test(phrase);
    // Applicant-residency requirements need no country/city dictionary: an
    // explicit local-only condition contradicts worldwide hiring anywhere.
    // Preferences alone must not turn an office/HQ address into a restriction.
    const optionalGeography=/\b(?:preferred|preferably|ideally|optional|nice to have)\b/i.test(phrase)&&!/\b(?:must|only|required|mandatory|need to|have to|restricted|limited)\b/i.test(phrase);
    const officeAddress=/\b(?:offices?|headquarters?|HQ) (?:is|are) (?:based|located) in\b/i.test(phrase)&&!/\b(?:applicants?|candidates?|must|only|required|mandatory|need to|have to)\b/i.test(phrase);
    const localApplicants=/\bonly (?:applicants?|candidates?|people) (?:currently )?(?:living|residing|based|located|(?:who |that )(?:live|reside|are based|are located)) (?:in|within|near)\b|\bonly (?:current )?residents? (?:of|in)\b|\bonly [^.!?\n]{1,80}\bresidents?\b[^.!?\n]{0,50}\b(?:apply|considered|eligible)\b|\b(?:applicants?|candidates?) (?:currently )?(?:living|residing) (?:in|within|near)\b[^.!?\n]{0,100}\b(?:only|will be considered|may apply)\b|\b(?:must|need to|have to|required to) be (?:an? )?(?:current )?residents? (?:of|in)\b|\b(?:residence|residency) (?:in|within)\b[^.!?\n]{0,100}\b(?:required|mandatory)\b/i.test(phrase);
    const residency=!optionalGeography&&(localApplicants||/\b(?:must|need to|have to|required to) (?:currently )?(?:reside|live|be based|be located|work from)/i.test(phrase)||!officeAddress&&/\b(?:based|residing|located) in\b/i.test(phrase)||!timezone.test(phrase)&&/\b(?:must|need to|required to) be in\b/i.test(phrase));
    const hiring=/\b(?:hir(?:e[sd]?|ing)|recruit(?:ing|ment)?|accept(?:ing)? (?:applications|applicants)|applicants?|candidates?|eligible|available|open|work remotely|remote|work from|location\s*:)\b/i.test(phrase);
    const narrow=/\b(?:only|restricted|limited|except|excluding|excluded|not hiring|not available|cannot hire|unable to hire|residents?|citizens?|reside|based in|located in|from|within|in|across)\b/i.test(phrase);
    const normalized=normalizeText(phrase);
    const hasGeo=countryPattern.test(normalized)||/\b(?:EU|EMEA|APAC|Europe|Americas|North America|Latin America|continental US|United Kingdom)\b/i.test(phrase)||/\b(?:US|USA)\b/.test(phrase)||/\b(?:remote[ ,:-]+us|us[ -]only)\b/i.test(phrase)||/\b\d+ (?:named )?countries\b/i.test(phrase);
    const headquarters=/\b(?:headquarters?|headquartered|HQ)\b/i.test(phrase)&&!residency&&!/\b(?:applicants?|candidates?|hir(?:e[sd]?|ing)|restricted|eligible)\b/i.test(phrase);
    // Pure timezone overlap is evidence to retain, not a residence restriction.
    const scopeLimit=/\b(?:restricted|limited) to|\bonly hir(?:e[sd]?|ing)\b|\b(?:US|USA|EU|EMEA|APAC)[ -]only\b/i.test(phrase)||countryOnly.test(normalized);
    const timeOnly=timezone.test(phrase)&&!residency&&!scopeLimit&&!/\b(?:countries|residents?|citizens?|anywhere in (?:the )?(?:continental|United States|US|Europe|Americas))\b/i.test(phrase);
    if(timezone.test(phrase)){add(phrase);restrictions.push(phrase.slice(0,650));}
    const unnamedLimit=/\b(?:only (?:hir(?:e[sd]?|ing)|recruit)|(?:hiring|recruiting) only|restricted to|limited to)[^.!?\n]{0,60}\b(?:in|from|within)\b/i.test(phrase)&&!worldwide.test(phrase);
    const geographicExclusion=hasGeo&&/\b(?:except|excluding|excluded|ineligible|not from|not eligible in)\b/i.test(phrase);
    const allowedList=hasGeo&&/\b(?:(?:hiring|applicant|eligible|permitted|supported)\s+)?(?:countries|regions|locations)\s*:|\beligible\s*:/i.test(phrase);
    const universalResidence=/\b(?:reside|live|be based|be located|be in|work from)\s+(?:in |from )?(?:anywhere in the world|any country in the world|anywhere(?!\s+(?:in|within|across)\b)|any country(?!\s+(?:in|within|across)\b))\b/i.test(phrase);
    if(office || !headquarters && (residency && !universalResidence || unnamedLimit || geographicExclusion || allowedList || !optionalGeography&&hiring&&hasGeo&&!timeOnly&&(narrow||/\bremote\b/i.test(phrase)) || /\b(?:available|hiring|hire|open)[^.!?\n]{0,60}\b\d+ (?:named )?countries\b/i.test(phrase))){
      limited=true;add(phrase);if(!timezone.test(phrase))restrictions.push(phrase.slice(0,650));
    }
    if(/\bhybrid\b/i.test(phrase)&&!office&&!/\bhybrid (?:cloud|infrastructure)\b/i.test(phrase)){unclear=true;add(phrase);}
    if(hasGeo&&!headquarters&&!timeOnly&&/\b(?:employ|staff|countries|residency|work authori[sz]ation|right to work)\b/i.test(phrase)&&!limited){unclear=true;add(phrase);}
    if(/\b(?:not (?:available )?worldwide|geographic(?:al)? restrictions?|location (?:is |to be )?(?:unconfirmed|determined)|may hire|might hire|potentially worldwide|possibly worldwide)\b/i.test(phrase)) {unclear=true;add(phrase);}
    if(!optionalGeography&&/\b(?:geographic(?:al)?|location|residen(?:ce|cy)) (?:requirements?|criteria|eligibility)\b|\bonly (?:local applicants?|local candidates?|residents?)\b/i.test(phrase)&&!limited){unclear=true;add(phrase);}
  }
  if(limited||p.remote===false)return result('restricted','The actual posting limits applicant geography or requires non-remote attendance.',evidence,restrictions);
  const affirmative=phrases.filter(phrase=>worldwide.test(phrase)&&
    !/\b(?:may|might|could|potentially|possibly|not|company|customers?|clients?|markets?|offices?)\b/i.test(phrase)&&
    (role.test(phrase)&&/\b(?:open|available|applicants?|applications?|candidates?|welcome|work|performed|hire|hiring)\b/i.test(phrase)||
      /^(?:location\s*:\s*|(?:fully |100% )?remote[, :\-]+)(?:worldwide|anywhere in the world)[.!]?$/i.test(phrase)||
      // An explicit posting eligibility label is role evidence even when a
      // semicolon separates it from the remote-work clause (real ATS fixture).
      /^eligibility\s*:\s*open to (?:applicants|candidates) worldwide[.!]?$/i.test(phrase)));
  affirmative.forEach(phrase=>add(phrase));
  if(!remote||unclear||(!affirmative.length&&!explicitWorld))return result('unknown',!remote?'Fully remote work for this role was not established.':unclear?'The posting has conditional or unresolved geographic terms.':'The posting does not affirmatively establish worldwide applications for this role.',evidence,restrictions);
  if(p.remote===true)add('TELECOMMUTE','jobLocationType (establishes remote work only)');
  return result('verified','The posting explicitly establishes fully remote worldwide hiring, with no detected conflicting geographic or office requirement.',evidence,restrictions);
}
