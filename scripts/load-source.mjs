import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=new Map();
export function sourceModule(path){
 const url=path instanceof URL?path:new URL(path,import.meta.url);
 if(compiled.has(url.href))return compiled.get(url.href);
 let source=readFileSync(url,'utf8');
 source=source.replace(/from ['"](.\/?[^'"]+)['"]/g,(match,path)=>path.startsWith('.')?`from '${sourceModule(new URL(path+'.ts',url))}'`:match);
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const result='data:text/javascript;base64,'+Buffer.from(output).toString('base64');compiled.set(url.href,result);return result;
}
