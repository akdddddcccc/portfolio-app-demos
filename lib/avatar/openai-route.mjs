import {request as httpsRequest} from 'node:https';
import {Readable} from 'node:stream';
import {classifyImageError,networkCause} from './image-error.mjs';

// Same DNS hostname, HTTPS certificate validation and credentials as fetch.
// Only read-only probes are repeated; never replay a generation request.
export function officialIPv4(input,options){
  const u=new URL(input);
  if(!['https://api.openai.com','https://dashscope.aliyuncs.com'].includes(u.origin)||u.username||u.password)throw Error('Unexpected image host');
  return new Promise((resolve,reject)=>{
    const req=httpsRequest(u,{method:options.method||'GET',headers:options.headers,family:4,signal:options.signal},res=>{
      resolve(new Response(Readable.toWeb(res),{status:res.statusCode,headers:new Headers(res.headers)}));
    });
    req.on('error',reject);req.end(options.body);
  });
}
export async function inspectRoutes(key,model,standard,ipv4){
  if(!key || !/^[!-~]+$/.test(key))return {status:key?'KEY_FORMAT':'NOT_CONFIGURED'};
  const checks={};
  for(const [name,transport] of [['standard',standard],['ipv4',ipv4]]){
    if(!transport)continue;
    try{
      const r=await transport('https://api.openai.com/v1/models/'+encodeURIComponent(model),{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(3500)});
      const status=r.ok?'MODEL_VISIBLE':classifyImageError(r.status,await r.json().catch(()=>({})));
      if(r.ok)await r.body?.cancel();
      checks[name]=status;return {status,checks,route:name,transport};
    }catch(e){checks[name]=networkCause(e);}
  }
  return {status:checks.ipv4||checks.standard,checks};
}
