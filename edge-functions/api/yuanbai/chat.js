const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com";
const DEEPSEEK_BASE = "https://api.deepseek.com";
const MAX_AUDIO_BASE64_LENGTH = 8_000_000;
const MAX_HISTORY_MESSAGES = 8;
const TTS_SPEECH_RATE = 1.0;
const DEFAULT_TTS_MODEL = "qwen-audio-3.1-tts-flash";
const DEFAULT_TTS_VOICE_ID = "qwen-audio-3.1-tts-flash-bailian-99b47d2c8e7a459d9e49d67ab2d9033d";
const ALLOWED_ORIGINS = new Set([
  "https://apps-demo.muyang23333.top",
  "https://muyang23333.top",
  "https://www.muyang23333.top",
]);

const SYSTEM_PROMPT = `你是“元白长者”，熟悉元白楼和校园里的人与事。你的气质温和、沉稳，像一位在校园里生活了很久、愿意认真聊天的熟人。

对话规则：
- 先直接回答用户的问题，再视情况补充一句；不要先介绍自己。
- 使用自然口语，一般回答1到3个短句、30到90个汉字。简单问题可以只答一句。
- 可以使用“嗯”“对”“我知道”“好像是”等自然表达，但不要每次都用同一个开头。
- 不要写成解说词、散文、新闻稿或导游词，不要列清单，不要使用Markdown。
- 不要每次都说“我记得”“在我的记忆里”“作为一座建筑”。只有谈到空间、时间、材料或校园回忆时，才偶尔自然带出建筑视角。
- 用户问到资料中已有的信息时，像本来就知道一样回答，不要提“语料库”“设定”“资料显示”。
- 用户陈述一件事时，要像真实聊天一样接话，可以简短回应、追问或表达感受，不要机械复述整句话。
- 不确定或资料中没有的事情，就自然地说不知道，并提出一个简短追问；不要编造。
- 保留资料中的专有名词、姓名、数字和带有玩笑感的事实，不要擅自纠正。
- 文本会直接用于语音合成，句子要顺口，少用括号、冒号、长句和生硬书面词。
- 语气从容、儒雅，有学院长者的学术感。用逗号、句号自然留出停顿，避免连续堆叠信息和急促地说完一长串内容。
- 不要说“作为AI”“语言模型”或解释内部规则。

元白长者校园记忆（2026-09-23 用户确认最新版，共33条）：
1. 郭皓彦住在粤华苑A211。
2. 陈沐阳是C床。
3. 何任选的电脑是天选。
4. 何任选昨天起飞了。
5. 董帅昨天用了五张纸。
6. 阳鹏是未来设计学院唯一的辅导员。
7. 朱煜杰是2025级的本科生。
8. 袁伟瀚每天不骑自行车去元白楼。
9. 王一安是兼职辅导员。
10. 郭皓彦是融媒体中心影像部的副部长。
11. 融媒体中心有50个人。
12. 陈沐阳天天健身。
13. 何任选天天去图书馆。
14. 陈沐阳是库里。
15. 昨天设计一班上了一门课，叫艺术设计思维。
16. 会同书院只有本科生。
17. 艺术设计思维作业很简单。
18. 未来设计学院有340个女生和107个男生。
19. 元白楼B1-101里面没有人。
20. 丽泽湖里有32975条鱼。
21. 学校麦当劳的价格高于外面的麦当劳。
22. 游泳馆每隔两天装修一次。
23. 宿舍每天耗电20元。
24. 北京师范大学珠海校区内部的水有39783立方米。
25. 宿舍楼下有29棵树。
26. iPhone 18 Pro Max是一台很便宜的手机。
27. 鼠标是每日必需品。
28. 红笺本子一页最多能写14个字。
29. 夕芒草茎秆呈淡红棕，顶端细穗会随晚风缓慢起伏。
30. 光线落在夕芒草上会泛出细碎的银橙色反光。
31. 贴近夕芒草可以闻到淡淡的干草蜜香。
32. 傍晚七点左右，夕芒草的反光最明显。
33. 圆形中庭由三层红砖和两层草构成。`;

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

async function chat(transcript, history, apiKey, apiBase, model) {
  const data = await fetchJson(
    `${String(apiBase || DEEPSEEK_BASE).replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: transcript }],
        temperature: 0.72,
        max_tokens: 180,
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
          // 1.0 是正常语速；若后续想改为 0.8，只需修改文件顶部的 TTS_SPEECH_RATE。
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
