import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../agents/yuanbai-pilot/index.js';

const origin = 'https://pilot.example.test';
const env = { DASHSCOPE_API_KEY: 'private-key', DEEPSEEK_API_KEY: 'private-key' };
const ticket = '12345678-1234-1234-1234-123456789abc';
// Match @edgeone/types AgentContextRequest, not an Edge Function Web Request.
const post = (body, action = 'chat', source = origin) => ({
  url: `${origin}/yuanbai-pilot?action=${action}`, method: 'POST',
  headers: { origin: source, 'content-type': 'application/json' }, body,
  signal: new AbortController().signal,
});

test('health reports configuration without contacting models or exposing keys', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('unexpected network'); });
  const response = await onRequest({ request: {url:`${origin}/yuanbai-pilot`,method:'GET',headers:{},body:null}, env });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(body, /private-key/);
  assert.equal(JSON.parse(body).configured.asr_tts, true);
});

test('cross-origin and oversized requests never reach the shared queue', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('unexpected network'); });
  assert.equal((await onRequest({request:post({}, 'join', 'https://other.example'),env})).status,403);
  assert.equal((await onRequest({request:post({audio_base64:'A'.repeat(1_000_001)}),env})).status,413);
  assert.equal((await onRequest({request:post({},'claim'),env})).status,400);
});

test('same-origin preview can join the existing shared queue', async t => {
  t.mock.method(console,'info',()=>{});
  t.mock.method(globalThis,'fetch',async(url, options)=>{
    assert.ok(String(url).endsWith('/join'));
    assert.deepEqual(JSON.parse(options.body),{});
    return Response.json({ok:true,ticket,state:'active',capacity:4});
  });
  const response = await onRequest({request:post({},'join'),env});
  assert.equal((await response.json()).capacity,4);
  assert.equal(response.headers.get('X-Yuanbai-Runtime'),'makers-agent-pilot');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});

for (const fail of [false,true]) test(`Agent preserves voice pipeline and releases admission on ${fail?'failure':'success'}`,async t=>{
  const actions=[], logs=[];
  t.mock.method(console,'info',(...args)=>logs.push(args));
  t.mock.method(console,'error',(...args)=>logs.push(args));
  t.mock.method(globalThis,'fetch',async(url, options)=>{
    const target=String(url);
    if(target.endsWith('/claim'))return Response.json({ok:true,claimToken:'private-claim'});
    if(target.endsWith('/complete')||target.endsWith('/release')){actions.push(target.split('/').pop());return Response.json({ok:true});}
    if(target.includes('multimodal-generation'))return fail?Response.json({code:'Throttling',message:'busy'},{status:429}):Response.json({output:{text:'你好'}});
    if(target.includes('chat/completions'))return Response.json({choices:[{message:{content:'你好，慢慢说。'}}]});
    if(target.includes('SpeechSynthesizer')){
      const body=JSON.parse(options.body);
      assert.equal(body.model,'qwen-audio-3.1-tts-flash');
      assert.equal(body.input.speech_rate,0.95);
      assert.match(body.input.voice,/99b47d2c8e7a459d9e49d67ab2d9033d$/);
      return Response.json({output:{audio:'https://audio.example.test/test.mp3'}});
    }
    if(target==='https://audio.example.test/test.mp3')return new Response(new Uint8Array([1,2,3]));
    throw Error('unexpected URL');
  });
  const response=await onRequest({request:post({audio_base64:'cHJpdmF0ZQ==',voice_queue_ticket:ticket}),env});
  assert.equal(response.status,fail?502:200);
  if(!fail)assert.equal((await response.json()).audio_base64,'AQID');
  assert.deepEqual(actions,['complete','release']);
  assert.doesNotMatch(JSON.stringify(logs),/private-key|private-claim|cHJpdmF0ZQ|你好/);
});
