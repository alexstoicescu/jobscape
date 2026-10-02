import assert from 'node:assert/strict';
import {sourceModule} from './load-source.mjs';
const {validateInput,matches,matchJob,googleUrl,expandedTerms}=await import(sourceModule('../lib/search.ts'));
const {locationMatch,normalizePlace}=await import(sourceModule('../lib/geography.ts'));
const {boards}=await import(sourceModule('../lib/registry.ts'));
const {sourceCoverage}=await import(sourceModule('../lib/coverage.ts'));
assert.equal(sourceCoverage(['workday'],boards,[])[0].state,'unsupported');
assert.equal(sourceCoverage(['ashby'],[],[])[0].state,'unregistered');
assert.equal(sourceCoverage(['ashby'],boards)[0].state,'ready');
assert.equal(sourceCoverage(['ashby'],boards,[])[0].state,'unavailable');
assert.equal(sourceCoverage(['ashby'],[{platform:'ashby'},{platform:'ashby'}],[{platform:'ashby',status:'ok'}])[0].state,'partial');
assert.equal(sourceCoverage(['ashby'],[{platform:'ashby'}],[{platform:'ashby',status:'ok'}])[0].state,'complete');
const input = { keywords: 'developer relations OR developer advocate', location: '', remote: false, platforms: ['ashby'] };
const job = { title: 'Senior Developer Advocate', location: 'Remote, United States', remote: true };
assert.equal(matches(job, input), true);
assert.equal(matches({ ...job, title: 'Developer Experience Engineer' }, input), false);
assert.equal(matches(job, { ...input, location: 'Germany', remote: true }), false);
assert.equal(matches({ ...job, remote: false }, { ...input, remote: true }), false);
for (const keywords of ['   ', ',,,', '""', '“”', '***']) {
  assert.throws(() => validateInput({ ...input, keywords }), /keywords/i);
}
assert.throws(() => validateInput({ ...input, platforms: ['unknown'] }), /platform/i);
const query = new URL(googleUrl({ ...input, location: 'Germany', remote: true })).searchParams.get('q');
assert.match(query, /site:jobs\.ashbyhq\.com/);
assert.match(query, /"developer relations"/);
assert.match(query, /"developer advocate"/);
assert.match(query, /"devrel"/);
assert.match(query, /"Germany"/);
assert.match(query, /"remote"/);
assert.throws(()=>validateInput({...input,searchDescriptions:'true'}),/options/i);
assert.equal(validateInput(input).expandTitles,true);
assert.equal(validateInput(input).searchDescriptions,false);
assert.equal(matches({...job,title:'DevRel Engineer'},input),true);
assert.equal(matches({...job,title:'DevRel Engineer'},{...input,expandTitles:false}),false);
assert.equal(matches({...job,title:'Senior Site Reliability Engineer'},{...input,keywords:'Senior SRE'}),true);
assert.equal(matches({...job,title:'Software Developer'},{...input,keywords:'Software Engineer'}),true);
assert.equal(matches({...job,title:'Senior QA Engineer'},{...input,keywords:'Quality assurance'}),true);
assert.equal(expandedTerms({...input,keywords:'senior devrel'}).some(value=>value.term==='senior developer advocate'),true);
assert.equal(matchJob({...job,title:'Technical Community Manager',description:'We work closely with developer relations.'},input),null);
const descriptionMatch=matchJob({...job,title:'Technical Community Manager',description:'We work closely with developer relations.'},{...input,searchDescriptions:true});
assert.equal(descriptionMatch.field,'description');
assert.match(descriptionMatch.snippet,/developer relations/);
assert.equal(locationMatch({...job,location:'Berlin'},'Germany'),'listed');
assert.equal(locationMatch({...job,location:'München'},'Deutschland'),'listed');
assert.equal(locationMatch({...job,location:'Remote',locations:[{label:'Remote',country:'DEU'}]},'Germany'),'listed');
assert.equal(locationMatch({...job,location:'San Francisco, CA'},'Canada'),'none');
assert.equal(locationMatch({...job,location:'UK Remote'},'uk'),'listed');
assert.equal(locationMatch({...job,location:'Ukraine'},'uk'),'none');
assert.equal(locationMatch({...job,location:'EMEA'},'Germany'),'region');
assert.equal(matches({...job,location:'EMEA'},{...input,location:'Germany',remote:true}),false);
assert.equal(matches({...job,location:'EMEA'},{...input,location:'Germany',remote:true,includeUnknownRemote:true}),true);
assert.equal(locationMatch({...job,location:'Remote'},'Germany'),'unknown');
assert.equal(matches({...job,location:'Remote, USA'},{...input,location:'Germany',remote:true,includeUnknownRemote:true}),false);
assert.equal(locationMatch({...job,location:'Paris'},'Europe'),'listed');
assert.equal(locationMatch({...job,location:'France; Germany; USA'},'USA'),'listed');
assert.equal(locationMatch({...job,location:'France; Germany; USA'},'France'),'listed');
assert.equal(locationMatch({...job,location:'EMEA excluding Germany'},'Germany'),'none');
assert.equal(normalizePlace({label:'Berlin',country:'USA'}).country,'US');
assert.equal(new Set(boards.map(board=>board.platform+':'+board.slug)).size,boards.length);
// The shared transport bounds actual requests, including pages and redirects.
assert.equal(sourceCoverage(['ashby'],[{platform:'ashby'}],[{platform:'ashby',status:'partial'}])[0].state,'partial');
assert.equal(boards.find(board=>board.name==='Snyk').platform,'ashby');

