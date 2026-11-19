import test from 'node:test';import assert from 'node:assert/strict';import {makeLightLimit} from './light-limit.mjs';
test('light limiter reserves synchronously, rejects duplicate IDs and enforces visitor and instance limits',()=>{
 const reserve=makeLightLimit(),limits=[2,3,1,1],r=(ip,kind,id,day=1)=>reserve(day,ip,kind,id,limits)[0];
 assert.equal(r('a','chat','1'),0);assert.equal(r('a','chat','1'),2);assert.equal(r('a','chat','2'),0);assert.equal(r('a','chat','3'),1);
 assert.equal(r('b','chat','4'),0);assert.equal(r('c','chat','5'),1);assert.equal(r('a','image','1'),0);assert.equal(r('b','image','2'),1);assert.equal(r('a','image','1',2),0);
});
