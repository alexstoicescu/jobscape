export type Board = {slug:string;name:string;platform:'greenhouse'|'lever'|'ashby';source:string};
const group = (platform:Board['platform'], entries:string[][]):Board[] => entries.map(([slug,name,source])=>({slug,name,platform,source:source??boardPage(platform,slug)}));
function boardPage(platform:Board['platform'],slug:string){
 return platform==='greenhouse'?`https://job-boards.greenhouse.io/${slug}`:platform==='lever'?`https://jobs.lever.co/${slug}`:`https://jobs.ashbyhq.com/${slug}`;
}
// Add boards only after checking their public feed and employer identity.
// source is the employer's careers page or official hosted ATS board.
export const boards:Board[] = [
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
 return board.platform==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs${descriptions?'?content=true':''}`:board.platform==='lever'?`https://api.lever.co/v0/postings/${board.slug}?mode=json`:`https://api.ashbyhq.com/posting-api/job-board/${board.slug}`;
}
