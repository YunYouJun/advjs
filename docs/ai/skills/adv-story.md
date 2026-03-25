# adv-story

`adv-story` 是 ADV.JS 的核心 Skill，允许 AI Agent 通过 CLI 命令驱动互动叙事。

## 命令列表

| 命令 | 说明 |
| --- | --- |
| `adv play <script> --session-id <id> --json` | 加载剧本并启动播放 |
| `adv play next --session-id <id> --json` | 推进到下一个节点 |
| `adv play choose <n> --session-id <id> --json` | 在选项中做出选择 |
| `adv play status --session-id <id> --json` | 查看当前会话状态 |
| `adv play list --json` | 列出所有活跃会话 |
| `adv play reset --session-id <id>` | 重置（删除）会话 |

## JSON 输出类型

所有带 `--json` 的命令返回结构化 JSON，包含以下类型：

**对话 `dialog`**

```json
{
  "type": "dialog",
  "character": "云游君",
  "status": "smile",
  "text": "欢迎来到 ADV.JS 的世界！"
}
```

**旁白 `narration`**

```json
{
  "type": "narration",
  "text": "夜幕降临，星光点点。"
}
```

**选择 `choices`**

```json
{
  "type": "choices",
  "text": "请选择:\n  1. 前往城镇\n  2. 探索森林",
  "options": [
    { "index": 1, "label": "前往城镇" },
    { "index": 2, "label": "探索森林" }
  ]
}
```

**场景 `scene`**

```json
{
  "type": "scene",
  "text": "[场景] 学校 - 白天",
  "place": "学校",
  "time": "白天"
}
```

**结束 `end`**

```json
{
  "type": "end",
  "text": "— END —"
}
```

## 工作流

```
1. Start   → adv play <script> --session-id <id> --json
2. Loop    → adv play next / choose --session-id <id> --json
3. Present → 将 JSON 输出格式化为自然语言
4. End     → 收到 type: "end" 时故事结束
```

## 呈现指南

- **dialog** — 以角色口吻呈现，包含角色名与情绪状态
- **narration** — 作为氛围描写呈现，使用斜体或引号
- **choices** — 清晰展示所有选项并请求用户选择
- **scene** — 描述场景转换

## 剧本格式

ADV.JS 使用 `.adv.md` 格式编写剧本，基于 Markdown 扩展语法：

```markdown
---
title: 我的故事
---

【学校，白天，内景】

（阳光洒入教室。）

@角色名(表情)
这是一句对话。

> 这是旁白文字。

- 选项一
- 选项二
```

详细语法请参考 [AdvScript 语法指南](/guide/advscript/syntax)。
