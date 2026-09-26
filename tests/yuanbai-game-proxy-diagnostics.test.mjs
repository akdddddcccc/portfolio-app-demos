import test from "node:test";
import assert from "node:assert/strict";
import {proxyGame} from "../edge-functions/_shared/yuanbai-game.js";

const origin = "https://apps-demo.muyang23333.top";
const unavailable = {error:"成绩服务暂时不可用，请稍后重试。"};

async function withCapturedLogs(run) {
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args.map(String).join(" "));
  try {
    return {result: await run(), logs};
  } finally {
    console.error = original;
  }
}

test("upstream failure keeps the public message and hides the stage by default", async () => {
  let options;
  const request = new Request(origin + "/api/yuanbai/game/leaderboard?board=normal", {headers:{Origin:origin}});
  const {result: response, logs} = await withCapturedLogs(() => proxyGame({request}, "leaderboard", async (url, init) => {
    options = init;
    throw new TypeError("network unreachable");
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), unavailable);
  assert.equal(options.signal, undefined, "no AbortSignal is passed to EdgeOne fetch");
  assert.deepEqual(Object.keys(options).sort(), ["body", "headers", "method", "redirect"], "only documented fetch options are used");
  assert.equal(logs.length, 1);
  assert.match(logs[0], /stage=upstream_fetch/);
  assert.match(logs[0], /code=TypeError/);
});

test("diag=1 exposes the failing stage without leaking upstream details", async () => {
  const request = new Request(origin + "/api/yuanbai/game/leaderboard?diag=1&board=deaths", {headers:{Origin:origin}});
  const {result: response} = await withCapturedLogs(() => proxyGame({request}, "leaderboard", async () => {
    throw new TypeError("dial tcp 123.56.162.88:80: connect: connection refused");
  }));
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.error, unavailable.error);
  assert.equal(payload.stage, "upstream_fetch");
  assert.equal(payload.code, "TypeError");
  assert.equal(JSON.stringify(payload).includes("connection refused"), false, "upstream detail stays out of the browser response");
});

test("non-JSON upstream replies report the parsing stage", async () => {
  const request = new Request(origin + "/api/yuanbai/game/leaderboard?diag=1", {headers:{Origin:origin}});
  const {result: response, logs} = await withCapturedLogs(() => proxyGame({request}, "leaderboard", async () => new Response("<html>502 Bad Gateway</html>", {status:502})));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).stage, "upstream_json");
  assert.equal(logs.length, 1);
  assert.match(logs[0], /stage=upstream_json/);
});

test("server-side failure logs never contain the player token", async () => {
  const token = "b".repeat(64);
  const request = new Request(origin + "/api/yuanbai/game/runs", {method:"POST", headers:{Origin:origin, "Content-Type":"application/json", Authorization:"Bearer " + token}, body:"{}"});
  const {result: response, logs} = await withCapturedLogs(() => proxyGame({request}, "runs", async () => {
    throw new Error("upstream rejected Bearer " + token);
  }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).stage, undefined);
  assert.equal(logs.join("\n").includes(token), false);
  assert.match(logs[0], /Bearer \*\*\*/);
});
