import {timedRequest} from './yuanbai-request.js';
const UPSTREAM = "http://123.56.162.88/yuanbai-queue/api/yuanbai/voice-queue/";
const ALLOWED_ORIGINS = new Set([
  "https://apps-demo.muyang23333.top",
  "https://muyang23333.top",
  "https://www.muyang23333.top",
]);

export async function proxyVoiceQueue({request, env = {}}, route, fetcher = fetch) {
  const origin = request.headers.get("Origin") || "";
  const permitted = ALLOWED_ORIGINS.has(origin) || String(env.YUANBAI_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean).includes(origin);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    ...(permitted ? {"Access-Control-Allow-Origin": origin, Vary: "Origin"} : {}),
  }});
  if (request.method !== "POST") return json({ok:false,error:"请求方式不支持"},405);
  if (origin && !permitted && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return json({ok:false,error:"请从元白页面内访问。"},403);
  let data;
  try { data = await request.json(); } catch { return json({ok:false,error:"排队请求无效"},400); }
  const ticket = typeof data.ticket === "string" ? data.ticket : "";
  if (route !== "join" && !/^[a-f0-9-]{36}$/i.test(ticket)) return json({ok:false,error:"排队凭据无效"},400);
  try {
    const {response, body: text} = await timedRequest(new URL(route, UPSTREAM), {
      method:"POST", headers:{Origin:"https://apps-demo.muyang23333.top","Content-Type":"application/json"},
      body:JSON.stringify(route === "join" ? {} : {ticket}), redirect:"error",
    }, '排队服务', 5000, r => r.text(), fetcher);
    let result;
    try { result = JSON.parse(text); } catch { return json({ok:false,error:"排队服务暂时没有回应。"},503); }
    return json(result,response.status);
  } catch { return json({ok:false,error:"排队服务暂时不可用，请稍后再试。"},503); }
}

