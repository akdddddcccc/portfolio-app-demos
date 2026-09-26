// 浏览器只访问同域 HTTPS；成绩保存在用户 VPS，地址不是管理密钥。
const UPSTREAM = "http://123.56.162.88/yuanbai-game/api/yuanbai/game/";
export async function proxyGame({request}, route, fetcher = fetch) {
  const url = new URL(request.url);
  const method = route === "leaderboard" ? "GET" : "POST";
  const json = (body, status) => new Response(JSON.stringify(body), {status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  }});
  // 失败阶段默认只写服务端日志；仅当请求显式带上 ?diag=1 时才回传阶段名，
  // 不向普通浏览器暴露内部细节，也不回传堆栈、密钥或玩家身份令牌。
  const fail = (stage, error) => {
    const code = typeof error?.name === "string" && /^[A-Za-z]{1,24}$/.test(error.name) ? error.name : "Error";
    const detail = typeof error?.message === "string" ? error.message.replace(/Bearer\s+\S+/gi, "Bearer ***").slice(0, 160) : "";
    console.error(`yuanbai-game proxy failed route=${route} stage=${stage} code=${code} detail=${detail}`);
    return json({error:"成绩服务暂时不可用，请稍后重试。", ...(url.searchParams.get("diag") === "1" ? {stage, code} : {})}, 503);
  };
  if (request.method !== method) return json({error:"请求方式不支持"},405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return json({error:"请从游戏页面内提交。"},403);
  const headers = {"Origin":"https://apps-demo.muyang23333.top"};
  const auth = request.headers.get("Authorization");
  if (auth) {
    if (!/^Bearer [a-f0-9]{64}$/.test(auth)) return json({error:"身份凭据无效"},401);
    headers.Authorization = auth;
  }
  try {
    let body;
    if (method === "POST") {
      if (!request.headers.get("Content-Type")?.includes("application/json")) return json({error:"提交格式无效"},415);
      if (Number(request.headers.get("Content-Length")) > 200000) return json({error:"提交内容过大"},413);
      body = await request.text();
      if (new TextEncoder().encode(body).length > 200000) return json({error:"提交内容过大"},413);
      try { JSON.parse(body); } catch { return json({error:"提交格式无效"},400); }
      headers["Content-Type"] = "application/json";
    }
    const target = new URL(route, UPSTREAM);
    if (method === "GET") for (const key of ["page","season","board"]) if (url.searchParams.has(key)) target.searchParams.set(key,url.searchParams.get(key));
    // EdgeOne's V8 runtime has a 15-second fetch timeout by default; avoid
    // AbortSignal.timeout(), which is not listed among its supported APIs.
    let result;
    try { result = await fetcher(target.href,{method,headers,body,redirect:"error"}); }
    catch (error) { return fail("upstream_fetch", error); }
    let data;
    try { data = await result.json(); }
    catch (error) { return fail("upstream_json", error); }
    return json(data,result.status);
  } catch { return json({error:"成绩服务暂时不可用，请稍后重试。"},503); }
}
