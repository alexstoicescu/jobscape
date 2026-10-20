import type {Candidate} from './discovery';
import {readPosting,POSTING_LIMITS} from './posting-reader';
import {strictGlobal,type PostingRead} from './global-remote';

export async function verifyGlobalPage(cards:Candidate[],db:D1Database,fetcher:typeof fetch=fetch):Promise<Candidate[]>{
  const budget={deadline:Date.now()+POSTING_LIMITS.pageMs,requests:0,bytes:0};
  const output:Candidate[]=new Array(cards.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(POSTING_LIMITS.concurrency,cards.length)},async()=>{
    while(cursor<cards.length){
      const index=cursor++,card=cards[index],key='posting:v1:'+card.key,now=Date.now();
      try{
        const cached=await db.prepare('SELECT body FROM discovery_cache WHERE key=? AND expires>?').bind(key,now).first<{body:string}>();
        const read:PostingRead=cached?JSON.parse(cached.body):await readPosting(card,budget,fetcher);
        if(!cached)await db.prepare('INSERT OR REPLACE INTO discovery_cache(key,body,expires) VALUES(?,?,?)').bind(key,JSON.stringify(read),now+(read.posting?600000:120000)).run();
        output[index]={...card,globalCheck:{...strictGlobal(read),cached:!!cached}};
      }catch{output[index]={...card,globalCheck:{status:'unknown',reason:'Posting verification/cache was unavailable.',evidence:[],restrictions:[],checkedAt:new Date().toISOString(),sourceUrl:card.url,method:'unavailable'}};}
    }
  }));
  return output;
}
