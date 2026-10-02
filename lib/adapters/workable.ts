import type {BoardAdapter} from './types';
import {normalizedJob,plain,isJob} from './normalize';
import type {Place} from '../geography';
import type {Job} from '../search';

const MAX_JOBS=1000;
export const workable:BoardAdapter={
 feedUrl:board=>`https://www.workable.com/api/accounts/${encodeURIComponent(board.slug)}?details=true`,
 cacheVariant:()=>'',
 async load(board,context){
  const data=await context.json(this.feedUrl(board,context.descriptions));
  if(typeof data.name!=='string'||!Array.isArray(data.jobs))throw new Error('Unexpected Workable published-job payload.');
  const issues:string[]=[];
  if(data.jobs.length>MAX_JOBS)issues.push(`Postings capped at ${MAX_JOBS}; source returned ${data.jobs.length}.`);
  if(data.next||data.next_page||data.paging?.next)issues.push('The public endpoint reported additional pages outside its documented all-published-jobs contract; coverage is incomplete.');
  // In this public endpoint "state" is a geographic state, not SPI job status.
  const publicJobs=data.jobs.slice(0,MAX_JOBS).filter((job:any)=>job&&job.is_published!==false&&job.isListed!==false&&!['draft','closed','archived','internal'].includes(String(job.status??'').toLowerCase()));
  const jobs:Job[]=publicJobs.map((job:any)=>{
   const locations:Place[]=Array.isArray(job.locations)&&job.locations.length?job.locations.filter((place:any)=>place.hidden!==true).map((place:any)=>({label:[place.city,place.region,place.country??place.country_name??place.country_code??place.countryCode].filter(Boolean).join(', '),city:place.city,country:place.countryCode??place.country_code??place.country??place.country_name})):[{label:[job.city,job.state,job.country].filter(Boolean).join(', '),city:job.city,country:job.country_code??job.country}];
   const type=job.workplace_type??job.workplaceType??job.location?.workplace_type;
   const explicitHybrid=/[([]\s*hybrid\s*[)\]]/i.test(job.title??'');
   return normalizedJob(board,context.checked,{id:job.shortcode,title:job.title,locations,remote:typeof job.telecommuting==='boolean'?job.telecommuting:undefined,workplaceType:explicitHybrid?'hybrid':type,url:job.url??job.shortlink,description:job.description,published:job.published_on,dateKind:'published'});
  }).filter(isJob);
  if(jobs.length<publicJobs.length)issues.push('Some published jobs lack a stable shortcode, title, or original URL.');
  const merged=new Map<string,Job>();
  for(const job of jobs){const old=merged.get(job.id);if(!old){merged.set(job.id,job);continue}const locations=[...new Map([...(old.locations??[]),...(job.locations??[])].map(place=>[JSON.stringify(place),place])).values()];merged.set(job.id,{...old,locations,location:[...new Set(locations.map(place=>place.label))].join(' · ')||'Location not specified',remote:old.remote&&job.remote})}
  // The API repeats shortcodes per geographic variant; merge all listed places.
  return {jobs:[...merged.values()],complete:!issues.length,issues};
 },
};
