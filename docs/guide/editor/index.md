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

## Agent 工作流

先使用 `adv agent install` 把 Skills 与 MCP 配置到 Codex、Claude Code 或 Cursor。Agent 负责批量生成、校验和审查，Editor 负责可视化精修、冲突处理和试玩；两者操作同一批 Markdown 文件。

## 支持范围

首发浏览器为 Chromium Stable。Ubuntu 覆盖完整 journey，macOS/Windows 覆盖 Editor 生命周期 smoke。Firefox、Safari、多人云协作和 Studio 的账号积分流程不在本地 Editor 首发范围内。
