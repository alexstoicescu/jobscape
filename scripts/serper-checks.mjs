import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, mkdirSync, unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {sourceModule} from './load-source.mjs';
const {discovery, fetchSerper, candidatePage, limits} = await import(sourceModule('../lib/serper.ts'));
const {atsPosting, appendCandidates} = await import(sourceModule('../lib/discovery.ts'));
const {googleQuery, terms, validateInput} = await import(sourceModule('../lib/search.ts'));
const sql=readFileSync(new URL('../db/serper.sql',import.meta.url),'utf8');
// Real SQLite statement execution, two connections to one durable file; no fake counters.
mkdirSync(new URL('../outputs/',import.meta.url),{recursive:true});
const file=new URL('../outputs/serper-test-'+randomUUID()+'.sqlite',import.meta.url);
const a=new DatabaseSync(file);a.exec(sql);const b=new DatabaseSync(file);
const wrap=sqlite=>({prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)??null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}});
const db=wrap(a),other=wrap(b);
const env={JOBSCAPE_DISCOVERY:'serper',SERPER_API_KEY:'mock-server-only-key',SERPER_DB:db};
const input={keywords:'events, field marketing',location:'',remote:true,platforms:['ashby','lever','greenhouse'],expandTitles:true};
const spec={input,region:'All'};
const url='https://jobs.ashbyhq.com/employer/42b0d252-7407-4dd3-ab17-825be9599a7b';
const second='https://jobs.ashbyhq.com/employer/a1320bbf-bfae-49a8-a1b7-12eeccaf39ca';
let calls=[];
const provider=async(_url,options)=>{assert.equal(options.redirect,'manual','Worker supports manual/follow only; never forward credentials through a redirect');const body=JSON.parse(options.body);calls.push(body);return Response.json({organic:[{title:'Events Marketing Manager',link:url,snippet:'Mock fixture only'},{title:'Field Marketing Lead',link:body.page===1?url+'?utm_source=test':second}],credits:1,searchParameters:{q:body.q}});};
const request=(session=randomUUID(),page=1,s=spec)=>({session,page,spec:s});
const rejects=(fn,code)=>assert.rejects(fn,e=>e.code===code);
try {
  assert.deepEqual(terms('"community, events" OR "ecosystem OR partnerships", field marketing'),['community, events','ecosystem OR partnerships','field marketing']);
  const quoted=googleQuery({...input,keywords:'"community, events" OR "customer programs"',expandTitles:false});
  assert.ok(quoted.includes('intitle:"community, events" OR intitle:"customer programs"'));
  assert.throws(()=>validateInput({...input,keywords:'a,b,c,d,e,f,g,h,i'}),/eight/);
  for(const keywords of ['events, field marketing','developer relations, developer advocate','partnerships, ecosystem']){
    const q=googleQuery({...input,keywords});
    assert.ok(q.includes('site:jobs.ashbyhq.com'));assert.ok(q.includes('intitle:'));
    for(const term of terms(keywords))assert.ok(q.includes('"'+term+'"'));
  }
  assert.equal(atsPosting(url+'?utm_source=x',['ashby']).url,url+'?utm_source=x','Original application URL is preserved');
  assert.equal(atsPosting(url,['ashby']).key,atsPosting(url+'?utm_source=x#anchor',['ashby']).key);
  for(const invalid of ['https://jobs.ashbyhq.com/employer','https://jobs.ashbyhq.com/employer/',
    'https://jobs.ashbyhq.com.evil.example/employer/id','https://evil.example/job/123',
    'http://jobs.ashbyhq.com/employer/id','javascript:alert(1)','https://user@jobs.ashbyhq.com/employer/id',
    'https://jobs.ashbyhq.com:8443/employer/id','https://jobs.lever.co/company'])assert.equal(atsPosting(invalid,input.platforms),null,invalid);
  assert.equal(atsPosting(url,['lever']),null);
  assert.equal(atsPosting('https://job-boards.greenhouse.io/acme/jobs/123',['greenhouse']).key,'greenhouse:acme:123');
  assert.equal(atsPosting('https://company.jobs.personio.de/job/123?language=en',['personio']).platform,'personio');
  assert.equal(atsPosting('https://company.wd5.myworkdayjobs.com/en-US/Careers/job/Berlin/Title_R123',['workday']).key,
    atsPosting('https://company.wd5.myworkdayjobs.com/de-DE/Careers/job/Berlin/Title_R123',['workday']).key);
  const req=request(),first=await discovery(req,env,provider);
  assert.equal(first.results.length,1);assert.equal(first.duplicates,1);assert.equal(first.usage.request,1);assert.ok(first.hasMore);
  const next=await discovery({session:req.session,page:2,spec:{...spec,input:{...input,keywords:'edited'}}},env,provider);
  assert.equal(calls[0].q,calls[1].q);assert.equal(next.query,first.query);assert.equal(next.results.length,1);
  assert.equal(appendCandidates(first.results,next.results).length,2);
  assert.equal(appendCandidates(first.results,first.results).length,1);
  assert.equal((await discovery(req,env,provider)).usage.request,0);assert.equal(calls.length,2,'Duplicate page uses saved response');
  const cached=await discovery(request(),{...env,SERPER_DB:other},provider);
  assert.ok(cached.usage.cached);assert.equal(cached.usage.request,0);assert.equal(calls.length,2);
  const filtered=candidatePage({organic:[{title:'Backend Integration Engineer',link:second}],credits:1},spec,[]);
  assert.equal(filtered.results.length,0);assert.equal(filtered.exhausted,false,'Zero title matches is not exhaustion');
  assert.equal(candidatePage({organic:[],credits:1},spec,[]).exhausted,true);
  assert.equal(candidatePage({organic:[{title:'Events',link:url}],credits:1},spec,[atsPosting(url,input.platforms).key]).exhausted,true);
  // Known semantic limitation is preserved, not broadened into title matching work.
  assert.equal(candidatePage({organic:[{title:'Event-driven Platform Engineer',link:url}],credits:1},spec,[]).results.length,1);
  const blockedFetcher=()=>{throw new Error('must never reach provider');};
  await rejects(()=>discovery(request(),{...env,JOBSCAPE_DISCOVERY:'off'},blockedFetcher),'disabled');
  await rejects(()=>discovery(request(),{...env,SERPER_API_KEY:''},blockedFetcher),'missing_key');
  await rejects(()=>discovery(request(),{...env,SERPER_DB:undefined},blockedFetcher),'usage_store');
  await rejects(()=>discovery(request(),{...env,SERPER_SEARCH_LIMIT:'0'},blockedFetcher),'search_limit');
  assert.throws(()=>limits({...env,SERPER_DAILY_LIMIT:'not a number'}),/configured/);
  await rejects(()=>discovery({...req,page:4},env,blockedFetcher),'page_order');
  await rejects(()=>discovery(request(req.session,1,{...spec,region:'EU'}),env,blockedFetcher),'input');
  await rejects(()=>fetchSerper('q',1,'secret',async()=>{throw new DOMException('timeout','TimeoutError');}),'provider_timeout');
  for(const [status,code] of [[402,'provider_quota'],[429,'provider_quota'],[401,'provider_auth'],[403,'provider_auth'],[500,'provider_failed']]){
    await rejects(()=>fetchSerper('q',1,'secret',async()=>new Response('secret must not escape',{status})),code);
  }
  await rejects(()=>fetchSerper('q',1,'secret',async()=>Response.json({message:'Not enough credits'},{status:403})),'provider_quota');
  await rejects(()=>fetchSerper('q',1,'secret',async()=>Response.json({images:[]})),'provider_format');
  await rejects(()=>fetchSerper('q',1,'secret',async()=>new Response('not json')),'provider_format');
  await rejects(()=>fetchSerper('q',1,'secret',async()=>Response.json({organic:[],searchParameters:{q:'changed'}})),'provider_format');
  assert.deepEqual((await fetchSerper('q',1,'secret',async()=>Response.json({organic:[],credits:1}))).organic,[]);
  // Concurrent requests on separate connections compete for the LAST daily/global slot.
  a.exec('DELETE FROM discovery_cache; DELETE FROM discovery_requests; DELETE FROM discovery_sessions;');
  const capped={...env,SERPER_DAILY_LIMIT:'1',SERPER_MONTHLY_LIMIT:'1',SERPER_TOTAL_LIMIT:'1'};
  let release,started;const gate=new Promise(resolve=>{release=resolve;}),reserved=new Promise(resolve=>{started=resolve;});let concurrentCalls=0;
  const delayed=async(...args)=>{concurrentCalls++;started();await gate;return provider(...args);};
  const one=discovery(request(),capped,delayed);
  await reserved;
  await rejects(()=>discovery(request(),{...capped,SERPER_DB:other},delayed),'quota_exhausted');
  release();await one;
  assert.equal(concurrentCalls,1);
  for(const which of ['SERPER_DAILY_LIMIT','SERPER_MONTHLY_LIMIT','SERPER_TOTAL_LIMIT']) {
    await rejects(()=>discovery(request(randomUUID(),1,{...spec,input:{...input,keywords:'new '+which}}),{...env,[which]:'0'},blockedFetcher),'quota_exhausted');
  }
  a.exec('DELETE FROM discovery_cache; DELETE FROM discovery_requests; DELETE FROM discovery_sessions;');
  const failed=request();let failedCalls=0;
  await rejects(()=>discovery(failed,env,async()=>{failedCalls++;return new Response('',{status:500});}),'provider_failed');
  await rejects(()=>discovery(failed,env,blockedFetcher),'already_requested');
  assert.equal(failedCalls,1);assert.equal(a.prepare('SELECT SUM(charged) n FROM discovery_requests').get().n,1,'Failure keeps its reservation');
  console.log('Serper checks passed: role inputs/quoted phrases, ATS posting boundaries, original URLs, stable query/pages, deduplication, empty/repeated/filtered pages, cache, missing configuration, provider timeout/auth/quota/format errors, durable cross-connection caps and failure reservations.');
} finally {a.close();b.close();unlinkSync(file);}
