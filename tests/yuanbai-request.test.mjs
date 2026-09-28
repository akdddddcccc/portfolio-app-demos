import test from 'node:test';
import assert from 'node:assert/strict';
import {timedRequest} from '../edge-functions/_shared/yuanbai-request.js';

test('deadline aborts a stalled body, labels stage and does not retry',async()=>{
  let calls=0;
  const fetcher=async(_url,{signal,eo})=>{
    calls++;
    assert.equal(eo.timeoutSetting.readTimeout,20);
    return {text:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))};
  };
  await assert.rejects(timedRequest('https://example.test',{},'语音合成',20,r=>r.text(),fetcher),{name:'TimeoutError',stage:'语音合成'});
  assert.equal(calls,1);
});

test('successful request reads body before clearing timeout',async()=>{
  let signal;
  const result=await timedRequest('https://example.test',{},'语音识别',20,r=>r.text(),async(_url,options)=>{
    signal=options.signal; return new Response('ok');
  });
  assert.equal(result.body,'ok');
  await new Promise(resolve=>setTimeout(resolve,35));
  assert.equal(signal.aborted,false);
});
