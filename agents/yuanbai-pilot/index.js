import { onRequestPost } from '../../edge-functions/api/yuanbai/chat.js';
import { proxyVoiceQueue } from '../../edge-functions/_shared/yuanbai-voice-queue.js';

const QUEUE_ACTIONS = new Set(['join', 'status', 'release']);
const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Yuanbai-Runtime': 'makers-agent-pilot' },
});

// Frameworkless Agent: reuse the exact production pipeline, voice and FIFO gate.
// This new route does not replace /api/yuanbai/chat. No Store or Sandbox is used.
export async function onRequest(context) {
  const { request, env = {} } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return json({ ok: false, error: '请在同一测试站点内调用。' }, 403);
  }
  if (request.method === 'GET') {
    return json({ ok: true, runtime: 'makers-agent-pilot', protocol: 1,
      configured: { asr_tts: Boolean(env.DASHSCOPE_API_KEY), dialogue: Boolean(env.DEEPSEEK_API_KEY) },
      shared_queue: true, autoplay: false });
  }
  if (request.method !== 'POST') return json({ ok: false, error: '仅支持 GET / POST' }, 405);

  // Bound input before parsing/copying; keep the existing 1 MB audio envelope.
  const reader = request.body?.getReader();
  if (!reader) return json({ ok: false, error: '请求内容为空' }, 400);
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_000_000) {
      await reader.cancel();
      return json({ ok: false, error: '录音过大，请使用更短的录音。' }, 413);
    }
    chunks.push(value);
  }
  // Preview domains vary by deployment. Validate same-origin above, then remove
  // Origin ONLY on the internal request; production's allowlist stays untouched.
  const headers = new Headers(request.headers);
  headers.delete('Origin');
  headers.delete('Content-Length');
  const internal = new Request(url, { method: 'POST', headers, body: new Blob(chunks), signal: request.signal });
  const action = url.searchParams.get('action') || 'chat';
  if (action !== 'chat' && !QUEUE_ACTIONS.has(action)) return json({ ok: false, error: '未知操作' }, 400);
  const started = Date.now();
  const response = action === 'chat'
    ? await onRequestPost({ ...context, request: internal, env })
    : await proxyVoiceQueue({ request: internal }, action);
  const outgoing = new Response(response.body, response);
  outgoing.headers.delete('Access-Control-Allow-Origin');
  outgoing.headers.set('X-Yuanbai-Runtime', 'makers-agent-pilot');
  outgoing.headers.set('Server-Timing', `pilot;dur=${Date.now() - started}`);
  // Metadata only; never log audio, transcripts, answers, credentials or tickets.
  console.info('Yuanbai agent pilot', { action, status: response.status, duration_ms: Date.now() - started });
  return outgoing;
}
