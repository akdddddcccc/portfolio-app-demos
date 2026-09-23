import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readRegistry() {
  const registryPath = path.join(repoRoot, "registry", "apps.json");
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

export function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    // Windows 需要通过 cmd.exe 启动 npm.cmd / npx.cmd；其他平台保持直接执行。
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

export function packageManagerCommand(specification) {
  const [name, version] = specification.split("@");
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  if (name === "pnpm" && version) {
    return {
      install: [npx, ["--yes", `pnpm@${version}`, "install", "--frozen-lockfile"]],
      build: [npx, ["--yes", `pnpm@${version}`, "run", "build"]],
    };
  }

  if (name === "npm") {
    return {
      install: [npm, ["ci"]],
      build: [npm, ["run", "build"]],
    };
  }

  throw new Error(`Unsupported package manager: ${specification}`);
}
