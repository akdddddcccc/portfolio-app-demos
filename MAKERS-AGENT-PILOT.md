# 元白 Makers Agent 测试分支

分支：`test/makers-agent-pilot`，基于发布仓库 main 的 `ad3619e`。
只部署为 Preview，不合并 main，不切换生产域名。

## 入口

- 测试页面：预览域名 `/yuanbai-agent-test/`
- Agent：`GET /yuanbai-pilot` 无模型健康检查；`POST /yuanbai-pilot` 运行原有语音链路。
- 所有 Agent 请求（包括 GET）必须携带 `makers-conversation-id`；测试页每次打开生成一个 UUID，服务端平台在入口前校验该请求头。
- 排队：同一路径 `?action=join|status|release`，连接现有四路 FIFO 服务。
- 正式入口 `/api/yuanbai/chat`、游戏、模型资产和子模块指针均未修改。

Agent 直接导入既有处理函数，不复制人格、检索、音色或合成参数。沿用浏览器传入的最多八条上下文，本次不引入 Store、Sandbox 或新的模型网关。测试录音使用与正式版相同的 JSON 协议。Agent 最长执行 170 秒；各阶段仍使用原来的超时预算。健康检查只报告密钥是否配置，不输出值。

## 部署

在 EdgeOne 当前项目新建**预览环境**部署，选择 `test/makers-agent-pilot`，沿用安装和构建命令。`edgeone.json` 新增 frameworkless `agents` 配置，Agent 路由为 `/yuanbai-pilot`。

预览环境需可读现有 `DASHSCOPE_API_KEY`、`DEEPSEEK_API_KEY`。如线上设置了 `DEEPSEEK_MODEL`、`YUANBAI_TTS_MODEL`、`YUANBAI_TTS_VOICE_ID` 和检索选项，预览应继承相同值，以免模型差异干扰对比。不需要 `AI_GATEWAY_API_KEY`，不要将密钥写进 Git。

## 验证

1. `npm ci && npm test`：测试使用模拟供应商，不产生模型费用、不录音、不播放声音。
2. 初始化子模块并按原项目构建。测试页随构建复制到 `dist/yuanbai-agent-test/`。
3. 部署后先打开测试页点“检查运行环境”，确认 runtime 和两个 configured 字段。
4. 手工上传短录音再点提交，才会消耗真实模型额度；结果默认静音。测试页与生产共用四个名额，不适合无人值守压力测试。
5. 用同一录音分别记录两种运行时的成功率、排队/识别/对话/合成耗时，再决定是否迁移。单次成功不代表高并发已验证。

## 限制与回退

- 本次是兼容性试验，不承诺更快，也不绕开模型供应商限额。
- Node 模拟测试不能证明 Makers 云端打包、路由、网络与实际环境变量均可用，须以预览部署实测为准。
- 页面关闭后尚未完成的请求可能继续执行至阶段超时；服务端票据有 TTL 兜底。后续再独立验证跨运行时取消传播。
- 不使用测试入口即回到原流程；删除预览部署不会影响生产域名。不要将本分支提升为生产发布。

依据：https://pages.edgeone.ai/document/framework-agent 、https://pages.edgeone.ai/document/agents-quick-start
