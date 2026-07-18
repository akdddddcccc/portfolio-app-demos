import path from "node:path";
import { packageManagerCommand, readRegistry, repoRoot, run } from "./lib.mjs";

const { apps } = readRegistry();

for (const app of apps) {
  const appRoot = path.join(repoRoot, app.path);
  const [command, args] = packageManagerCommand(app.packageManager).install;
  console.log(`\nInstalling ${app.title} (${app.slug})`);
  run(command, args, appRoot);
}
