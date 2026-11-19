import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarCloud} from '../lib/avatar/cloud.mjs';
import {createProviders} from '../lib/avatar/providers.mjs';
const env={OPENAI_OFFICIAL_API_KEY:'mock-open',DASHSCOPE_API_KEY:'mock-qwen'};
const ctx=query=>({request:new Request('https://apps-demo.muyang23333.top/api/avatar/status'+query),env,clientIp:'192.0.2.3'});
test('each new page probes fresh metadata without a generation or reservation; ordinary status does not probe',async()=>{
 let hits=0;
 const meta=async(url,o)=>{assert.equal(o.method??'GET','GET');assert.match(url,/^https:\/\/api\.openai\.com\/v1\/models\//);return new Response(null,{status:++hits===1?200:403});};
 const read=async q=>(await avatarCloud(ctx(q),'status',meta)).json();
 assert.equal((await read('')).pageRoute,undefined);assert.equal(hits,0);
 const a=await read('?check=image'),b=await read('?check=image');
 assert.equal(a.pageRoute,'standard');assert.equal(b.pageRoute,'qwen');assert.equal(hits,2);assert.deepEqual(a.quota,b.quota);
 await read('');assert.equal(hits,2);
});
test('later explicit requests honor only a fixed page route, without re-probing OpenAI',async()=>{
 for(const route of ['standard','ipv4','qwen']){
   const calls=[];
   const fake=label=>async(u,o)=>{calls.push([label,new URL(u).hostname,o.method]);return Response.json({error:{code:'content_policy_violation'}},{status:400});};
   const p=createProviders(env,fake('standard'),fake('ipv4'));
   await assert.rejects(p.image({prompt:'offline transport fixture',pageRoute:route}));
   assert.deepEqual(calls,[[route==='ipv4'?'ipv4':'standard',route==='qwen'?'dashscope.aliyuncs.com':'api.openai.com','POST']]);
 }
});
