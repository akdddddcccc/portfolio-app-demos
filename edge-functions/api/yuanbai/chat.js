import { YUANBAI_SYSTEM_PROMPT, buildCuratedKnowledgeContext } from "../../_shared/yuanbai-knowledge.js";

const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com";
const DEEPSEEK_BASE = "https://api.deepseek.com";
const MAX_AUDIO_BASE64_LENGTH = 8_000_000;
const MAX_HISTORY_MESSAGES = 8;
const TTS_SPEECH_RATE = 0.5;
const DEFAULT_TTS_MODEL = "qwen-audio-3.1-tts-flash";
const DEFAULT_TTS_VOICE_ID = "qwen-audio-3.1-tts-flash-bailian-99b47d2c8e7a459d9e49d67ab2d9033d";
const MAX_KNOWLEDGE_DOCUMENTS = 8;
const MAX_KNOWLEDGE_CHARACTERS = 160_000;
const ALLOWED_ORIGINS = new Set([
  "https://apps-demo.muyang23333.top",
  "https://muyang23333.top",
  "https://www.muyang23333.top",
]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://apps-demo.muyang23333.top",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

function audioFormatFromMime(mimeType) {
  const mime = String(mimeType || "audio/webm").toLowerCase().split(";")[0];
  const formats = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  return { mime, format: formats[mime] || "webm" };
}

async function fetchJson(url, options, serviceName) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${serviceName} 返回了无法读取的结果`);
  }
  if (!response.ok || data.code) {
    throw new Error(`${serviceName} 请求失败：${data.message || data.code || response.status}`);
  }
  return data;
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 600) }))
    .filter((item) => item.content)
    .slice(-MAX_HISTORY_MESSAGES);
}

function cleanKnowledgeDocuments(value) {
  if (!Array.isArray(value)) return [];
  let remaining = MAX_KNOWLEDGE_CHARACTERS;
  return value.slice(0, MAX_KNOWLEDGE_DOCUMENTS).flatMap((item) => {
    if (!item || typeof item.content !== "string" || remaining <= 0) return [];
    const content = item.content.replace(/\u0000/g, "").trim().slice(0, Math.min(remaining, 50_000));
    if (!content) return [];
    remaining -= content.length;
    return [{
      name: String(item.name || "未命名资料").replace(/[\r\n]/g, " ").slice(0, 120),
      content,
    }];
  });
}

function retrievalTokens(query) {
  const normalized = String(query || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const tokens = new Set(String(query || "").toLowerCase().match(/[a-z0-9][a-z0-9._-]{1,}/g) || []);
  for (const size of [2, 3, 4]) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      tokens.add(normalized.slice(index, index + size));
    }
  }
  return [...tokens];
}

function buildUploadedKnowledgeContext(query, documents) {
  const tokens = retrievalTokens(query);
  const chunks = documents.flatMap((document) => {
    const paragraphs = document.content.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
    const grouped = [];
    let buffer = "";
    paragraphs.forEach((paragraph) => {
      if (buffer && buffer.length + paragraph.length > 850) {
        grouped.push(buffer);
        buffer = "";
      }
      buffer += `${buffer ? "\n" : ""}${paragraph.slice(0, 1400)}`;
    });
    if (buffer) grouped.push(buffer);
    return grouped.map((content) => ({ name: document.name, content }));
  });

  return chunks.map((chunk) => {
    const haystack = chunk.content.toLowerCase();
    let score = 0;
    tokens.forEach((token) => {
      if (haystack.includes(token)) score += token.length * token.length;
    });
    return { ...chunk, score };
  }).filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((chunk) => `[上传资料｜${chunk.name}]\n${chunk.content}`)
    .join("\n\n");
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function transcribe(audioBase64, mimeType, apiKey) {
  const { mime, format } = audioFormatFromMime(mimeType);
  const data = await fetchJson(
    `${DASHSCOPE_BASE}/api/v1/services/aigc/multimodal-generation/generation`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-SSE": "disable",
      },
      body: JSON.stringify({
        model: "fun-asr-realtime",
        input: {
          messages: [{ role: "user", content: [{ audio: `data:${mime};base64,${audioBase64}` }] }],
        },
        parameters: { format, vad_enabled: true },
        resources: [],
      }),
    },
    "语音识别",
  );
  return String(data.output?.text || data.output?.output?.text || "").trim();
}

async function chat(transcript, history, documents, apiKey, apiBase, model) {
  const curatedContext = buildCuratedKnowledgeContext(transcript);
  const uploadedContext = buildUploadedKnowledgeContext(transcript, documents);
  const knowledgeContext = [
    "以下是根据当前问题检索出的参考资料。只使用其中能直接支持回答的内容；资料没有答案时要坦率说明。",
    curatedContext,
    uploadedContext,
  ].filter(Boolean).join("\n\n");
  const data = await fetchJson(
    `${String(apiBase || DEEPSEEK_BASE).replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [
          { role: "system", content: YUANBAI_SYSTEM_PROMPT },
          { role: "system", content: knowledgeContext },
          ...history,
          { role: "user", content: transcript },
        ],
        temperature: 0.68,
        max_tokens: 320,
        stream: false,
      }),
    },
    "对话生成",
  );
  return String(data.choices?.[0]?.message?.content || "").trim().replace(/^[-*#\s]+/, "").slice(0, 600);
}

async function synthesize(text, apiKey, model, voice) {
  const data = await fetchJson(
    `${DASHSCOPE_BASE}/api/v1/services/audio/tts/SpeechSynthesizer`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || DEFAULT_TTS_MODEL,
        input: {
          text,
          voice: voice || DEFAULT_TTS_VOICE_ID,
          format: "mp3",
          sample_rate: 22050,
          // 元白保持舒缓、有停顿的表达；只改语速，不改变已选定的音色。
          speech_rate: TTS_SPEECH_RATE,
          pitch_rate: 1.0,
        },
      }),
    },
    "语音合成",
  );
  const audioUrl = typeof data.output?.audio === "string" ? data.output.audio : data.output?.audio?.url;
  if (!audioUrl) throw new Error("语音合成没有返回音频地址");
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error("生成的声音文件下载失败");
  return arrayBufferToBase64(await audioResponse.arrayBuffer());
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("Origin") || "") });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    return jsonResponse({ ok: false, error: "当前来源不能调用元白服务。" }, 403, origin);
  }

  if (!env.DASHSCOPE_API_KEY || !env.DEEPSEEK_API_KEY) {
    return jsonResponse({ ok: false, error: "元白网页的云端密钥尚未配置。" }, 503, origin);
  }

  try {
    const body = await request.json();
    const audioBase64 = typeof body.audio_base64 === "string" ? body.audio_base64.trim() : "";
    if (!audioBase64) return jsonResponse({ ok: false, error: "没有收到录音。" }, 400, origin);
    if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
      return jsonResponse({ ok: false, error: "这段录音太长了，请分成两次说。" }, 413, origin);
    }

    const transcript = await transcribe(audioBase64, body.mime_type, env.DASHSCOPE_API_KEY);
    if (!transcript) return jsonResponse({ ok: false, error: "我没有听清，请靠近麦克风再说一次。" }, 422, origin);

    const answer = await chat(
      transcript,
      cleanHistory(body.history),
      cleanKnowledgeDocuments(body.knowledge_documents),
      env.DEEPSEEK_API_KEY,
      env.DEEPSEEK_API_BASE,
      env.DEEPSEEK_MODEL,
    );
    if (!answer) throw new Error("对话生成没有返回内容");

    const audioBase64Result = await synthesize(
      answer,
      env.DASHSCOPE_API_KEY,
      env.YUANBAI_TTS_MODEL,
      env.YUANBAI_TTS_VOICE_ID,
    );

    return jsonResponse(
      { ok: true, transcript, answer, audio_base64: audioBase64Result, audio_mime_type: "audio/mpeg" },
      200,
      origin,
    );
  } catch (error) {
    console.error("Yuanbai request failed", error?.message || error);
    return jsonResponse({ ok: false, error: error?.message || "元白暂时没有回答成功，请再试一次。" }, 502, origin);
  }
}
