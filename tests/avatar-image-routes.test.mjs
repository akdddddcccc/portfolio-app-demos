import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {createProviders} from '../lib/avatar/providers.mjs';
const env={OPENAI_OFFICIAL_API_KEY:'primary',DASHSCOPE_API_KEY:'backup'};
const prompt={prompt:'test'};
const dead=()=>{throw Object.assign(new Error('connection'),{code:'ECONNRESET'});};
test('failed metadata checks cause exactly one Qwen generation; actual PNG is converted to JPG',async()=>{
 const calls=[];const png=PNG.sync.write(new PNG({width:1024,height:1024}));
 const f=async(url,o)=>{
   calls.push([url,o.method]);if(url.includes('openai.com'))return dead();
   if(url.includes('/generation')){assert.equal(o.headers.Authorization,'Bearer backup');return Response.json({output:{choices:[{message:{content:[{image:'https://dashscope-result-sh.oss-cn-shanghai.aliyuncs.com/a.png'}]}}]}});}
   assert.equal(o.headers,undefined);return new Response(png);
 };
 const r=await createProviders(env,f,dead).image(prompt);assert.equal(r.provider,'Qwen');assert.match(r.image,/^data:image\/jpeg;base64,\/9j\//);assert.equal(calls.filter(c=>c[1]==='POST').length,1);
});
test('working official IPv4 route remains preferred over Qwen',async()=>{
 let posts=0;const alt=async(url,o)=>{assert.equal(new URL(url).hostname,'api.openai.com');if(o.method!=='POST')return Response.json({id:'model'});
   posts++;return Response.json({data:[{b64_json:'/9j/test'}]});};
 assert.equal((await createProviders(env,dead,alt).image(prompt)).provider,'OpenAI');assert.equal(posts,1);
});
test('ambiguous post failures and content refusals never fall through to a second generator',async()=>{
 for(const response of [dead,()=>Response.json({error:{code:'content_policy_violation'}},{status:400}),()=>new Response('',{status:500})]){
  let posts=0;const f=async(url,o)=>{assert.equal(new URL(url).hostname,'api.openai.com');if(o.method!=='POST')return Response.json({id:'model'});posts++;return response();};
  await assert.rejects(createProviders(env,f).image(prompt));assert.equal(posts,1);
 }
});
