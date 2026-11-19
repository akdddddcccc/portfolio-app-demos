import test from "node:test";
import assert from "node:assert/strict";
import {streamReply, streamingCompletion, finalTranscript} from "../edge-functions/_shared/yuanbai-stream.js";

test("plays the first sentence before generation finishes and keeps the catalogue voice on each request", async t => {
  const encode = new TextEncoder();
  const event = value => encode.encode("data: " + JSON.stringify(value) + "\n\n");
  let finishText, completed;
  const wait = new Promise(resolve => { finishText = resolve; });
  let spoken = [];
  t.mock.method(globalThis, "fetch", async (url, opts) => {
    if (url === "https://test/completion") return new Response(new ReadableStream({
      async start(c) {
        c.enqueue(event({choices:[{delta:{content:"第一句。"}}]}));
        await wait;
        c.enqueue(event({choices:[{delta:{content:"第二句。"},finish_reason:"stop"}]}));
        c.close();
      }
    }));
    const {model,input} = JSON.parse(opts.body);
    assert.equal(model,"qwen-audio-3.1-tts-flash");
    assert.equal(input.voice,"longanhuan_v3.1");
    assert.equal(input.format,"pcm"); assert.equal(input.sample_rate,24000);
    spoken.push(input.text);
    return new Response(event({output:{audio:{data:"AAA="},finish_reason:"stop"}}));
  });
  const response=streamReply({transcript:"测试",base:"https://test",key:"test",metadata:()=>({}),
    complete:ok=>{completed=ok;},generate:async (delta,signal)=>{
      const result=await streamingCompletion("https://test/completion",{},delta,signal);
      return {answer:result.choices[0].message.content};
    }});
  const reader=response.body.getReader(), frames=[];
  while(true){
    const {value,done}=await reader.read(); if(done)break;
    const frame=JSON.parse(new TextDecoder().decode(value));
    frames.push(frame.type);
    if(frame.type==="pcm")finishText();
  }
  assert.deepEqual(spoken,["第一句。","第二句。"]);
  assert.ok(frames.indexOf("pcm") < frames.lastIndexOf("text"));
  assert.equal(frames.at(-1),"end");assert.equal(completed,true);
});

test("ignores provisional transcripts and rejects an unfinished last hypothesis", () => {
  const record=(text,end)=>"data: "+JSON.stringify({output:{sentence:{text,sentence_end:end}}})+"\n";
  assert.equal(finalTranscript(record("元",false)+record("元白",true)),"元白");
  assert.equal(finalTranscript(record("元",false)),"");
});
