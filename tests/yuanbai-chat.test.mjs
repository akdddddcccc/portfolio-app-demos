import assert from "node:assert/strict";
import test from "node:test";
import { audioFormatFromMime, onRequestPost } from "../edge-functions/api/yuanbai/chat.js";

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
