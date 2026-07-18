import fs from "node:fs";
import path from "node:path";
import { readRegistry, repoRoot } from "./lib.mjs";

const { version, apps } = readRegistry();

if (version !== 1) throw new Error(`Unsupported registry version: ${version}`);
if (!Array.isArray(apps) || apps.length === 0) throw new Error("Registry must contain at least one app");

const slugs = new Set();
const publicPaths = new Set();

for (const app of apps) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app.slug)) {
    throw new Error(`Invalid app slug: ${app.slug}`);
  }
  if (slugs.has(app.slug)) throw new Error(`Duplicate app slug: ${app.slug}`);
  if (publicPaths.has(app.publicPath)) throw new Error(`Duplicate public path: ${app.publicPath}`);
  if (app.publicPath !== `/${app.slug}/`) {
    throw new Error(`${app.slug} publicPath must be /${app.slug}/`);
  }

  slugs.add(app.slug);
  publicPaths.add(app.publicPath);

  const appRoot = path.join(repoRoot, app.path);
  if (!fs.existsSync(appRoot)) throw new Error(`Missing submodule directory: ${app.path}`);
  if (!fs.existsSync(path.join(appRoot, "package.json"))) {
    throw new Error(`Missing package.json for ${app.slug}`);
  }
}

console.log(`Registry valid: ${apps.length} app(s)`);
