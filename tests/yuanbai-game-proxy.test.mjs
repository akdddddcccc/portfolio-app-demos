import test from "node:test";
import assert from "node:assert/strict";
import {proxyGame} from "../edge-functions/_shared/yuanbai-game.js";

const origin = "https://apps-demo.muyang23333.top";

test("榜单同源转发保留页码、规则版本和榜单类型", async () => {
  let upstream;
  const request = new Request(origin + "/api/yuanbai/game/leaderboard?page=2&season=current&board=deaths", {headers:{Origin:origin}});
  const response = await proxyGame({request}, "leaderboard", async (url, options) => {
    upstream = {url, options};
    return new Response(JSON.stringify({items:[],board:"deaths"}), {headers:{"Content-Type":"application/json"}});
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).board, "deaths");
  assert.match(upstream.url, /board=deaths/);
  assert.equal(upstream.options.method, "GET");
  assert.equal(upstream.options.signal, undefined, "use EdgeOne's supported fetch timeout instead of AbortSignal.timeout");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("提交保留身份令牌和 JSON；跨来源与无效令牌被拒绝", async () => {
  const token = "a".repeat(64);
  let upstream;
  const request = new Request(origin + "/api/yuanbai/game/runs", {method:"POST",headers:{Origin:origin,"Content-Type":"application/json",Authorization:"Bearer "+token},body:"{}"});
  const response = await proxyGame({request}, "runs", async (url, options) => {
    upstream = {url, options};return new Response("{}", {status:201});
  });
  assert.equal(response.status,201);
  assert.equal(upstream.options.headers.Authorization,"Bearer "+token);
  assert.equal(upstream.options.body,"{}");
  assert.equal((await proxyGame({request:new Request(origin+"/api/yuanbai/game/runs",{method:"POST",headers:{Origin:"https://evil.example","Content-Type":"application/json"},body:"{}"})},"runs",()=>{throw Error("should not call") })).status,403);
  assert.equal((await proxyGame({request:new Request(origin+"/api/yuanbai/game/runs",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",Authorization:"Bearer invalid"},body:"{}"})},"runs",()=>{throw Error("should not call") })).status,401);
});
