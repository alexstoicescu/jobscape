import {atsPosting, type Candidate} from './discovery';
import {plain} from './adapters/normalize';
import type {Posting} from './remote-eligibility';
import type {PostingRead} from './global-remote';

export const POSTING_LIMITS={concurrency:3,timeoutMs:6000,pageMs:18000,responseBytes:1024*1024,pageBytes:8*1024*1024,pageRequests:40,text:80000};
export type PostingBudget={deadline:number;requests:number;bytes:number};
const text=(html:string)=>html.replace(/<(script|style|form|nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<\/(?:p|li|div|h[1-6])\s*>|<br\s*\/?>/gi,'\n').split('\n').map(line=>plain(plain(line))).filter(Boolean).join('\n');
function names(value:unknown):string[]{
  if(value===undefined||value===null)return [];
  return [value].flat().flatMap(item=>{
    if(typeof item==='string')return [item];
    if(!item||typeof item!=='object')throw new Error('Unreadable applicant location metadata.');
    const v=item as {name?:unknown;address?:{addressCountry?:unknown}};
    if(typeof v.name==='string')return [v.name];
    if(typeof v.address?.addressCountry==='string')return [v.address.addressCountry];
    throw new Error('Unreadable applicant location metadata.');
  }).map(s=>s.trim()).filter(Boolean);
}
function fromJob(job:Record<string,unknown>):Posting {
  if(typeof job.description!=='string'||typeof job.title!=='string')throw new Error('Incomplete structured posting.');
  const full=text(job.description);
  const type=[job.jobLocationType].flat().filter(Boolean).map(String);
  return {title:plain(job.title),text:full.slice(0,POSTING_LIMITS.text),locations:[],requirements:names(job.applicantLocationRequirements),
    remote:type.length?type.every(t=>t.toUpperCase()==='TELECOMMUTE'):null,truncated:full.length>POSTING_LIMITS.text,method:'JobPosting JSON-LD'};
}
export function structuredPosting(html:string,card:Candidate):Posting {
  const found:Record<string,unknown>[]=[];let visited=0;
  const find=(v:unknown,depth=0)=>{
    if(!v||typeof v!=='object'||depth>8||++visited>1500)return;
    const item=v as Record<string,unknown>;
    if([item['@type']].flat().includes('JobPosting')){found.push(item);return;}
    for(const child of Object.values(item).slice(0,100))if(Array.isArray(child))child.slice(0,100).forEach(v=>find(v,depth+1));else find(child,depth+1);
  };
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    if(!/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1]))continue;
    let value;try{value=JSON.parse(match[2]);}catch{throw new Error('Malformed structured posting data.');}find(value);
  }
  if(visited>1500)throw new Error('Structured data exceeded parser bounds.');
  const matching=found.filter(job=>{
    if(typeof job.url==='string')return atsPosting(job.url,[card.platform])?.key===card.key;
    const value=(job.identifier as {value?:unknown}|undefined)?.value;
    if(typeof value==='string'||typeof value==='number')return card.key.toLowerCase().endsWith(':'+String(value).toLowerCase());
    return found.length===1&&typeof job.title==='string'&&plain(card.title).toLowerCase().includes(plain(job.title).toLowerCase());
  });
  if(matching.length!==1)throw new Error('No single identifiable full JobPosting description was found.');
  const posting=fromJob(matching[0]);
  if(posting.text.length<150)throw new Error('The structured description is too short to verify completely.');
  return posting;
}

export async function readPosting(card:Candidate,budget:PostingBudget,fetcher:typeof fetch=fetch):Promise<PostingRead>{
  const checkedAt=new Date().toISOString();let sourceUrl=card.url,method='unavailable',requests=0;
  const fail=(reason:string):PostingRead=>({reason,sourceUrl,method,checkedAt});
  if(atsPosting(card.url,[card.platform])?.key!==card.key)return fail('The original ATS posting URL could not be validated.');
  const deadline=Math.min(budget.deadline,Date.now()+POSTING_LIMITS.timeoutMs);
  const get=async(initial:string,api=false)=>{
    let url=initial;
    for(let redirects=0;redirects<=2;redirects++){
      if(Date.now()>=deadline||budget.requests>=POSTING_LIMITS.pageRequests||requests>=4)throw new Error('The bounded posting request/time budget was reached.');
      budget.requests++;requests++;
      const r=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(Math.max(1,deadline-Date.now())),headers:{Accept:api?'application/json':'text/html'}});
      if([301,302,303,307,308].includes(r.status)){
        await r.body?.cancel();const location=r.headers.get('location');
        if(!location)throw new Error('Posting redirect had no destination.');
        const next=new URL(location,url);
        if(api||redirects===2||atsPosting(next.href,[card.platform])?.key!==card.key)throw new Error('Posting redirected outside the validated ATS job.');
        url=next.href;continue;
      }
      if(!r.ok){await r.body?.cancel();throw new Error(`Posting unavailable (HTTP ${r.status}).`);}
      const contentType=r.headers.get('content-type')??'';
      if(!(api?/application\/json/i:/text\/html/i).test(contentType)){await r.body?.cancel();throw new Error('Unsupported original posting format.');}
      if(!r.body)throw new Error('Empty original posting response.');
      if(Number(r.headers.get('content-length'))>POSTING_LIMITS.responseBytes){await r.body.cancel();throw new Error('Original posting exceeds the response size limit.');}
      const reader=r.body.getReader(),decoder=new TextDecoder();let bytes=0,body='';
      try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;budget.bytes+=chunk.value.byteLength;
        if(bytes>POSTING_LIMITS.responseBytes||budget.bytes>POSTING_LIMITS.pageBytes){await reader.cancel();throw new Error('Posting response/page byte limit reached; content is incomplete.');}
        body+=decoder.decode(chunk.value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}
      if(!api)sourceUrl=url;
      return body;
    }throw new Error('Posting redirect limit reached.');
  };
  try{
    const html=await get(card.url);
    // Supplemental visible source text can veto a structured claim, but can
    // never establish a positive claim. Strip scripts/forms/navigation first.
    const visible=text(html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1]??html);
    if(/access denied|verify you are human|checking your browser|no longer accepting applications|position has been (?:filled|closed)/i.test(visible.slice(0,2000)))throw new Error('The original posting is unavailable or requires access verification.');
    let posting:Posting;
    try{posting=structuredPosting(html,card);method=posting.method;}
    catch(error){
      // Reuse Greenhouse's public single-job content format; no registry lookup
      // or whole-board retrieval. Other unrendered/unsupported pages stay Unknown.
      const url=new URL(card.url),match=url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
      if(card.platform!=='greenhouse'||!match)throw error;
      const data=JSON.parse(await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(match[1])}/jobs/${match[2]}`,true));
      if(String(data.id)!==match[2]||typeof data.content!=='string'||typeof data.title!=='string')throw new Error('The ATS detail did not identify the selected posting.');
      const full=text(data.content);if(full.length<150)throw new Error('The ATS detail is incomplete.');
      posting={title:plain(data.title),text:full.slice(0,POSTING_LIMITS.text),requirements:[],locations:[],remote:null,truncated:full.length>POSTING_LIMITS.text,method:'Greenhouse single-job API'};method=posting.method;
    }
    if(visible.length>POSTING_LIMITS.text)posting.truncated=true;
    return {posting,context:visible.slice(0,POSTING_LIMITS.text),sourceUrl,checkedAt,method};
  }catch(e){return fail(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?'The original posting exceeded its bounded read timeout.':e instanceof Error?e.message:'The original posting could not be read.');}
}
