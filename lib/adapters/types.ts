import type {Board} from '../registry';
import type {Job} from '../search';

export type AdapterResult={jobs:Job[];complete:boolean;issues:string[];reportedTotal?:number};
export type AdapterContext={
 descriptions:boolean; checked:string;
 json:(url:string)=>Promise<any>; text:(url:string)=>Promise<string>;
 remainingRequests:()=>number;
};
export type BoardAdapter={
 feedUrl:(board:Board,descriptions:boolean)=>string;
 cacheVariant:(descriptions:boolean)=>string;
 load:(board:Board,context:AdapterContext)=>Promise<AdapterResult>;
};
