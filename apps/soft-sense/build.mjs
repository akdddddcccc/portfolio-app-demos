import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, "dist");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(root, "index.html"), path.join(out, "index.html"));

const assets = path.join(root, "assets");
if (fs.existsSync(assets)) {
  fs.cpSync(assets, path.join(out, "assets"), { recursive: true });
}

console.log("Built Soft Sense static page");
