# ADV.JS

[![ADV.JS CI](https://github.com/YunYouJun/advjs/workflows/ADV.JS%20CI/badge.svg)](https://github.com/YunYouJun/advjs/actions)

面向 AI 时代的 Markdown 文字冒险游戏引擎。用 Agent 生成标准项目，在本地 Editor 精修、试玩和构建，再直接部署为可分享的 Web 游戏。

- 文档：[advjs.org](https://advjs.org)
- 在线 Editor：[editor.advjs.org](https://editor.advjs.org)
- 源码协议：MPL-2.0

## 产品定位

| 产品            | 定位                                                               | 首要用户                            |
| --------------- | ------------------------------------------------------------------ | ----------------------------------- |
| `advjs`         | 核心引擎、编译器与 CLI                                             | 引擎集成者和项目工具链              |
| `@advjs/editor` | 针对 PC 创作优化的本地/在线编辑器，可接入 Skills、MCP 和其他 Agent | 专业创作者、团队与 ToB 工作流       |
| `@advjs/studio` | 针对移动端 AI 流程优化的账号型 SaaS，承接公共 AI 积分与轻量创作    | 个人创作者与 ToC 用户               |
| ADV.JS Skills   | Agent 可安装的生成、调试、审查、美术和改编工作流                   | Codex、Claude Code、Cursor 等 Agent |

Editor 和 Studio 使用同一套 Markdown 项目与 Runtime，不是两套内容格式。首发闭环以本地 Editor 为准；Studio 的账号、计费和移动端云流程独立演进。

## 快速开始

推荐使用当前 Node.js LTS；发布包的最低运行版本与 Vite 对齐（`^20.19.0 || >=22.12.0`）。安装固定版本的 CLI 与 MCP Server：

```bash
npm install --global advjs@0.1.4 @advjs/mcp-server@0.1.4
adv init rain-letter --template default --name 雨夜来信 --json
cd rain-letter
adv agent install --client codex --skills default --mcp --json
adv doctor . --client codex --json
```

让 Agent 使用 `adv-create` 创建或修改 Markdown 内容，然后执行：

```bash
adv check --json
adv editor .
adv build --json
adv deploy --provider cloudflare-pages --project rain-letter --json
```

第一次部署会使用固定版本的 Wrangler 完成 Cloudflare 登录；后续部署复用 `.advjs/deploy.json` 中不含凭据的项目 ID。完整解释见[快速开始](./docs/guide/quick-start.md)。

## 仓库开发

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm demo
pnpm editor
```

`demo/starter` 是最小可复制项目，`demo/hamster` 是覆盖多章节、资源和插件活动的完整回归项目。详见 [Demo 与 Examples](./docs/guide/demos.md)。

## 浏览器与平台

首发支持 Chromium Stable。Ubuntu 执行完整 journey；macOS 和 Windows 执行安装、CLI、Editor 生命周期与构建 smoke。Firefox 和 Safari 尚未进入首发支持矩阵。