// Synthetic provider responses are confined to this process, never the app.
const actualFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (!String(url).endsWith('/alchemy')) return new Response('', { status: 503 });
    return Response.json({ jobs: [
      { id: 'remote', title: 'Developer Advocate', location: 'Germany', isRemote: true, jobUrl: 'https://example.test/remote', publishedAt: '2026-09-01T00:00:00Z' },
      { id: 'onsite', title: 'Developer Advocate', location: 'Remote, Germany', isRemote: false, workplaceType: 'OnSite', jobUrl: 'https://example.test/onsite' },
      { id: 'hybrid', title: 'Developer Advocate', location: 'Remote, Germany', workplaceType: 'Hybrid', jobUrl: 'https://example.test/hybrid' },
      { id: 'negated', title: 'Developer Advocate', location: 'Germany (not remote)', jobUrl: 'https://example.test/negated' },
      { id: 'enum', title: 'Developer Advocate', location: 'Germany', workplaceType: 'Remote', jobUrl: 'https://example.test/enum' },
      { id: 'hidden', title: 'Developer Advocate', location: 'Germany', isRemote: true, isListed: false, jobUrl: 'https://example.test/hidden' },
      { id: 'duplicate', title: 'Developer Advocate', location: 'Germany', isRemote: true, jobUrl: 'https://example.test/remote', publishedAt: '2026-09-01T00:00:00Z' },
    ] });
  };
  const { searchBoards } = await import(sourceModule('../lib/boards.ts'));
  const result = await searchBoards({ ...input, location: 'Germany', remote: true });
  assert.deepEqual(result.jobs.map(j => j.url).sort(), ['https://example.test/enum', 'https://example.test/remote']);
  assert.equal(result.boards, 1);
  const ashbyCount=boards.filter(board=>board.platform==='ashby').length;
  assert.equal(result.attempted, ashbyCount);
  assert.equal(result.failed.length, ashbyCount-1);
  assert.equal(result.jobs.find(j => j.url.endsWith('/remote')).dateKind, 'published');
  await searchBoards(input);
  assert.equal(calls, ashbyCount*2-1, 'Successful feeds cache; failed feeds retry');
  assert.equal(result.health.find(board=>board.name==='Alchemy').jobs,6);
  assert.equal(result.jobs.every(job=>job.match.field==='title'),true);
  const none = await searchBoards({ ...input, platforms: ['workday'] });
  assert.equal(none.attempted, 0);
  assert.equal(none.coverage[0].state,'unsupported');
  assert.equal(result.coverage[0].state,'partial');
  const unavailable = await searchBoards({ ...input, platforms: ['lever'] });
  assert.equal(unavailable.boards, 0);
  assert.equal(unavailable.failed.length, unavailable.attempted);
  // Check Greenhouse office countries, real HTML descriptions, edit dates,
  // separate description caches, and payload trimming.
  globalThis.fetch=async url=>String(url).includes('/boards/stripe/')?Response.json({jobs:[{id:'gh',title:'Community Manager',location:{name:'Berlin'},offices:[{location:'Germany'}],absolute_url:'https://example.test/gh',updated_at:'2026-09-20T00:00:00Z',content:String(url).includes('content=true')?'&lt;p&gt;Developer relations works with this team.&lt;/p&gt;':''}]}):new Response('',{status:503});
  const titleOnly=await searchBoards({...input,platforms:['greenhouse']});
  assert.equal(titleOnly.total,0);
  const withDescriptions=await searchBoards({...input,location:'Germany',remote:false,platforms:['greenhouse'],searchDescriptions:true});
  assert.equal(withDescriptions.total,1);
  assert.equal(withDescriptions.jobs[0].match.field,'description');
  assert.equal(withDescriptions.jobs[0].dateKind,'updated');
  assert.equal(withDescriptions.jobs[0].description.includes('<p>'),false);
  assert.equal(withDescriptions.descriptions.available,1);
} finally {
  globalThis.fetch = actualFetch;
}
console.log('Search regression checks passed: validation, matching, Google links, remote flags, visibility, deduplication, partial failures, and caching.');
