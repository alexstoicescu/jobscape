import {adapters} from './adapters/index';
export type Board = {slug:string;name:string;platform:'greenhouse'|'lever'|'ashby'|'smartrecruiters'|'workable'|'personio';source:string;domain?:'de'|'com';locale?:string};
const group = (platform:Board['platform'], entries:string[][]):Board[] => entries.map(([slug,name,source])=>({slug,name,platform,source:source??boardPage(platform,slug)}));
function boardPage(platform:Board['platform'],slug:string){
 const pages={greenhouse:`https://job-boards.greenhouse.io/${slug}`,lever:`https://jobs.lever.co/${slug}`,ashby:`https://jobs.ashbyhq.com/${slug}`,smartrecruiters:`https://careers.smartrecruiters.com/${slug}`,workable:`https://apply.workable.com/${slug}/`,personio:`https://${slug}.jobs.personio.de/`};return pages[platform];
}
// Add boards only after checking their public feed and employer identity.
// source is the employer's careers page or official hosted ATS board.
export const boards:Board[] = [
 ...group('smartrecruiters',[
  ['SmartRecruiters','SmartRecruiters','https://careers.smartrecruiters.com/smartrecruiters'],
  ['Ubisoft2','Ubisoft','https://www.ubisoft.com/en-us/company/careers/search'],
  ['Devoteam','Devoteam','https://careers.smartrecruiters.com/Devoteam'],
 ]),
 ...group('greenhouse',[
  ['stripe','Stripe'],['cloudflare','Cloudflare'],['datadog','Datadog'],['mongodb','MongoDB'],['gitlab','GitLab'],['canonical','Canonical'],['elastic','Elastic'],['grafanalabs','Grafana Labs'],['figma','Figma'],['reddit','Reddit'],['discord','Discord'],['coinbase','Coinbase'],['vercel','Vercel'],['anthropic','Anthropic'],['contentful','Contentful'],['hubspot','HubSpot'],['intercom','Intercom'],['twilio','Twilio'],['postman','Postman','https://www.postman.com/company/careers/open-positions/'],
  ['cockroachlabs','Cockroach Labs','https://www.cockroachlabs.com/careers/'],['fastly','Fastly','https://www.fastly.com/about/careers'],['launchdarkly','LaunchDarkly'],['netlify','Netlify'],
 ]),
 ...group('lever', [['spotify','Spotify'],['mistral','Mistral AI'],['palantir','Palantir'],['kraken','Kraken'],['binance','Binance']]),
 ...group('ashby',[
  ['alchemy','Alchemy'],['n8n','n8n'],['supabase','Supabase'],['openai','OpenAI'],['linear','Linear'],['notion','Notion'],['replit','Replit'],['perplexity','Perplexity'],['deepl','DeepL'],['elevenlabs','ElevenLabs'],['ramp','Ramp'],
  ['snyk','Snyk','https://snyk.io/careers/all-jobs/'],['cursor','Cursor'],['resend','Resend'],['modal','Modal'],['railway','Railway'],['langchain','LangChain'],['cohere','Cohere'],['baseten','Baseten'],['docker','Docker'],
 ]),
];
export function boardFeedUrl(board:Board, descriptions=false){
 const adapter=adapters[board.platform];if(!adapter)throw new Error('No public adapter is enabled for this source.');return adapter.feedUrl(board,descriptions);
}
