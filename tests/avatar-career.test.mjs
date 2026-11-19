import test from 'node:test';
import assert from 'node:assert/strict';
import {contextFor,curatedLinks,demoReply} from '../lib/avatar/knowledge.mjs';
import {createProviders} from '../lib/avatar/providers.mjs';

test('both live contexts carry reviewed career details and only real portfolio links',()=>{
  for(const lang of ['zh','en']){
    const data=JSON.parse(contextFor('具体呢？',[],lang)).careerCases;
    assert.equal(new Set(data.map(x=>x.topic)).size,data.length);
    assert.ok(data.length>=9);
    for(const entry of data){
      assert.deepEqual(Object.keys(entry).sort(),entry.project?['details','project','topic']:['details','topic']);
      if(entry.project)assert.equal(curatedLinks([entry.project],lang).length,1);
    }
    assert.doesNotMatch(JSON.stringify(data),/https?:|github\.com|@|100 套|30 套|5 分钟|CareerDB|船舶/);
    assert.match(data.find(x=>x.topic.includes('8 Mile')).details,/未被采用|not adopted/);
  }
});
test('a vague second turn gets both prior turns and the specific evidence in the model request',async()=>{
  const history=[{role:'user',content:'在中天参与过什么？'},{role:'assistant',content:'他参与过收费站设备设计。'}];
  const provider=createProviders({DEEPSEEK_API_KEY:'test'},async(url,options)=>{
    const input=JSON.parse(options.body);
    assert.deepEqual(input.messages.slice(1,-1),history);
    assert.match(input.messages[0].content,/自助发卡机/);
    assert.match(input.messages[0].content,/协作贡献/);
    return Response.json({choices:[{message:{content:'有自助发卡机和自助缴费机。'}}]});
  });
  assert.equal((await provider.chat({message:'具体是哪几款？',history})).mode,'live');
});
test('local guide can expand an identified case without confusing it with contact info',()=>{
  assert.match(demoReply({message:'微信公众号助理怎么处理语音？'}).text,/最近的图片/);
  assert.match(demoReply({message:'具体做了什么？',history:[{role:'user',content:'河南中天'}]}).text,/岛尾/);
  assert.match(demoReply({message:'地下八英里的海报呢？'}).text,/未被采用/);
});
