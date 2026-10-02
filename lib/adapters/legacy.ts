import type {BoardAdapter} from './types';
import {normalizedJob,plain,isJob} from './normalize';
import type {Place} from '../geography';

export const greenhouse:BoardAdapter={
 feedUrl:(board,descriptions)=>`https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs${descriptions?'?content=true':''}`,
 cacheVariant:descriptions=>descriptions?'descriptions':'titles',
 async load(board,context){
  const data=await context.json(this.feedUrl(board,context.descriptions));
  if(!Array.isArray(data.jobs))throw new Error('The feed returned an unexpected format.');
  const jobs=data.jobs.filter((job:any)=>job.isListed!==false).map((job:any)=>normalizedJob(board,context.checked,{id:job.id,title:job.title,location:plain(job.location?.name),remote:job.isRemote,workplaceType:job.workplaceType,locations:[{label:plain(job.location?.name)},...(job.offices??[]).map((office:any)=>({label:plain(office.location)}))],url:job.absolute_url,description:job.content,published:job.updated_at,dateKind:'updated'})).filter(isJob);
  return {jobs,complete:true,issues:[]};
 },
};
export const lever:BoardAdapter={
 feedUrl:board=>`https://api.lever.co/v0/postings/${board.slug}?mode=json`,cacheVariant:()=>'',
 async load(board,context){
  const data=await context.json(this.feedUrl(board,context.descriptions));
  if(!Array.isArray(data))throw new Error('The feed returned an unexpected format.');
  const jobs=data.filter((job:any)=>job.isListed!==false).map((job:any)=>normalizedJob(board,context.checked,{id:job.id,title:job.text,locations:[...new Set([job.categories?.location,...(job.categories?.allLocations??[])].filter(Boolean))].map(label=>({label:plain(label)})),remote:job.isRemote,workplaceType:job.workplaceType,url:job.hostedUrl,description:[job.descriptionPlain,...(job.lists??[]).map((list:any)=>list.content),job.additionalPlain].filter(Boolean).join(' '),published:job.createdAt})).filter(isJob);
  return {jobs,complete:true,issues:[]};
 },
};
export const ashby:BoardAdapter={
 feedUrl:board=>`https://api.ashbyhq.com/posting-api/job-board/${board.slug}`,cacheVariant:()=>'',
 async load(board,context){
  const data=await context.json(this.feedUrl(board,context.descriptions));
  if(!Array.isArray(data.jobs))throw new Error('The feed returned an unexpected format.');
  const jobs=data.jobs.filter((job:any)=>job.isListed!==false).map((job:any)=>{
   const locations:Place[]=[{label:plain(job.location),city:job.address?.postalAddress?.addressLocality,country:job.address?.postalAddress?.addressCountry},...(job.secondaryLocations??[]).map((place:any)=>({label:plain(place.location),city:place.address?.addressLocality,country:place.address?.addressCountry}))];
   return normalizedJob(board,context.checked,{id:job.id,title:job.title,locations,remote:job.isRemote,workplaceType:job.workplaceType,url:job.jobUrl,description:job.descriptionPlain??job.descriptionHtml,published:job.publishedAt});
  }).filter(isJob);
  return {jobs,complete:true,issues:[]};
 },
};
