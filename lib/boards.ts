import {type Job,type SearchInput,type SearchResult,type BoardHealth,matchJob} from './search';
import {boards,boardFeedUrl,type Board} from './registry';
import {normalizePlaces,type Place} from './geography';
export {boards} from './registry';

type CachedBoard={jobs:Job[];until:number;checked:string;bytes:number};
const cache=new Map<string,CachedBoard>();
const pending=new Map<string,Promise<CachedBoard>>();
const MAX_CACHE_BYTES=24*1024*1024;
const MAX_DESCRIPTION=12000;
const plain=(value:unknown)=>String(value??'')
 .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/<[^>]*>/g,' ')
 .replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
 .replace(/&#(\d+);/g,(_,value)=>{const code=Number(value);return code<=0x10ffff?String.fromCodePoint(code):' '})
 .replace(/\s+/g,' ').trim();
const safeUrl=(value:unknown)=>{try{const url=new URL(String(value));return url.protocol==='https:'?url.href:''}catch{return ''}};
const date=(value:unknown)=>{if(value===undefined||value===null||value==='')return null;const parsed=new Date(value as string|number);return Number.isNaN(parsed.getTime())?null:parsed.toISOString()};
function remoteListing(job:{isRemote?:boolean;workplaceType?:string},location:string){
 const workplace=String(job.workplaceType??'').toLowerCase().replace(/[-\s]/g,'');
 if(workplace==='onsite'||workplace==='hybrid')return false;
 if(typeof job.isRemote==='boolean')return job.isRemote;
 if(workplace==='remote')return true;
 return location.split(/[;·]/).some(place=>!/\b(non[ -]?remote|not remote|no remote)\b/i.test(place)&&/\b(remote|distributed|anywhere|home[ -]based|work from home)\b/i.test(place));
}
function store(key:string,value:CachedBoard){
 for(const [oldKey,entry] of cache)if(entry.until<=Date.now())cache.delete(oldKey);
 let bytes=[...cache.values()].reduce((sum,entry)=>sum+entry.bytes,0);
 while(cache.size&&bytes+value.bytes>MAX_CACHE_BYTES){const first=cache.keys().next().value!;bytes-=cache.get(first)!.bytes;cache.delete(first)}
 if(value.bytes<=MAX_CACHE_BYTES)cache.set(key,value);
}
async function loadBoard(board:Board,descriptions:boolean,deadline:number):Promise<{entry:CachedBoard;cached:boolean}>{
 const full=descriptions&&board.platform==='greenhouse';
 const key=board.platform+':'+board.slug+(full?':descriptions':'');
 const old=cache.get(key);
 if(old&&old.until>Date.now())return {entry:old,cached:true};
 const inFlight=pending.get(key);if(inFlight)return {entry:await inFlight,cached:false};
 const remaining=Math.min(9000,deadline-Date.now());
 if(remaining<=0)throw new Error('Search time budget reached. Retry this board.');
 const promise=(async()=>{
  const response=await fetch(boardFeedUrl(board,full),{signal:AbortSignal.timeout(remaining),headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`HTTP ${response.status}${response.status===404?'; check the careers page for an ATS migration.':''}`);
  const data:any=await response.json();const raw=board.platform==='lever'?data:data.jobs;
  if(!Array.isArray(raw))throw new Error('The feed returned an unexpected format.');
  const checked=new Date().toISOString();
  const jobs:Job[]=raw.filter((job:any)=>job.isListed!==false).map((job:any):Job=>{
   const locations:Place[]=board.platform==='ashby'?[{label:plain(job.location),city:job.address?.postalAddress?.addressLocality,country:job.address?.postalAddress?.addressCountry},...(job.secondaryLocations??[]).map((place:any)=>({label:plain(place.location),city:place.address?.addressLocality,country:place.address?.addressCountry}))]:board.platform==='greenhouse'?[{label:plain(job.location?.name)},...(job.offices??[]).map((office:any)=>({label:plain(office.location)}))]:[...new Set([job.categories?.location,...(job.categories?.allLocations??[])].filter(Boolean))].map(label=>({label:plain(label)}));
   const primaryLocation=board.platform==='greenhouse'?plain(job.location?.name):[...new Set(locations.map(place=>place.label).filter(Boolean))].join(' · ');
   const text=board.platform==='greenhouse'?plain(job.content):board.platform==='lever'?plain([job.descriptionPlain,...(job.lists??[]).map((list:any)=>list.content),job.additionalPlain].filter(Boolean).join(' ')):plain(job.descriptionPlain??job.descriptionHtml);
   const published=date(board.platform==='greenhouse'?job.updated_at:board.platform==='lever'?job.createdAt:job.publishedAt);
   return {id:board.platform+':'+board.slug+':'+job.id,title:plain(job.title??job.text),company:board.name,location:primaryLocation||'Location not specified',locations:normalizePlaces(locations.filter(place=>place.label||place.country||place.city)),remote:remoteListing(job,primaryLocation),url:safeUrl(job.absolute_url??job.hostedUrl??job.jobUrl),platform:board.platform,description:text.slice(0,MAX_DESCRIPTION),descriptionTruncated:text.length>MAX_DESCRIPTION,published,dateKind:published?board.platform==='greenhouse'?'updated':'published':null,checked};
  }).filter((job:Job)=>job.url&&job.title);
  const entry={jobs,until:Date.now()+600000,checked,bytes:JSON.stringify(jobs).length*2};store(key,entry);return entry;
 })();
 pending.set(key,promise);
 try{return {entry:await promise,cached:false}}finally{pending.delete(key)}
}
async function loadSelected(selected:Board[],descriptions:boolean){
 const deadline=Date.now()+16000;let next=0;
 const responses:{jobs:Job[];health:BoardHealth}[]=new Array(selected.length);
 // Bound memory use when full Greenhouse descriptions are requested.
 await Promise.all(Array.from({length:Math.min(descriptions?4:8,selected.length)},async()=>{
  while(next<selected.length){const index=next++,board=selected[index];
   try{const {entry,cached}=await loadBoard(board,descriptions,deadline);responses[index]={jobs:entry.jobs,health:{name:board.name,platform:board.platform,source:board.source,status:'ok',jobs:entry.jobs.length,checked:entry.checked,cached}}}
   catch(error){responses[index]={jobs:[],health:{name:board.name,platform:board.platform,source:board.source,status:'unavailable',jobs:0,checked:new Date().toISOString(),cached:false,error:error instanceof Error?(error.name==='TimeoutError'?'The feed timed out.':error.message):'Feed unavailable.'}}}
  }
 }));
 return responses;
}
export async function checkBoards(){return (await loadSelected(boards,false)).map(response=>response.health)}
export async function searchBoards(input:SearchInput):Promise<SearchResult>{
 const selected=boards.filter(board=>input.platforms.includes(board.platform));
 const responses=await loadSelected(selected,input.searchDescriptions===true);
 const health=responses.map(response=>response.health),all=responses.flatMap(response=>response.jobs);
 const matching:Job[]=[];
 for(const job of all){const match=matchJob(job,input);if(match)matching.push({...job,description:job.description.slice(0,420),match})}
 const unique=[...new Map(matching.map(job=>[job.url,job])).values()].sort((a,b)=>a.title.localeCompare(b.title));
 return {jobs:unique.slice(0,300),total:unique.length,scanned:all.length,boards:health.filter(board=>board.status==='ok').length,attempted:selected.length,failed:health.filter(board=>board.status==='unavailable').map(board=>board.name),checked:new Date().toISOString(),truncated:unique.length>300,health,descriptions:{available:all.filter(job=>job.description).length,truncated:all.filter(job=>job.descriptionTruncated).length}};
}
