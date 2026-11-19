// Only this catalogue voice is allowed, including on requests from cached clients.
export const preset = Object.freeze({ model: "qwen-audio-3.1-tts-flash", voice: "longanhuan_v3.1" });
export function speechPayload(text, format) {
  return { model: preset.model, input: { text, voice: preset.voice, format, sample_rate: 24000,
    rate: 0.95, pitch: 1, seed: 0,
    instruction: "用自然的普通话聊天语气。逗号处轻停并连贯读完整句，句末自然停顿，避免逐字顿读或拖长尾音。" } };
}

export function finalTranscript(body) {
  let final = "", partial = false;
  const trimmed = body.trim();
  const records = trimmed.startsWith("{") ? [trimmed] : trimmed.split(/\r?\n/)
    .filter(line => line.startsWith("data:")).map(line => line.slice(5).trim());
  for (const record of records) {
    if (!record || record === "[DONE]") continue;
    const event = JSON.parse(record);
    if (event.code || event.error) throw new Error("语音识别失败");
    const output = event.output?.output || event.output || event;
    const sentence = output.sentence;
    if (sentence?.sentence_end === false) { partial = true; continue; }
    const text = sentence?.text || output.text || output.choices?.[0]?.message?.content?.[0]?.text;
    if (text?.trim()) { final = text.trim(); partial = false; }
  }
  return partial ? "" : final;
}

async function* events(url, options, stage, signal) {
  const response = await fetch(url, { ...options, signal, redirect: "error",
    eo: {timeoutSetting: {connectTimeout: 10000, readTimeout: 40000, writeTimeout: 10000}} });
  if (!response.ok || !response.body) throw new Error(stage + "暂时不可用（" + response.status + "）");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() + "\n" : decoder.decode(value, {stream:true});
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        if (!data) continue;
        const event = JSON.parse(data);
        if (event.code || event.error) throw new Error(stage + "暂时不可用");
        yield event;
      }
      if (buffer.length > 524288) throw new Error(stage + "数据过大");
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function streamingCompletion(url, options, onText, signal) {
  let answer = "", finished = false;
  for await (const event of events(url, options, "对话生成", signal)) {
    const choice = event.choices?.[0];
    const text = (choice?.delta?.content || "").slice(0, 600 - answer.length);
    if (text) { answer += text; onText(text); }
    if (choice?.finish_reason) finished = true;
  }
  if (!finished || !answer.trim()) throw new Error("文字回答未完整返回");
  return {choices:[{message:{content:answer}}]};
}

async function speak(text, base, key, signal, emit) {
  const options = {method:"POST", headers:{Authorization:"Bearer " + key, "Content-Type":"application/json",
    Accept:"text/event-stream", "X-DashScope-SSE":"enable"}, body:JSON.stringify(speechPayload(text, "pcm"))};
  let audio = false;
  for await (const event of events(base + "/api/v1/services/audio/tts/SpeechSynthesizer", options, "语音合成", signal)) {
    const output = event.output;
    if (output?.audio?.data) { emit({type:"pcm", data:output.audio.data}); audio = true; }
    if (output?.finish_reason === "stop" && audio) return;
  }
  throw new Error("语音未完整返回");
}

export function streamReply({transcript, generate, base, key, headers, complete, metadata, signal}) {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, {once:true});
  const body = new ReadableStream({
    async start(controller) {
      const timer = setTimeout(cancel, 90000);
      const encoder = new TextEncoder();
      const emit = event => { if (!abort.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      let speech = Promise.resolve(), unavailable = false, received = false, pending = "", ok = false;
      function queueSentence(sentence) {
        if (!sentence.trim()) return;
        speech = speech.then(async () => {
          if (unavailable || abort.signal.aborted) return;
          try { await speak(sentence, base, key, abort.signal, emit); }
          catch { unavailable = true; }
        });
      }
      function delta(text) {
        received = true;
        emit({type:"text", text});
        pending += text;
        let match;
        while ((match = /[。！？!?\n]+/.exec(pending)) || pending.length >= 240) {
          const n = match ? match.index + match[0].length : 240;
          queueSentence(pending.slice(0,n));
          pending = pending.slice(n);
        }
      }
      try {
        emit({type:"start", transcript, voice:preset.voice, rate:24000});
        const result = await generate(delta, abort.signal);
        if (!result.answer) throw new Error("对话生成没有返回内容");
        if (!received) delta(result.answer);
        queueSentence(pending);
        emit({type:"answer", transcript, answer:result.answer, ...metadata(result)});
        await speech;
        if (abort.signal.aborted) throw new Error("请求已结束");
        emit({type:"end", audio:!unavailable});
        ok = !unavailable;
      } catch {
        emit({type:"error", message:"这次回复中断，请重新提问。"});
      } finally {
        clearTimeout(timer);
        cancel();
        signal?.removeEventListener("abort", cancel);
        try { await complete(ok); } finally { try { controller.close(); } catch {} }
      }
    },
    cancel,
  });
  return new Response(body,{headers:{...headers,"Content-Type":"application/x-ndjson; charset=utf-8",
    "Cache-Control":"no-store, no-transform","X-Accel-Buffering":"no"}});
}
