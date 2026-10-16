import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, onRequestPost } from '../edge-functions/api/yuanbai/chat.js';
import { publicStudentBoundary, buildCuratedKnowledgeContext } from '../edge-functions/_shared/yuanbai-public-knowledge.js';
import { proxyVoiceQueue } from '../edge-functions/_shared/yuanbai-voice-queue.js';
const origin='https://academy.example.test';
const env={YUANBAI_ALLOWED_ORIGINS:origin,DASHSCOPE_API_KEY:'test',DEEPSEEK_API_KEY:'test'};
const request=(body,site=origin)=>new Request('https://api.example.test/api/yuanbai/chat',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('公众版学生查询不调用模型、不查网络；正常学习与师资名单不被拦截',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('must not fetch');});
 for(const q of ['26级学生名单','你认识某某同学吗','你知道陌生人吗']) {
  const r=await chat(q,[],'test');assert.match(r.answer,/个人信息/);assert.equal(r.webSearchAttempted,false);
 }
 assert.equal(publicStudentBoundary('设计学生如何学习'),null);
 assert.equal(publicStudentBoundary('介绍学院教师名单'),null);
 assert.match(buildCuratedKnowledgeContext('未来设计学院师资'),/高鹏/);
});
test('文字提问保留排队校验，但跳过语音识别和合成，并释放队列',async t=>{
 const actions=[];
 t.mock.method(console,'info',()=>{});
 t.mock.method(globalThis,'fetch',async(url)=>{
  const u=String(url);actions.push(u);
  if(u.endsWith('/claim'))return Response.json({ok:true,claimToken:'claim'});
  if(u.endsWith('/complete')||u.endsWith('/release'))return Response.json({ok:true});
  if(u.endsWith('/chat/completions'))return Response.json({choices:[{message:{content:'可以先从观察空间开始。'}}]});
  throw Error('Unexpected speech call');
 });
 const r=await onRequestPost({request:request({text:'设计如何开始',voice_queue_ticket:'12345678-1234-1234-1234-123456789abc'}),env});
 assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),origin);
 const data=await r.json();assert.equal(data.text_only,true);assert.equal(data.audio_base64,'');assert.equal(data.transcript,'设计如何开始');
 assert.equal(actions.length,4);assert.ok(actions.at(-1).endsWith('/release'));
});
test('文字长度、票据、学院来源错误响应也带正确 CORS',async()=>{
 for(const [body,status] of [[{},400],[{text:'a'.repeat(601)},413],[{text:'你好'},429]]){
  const r=await onRequestPost({request:request(body),env});assert.equal(r.status,status);assert.equal(r.headers.get('access-control-allow-origin'),origin);
 }
 assert.equal((await onRequestPost({request:request({text:'你好'},'https://evil.example'),env})).status,403);
});
test('学院同源代理的排队请求通过显式域名白名单',async()=>{
 const r=await proxyVoiceQueue({request:request({}),env},'join',async()=>Response.json({ok:true,ticket:'ticket'}));
 assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),origin);
});

test('学院游戏代理显式允许学院来源，同时拒绝其他站点',async()=>{
 const {proxyGame}=await import('../edge-functions/_shared/yuanbai-game.js');
 const forward=async()=>Response.json({ok:true});
 assert.equal((await proxyGame({request:request({}),env},'runs',forward)).status,200);
 assert.equal((await proxyGame({request:request({},'https://evil.example'),env},'runs',forward)).status,403);
});
