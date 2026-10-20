import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {sourceModule} from './load-source.mjs';
import ts from 'typescript';
import vm from 'node:vm';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const {strictGlobal}=await import(sourceModule('../lib/global-remote.ts'));
const {readPosting,structuredPosting,POSTING_LIMITS}=await import(sourceModule('../lib/posting-reader.ts'));
const {verifyGlobalPage}=await import(sourceModule('../lib/global-page.ts'));
const {discovery}=await import(sourceModule('../lib/serper.ts'));
const {atsPosting,globalCounts}=await import(sourceModule('../lib/discovery.ts'));
const discoveryUi=await import(sourceModule('../lib/discovery.ts')),searchUi=await import(sourceModule('../lib/search.ts'));
const checkedAt=new Date().toISOString(),base={title:'Events Manager',locations:[],requirements:[],remote:true,truncated:false,method:'fixture'};
const inspect=(text,extra={})=>strictGlobal({posting:{...base,text,...extra},sourceUrl:'https://jobs.ashbyhq.com/fixture/'+randomUUID(),method:'synthetic fixture',checkedAt});
const affirmative='This fully remote position is open to applicants worldwide.';
const cases=[
 ['explicit worldwide',affirmative,'verified'],
 ['no remote metadata',affirmative,'verified',{remote:null}],
 ['US only','This remote role is open to US applicants only.','restricted'],
 ['EU remote','Remote EU.','restricted'],
 ['EMEA remote','Remote EMEA.','restricted'],
 ['lowercase US restriction',affirmative+' Remote us only.','restricted'],
 ['lowercase EU restriction',affirmative+' Remote eu.','restricted'],
 ['25 countries',affirmative+' We hire in 25 named countries.','restricted'],
 ['named allowlist',affirmative,'restricted',{requirements:['Germany','France']}],
 ['generic remote','This is a remote role with a collaborative team.','unknown'],
 ['generic worldwide company','We are a worldwide company with global customers. We hire globally.','unknown'],
 ['global company US residents',affirmative+' Our global company only hires US residents.','restricted'],
 ['hybrid',affirmative+' This role is hybrid.','restricted'],
 ['hybrid header',affirmative+'\nHybrid in Berlin.','unknown'],
 ['mandatory office',affirmative+' You must attend the office weekly.','restricted'],
 ['office days',affirmative+' Work in the office 3 days per week.','restricted'],
 ['contradictory US',affirmative+' Candidates must reside in the US.','restricted'],
 ['worldwide with exclusions',affirmative+' We cannot hire in France.','restricted'],
 ['standalone exclusion',affirmative+' Except in North Korea.','restricted'],
 ['hiring regions label',affirmative+' Hiring regions: US, Canada.','restricted'],
 ['allowed countries label',affirmative+' Eligible countries: Germany, France.','restricted'],
 ['unmapped locality limit',affirmative+' We only hire from Bavaria.','restricted'],
 ['office attendance required',affirmative+' Office attendance is required.','restricted'],
 ['mandatory office presence',affirmative+' Mandatory office presence.','restricted'],
 ['Americas',affirmative+' Work from anywhere in the Americas.','restricted'],
 ['timezone allowed',affirmative+' Must overlap four working hours with US Eastern Time.','verified'],
 ['timezone plus residence',affirmative+' Candidates must reside in France and overlap with CET.','restricted'],
 ['timezone plus US only',affirmative+' Remote US only, with EST overlap.','restricted'],
 ['timezone plus France only',affirmative+' Remote France only, with CET overlap.','restricted'],
 ['timezone core hours only',affirmative+' Must overlap US Eastern business hours only.','verified'],
 ['not fully remote',affirmative+' This role is not fully remote.','restricted'],
 ['must be in US',affirmative+' You must be in the US.','restricted'],
 ['must work from London',affirmative+' You must work from London.','restricted'],
 ['same-clause city overrides marketing',affirmative+' You must be based in London, despite our worldwide team.','restricted'],
 ['anywhere within a region',affirmative+' You must live anywhere in the Americas.','restricted'],
 ['HQ irrelevant',affirmative+' Our headquarters is in the US.','verified'],
 ['office metadata irrelevant',affirmative,'verified',{locations:['United States']}],
 ['telecommute alone','Join our worldwide company.','unknown'],
 ['no applicant requirements alone','Fully remote job.','unknown',{requirements:[]}],
 ['universal applicant field','A fully remote position building useful products.','verified',{requirements:['Worldwide']}],
 ['ambiguous applicant field',affirmative,'unknown',{requirements:['Unknown location scope']}],
 ['conditional worldwide','We may hire worldwide for this remote role.','unknown'],
 ['negated worldwide','This fully remote role is not available worldwide.','unknown'],
 ['empty description','','unknown'],
 ['truncated description',affirmative,'unknown',{truncated:true}],
 ['nonremote metadata',affirmative,'restricted',{remote:false}],
 ['title is not scope','Work with an experienced team.','unknown',{title:'Global Remote Worldwide Events Manager'}],
];
let falsePositives=0;
for(const [name,text,expected,extra] of cases){const actual=inspect(text,extra).status;if(actual==='verified'&&expected!=='verified')falsePositives++;assert.equal(actual,expected,name);}
assert.ok(inspect(affirmative+' Must overlap four hours with US Eastern Time.').restrictions.some(s=>s.includes('overlap')));
// Literal source excerpts previously read in the authenticated benchmark, not
// fabricated listings or full production descriptions. URL/date aid human review.
const real=[
 {url:'https://jobs.ashbyhq.com/chilipiper/42b0d252-7407-4dd3-ab17-825be9599a7b',text:'CURRENTLY ONLY HIRING FOR THIS ROLE IN CANADA AND THE US',requirements:[]},
 {url:'https://jobs.ashbyhq.com/supabase/a1320bbf-bfae-49a8-a1b7-12eeccaf39ca',text:'We hire globally. This role requires being based in San Francisco.',requirements:['United States']},
 {url:'https://job-boards.greenhouse.io/customerio/jobs/8260218',text:'Based in the UK or Ireland (London or Dublin ideal)',requirements:[]},
];
for(const row of real)assert.equal(strictGlobal({posting:{...base,text:row.text,requirements:row.requirements},sourceUrl:row.url,method:'2026-10-20 source excerpt',checkedAt}).status,'restricted',row.url);
const filler='You will build effective programs, coordinate delivery, document decisions, and work with your colleagues on projects. The role involves planning, communication and evaluation of outcomes. ';
const card=(id=randomUUID())=>{const url='https://jobs.ashbyhq.com/fixture/'+id;return {title:'Events Manager',snippet:'Remote worldwide (untrusted search text)',...atsPosting(url,['ashby'])};};
const html=(c,description=affirmative,metadata={},extra='')=>'<html><body>'+extra+'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Events Manager',identifier:{value:c.url.split('/').at(-1)},description:'<p>'+description+'</p><p>'+filler+'</p>',jobLocationType:'TELECOMMUTE',...metadata})+'</script></body></html>';
const response=(body,status=200,headers={})=>new Response(body,{status,headers:{'Content-Type':'text/html',...headers}});
const budget=()=>({deadline:Date.now()+POSTING_LIMITS.pageMs,requests:0,bytes:0});
const c=card();
assert.equal(structuredPosting(html(c),c).requirements.length,0);
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response(html(c)))).status,'verified');
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response(html(c,affirmative,{},'<p>Candidates must reside in the US.</p>')))).status,'restricted','Visible role restriction vetoes JSON-LD');
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response(html(c,affirmative,{applicantLocationRequirements:{name:'France'}})))).status,'restricted');
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response('Verify you are human'))).status,'unknown');
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response('',403))).status,'unknown');
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response('<p>No structured job appeared.</p>'))).status,'unknown');
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response(html(c,affirmative+'x'.repeat(POSTING_LIMITS.text))))).status,'unknown');
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>{throw new DOMException('timeout','TimeoutError');})).status,'unknown');
let redirects=0;
for(const destination of ['http://127.0.0.1/private','https://jobs.ashbyhq.com.evil.example/a','https://jobs.ashbyhq.com/fixture/'+randomUUID()]){
 const outcome=await readPosting(c,budget(),async()=>{redirects++;return response('',302,{Location:destination});});assert.equal(strictGlobal(outcome).status,'unknown');
}assert.equal(redirects,3,'Unvalidated redirects were never fetched');
let invalidCalls=0;await readPosting({...c,url:'https://127.0.0.1/job'},budget(),async()=>{invalidCalls++;return response('');});assert.equal(invalidCalls,0);
assert.equal(strictGlobal(await readPosting(c,budget(),async()=>response('x'.repeat(POSTING_LIMITS.responseBytes+1)))).status,'unknown');
const expired=budget();expired.deadline=0;assert.equal(strictGlobal(await readPosting(c,expired,async()=>{throw new Error('must not fetch');})).status,'unknown');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../db/serper.sql',import.meta.url),'utf8'));
const db={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)??null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},async batch(statements){const out=[];for(const s of statements)out.push(await s.run());return out;}};
try{
 let concurrent=0,peak=0,reads=0;
 const cards=Array.from({length:8},()=>card());
 const bounded=async url=>{reads++;concurrent++;peak=Math.max(peak,concurrent);await new Promise(resolve=>setImmediate(resolve));concurrent--;return response(html(cards.find(c=>c.url===url)));};
 const checks=await verifyGlobalPage(cards,db,bounded);assert.equal(checks.length,8);assert.equal(peak,3);assert.equal(reads,8);
 await verifyGlobalPage(cards,db,bounded);assert.equal(reads,8,'Descriptions cache across page checks');
 let providerCalls=0,postingCalls=0;
 const a=card(),b=card(),unknown=card(),more=card();
 const fetcher=async(url,options)=>{
   if(url==='https://google.serper.dev/search'){providerCalls++;const p=JSON.parse(options.body);return Response.json({credits:1,organic:(p.page===1?[a,b,unknown]:[a,more]).map(c=>({title:c.title,link:c.url,snippet:c.snippet})),searchParameters:{q:p.q}});}
   postingCalls++;const current=[a,b,unknown,more].find(c=>c.url===url);if(current===unknown)return response('Inaccessible description',403);
   return response(html(current,current===b?'This remote role is available in the US only.':affirmative));
 };
 const spec={input:{keywords:'events',location:'',remote:true,platforms:['ashby']},region:'Global'};
 const env={JOBSCAPE_DISCOVERY:'serper',SERPER_API_KEY:'fixture-only',SERPER_DB:db};
 const session=randomUUID(),first=await discovery({session,page:1,spec},env,fetcher);
 assert.equal(providerCalls,1);assert.equal(postingCalls,3);assert.equal(first.results.length,1);assert.ok(first.results.every(c=>c.globalCheck.status==='verified'));
 assert.deepEqual(globalCounts(first.globalReview),{verified:1,restricted:1,unverified:1});
 // Render the real component with deliberately mixed/stale card state. Even
 // then, restricted/unknown candidates must appear only in separate disclosures.
 const component=ts.transpileModule(readFileSync(new URL('../components/discovery-search.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const states=[spec.input,'Global','/',false,false,'',first.globalReview,first.globalReview,first,spec,true];let hook=0;
 const exports={};vm.runInNewContext(component,{exports,URL,require:name=>name==='react'?{...React,useState:()=>[states[hook++],()=>{}],useRef:value=>({current:value}),useEffect:()=>{},useLayoutEffect:()=>{}}:
   name==='react/jsx-runtime'?jsxRuntime:name==='@/lib/discovery'?discoveryUi:name==='@/lib/search'?searchUi:name==='lucide-react'?Object.fromEntries(['Search','MapPin','SlidersHorizontal','ExternalLink','LoaderCircle','BriefcaseBusiness'].map(k=>[k,()=>null])):name.includes('checkbox')?{Checkbox:()=>null}:{ThemeToggle:()=>null}});
 const markup=renderToStaticMarkup(exports.default({enabled:true}));
 assert.equal((markup.match(/<article\b/g)??[]).length,1,'Only verified cards render in the main list');
 assert.ok(markup.includes('Verified Global: 1. Restricted or not fully remote: 1. Unverified: 1.'));
 const next=await discovery({session,page:2,spec:{...spec,region:'All'}},env,fetcher);
 assert.equal(providerCalls,2);assert.equal(postingCalls,4);assert.equal(next.results.length,1);assert.equal(next.duplicates,1);assert.equal(next.query,first.query);
 const replay=await discovery({session:randomUUID(),page:1,spec},env,fetcher);assert.equal(providerCalls,2);assert.equal(postingCalls,4);assert.equal(replay.usage.request,0);
 // Old PR #15 session payloads must never bypass the new Global gate.
 const old={...first,results:[b]};delete old.globalReview;delete old.globalPolicy;
 sqlite.prepare('UPDATE discovery_requests SET response=? WHERE session=? AND page=1').run(JSON.stringify(old),session);
 assert.equal((await discovery({session,page:1,spec},env,fetcher)).results.length,0);
 // Zero verified positions is not exhaustion when new raw results exist.
 const none={...spec,input:{...spec.input,keywords:'field marketing',wholePageKeywords:true}};
 const zero=await discovery({session:randomUUID(),page:1,spec:none},env,async(url,options)=>url==='https://google.serper.dev/search'?Response.json({organic:[{title:'Field Marketing',link:b.url}],credits:1}):fetcher(url,options));
 assert.equal(zero.results.length,0);assert.equal(zero.hasMore,true);assert.equal(zero.globalReview[0].globalCheck.status,'restricted');
 console.log(`Strict Global checks passed: ${cases.length} classification fixtures, 3 real-source excerpts, SSRF/redirect/timeout/size bounds, concurrency/cache, strict API results/counts, unchanged query, pagination and legacy replay. False positives: ${falsePositives}; synthetic Unknowns: ${cases.filter(c=>c[2]==='unknown').length}. No live Serper calls.`);
}finally{sqlite.close();}
