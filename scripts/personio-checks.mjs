import assert from 'node:assert/strict';
import {sourceModule} from './load-source.mjs';
const {personio}=await import(sourceModule('../lib/adapters/personio.ts'));
const {parseXml,field}=await import(sourceModule('../lib/adapters/xml.ts'));
const {matches}=await import(sourceModule('../lib/search.ts'));
const board={platform:'personio',slug:'fixture',name:'Fixture',source:'https://fixture.jobs.personio.com/',domain:'com',locale:'en'};
const context=xml=>({text:async()=>xml,descriptions:true,checked:'2026-10-02T00:00:00Z',remainingRequests:()=>48});
const position=(id,office='Remote - Germany',name='Developer Advocate')=>`<position><id>${id}</id><name>${name}</name><office>${office}</office><additionalOffices><office>Berlin</office></additionalOffices><jobDescriptions><jobDescription><name>Mission</name><value><![CDATA[<p>Kubernetes &amp; API tools</p>]]></value></jobDescription></jobDescriptions><createdAt>2026-09-01T00:00:00Z</createdAt></position>`;
const wrap=xml=>`<?xml version="1.0" encoding="UTF-8"?><workzag-jobs>${xml}</workzag-jobs>`;
const loaded=await personio.load(board,context(wrap(position('1')+position('2','Hybrid - Berlin')+position('3','On-site - Berlin')+position('4','Remote - Spain')+position('5','Remote'))));
assert.equal(loaded.jobs.length,5);assert.equal(loaded.complete,true);
assert.equal(loaded.jobs[0].remote,true);assert.equal(loaded.jobs[1].remote,false);assert.equal(loaded.jobs[2].remote,false);
assert.equal(loaded.jobs[0].published,null);assert.equal(loaded.jobs[0].dateKind,null);assert.match(loaded.jobs[0].description,/Kubernetes & API/);
assert.equal(loaded.jobs[0].url,'https://fixture.jobs.personio.com/job/1?language=en');
assert.equal(matches(loaded.jobs[0],{keywords:'DevRel',location:'Germany',remote:true,platforms:['personio']}),true);
assert.equal(matches(loaded.jobs[3],{keywords:'DevRel',location:'Germany',remote:true,platforms:['personio']}),true); // Additional Berlin office is explicitly listed.
const foreign=await personio.load(board,context(wrap(position('6','Remote - Spain').replace('<office>Berlin</office>','<office>Barcelona</office>'))));
assert.equal(matches(foreign.jobs[0],{keywords:'DevRel',location:'Germany',remote:true,platforms:['personio'],includeUnknownRemote:true}),false);
const escaped=await personio.load(board,context(wrap(position('7','Berlin','R&amp;D &#x1F680; &#65; &quot;Tools&quot;'))));
assert.equal(escaped.jobs[0].title,'R&D 🚀 A "Tools"');
const duplicate=await personio.load(board,context(wrap(position('1')+position('1','Remote - Spain','Entwickler'))));
assert.equal(duplicate.jobs.length,1);assert.equal(duplicate.jobs[0].title,'Developer Advocate');assert.match(duplicate.jobs[0].location,/Spain/);
assert.match(personio.feedUrl({...board,domain:'de',locale:'de'}),/personio\.de\/xml\?language=de$/);
const empty=await personio.load(board,context(wrap('')));assert.equal(empty.complete,true);assert.equal(empty.jobs.length,0);
for(const xml of ['<html>Disabled</html>','<workzag-jobs>Disabled</workzag-jobs>','<workzag-jobs><position></workzag-jobs>','<!DOCTYPE workzag-jobs [<!ENTITY x SYSTEM "https://evil.test">]><workzag-jobs>&x;</workzag-jobs>','<workzag-jobs/> trailing','<workzag-jobs/><workzag-jobs/>','<workzag-jobs>&custom;</workzag-jobs>','<workzag-jobs><![CDATA[broken</workzag-jobs>'])await assert.rejects(personio.load(board,context(xml)));
assert.throws(()=>parseXml('<root><name>&#0;</name></root>'),/entity/);
assert.throws(()=>parseXml('<root bad="1" bad="2"/>'),/duplicate/);
assert.throws(()=>parseXml('<root>'+ '<node>'.repeat(33)+'x'+'</node>'.repeat(33)+'</root>'),/depth/);
assert.throws(()=>parseXml('<root>'+ 'x'.repeat(2*1024*1024)+'</root>'),/limit/);
assert.equal(field(parseXml('<root><!-- comment --><name>A <b>B</b> C &amp; D</name></root>'),'name'),'A B C & D');
const capped=await personio.load(board,context(wrap(Array.from({length:1001},(_,index)=>position(index+1)).join(''))));assert.equal(capped.jobs.length,1000);assert.equal(capped.complete,false);assert.match(capped.issues[0],/capped/);
const invalid=await personio.load(board,context(wrap('<position><id>bad</id><name>Job</name></position>')));assert.equal(invalid.complete,false);assert.equal(invalid.jobs.length,0);
// Domains/locales must not share a cached response for the same employer slug.
const {boards}=await import(sourceModule('../lib/registry.ts'));
const {searchBoards}=await import(sourceModule('../lib/boards.ts'));
const originalBoards=[...boards],actualFetch=globalThis.fetch;let calls=0;
try{
 boards.splice(0,boards.length,{...board,locale:'en'},{...board,locale:'de'});
 globalThis.fetch=async url=>{calls++;const german=new URL(url).searchParams.get('language')==='de';return new Response(wrap(position(german?'102':'101','Berlin',german?'Engineer Deutsch':'Engineer English')))};
 const search=await searchBoards({keywords:'Engineer',location:'',remote:false,platforms:['personio']});
 assert.equal(calls,2);assert.equal(search.jobs.length,2);assert.match(search.jobs.map(job=>job.title).join(' '),/Deutsch/);
 await searchBoards({keywords:'Engineer',location:'',remote:false,platforms:['personio']});assert.equal(calls,2);
}finally{globalThis.fetch=actualFetch;boards.splice(0,boards.length,...originalBoards)}
console.log('Personio checks passed: Worker-safe XML, CDATA/escaped/numeric text, malformed/disabled/DTD feeds, bounds, locale deduplication, additional offices, remote/hybrid/country matching and unknown publication dates.');
