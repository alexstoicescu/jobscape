import type {Job} from '../search';
import type {Board} from '../registry';
import {normalizePlaces,type Place} from '../geography';

export const MAX_DESCRIPTION=12000;
export const isJob=(job:Job|null):job is Job=>job!==null;
export const plain=(value:unknown)=>String(value??'')
 .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/<[^>]*>/g,' ')
 .replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
 .replace(/&#(\d+);/g,(_,value)=>{const code=Number(value);return code<=0x10ffff?String.fromCodePoint(code):' '})
 .replace(/\s+/g,' ').trim();
export const safeUrl=(value:unknown)=>{try{const url=new URL(String(value));return url.protocol==='https:'?url.href:''}catch{return ''}};
export const date=(value:unknown)=>{if(value===undefined||value===null||value==='')return null;const parsed=new Date(value as string|number);return Number.isNaN(parsed.getTime())?null:parsed.toISOString()};
export function remoteListing(job:{isRemote?:boolean;workplaceType?:string},location:string){
 const workplace=String(job.workplaceType??'').toLowerCase().replace(/[-\s_]/g,'');
 if(workplace==='onsite'||workplace==='hybrid')return false;
 if(typeof job.isRemote==='boolean')return job.isRemote;
 if(workplace==='remote')return true;
 return location.split(/[;·]/).some(place=>!/\b(non[ -]?remote|not remote|no remote|hybrid|on[ -]?site)\b/i.test(place)&&/\b(remote|distributed|anywhere|home[ -]based|work from home)\b/i.test(place));
}
export function normalizedJob(board:Board,checked:string,value:{id:unknown;title:unknown;locations:Place[];location?:string;remote?:boolean;workplaceType?:string;url:unknown;description?:unknown;published?:unknown;dateKind?:'published'|'updated'}):Job|null{
 const title=plain(value.title),url=safeUrl(value.url);
 if(!value.id||!title||!url)return null;
 const locations=normalizePlaces(value.locations.filter(place=>place.label||place.city||place.country));
 const location=value.location||[...new Set(locations.map(place=>place.label).filter(Boolean))].join(' · ')||'Location not specified';
 const description=plain(value.description),published=date(value.published);
 return {id:`${board.platform}:${board.slug}:${value.id}`,title,company:board.name,location,locations,remote:remoteListing({isRemote:value.remote,workplaceType:value.workplaceType},location),url,platform:board.platform,description:description.slice(0,MAX_DESCRIPTION),descriptionTruncated:description.length>MAX_DESCRIPTION,published,dateKind:published?value.dateKind??'published':null,checked};
}
