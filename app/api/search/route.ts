import {validateInput} from '@/lib/search';
import {searchBoards} from '@/lib/boards';
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')??0)>4096)return Response.json({error:'Search is too long.'},{status:413});
 let input;try{input=validateInput(await request.json())}catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid search.'},{status:400})}
 try{return Response.json(await searchBoards(input),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'The job feeds are unavailable. Try the all-ATS search.'},{status:502})}
}
