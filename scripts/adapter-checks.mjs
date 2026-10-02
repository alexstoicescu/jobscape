import assert from 'node:assert/strict';
import {sourceModule} from './load-source.mjs';
const {makeContext,MAX_REQUESTS,MAX_RESPONSE_BYTES}=await import(sourceModule('../lib/adapters/transport.ts'));
const {remoteListing,normalizedJob}=await import(sourceModule('../lib/adapters/normalize.ts'));
const board={platform:'ashby',slug:'fixture',name:'Fixture',source:'https://example.test/careers'};
assert.equal(remoteListing({workplaceType:'hybrid',isRemote:true},'Remote, Germany'),false);
assert.equal(remoteListing({workplaceType:'on_site',isRemote:true},'Remote'),false);
assert.equal(remoteListing({},'Hybrid - Berlin'),false);
assert.equal(normalizedJob(board,'2026-10-02T00:00:00Z',{id:'1',title:'Engineer',locations:[],url:'http://example.test/job'}),null);
const unknown=normalizedJob(board,'2026-10-02T00:00:00Z',{id:'1',title:'Engineer',locations:[],url:'https://example.test/job'});
assert.equal(unknown.published,null);assert.equal(unknown.dateKind,null);assert.equal(unknown.remote,false);
const actual=globalThis.fetch;let calls=0;
const budget=()=>({deadline:Date.now()+16000,requests:0,bytes:0});
try{
 globalThis.fetch=async()=>{calls++;return new Response('{}')};
 const limited=budget();limited.requests=MAX_REQUESTS;
 await assert.rejects(makeContext(board,limited,false).text('https://example.test/feed'),/Request budget/);assert.equal(calls,0);
 await assert.rejects(makeContext(board,{...budget(),deadline:Date.now()-1},false).text('https://example.test/feed'),/time budget/);
 globalThis.fetch=async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'30'}})};
 const throttled=makeContext({...board,slug:'rate'},budget(),false);
 await assert.rejects(throttled.text('https://example.test/feed'),error=>error.message.includes('429')&&Date.parse(error.retryAt)>Date.now()+25000);
 const before=calls;await assert.rejects(makeContext({...board,slug:'rate'},budget(),false).text('https://example.test/feed'),/cooling down/);assert.equal(calls,before);
 for(const status of [401,403]){globalThis.fetch=async()=>new Response('',{status});await assert.rejects(makeContext(board,budget(),false).text('https://example.test/feed'),new RegExp('HTTP '+status))}
 globalThis.fetch=async()=>new Response('<html>disabled</html>');await assert.rejects(makeContext(board,budget(),false).json('https://example.test/feed'),/malformed JSON/);
 globalThis.fetch=async()=>new Response('too big',{headers:{'content-length':String(MAX_RESPONSE_BYTES+1)}});await assert.rejects(makeContext(board,budget(),false).text('https://example.test/feed'),/size limit/);
 globalThis.fetch=async()=>new Response('',{status:302,headers:{location:'https://other.test/feed'}});await assert.rejects(makeContext(board,budget(),false).text('https://example.test/feed'),/outside its provider/);
}finally{globalThis.fetch=actual}
console.log('Adapter transport checks passed: budgets, Retry-After, denied access, malformed payloads, size bounds, redirects, and normalization.');
