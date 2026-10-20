import {env} from 'cloudflare:workers';
import {discovery, DiscoveryError, type SerperEnv} from '@/lib/serper';

export async function POST(request: Request) {
  const headers = {'Cache-Control':'no-store'};
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({code:'origin',error:'Use the JobScape search form.'},{status:403,headers});
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({code:'input',error:'Expected JSON.'},{status:415,headers});
  try {
    // Bound actual body bytes, not only the optional Content-Length header.
    const reader = request.body?.getReader();
    let text = '', size = 0;
    if (!reader) throw new DiscoveryError('input','Missing search inputs.',400);
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8192) {await reader.cancel(); throw new DiscoveryError('input','Search is too long.',413);}
      text += decoder.decode(chunk.value,{stream:true});
    }
    text += decoder.decode();
    let body; try {body = JSON.parse(text);} catch {throw new DiscoveryError('input','Invalid search JSON.',400);}
    return Response.json(await discovery(body,env as SerperEnv),{headers});
  } catch (e) {
    const failure = e instanceof DiscoveryError ? e : new DiscoveryError('usage_store','Search could not finish safely. Check the shared database configuration; results were not treated as empty.');
    return Response.json({code:failure.code,error:failure.message},{status:failure.status,headers});
  }
}
