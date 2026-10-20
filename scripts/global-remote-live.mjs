// Explicit, finite ATS-only validation. Never calls Serper or explores a board.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sourceModule} from './load-source.mjs';
const {atsPosting}=await import(sourceModule('../lib/discovery.ts'));
const {verifyGlobalPage}=await import(sourceModule('../lib/global-page.ts'));
const sources=[
 ['ashby','Events Marketing Manager','https://jobs.ashbyhq.com/chilipiper/42b0d252-7407-4dd3-ab17-825be9599a7b','restricted'],
 ['ashby','Developer Relations Engineer','https://jobs.ashbyhq.com/supabase/a1320bbf-bfae-49a8-a1b7-12eeccaf39ca','restricted'],
 ['ashby','Global Field Marketing Lead','https://jobs.ashbyhq.com/jobs.june-ai/9c3f6747-ba48-43be-a18b-257afffbf3a9','restricted'],
 ['personio','Senior Developer Relations Manager - Photonic AI (f/m/d)','https://q-ant-gmbh.jobs.personio.de/job/2579395?language=en','restricted'],
 ['greenhouse','Events Marketing Manager, EMEA','https://job-boards.greenhouse.io/customerio/jobs/8260218','restricted'],
 ['workday','Strategic Field Marketing Manager','https://crowdstrike.wd5.myworkdayjobs.com/en-US/crowdstrikecareers/job/Germany---Remote/Strategic-Field-Marketing-Manager--Remote--DEU-_R29931','unknown'],
 ['greenhouse','Director of AI Automation','https://job-boards.greenhouse.io/interdependence/jobs/5145926008','unknown'],
 ['greenhouse','Lead Scrum Master - Remote (PH)','https://job-boards.greenhouse.io/theoriamedical/jobs/4632108008','restricted'],
];
const cards=sources.map(([platform,title,url])=>({title,snippet:'',...atsPosting(url,[platform])}));
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../db/serper.sql',import.meta.url),'utf8'));
const db={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)??null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};}};
let requests=0;
const fetcher=async(url,options)=>{if(new URL(url).hostname==='google.serper.dev')throw new Error('Serper is forbidden in this validation');requests++;return fetch(url,options);};
try{
 const start=Date.now(),checked=await verifyGlobalPage(cards,db,fetcher);
 const rows=checked.map((row,i)=>({title:row.title,url:row.url,expected:sources[i][3],actual:row.globalCheck.status,reason:row.globalCheck.reason,
   method:row.globalCheck.method,checkedAt:row.globalCheck.checkedAt,sourceUrl:row.globalCheck.sourceUrl,evidencePhrases:row.globalCheck.evidence.length}));
 const result={checkedAt:new Date().toISOString(),serperRequests:0,atsRequests:requests,elapsedMs:Date.now()-start,
  falsePositives:rows.filter(r=>r.actual==='verified'&&r.expected!=='verified').length,unknown:rows.filter(r=>r.actual==='unknown').length,
  verified:rows.filter(r=>r.actual==='verified').length,restricted:rows.filter(r=>r.actual==='restricted').length,rows};
 mkdirSync('docs',{recursive:true});writeFileSync('docs/global-remote-live.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{sqlite.close();}
