import assert from "node:assert/strict";
import test from "node:test";
import {proxyVoiceQueue} from "../edge-functions/_shared/yuanbai-voice-queue.js";

test("排队网关只转发允许的动作和票据，不接受任意路径",async()=>{
  let forwarded;
  const request=new Request("https://apps-demo.muyang23333.top/api/yuanbai/voice-queue/status",{
    method:"POST",headers:{Origin:"https://apps-demo.muyang23333.top","Content-Type":"application/json"},body:JSON.stringify({ticket:"12345678-1234-1234-1234-123456789abc"}),
  });
  const response=await proxyVoiceQueue({request},"status",async(url,options)=>{
    forwarded={url:String(url),options};
    return new Response(JSON.stringify({ok:true,state:"active",position:0}),{status:200});
  });
  assert.equal(response.status,200);
  assert.match(forwarded.url,/voice-queue\/status$/);
  assert.deepEqual(JSON.parse(forwarded.options.body),{ticket:"12345678-1234-1234-1234-123456789abc"});
});

test("排队网关拒绝其他网站和格式错误的票据",async()=>{
  const evil=new Request("https://apps-demo.muyang23333.top/api/yuanbai/voice-queue/status",{method:"POST",headers:{Origin:"https://evil.example","Content-Type":"application/json"},body:"{}"});
  assert.equal((await proxyVoiceQueue({request:evil},"status",()=>{throw Error("unexpected");})).status,403);
  const invalid=new Request("https://apps-demo.muyang23333.top/api/yuanbai/voice-queue/release",{method:"POST",headers:{Origin:"https://apps-demo.muyang23333.top","Content-Type":"application/json"},body:JSON.stringify({ticket:"not-a-ticket"})});
  assert.equal((await proxyVoiceQueue({request:invalid},"release",()=>{throw Error("unexpected");})).status,400);
});
