# Editor

`@advjs/editor` 是针对 PC 创作优化的 ADV.JS 编辑器。它既可以作为 [editor.advjs.org](https://editor.advjs.org) 在线使用，也可以由 CLI 在本地打开 Agent 正在修改的项目。

## 本地工作区

```bash
adv editor /path/to/game
```

本地模式通过仅监听 `127.0.0.1` 的受限 bridge 读写项目目录：

- 打开章节、角色与场景 Markdown；
- 用结构化 patch 无损保存已知字段；
- 直接从源码编译并试玩，不要求先 build；
- 观察 Agent 的外部写入并实时刷新；
- 未保存内容与外部变更冲突时要求人工选择。

bridge 拒绝路径穿越、越界 symlink、非本机 Origin 和不受支持的方法。停止 CLI 后端口立即释放。

## Electron 桌面客户端

[桌面客户端](./desktop)托管同一 Vue Editor 与 `ProjectWorkspace`，提供原生打开／最近项目、角色／立绘／项目音频编辑、真实保存、外部刷新、独立游戏预览与 Web 目录／ZIP 导出。游戏预览没有桌面权限；打包后的应用自带运行时，不需要系统 Node.js、pnpm、本仓库或开发服务器。

桌面模式每次启动生成新凭据，由有限 preload API 注入当前会话，不通过地址栏或 Web Storage 传递。首版验收平台为 macOS arm64，签名、公证与自动更新不包含在本次交付。运行、打包、支持边界与证据见[使用文档](./desktop)及[验收报告](../../reports/electron-desktop-acceptance)。

## Agent 工作流

先使用 `adv agent install` 把 Skills 与 MCP 配置到 Codex、Claude Code 或 Cursor。Agent 负责批量生成、校验和审查，Editor 负责可视化精修、冲突处理和试玩；两者操作同一批 Markdown 文件。

## 支持范围

首发浏览器为 Chromium Stable。Ubuntu 覆盖完整 journey，macOS/Windows 覆盖 Editor 生命周期 smoke。Firefox、Safari、多人云协作和 Studio 的账号积分流程不在本地 Editor 首发范围内。
