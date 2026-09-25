import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseSyntheticRoster } from "../edge-functions/_shared/yuanbai-roster.js";

const filePath = process.argv[2];
const token = process.env.YUANBAI_ROSTER_ADMIN_TOKEN;
const baseURL = (process.env.YUANBAI_ROSTER_API_BASE || "https://apps-demo.muyang23333.top").replace(/\/+$/, "");

if (!filePath) throw new Error("用法：node scripts/upload-yuanbai-synthetic-roster.mjs <合成名单.json>");
if (!token) throw new Error("请先设置 YUANBAI_ROSTER_ADMIN_TOKEN 环境变量。");

const body = await readFile(resolve(filePath), "utf8");
const roster = parseSyntheticRoster(body);
if (!roster) throw new Error("文件格式无效；请使用 synthetic: true，且每条记录只含 name、gender、class。");

const response = await fetch(`${baseURL}/api/yuanbai/admin/roster`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body,
});
const result = await response.json().catch(() => null);
if (!response.ok || !result?.ok) throw new Error(result?.error || `云端写入失败（HTTP ${response.status}）。`);
console.log(`已将${result.record_count}条合成测试记录写入云端共享资料。`);
