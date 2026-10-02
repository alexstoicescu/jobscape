import type {BoardAdapter} from './types';
import {normalizedJob,isJob} from './normalize';
import {parseXml,children,field,nodeText} from './xml';
import type {Job} from '../search';

const MAX_POSITIONS=1000;
export const personio:BoardAdapter={
 feedUrl:board=>`https://${board.slug}.jobs.personio.${board.domain??'de'}/xml?language=${encodeURIComponent(board.locale??'en')}`,
 cacheVariant:()=>'',
 async load(board,context){
  const root=parseXml(await context.text(this.feedUrl(board,context.descriptions)));
  if(root.name!=='workzag-jobs'||root.children.some(node=>node.name!=='position')||root.parts.some(part=>typeof part==='string'&&part.trim()))throw new Error('Unexpected Personio jobs XML root or position shape; feed may be disabled or migrated.');
  const positions=children(root,'position'),issues:string[]=[];
  if(positions.length>MAX_POSITIONS)issues.push(`Positions capped at ${MAX_POSITIONS}; source returned ${positions.length}.`);
  const publicPositions=positions.slice(0,MAX_POSITIONS).filter(position=>!['false','0'].includes(field(position,'published').toLowerCase())&&!['draft','closed','archived','internal'].includes(field(position,'status').toLowerCase()));
  const jobs=publicPositions.map(position=>{
   const id=field(position,'id'),title=field(position,'name'),office=field(position,'office');
   if(!/^\d+$/.test(id))return null;
   const offices=[office,...children(position,'additionalOffices').flatMap(group=>children(group,'office').map(node=>nodeText(node).trim()))].filter(Boolean);
   const descriptions=children(position,'jobDescriptions').flatMap(group=>children(group,'jobDescription').map(section=>[field(section,'name'),field(section,'value')].filter(Boolean).join(' '))).join(' ');
   const type=field(position,'workplaceType')||(/\bhybrid\b/i.test(office)||/[([]\s*hybrid\s*[)\]]/i.test(title)?'hybrid':'');
   // createdAt describes position creation, not publication. Keep dates unknown.
   return normalizedJob(board,context.checked,{id,title,locations:offices.map(label=>({label})),workplaceType:type,url:`https://${board.slug}.jobs.personio.${board.domain??'de'}/job/${id}?language=${encodeURIComponent(board.locale??'en')}`,description:descriptions});
  }).filter(isJob);
  if(jobs.length<publicPositions.length)issues.push('Some public positions lack a stable numeric ID or title.');
  const merged=new Map<string,Job>();
  for(const job of jobs){const old=merged.get(job.id);if(!old){merged.set(job.id,job);continue}const locations=[...new Map([...(old.locations??[]),...(job.locations??[])].map(place=>[JSON.stringify(place),place])).values()];merged.set(job.id,{...old,locations,location:[...new Set(locations.map(place=>place.label))].join(' · '),remote:old.remote&&job.remote})}
  return {jobs:[...merged.values()],complete:!issues.length,issues};
 },
};
