import {type Job,type SearchInput,type SearchResult,type BoardHealth,matchJob} from './search';
import {boards,type Board} from './registry';
import {sourceCoverage} from './coverage';
import {adapters} from './adapters/index';
import {makeContext,SourceError,type FetchBudget} from './adapters/transport';
import type {AdapterResult} from './adapters/types';
export {boards} from './registry';
type CachedBoard=AdapterResult&{until:number;checked:string;bytes:number};
const cache=new Map<string,CachedBoard>(),pending=new Map<string,Promise<CachedBoard>>();
const MAX_CACHE_BYTES=24*1024*1024;
const cacheBytes=()=>[...cache.values()].reduce((sum,entry)=>sum+entry.bytes,0);
function store(key:string,value:CachedBoard){
 for(const [oldKey,entry] of cache)if(entry.until<=Date.now())cache.delete(oldKey);let bytes=cacheBytes();
 while(cache.size&&bytes+value.bytes>MAX_CACHE_BYTES){const first=cache.keys().next().value!;bytes-=cache.get(first)!.bytes;cache.delete(first)}
 if(value.bytes<=MAX_CACHE_BYTES)cache.set(key,value);
}
async function loadBoard(board:Board,descriptions:boolean,budget:FetchBudget):Promise<{entry:CachedBoard;cached:boolean}>{
 const adapter=adapters[board.platform];if(!adapter)throw new Error('No public adapter is enabled for this source.');
 const key=board.platform+':'+board.slug+':'+adapter.cacheVariant(descriptions),old=cache.get(key);
 if(old&&old.until>Date.now())return {entry:old,cached:true};const inFlight=pending.get(key);if(inFlight)return {entry:await inFlight,cached:false};
 const context=makeContext(board,budget,descriptions);
 const promise=(async()=>{const result=await adapter.load(board,context);const entry={...result,until:Date.now()+(result.complete?600000:60000),checked:context.checked,bytes:JSON.stringify(result.jobs).length*2};store(key,entry);return entry})();
 pending.set(key,promise);try{return {entry:await promise,cached:false}}finally{pending.delete(key)}
}
function fairOrder(selected:Board[]){const groups=new Map<string,Board[]>();for(const board of selected){const group=groups.get(board.platform)??[];group.push(board);groups.set(board.platform,group)}const result:Board[]=[];while(result.length<selected.length)for(const group of groups.values()){const board=group.shift();if(board)result.push(board)}return result}
async function loadSelected(selected:Board[],descriptions:boolean){
 const started=Date.now(),budget:FetchBudget={deadline:started+16000,requests:0,bytes:0};let next=0;
 const ordered=fairOrder(selected),responses:{jobs:Job[];health:BoardHealth}[]=new Array(selected.length);
 await Promise.all(Array.from({length:Math.min(descriptions?4:8,ordered.length)},async()=>{
  while(next<ordered.length){const index=next++,board=ordered[index];
   try{const {entry,cached}=await loadBoard(board,descriptions,budget);responses[index]={jobs:entry.jobs,health:{name:board.name,platform:board.platform,source:board.source,status:entry.complete?'ok':'partial',jobs:entry.jobs.length,checked:entry.checked,cached,error:entry.issues.length?entry.issues.join(' '):undefined,reportedTotal:entry.reportedTotal}}}
   catch(error){responses[index]={jobs:[],health:{name:board.name,platform:board.platform,source:board.source,status:'unavailable',jobs:0,checked:new Date().toISOString(),cached:false,retryAt:error instanceof SourceError?error.retryAt:undefined,error:error instanceof Error?(error.name==='TimeoutError'?'The feed timed out.':error.message):'Feed unavailable.'}}}
  }
 }));return {responses,metrics:{requests:budget.requests,responseBytes:budget.bytes,elapsedMs:Date.now()-started,cacheBytes:cacheBytes()}};
}
export async function checkBoards(provider?:string){return (await loadSelected(boards.filter(board=>!provider||board.platform===provider),false)).responses.map(response=>response.health)}
export async function searchBoards(input:SearchInput):Promise<SearchResult>{
 const selected=boards.filter(board=>input.platforms.includes(board.platform)),{responses,metrics}=await loadSelected(selected,input.searchDescriptions===true);
 const health=responses.map(response=>response.health),all=responses.flatMap(response=>response.jobs),matching:Job[]=[];
 for(const job of all){const match=matchJob(job,input);if(match)matching.push({...job,description:job.description.slice(0,420),match})}
 const unique=[...new Map(matching.map(job=>[job.url,job])).values()].sort((a,b)=>a.title.localeCompare(b.title));
 return {jobs:unique.slice(0,300),total:unique.length,scanned:all.length,boards:health.filter(board=>board.status!=='unavailable').length,attempted:selected.length,failed:health.filter(board=>board.status!=='ok').map(board=>board.name),checked:new Date().toISOString(),truncated:unique.length>300,health,metrics,coverage:sourceCoverage(input.platforms,boards,health),descriptions:{available:all.filter(job=>job.description).length,truncated:all.filter(job=>job.descriptionTruncated).length}};
}
