export type Place = {label:string;city?:string;country?:string;region?:string};
export type LocationMatch = 'listed'|'region'|'unknown'|'none';
const countries:Record<string,{names:string[];region:string}> = {
 DE:{names:['germany','deutschland','de','deu'],region:'europe'},
 GB:{names:['united kingdom','great britain','uk','gb','gbr','england','scotland','wales','northern ireland'],region:'europe'},
 US:{names:['united states','united states of america','usa','us'],region:'north america'},
 CA:{names:['canada','ca','can'],region:'north america'},
 FR:{names:['france','fr','fra'],region:'europe'}, ES:{names:['spain','es','esp'],region:'europe'},
 NL:{names:['netherlands','the netherlands','nl','nld'],region:'europe'}, IE:{names:['ireland','ie','irl'],region:'europe'},
 CH:{names:['switzerland','ch','che'],region:'europe'}, AT:{names:['austria','at','aut'],region:'europe'},
 PL:{names:['poland','pl','pol'],region:'europe'}, PT:{names:['portugal','pt','prt'],region:'europe'},
 IT:{names:['italy','it','ita'],region:'europe'}, SE:{names:['sweden','se','swe'],region:'europe'},
 DK:{names:['denmark','dk','dnk'],region:'europe'}, NO:{names:['norway','no','nor'],region:'europe'},
 FI:{names:['finland','fi','fin'],region:'europe'}, BE:{names:['belgium','be','bel'],region:'europe'},
 CZ:{names:['czechia','czech republic','cz','cze'],region:'europe'}, RO:{names:['romania','ro','rou'],region:'europe'},
 AU:{names:['australia','au','aus'],region:'apac'}, NZ:{names:['new zealand','nz','nzl'],region:'apac'},
 IN:{names:['india','in','ind'],region:'apac'}, SG:{names:['singapore','sg','sgp'],region:'apac'},
 JP:{names:['japan','jp','jpn'],region:'apac'}, BR:{names:['brazil','br','bra'],region:'latam'},
 MX:{names:['mexico','mx','mex'],region:'latam'}, AR:{names:['argentina','ar','arg'],region:'latam'},
};
export const normalizeText=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const cities:Record<string,string>={berlin:'DE',munich:'DE',munchen:'DE',hamburg:'DE',frankfurt:'DE',cologne:'DE',koln:'DE',dusseldorf:'DE',stuttgart:'DE',london:'GB',edinburgh:'GB',manchester:'GB',paris:'FR',amsterdam:'NL',dublin:'IE',zurich:'CH',vienna:'AT',warsaw:'PL',lisbon:'PT',madrid:'ES',barcelona:'ES',stockholm:'SE',copenhagen:'DK',helsinki:'FI',prague:'CZ',bucharest:'RO','san francisco':'US','new york':'US',boston:'US',seattle:'US',austin:'US',toronto:'CA',vancouver:'CA',montreal:'CA',sydney:'AU',melbourne:'AU',bangalore:'IN',bengaluru:'IN',tokyo:'JP'};
const regions:Record<string,string[]>={europe:['europe','european union','eu'],emea:['emea','europe middle east and africa'],apac:['apac','asia pacific'],'north america':['north america'],latam:['latam','latin america'],worldwide:['worldwide','global','anywhere','work from anywhere']};
const contains=(text:string,phrase:string)=>(' '+normalizeText(text)+' ').includes(' '+normalizeText(phrase)+' ');
export function countryCode(value:string){const text=normalizeText(value);return Object.keys(countries).find(code=>countries[code].names.includes(text));}
export function regionCode(value:string){const text=normalizeText(value);return Object.keys(regions).find(region=>regions[region].includes(text));}
export function normalizePlace(place:Place):Place{
 const label=String(place.label??'');
 const city=place.city||Object.keys(cities).find(city=>contains(label,city));
 // Two-letter codes only identify countries in structured fields or clear
 // location segments. In particular "CA" in "San Francisco, CA" is a state.
 const explicit=countryCode(place.country??'');
 const labelCountry=Object.keys(countries).find(code=>countries[code].names.filter(name=>name.length>3||['uk','usa','us'].includes(name)).some(name=>contains(label,name)))
  ??Object.keys(countries).find(code=>code!=='CA'&&label.split(/[,;·/()]/).some(part=>countryCode(part.trim())===code));
 const country=explicit??labelCountry??(city?cities[normalizeText(city)]:undefined);
 const region=place.region?regionCode(place.region):Object.keys(regions).find(region=>regions[region].some(name=>contains(label,name)));
 return {label,city,country,region:region??(country?countries[country]?.region:undefined)};
}
export function normalizePlaces(places:Place[]){
 return places.flatMap(place=>place.country?[place]:place.label.split(/[;·/]/).map(label=>({...place,label:label.trim()}))).map(normalizePlace);
}
export function locationMatch(job:{location:string;remote:boolean;locations?:Place[]},query:string):LocationMatch{
 if(!query.trim())return 'listed';
 const places=normalizePlaces(job.locations?.length?job.locations:[{label:job.location}]);
 const country=countryCode(query),region=regionCode(query);
 if(country){
  const excluded=countries[country].names.some(name=>['excluding ','except ','not in ','outside '].some(prefix=>contains(job.location,prefix+name)));
  if(excluded)return 'none';
  if(places.some(place=>place.country===country))return 'listed';
  const broad=places.some(place=>!place.country&&(place.region===countries[country].region||place.region==='worldwide'||place.region==='emea'&&countries[country].region==='europe'));
  if(broad)return 'region';
 }else if(region){
  if(places.some(place=>place.region===region||place.country&&countries[place.country]?.region===region||region==='emea'&&(place.region==='europe'||place.country&&countries[place.country]?.region==='europe')))return 'listed';
  if(places.some(place=>!place.country&&(place.region==='worldwide'||region==='europe'&&place.region==='emea')))return 'region';
 }else if(places.some(place=>contains(place.label,query)||place.city&&normalizeText(place.city)===normalizeText(query)))return 'listed';
 if(job.remote&&(country||region)&&places.every(place=>!place.country&&!place.region)&&/^(remote|location not specified|distributed|home based|work from home)(\s|$)/i.test(job.location.trim()))return 'unknown';
 return 'none';
}
