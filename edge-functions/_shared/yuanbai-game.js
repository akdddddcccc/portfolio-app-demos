// 浏览器只访问同域 HTTPS；成绩保存在用户 VPS，地址不是管理密钥。
const UPSTREAM = "http://123.56.162.88/yuanbai-game/api/yuanbai/game/";
export async function proxyGame({request}, route, fetcher = fetch) {
  const url = new URL(request.url);
  const method = route === "leaderboard" ? "GET" : "POST";
  const json = (body, status) => new Response(JSON.stringify(body), {status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  }});
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
    const result = await fetcher(target.href,{method,headers,body,redirect:"error",signal:AbortSignal.timeout(10000)});
    const data = await result.json();
    return json(data,result.status);
  } catch { return json({error:"成绩服务暂时不可用，请稍后重试。"},503); }
}
