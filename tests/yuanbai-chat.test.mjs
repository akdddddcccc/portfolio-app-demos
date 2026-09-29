import assert from "node:assert/strict";
import test from "node:test";
import { audioFormatFromMime, normalizeYuanbaiAsrTranscript, onRequestPost } from "../edge-functions/api/yuanbai/chat.js";

test("successful speech releases its lease before returning audio and records private-free timings", async t => {
  const logs=[], actions=[];
  t.mock.method(console,"info",(...args)=>logs.push(args));
  t.mock.method(globalThis,"fetch",async(url,options)=>{
    const target=String(url);
    if(target.endsWith('/claim'))return Response.json({ok:true,claimToken:'private-claim'});
    if(target.endsWith('/complete')||target.endsWith('/release')){actions.push(target.split('/').pop());return Response.json({ok:true});}
    if(target.includes('multimodal-generation'))return Response.json({output:{text:'你好'}});
    if(target.includes('chat/completions')){
      assert.equal(options.eo.timeoutSetting.readTimeout,40000);
      return Response.json({choices:[{message:{content:'你好，慢慢说。'}}]});
    }
    if(target.includes('SpeechSynthesizer'))return Response.json({output:{audio:'https://audio.example.test/voice.mp3'}});
    if(target==='https://audio.example.test/voice.mp3')return new Response(new Uint8Array([1,2,3]));
    throw Error('unexpected URL');
  });
  const response=await onRequestPost({request:new Request('https://example.test/api/yuanbai/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      audio_base64:'cHJpdmF0ZQ==',voice_queue_ticket:'12345678-1234-1234-1234-123456789abc',
    }),
  }),env:{DASHSCOPE_API_KEY:'private-api-key',DEEPSEEK_API_KEY:'private-api-key'}});
  assert.equal(response.status,200);
  assert.equal((await response.json()).audio_base64,'AQID');
  assert.deepEqual(actions,['complete','release']);
  assert.equal(logs[0][1].ok,true);
  for(const key of ['admission_ms','asr_ms','dialogue_ms','tts_ms','total_ms'])assert.ok(logs[0][1][key]>=0);
  assert.doesNotMatch(JSON.stringify(logs),/你好|private-|cHJpdmF0ZQ/);
});

test("silently normalizes Yuanbai ASR homophones without rewriting another person's name", () => {
  assert.equal(normalizeYuanbaiAsrTranscript("高朋院长研究什么？"), "高鹏院长研究什么？");
  assert.equal(normalizeYuanbaiAsrTranscript("你认不认识袁延哉。"), "你认不认识原研哉。");
  assert.equal(normalizeYuanbaiAsrTranscript("袁白老师，能给我讲讲设计思维吗？"), "元白老师，能给我讲讲设计思维吗？");
  assert.equal(normalizeYuanbaiAsrTranscript("我想回袁白楼看看。"), "我想回元白楼看看。");
  assert.equal(normalizeYuanbaiAsrTranscript("袁白同学的设计作品很有意思。"), "袁白同学的设计作品很有意思。");
});

test("maps browser-compressed audio containers to supported ASR formats", () => {
  assert.deepEqual(audioFormatFromMime("audio/webm;codecs=opus"), {
    mime: "audio/webm",
    format: "webm",
  });
  assert.deepEqual(audioFormatFromMime("audio/ogg;codecs=opus"), {
    mime: "audio/ogg",
    format: "ogg",
  });
  assert.deepEqual(audioFormatFromMime("audio/mp4"), {
    mime: "audio/mp4",
    format: "mp4",
  });
});

test("rejects audio that would exceed the EdgeOne request-body budget before calling providers", async () => {
  const request = new Request("https://example.test/api/yuanbai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_base64: "A".repeat(800_001), mime_type: "audio/wav" }),
  });
  const response = await onRequestPost({
    request,
    env: { DASHSCOPE_API_KEY: "test-key", DEEPSEEK_API_KEY: "test-key" },
  });

  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /分成两次/u);
});

test("refuses speech generation without a server-issued queue ticket",async()=>{
  const response=await onRequestPost({request:new Request("https://example.test/api/yuanbai/chat",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({audio_base64:"dGVzdA==",mime_type:"audio/webm"}),
  }),env:{DASHSCOPE_API_KEY:"test-key",DEEPSEEK_API_KEY:"test-key"}});
  assert.equal(response.status,429);
  assert.match((await response.json()).error,/等候队列/u);
});

test("provider failure completes and releases the admission lease", async t => {
  const calls = [];
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const action = String(url).split("/").pop();
    calls.push({ action, body: JSON.parse(options.body) });
    if (action === "claim") return Response.json({ ok: true, claimToken: "server-only-token" });
    if (action === "complete" || action === "release") return Response.json({ ok: true });
    return Response.json({ message: "provider unavailable" }, { status: 503 });
  });
  const ticket = "12345678-1234-1234-1234-123456789abc";
  const response = await onRequestPost({
    request: new Request("https://example.test/api/yuanbai/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_base64: "dGVzdA==", mime_type: "audio/webm", voice_queue_ticket: ticket }),
    }),
    env: { DASHSCOPE_API_KEY: "test-key", DEEPSEEK_API_KEY: "test-key" },
  });
  assert.equal(response.status, 502);
  assert.equal(calls[0].action, "claim");
  const completion=calls.find(call=>call.action==='complete');
  assert.equal(completion.body.diagnostics.ok,false);
  assert.equal(completion.body.diagnostics.stage,'语音识别');
  delete completion.body.diagnostics;
  assert.deepEqual(calls.slice(-2), [
    { action: "complete", body: { ticket, claimToken: "server-only-token" } },
    { action: "release", body: { ticket } },
  ]);
  assert.doesNotMatch(await response.text(), /server-only-token/);
});

test("TTS rate limit logs its stage and provider request ID without private input", async t => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  t.mock.method(globalThis, "fetch", async (url) => {
    const target = String(url);
    if (target.endsWith("/claim")) return Response.json({ ok: true, claimToken: "server-only-token" });
    if (target.endsWith("/complete") || target.endsWith("/release")) return Response.json({ ok: true });
    if (target.includes("multimodal-generation")) return Response.json({ output: { text: "你好" } });
    if (target.includes("chat/completions")) return Response.json({ choices: [{ message: { content: "你好，慢慢说。" } }] });
    if (target.includes("SpeechSynthesizer")) {
      return Response.json({ code: "Throttling.RateQuota", message: "Too many requests", request_id: "tts-request-123" }, { status: 429 });
    }
    throw new Error(`Unexpected test URL: ${target}`);
  });

  const response = await onRequestPost({
    request: new Request("https://example.test/api/yuanbai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_base64: "QUJD",
        mime_type: "audio/webm",
        voice_queue_ticket: "12345678-1234-1234-1234-123456789abc",
      }),
    }),
    env: { DASHSCOPE_API_KEY: "private-test-key", DEEPSEEK_API_KEY: "private-test-key" },
  });

  assert.equal(response.status, 502);
  assert.deepEqual(logs, [["Yuanbai request failed", {
    stage: "语音合成",
    upstream_status: 429,
    upstream_code: "Throttling.RateQuota",
    request_id: "tts-request-123",
    error_name: "Error",
  }]]);
  assert.doesNotMatch(JSON.stringify(logs), /private-test-key|server-only-token|QUJD|你好/u);
});
