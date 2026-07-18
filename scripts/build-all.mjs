import fs from "node:fs";
import path from "node:path";
import { packageManagerCommand, readRegistry, repoRoot, run } from "./lib.mjs";

const registry = readRegistry();
run("node", ["scripts/validate-registry.mjs"], repoRoot);

const outputRoot = path.join(repoRoot, "dist");
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const app of registry.apps) {
  const appRoot = path.join(repoRoot, app.path);
  const [command, args] = packageManagerCommand(app.packageManager).build;
  console.log(`\nBuilding ${app.title} at ${app.publicPath}`);
  run(command, args, appRoot, { PORTFOLIO_APP_PUBLIC_PATH: app.publicPath });

  const source = path.join(appRoot, app.buildOutput);
  const destination = path.join(outputRoot, app.slug);
  const entry = path.join(source, "index.html");
  if (!fs.existsSync(entry)) throw new Error(`${app.slug} build did not produce ${entry}`);

  fs.cpSync(source, destination, { recursive: true });
}

const cards = registry.apps.map((app) => `
      <a class="app-card" href=".${app.publicPath}">
        <span class="app-card__title">${escapeHtml(app.title)}</span>
        <span class="app-card__path">${app.publicPath}</span>
      </a>`).join("");

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Portfolio App Demos</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; padding: 48px 24px; background: #f4f4f2; color: #111; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(720px, 100%); margin: 0 auto; }
      h1 { margin: 0 0 8px; font-size: clamp(32px, 6vw, 60px); letter-spacing: -0.04em; }
      p { margin: 0 0 36px; color: #666; }
      .app-grid { display: grid; gap: 14px; }
      .app-card { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 24px; border-radius: 24px; background: #fff; color: inherit; text-decoration: none; box-shadow: 0 12px 40px rgba(0,0,0,.07); transition: transform .2s ease, box-shadow .2s ease; }
      .app-card:hover { transform: translateY(-2px); box-shadow: 0 18px 48px rgba(0,0,0,.11); }
      .app-card__title { font-size: 22px; font-weight: 700; }
      .app-card__path { color: #3155ee; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    </style>
  </head>
  <body>
    <main>
      <h1>App Demos</h1>
      <p>作品集中的可交互 App 体验。</p>
      <div class="app-grid">${cards}
      </div>
    </main>
  </body>
</html>`;

fs.writeFileSync(path.join(outputRoot, "index.html"), html);
fs.writeFileSync(path.join(outputRoot, "apps.json"), `${JSON.stringify(registry, null, 2)}\n`);

console.log(`\nBuilt ${registry.apps.length} app(s) into ${outputRoot}`);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
