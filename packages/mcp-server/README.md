# ADV.JS MCP server

## Codex 工作区面板

`advjs_show_project_workspace` 读取当前进程工作目录中的 ADV.JS 项目，并返回 `ui://advjs/workspace.html` MCP Apps 面板及结构化摘要。调用时传入 `locale: "zh-CN"` 或 `locale: "en"`，让纯文本摘要匹配用户语言。不支持 MCP Apps 的宿主仍能读取相同数据。

面板语言优先级为：手动偏好 → 宿主 `hostContext.locale` → 浏览器语言。中文地区代码统一使用简体中文，其余语言回退到英文。手动选择会保存在浏览器；宿主禁用存储时，本次会话仍可切换。明暗主题跟随宿主；未提供时跟随浏览器。

默认展示项目身份、工作目录、章节／人物／场景数量、读取问题和上次校验结果。文件清单及具体校验命令按需展开。面板没有固定百分比进度、占位日志、重复 MCP 标记或无法取消运行的按钮。

### 读取与校验

- 打开或刷新面板只读取项目，`validation.status: "not_run"` 表示尚未校验。
- `diagnostics` 是项目加载产生的问题；`validation.issues` 是完整校验产生的问题，两者独立保留。
- 点击“校验项目”或用户明确要求后，调用 `advjs_run_project_check`。显示的命令使用当前 Node 和已安装的 ADV.JS CLI，工作目录与实际校验一致；不依赖项目是否有 `pnpm adv` 脚本。
- 同时发起的校验共用一次执行。完成或失败后可重试。刷新保留本次 MCP 连接中的上次校验结果和时间；历史结果不代表刷新后的文件再次通过校验。重新启动 MCP 服务后状态回到 `not_run`。
- 诊断原文、代码、文件名和项目标识保留来源内容，不因界面语言而改写。

### 连接正确的游戏项目

本地 Codex 插件 `.mcp.json` 必须将 `cwd` 指向目标游戏，避免一直读取 ADV.JS 的 `demo/starter`。如果项目提供固定工作目录和开发工具链的启动器，优先通过该启动器连接，例如：

```json
{
  "mcpServers": {
    "advjs_studio": {
      "command": "node",
      "args": ["/absolute/path/to/game/scripts/adv.ts", "mcp"],
      "cwd": "/absolute/path/to/game",
      "enabled": true
    }
  }
}
```

该示例绑定一个游戏项目，不会自动切换为当前聊天的目录。以工具返回的 `project.root` 为准。更新插件来源和重新安装后，已建立的 MCP 连接可能仍使用旧进程；应重新加载插件连接，再检查版本和项目目录。

### 验证

```bash
pnpm vitest run tests/unit/mcp-workspace-app.test.ts tests/unit/mcp-resources.test.ts tests/unit/mcp-character-visual.test.ts
pnpm exec tsc --noEmit -p packages/mcp-server/tsconfig.json
pnpm --filter @advjs/mcp-server build
```

测试覆盖宿主语言及主题、手动偏好、禁用存储、连接恢复、重复请求、真实校验问题和临时工程中的只读校验。用户项目不会作为自动测试的校验对象。
