import { parseSyntheticRoster, YUANBAI_ROSTER_KEY } from "../../../_shared/yuanbai-roster.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  if (request.headers.get("Origin")) return jsonResponse({ ok: false, error: "此管理接口只接受本机发布工具请求。" }, 403);
  if (!env.YUANBAI_ROSTER_ADMIN_TOKEN || !env.YUANBAI_ROSTER?.put) {
    return jsonResponse({ ok: false, error: "共享名单尚未配置管理员密钥或KV存储。" }, 503);
  }
  if (request.headers.get("Authorization") !== `Bearer ${env.YUANBAI_ROSTER_ADMIN_TOKEN}`) {
    return jsonResponse({ ok: false, error: "管理员凭证无效。" }, 403);
  }

  const body = await request.text();
  if (body.length > 200_000) return jsonResponse({ ok: false, error: "合成名单文件过大。" }, 413);
  const roster = parseSyntheticRoster(body);
  if (!roster) {
    return jsonResponse({
      ok: false,
      error: "名单格式无效。文件需标记 synthetic: true，且每条记录只能含姓名、性别、班级。",
    }, 400);
  }

  await env.YUANBAI_ROSTER.put(YUANBAI_ROSTER_KEY, JSON.stringify(roster));
  return jsonResponse({ ok: true, record_count: roster.records.length });
}

export async function onRequestGet() {
  return jsonResponse({ ok: false, error: "此接口仅接受经过管理员凭证验证的名单写入请求。" }, 405);
}
