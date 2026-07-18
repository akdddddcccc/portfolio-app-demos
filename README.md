# Portfolio App Demos

作品集交互 App 的统一构建仓库。各 App 保留独立 GitHub 仓库，通过 submodule 固定版本；本仓库将它们构建到同一个 EdgeOne Makers 输出目录。

## Current apps

- `flow` → `apps/flow` → `/flow/`

## Add an app

1. 将 App 仓库添加到 `apps/<slug>` submodule，并在 `.gitmodules` 中指定生产分支。
2. 在 `registry/apps.json` 注册 slug、路径、包管理器和 Frame 尺寸。
3. 运行 `node scripts/install-all.mjs` 和 `node scripts/build-all.mjs`。
4. 使用最终子路径与 `?embed=portfolio` 验收。

## EdgeOne Makers

- Node.js: `22.11.0`
- Install: `git submodule sync --recursive && git submodule update --init --recursive && node scripts/install-all.mjs`
- Build: `node scripts/build-all.mjs`
- Output: `dist`

将 Makers 项目绑定本仓库的 `main` 分支。`sync-apps.yml` 每半小时检查各 App 的生产分支，有更新时推进 submodule 指针并触发新的部署。
