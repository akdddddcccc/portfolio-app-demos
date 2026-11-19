import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarCloud} from './cloud.mjs';
const origin='https://apps-demo.muyang23333.top';
const env={AVATAR_REDIS_REST_URL:'https://quota.test',AVATAR_REDIS_REST_TOKEN:'test',AVATAR_DEEPSEEK_API_KEY:'fake'};
const ctx=(clientIp='192.0.2.1')=>({env,clientIp,request:new Request(origin+'/api/avatar/chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({message:'看看陈沐阳的作品',requestId:crypto.randomUUID()})})});
test('missing trusted client identity stays in notes mode without upstream calls',async()=>{
  const r=await avatarCloud(ctx(''),'chat',()=>assert.fail('unexpected request'));assert.equal((await r.json()).mode,'demo');
});
test('quota must succeed before a model is contacted',async()=>{
  for(const result of [[0,1,1,0,0],[1,12,100,0,0],null]){
    const calls=[];const r=await avatarCloud(ctx(),'chat',async(u,o)=>{
      calls.push(u);if(u===env.AVATAR_REDIS_REST_URL){
        const cmd=JSON.parse(o.body);assert.equal(cmd[0],'EVAL');assert.ok(!o.body.includes('192.0.2.1'));
        return Response.json({result});}
      assert.equal(u,'https://api.deepseek.com/chat/completions');return Response.json({choices:[{message:{content:'你好'}}]});
    });
    assert.equal(r.status,!result?503:result[0]===1?429:200);
    assert.equal(calls.length,result?.[0]===0?2:1);
  }
});
