# adv-story

`adv-story` 是 ADV.JS 的核心 Skill，允许 AI Agent 通过 CLI 命令驱动互动叙事。

## 命令一览

| 命令                  | 说明                   |
| --------------------- | ---------------------- |
| `adv play <script>`   | 加载剧本并启动互动播放 |
| `adv play next`       | 推进到下一个节点       |
| `adv play choose <n>` | 在选项中做出选择       |
| `adv play status`     | 查看当前会话状态       |
| `adv play list`       | 列出所有活跃会话       |
| `adv play reset`      | 重置会话               |

## 使用方式

### 启动互动播放

```bash
# 交互模式（终端直接操作）
adv play story.adv.md

# Agent 模式（指定 session-id + JSON 输出）
adv play story.adv.md --session-id my-session --json
```

### 推进故事

```bash
adv play next --session-id my-session --json
```

### 处理选择

当收到 `choices` 类型输出时：

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

选择第 1 个选项：

```bash
adv play choose 1 --session-id my-session --json
```

### 查看状态

```bash
adv play status --session-id my-session --json
```

返回：

```json
{
  "sessionId": "my-session",
  "status": "playing",
  "currentIndex": 5,
  "totalNodes": 20,
  "background": "",
  "tachies": {}
}
```

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

## Skill 文件

Skill 定义文件位于 `skills/adv-story/SKILL.md`，遵循 OpenClaw Skill 标准格式。

```yaml
---
name: adv-story
description: Interactive ADV narrative player
version: 0.1.0
tools:
  - adv play <script> --session-id <id> --json
  - adv play next --session-id <id> --json
  - adv play choose <n> --session-id <id> --json
---
```
