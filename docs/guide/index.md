# 指南

ADV.JS 是面向 AI 时代的 Markdown 文字冒险游戏引擎。创作的事实源是可被 Git 审阅、可由 Agent 直接修改的 `.adv.md`、角色卡、场景卡和资源目录；CLI、Editor、Studio 与正式游戏共用同一编译结果。

## 从一句话到可分享游戏

首发推荐一条固定路径：

1. 安装 `advjs` 与 `@advjs/mcp-server`；
2. 用 `adv init` 建立标准 Markdown 项目；
3. 把 ADV.JS Skills 和 MCP 安装进 Codex、Claude Code 或 Cursor；
4. 让 Agent 生成角色、场景与章节，并用 `adv check` 校验；
5. 用本地 `@advjs/editor` 打开同一目录，精修、保存和试玩；
6. 用 `adv build` 生成静态游戏；
7. 用 `adv deploy` Direct Upload 到 Cloudflare Pages，得到 HTTPS URL。

从[快速开始](./quick-start)执行这条路径。项目目录与可移植边界见[项目结构](./project-structure)，文本语法见 [AdvScript](./advscript/)。

## 产品边界

- `advjs` 是核心引擎、编译器与 CLI；
- `@advjs/editor` 面向 PC 专业创作和团队工作流，可与本地 Skills、MCP 及其他 Agent 协作；
- `@advjs/studio` 面向移动端账号型 AI SaaS，可承接公共 AI 积分，但不是本地首发闭环的前置条件；
- Skills 是可安装的 Agent 工作流，不是第四套游戏格式。

首发支持 Chromium Stable。Ubuntu 覆盖完整路径，macOS/Windows 覆盖 smoke；Firefox、Safari、Studio 云端计费与跨设备团队同步不属于本地首发承诺。

## 核心能力

- Markdown 驱动的角色、场景、章节与选择；
- 稳定的编译诊断、Runtime、存档与回退；
- 本地 Editor 无损保存、外部文件刷新和源码试玩；
- Agent Skills、MCP 工具与机器可读 CLI 输出；
- 可复现构建、部署 receipt 与 archive 恢复。
