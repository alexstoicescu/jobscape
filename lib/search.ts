import {locationMatch, normalizeText, type Place, type LocationMatch} from './geography';
export const platforms = [
 {id:'greenhouse',name:'Greenhouse',domains:['boards.greenhouse.io','job-boards.greenhouse.io'],live:true},
 {id:'lever',name:'Lever',domains:['jobs.lever.co','jobs.eu.lever.co'],live:true},
 {id:'ashby',name:'Ashby',domains:['jobs.ashbyhq.com'],live:true},
 {id:'workday',name:'Workday',domains:['myworkdayjobs.com'],live:false},
 {id:'smartrecruiters',name:'SmartRecruiters',domains:['jobs.smartrecruiters.com'],live:false},
 {id:'workable',name:'Workable',domains:['apply.workable.com'],live:false},
 {id:'recruitee',name:'Recruitee',domains:['recruitee.com'],live:false},
 {id:'personio',name:'Personio',domains:['jobs.personio.de','jobs.personio.com'],live:false},
 {id:'icims',name:'iCIMS',domains:['icims.com'],live:false},
 {id:'jobvite',name:'Jobvite',domains:['jobs.jobvite.com'],live:false},
 {id:'breezy',name:'Breezy HR',domains:['breezy.hr'],live:false},
 {id:'jazzhr',name:'JazzHR',domains:['applytojob.com'],live:false},
 {id:'taleo',name:'Taleo',domains:['taleo.net'],live:false},
 {id:'bamboohr',name:'BambooHR',domains:['bamboohr.com/careers'],live:false},
 {id:'teamtailor',name:'Teamtailor',domains:['teamtailor.com/jobs'],live:false},
 {id:'paylocity',name:'Paylocity',domains:['recruiting.paylocity.com'],live:false},
 {id:'adp',name:'ADP',domains:['workforcenow.adp.com'],live:false},
 {id:'successfactors',name:'SAP SuccessFactors',domains:['jobs2web.com','successfactors.com'],live:false}
];
export type SearchInput = {keywords:string;location:string;remote:boolean;platforms:string[];expandTitles?:boolean;searchDescriptions?:boolean;includeUnknownRemote?:boolean};
export type MatchReason = {field:'title'|'description';term:string;alias:boolean;snippet?:string;location:LocationMatch};
export type Job = {id:string;title:string;company:string;location:string;locations?:Place[];remote:boolean;url:string;platform:string;description:string;descriptionTruncated?:boolean;published:string|null;dateKind:'published'|'updated'|null;checked:string;match?:MatchReason};
export type BoardHealth = {name:string;platform:string;source:string;status:'ok'|'partial'|'unavailable';jobs:number;checked:string;cached:boolean;error?:string;reportedTotal?:number;retryAt?:string};
export type SearchResult = {jobs:Job[];total:number;scanned:number;boards:number;attempted:number;failed:string[];checked:string;truncated:boolean;health?:BoardHealth[];coverage?:import('./coverage').SourceCoverage[];metrics?:{requests:number;responseBytes:number;elapsedMs:number;cacheBytes:number};descriptions?:{available:number;truncated:number}};
export function terms(value:string){return value.split(/\s+OR\s+|,/i).map(x=>x.replace(/["“”]/g,'').trim()).filter(Boolean).slice(0,8)}
const titleAliases=[
 ['devrel','developer relations','developer advocate','dev advocate'],
 ['sre','site reliability engineer','site reliability engineering'],
 ['software engineer','software developer'],
 ['frontend','front end','front-end'],['backend','back end','back-end'],
 ['qa','quality assurance'],['ml','machine learning'],['ux','user experience'],['dx','developer experience'],
];
export function expandedTerms(input:SearchInput){
 const result:{term:string;alias:boolean}[]=terms(input.keywords).map(term=>({term,alias:false}));
 for(const original of terms(input.keywords)){
  if(input.expandTitles===false)continue;
  const normalized=normalizeText(original);
  for(const group of titleAliases){
   const alias=group.find(value=>(' '+normalized+' ').includes(' '+normalizeText(value)+' '));
   if(!alias)continue;
   const phrase=normalizeText(alias);
   for(const replacement of group){
    const next=(' '+normalized+' ').replace(' '+phrase+' ',' '+replacement+' ').trim();
    if(!result.some(value=>normalizeText(value.term)===normalizeText(next)))result.push({term:next,alias:true});
   }
  }
 }
 return result.slice(0,40);
}
export function googleQuery(input:SearchInput, ids=input.platforms){
 const domains=platforms.filter(p=>ids.includes(p.id)).flatMap(p=>p.domains);
 const quote=(s:string)=>'"'+s.replace(/["“”]/g,'').trim()+'"';
 const roles=[...new Set(expandedTerms(input).map(value=>value.term))].map(quote);
 return [domains.length?'('+domains.map(d=>'site:'+d).join(' OR ')+')':'',roles.length?'('+roles.join(' OR ')+')':'',input.location.trim()?quote(input.location):'',input.remote?'("remote" OR "work from home" OR "distributed")':''].filter(Boolean).join(' ');
}
export function googleUrl(input:SearchInput,ids=input.platforms){return 'https://www.google.com/search?'+new URLSearchParams({q:googleQuery(input,ids)})}
export function validateInput(value:unknown):SearchInput{
 if(!value||typeof value!=='object')throw new Error('Enter a job title or keyword.');
 const v=value as Record<string,unknown>;
 if(typeof v.keywords!=='string'||!terms(v.keywords).some(term=>normalizeText(term).length)||v.keywords.length>180)throw new Error('Enter keywords up to 180 characters.');
 if(typeof v.location!=='string'||v.location.length>100||typeof v.remote!=='boolean')throw new Error('Check the location and remote filter.');
 if(!Array.isArray(v.platforms)||!v.platforms.length||v.platforms.some(p=>!platforms.some(x=>x.id===p)))throw new Error('Select at least one ATS platform.');
 for(const option of ['expandTitles','searchDescriptions','includeUnknownRemote'])if(v[option]!==undefined&&typeof v[option]!=='boolean')throw new Error('Check the search options.');
 return {keywords:v.keywords.trim(),location:v.location.trim(),remote:v.remote,platforms:[...new Set(v.platforms)] as string[],expandTitles:v.expandTitles!==false,searchDescriptions:v.searchDescriptions===true,includeUnknownRemote:v.includeUnknownRemote===true};
}
const hasWords=(text:string,term:string)=>normalizeText(term).split(/\s+/).every(word=>word.length<=3?(' '+normalizeText(text)+' ').includes(' '+word+' '):normalizeText(text).includes(word));
export function matchJob(job:Job,input:SearchInput):MatchReason|null{
 if(input.remote&&!job.remote)return null;
 const location=locationMatch(job,input.location);
 if(location==='none'||location!=='listed'&&!(input.remote&&job.remote&&input.includeUnknownRemote))return null;
 const alternatives=expandedTerms(input);
 const title=alternatives.find(value=>hasWords(job.title,value.term));
 if(title)return {field:'title',...title,location};
 if(!input.searchDescriptions||!job.description)return null;
 const description=alternatives.find(value=>hasWords(job.description,value.term));
 if(!description)return null;
 const word=normalizeText(description.term).split(' ').find(word=>word.length>3)??description.term;
 const offset=Math.max(0,job.description.toLowerCase().indexOf(word)-65);
 return {field:'description',...description,location,snippet:(offset?'…':'')+job.description.slice(offset,offset+220)+(offset+220<job.description.length?'…':'')};
}
export function matches(job:Job,input:SearchInput){return matchJob(job,input)!==null}
