import {platforms, type BoardHealth} from './search';

export type SourceCoverage = {
 id:string; name:string; supported:boolean; registered:number; responding:number;
 state:'unsupported'|'unregistered'|'ready'|'unavailable'|'partial'|'complete';
};

// Capability metadata, registry scope, and responding boards describe different things.
export function sourceCoverage(ids:string[], registry:{platform:string}[], health?:BoardHealth[]):SourceCoverage[]{
 return platforms.filter(platform=>ids.includes(platform.id)).map(platform=>{
  const registered=registry.filter(board=>board.platform===platform.id).length;
  const selected=health?.filter(board=>board.platform===platform.id);
  const responding=selected?.filter(board=>board.status!=='unavailable').length??0;
  const state=!platform.live?'unsupported':!registered?'unregistered':!health?'ready':!responding?'unavailable':responding<registered||selected?.some(board=>board.status==='partial')?'partial':'complete';
  return {id:platform.id,name:platform.name,supported:platform.live,registered,responding,state};
 });
}
