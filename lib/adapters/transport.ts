import type {Board} from '../registry';
import type {AdapterContext} from './types';
export const MAX_REQUESTS=48, MAX_BOARD_REQUESTS=9, MAX_RESPONSE_BYTES=16*1024*1024, MAX_SEARCH_BYTES=64*1024*1024;
export type FetchBudget={deadline:number;requests:number;bytes:number};
const cooldown=new Map<string,number>();
export class SourceError extends Error{constructor(message:string,public retryAt?:string){super(message)}}
export function makeContext(board:Board,budget:FetchBudget,descriptions:boolean):AdapterContext{
 const deadline=Math.min(budget.deadline,Date.now()+9000),key=board.platform+':'+board.slug;let boardRequests=0;
 const remainingRequests=()=>Math.max(0,Math.min(MAX_REQUESTS-budget.requests,MAX_BOARD_REQUESTS-boardRequests));
 async function text(initialUrl:string):Promise<string>{
  let url=initialUrl;
  for(let redirects=0;redirects<=2;redirects++){
   const retry=cooldown.get(key);if(retry&&retry>Date.now())throw new SourceError('Source cooling down after rate limiting.',new Date(retry).toISOString());if(retry)cooldown.delete(key);
   if(!remainingRequests())throw new SourceError('Request budget reached; coverage is incomplete.');
   if(budget.bytes>=MAX_SEARCH_BYTES)throw new SourceError('Response memory budget reached; coverage is incomplete.');
   const remaining=deadline-Date.now();if(remaining<=0)throw new SourceError('Search time budget reached. Retry this board.');
   budget.requests++;boardRequests++;
   const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(remaining),headers:{Accept:'application/json, application/xml, text/xml'}});
   if([301,302,303,307,308].includes(response.status)){
    await response.body?.cancel();const next=new URL(response.headers.get('location')??'',url),host=new URL(initialUrl).hostname;
    if(next.protocol!=='https:'||!(next.hostname===host||board.platform==='workable'&&next.hostname==='apply.workable.com'))throw new SourceError('Feed redirected outside its provider; check whether it is disabled or migrated.');
    if(redirects===2)throw new SourceError('The feed redirected too many times.');url=next.href;continue;
   }
   if(!response.ok){
    await response.body?.cancel();let retryAt:string|undefined;const after=response.headers.get('retry-after');
    if(after||response.status===429){const parsed=after&&/^\d+(\.\d+)?$/.test(after)?Date.now()+Number(after)*1000:after?Date.parse(after):Date.now()+60000;const until=Number.isFinite(parsed)?Math.max(Date.now()+1000,parsed):Date.now()+60000;cooldown.set(key,until);retryAt=new Date(until).toISOString()}
    const explanation=response.status===401?'employer credentials required':response.status===403?'public access denied':response.status===429?'rate limited':response.status===404?'check whether the feed is disabled or migrated':'';
    throw new SourceError(`HTTP ${response.status}${explanation?'; '+explanation:''}`,retryAt);
   }
   if(!response.body)return '';
   if(Number(response.headers.get('content-length'))>MAX_RESPONSE_BYTES){await response.body.cancel();throw new SourceError('Feed exceeds the response size limit; coverage is incomplete.')}
   const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0;const chunks:string[]=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;budget.bytes+=value.byteLength;if(bytes>MAX_RESPONSE_BYTES||budget.bytes>MAX_SEARCH_BYTES){await reader.cancel();throw new SourceError('Response memory budget reached; coverage is incomplete.')}chunks.push(decoder.decode(value,{stream:true}))}chunks.push(decoder.decode());return chunks.join('')}finally{reader.releaseLock()}
  }throw new SourceError('The feed could not be loaded.');
 }
 return {descriptions,checked:new Date().toISOString(),text,json:async url=>{try{return JSON.parse(await text(url))}catch(error){if(error instanceof SyntaxError)throw new SourceError('The feed returned malformed JSON.');throw error}},remainingRequests};
}
