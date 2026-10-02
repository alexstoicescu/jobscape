import type {BoardAdapter} from './types';
import {normalizedJob,plain,isJob} from './normalize';

const PAGE_SIZE=100,MAX_PAGES=3,MAX_DETAILS=6;
const publicPosting=(job:any)=>job&&job.active!==false&&(!job.visibility||job.visibility==='PUBLIC');
export const smartrecruiters:BoardAdapter={
 feedUrl:board=>`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board.slug)}/postings?limit=${PAGE_SIZE}&offset=0`,
 cacheVariant:descriptions=>descriptions?'descriptions':'titles',
 async load(board,context){
  const root=`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board.slug)}/postings`;
  const raw:any[]=[],issues:string[]=[];let reportedTotal=0,offset=0,complete=true;
  for(let page=0;page<MAX_PAGES;page++){
   try{
    const data=await context.json(`${root}?limit=${PAGE_SIZE}&offset=${offset}`);
    if(!Array.isArray(data.content)||!Number.isInteger(data.totalFound)||data.totalFound<0||data.offset!==offset)throw new Error('Unexpected SmartRecruiters pagination payload.');
    reportedTotal=data.totalFound;
    raw.push(...data.content.slice(0,PAGE_SIZE));offset+=data.content.length;
    if(data.content.length>PAGE_SIZE){complete=false;issues.push('Source exceeded the requested page size.');break}
    if(offset>=reportedTotal)break;
    if(!data.content.length)throw new Error('The source stopped before its reported total.');
    if(page===MAX_PAGES-1){complete=false;issues.push(`Pagination capped at ${MAX_PAGES} pages / ${PAGE_SIZE*MAX_PAGES} postings; source reports ${reportedTotal}.`)}
   }catch(error){if(!page)throw error;complete=false;issues.push(error instanceof Error?error.message:'A posting page failed.');break}
  }
  const unique=[...new Map(raw.filter(publicPosting).map(job=>[String(job.id),job])).values()];
  if(context.descriptions){
   for(let index=0;index<Math.min(MAX_DETAILS,unique.length);index++){
    const job=unique[index];
    try{
     const detail=await context.json(`${root}/${encodeURIComponent(String(job.id))}`);
     if(String(detail.id)!==String(job.id)||typeof detail.name!=='string'||!detail.jobAd?.sections)throw new Error('Unexpected SmartRecruiters detail payload.');
     unique[index]={...job,...detail};
    }catch(error){complete=false;issues.push(`Detail ${job.id}: ${error instanceof Error?error.message:'unavailable'}`);break}
   }
   if(unique.length>MAX_DETAILS){complete=false;issues.push(`Descriptions are bounded to the first ${MAX_DETAILS} postings per board; others remain title-searchable.`)}
  }
  const jobs=unique.filter(publicPosting).map(job=>normalizedJob(board,context.checked,{
   id:job.id,title:job.name,
   locations:[{label:plain(job.location?.fullLocation)||[job.location?.city,job.location?.region,job.location?.country].filter(Boolean).join(', '),city:job.location?.city,country:job.location?.country}],
   remote:typeof job.location?.remote==='boolean'?job.location.remote:undefined,
   workplaceType:job.location?.hybrid===true?'hybrid':job.workplaceType,
   url:job.postingUrl??`https://jobs.smartrecruiters.com/${encodeURIComponent(board.slug)}/${encodeURIComponent(String(job.id))}`,
   description:Object.values(job.jobAd?.sections??{}).map((section:any)=>section.text).filter(Boolean).join(' '),
   published:job.releasedDate,dateKind:'published',
  })).filter(isJob);
  if(jobs.length<unique.filter(publicPosting).length){complete=false;issues.push('Some postings lack a valid stable ID, title, or public URL.');}
  return {jobs,complete,issues,reportedTotal};
 },
};
