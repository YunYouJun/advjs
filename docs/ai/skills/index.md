# Skills

ADV.JS Skills 是为 AI Agent（如 [OpenClaw](https://openclaw.com)、Claude Code、Cursor）设计的标准化技能定义，使 Agent 能够通过 CLI 命令驱动 ADV.JS 互动叙事引擎。

## 什么是 Skills？

Skills 是一组标准化的指令定义文件（`SKILL.md`），告诉 AI Agent：

- **可以使用哪些工具** — CLI 命令列表
- **如何正确调用** — 参数格式、输出解析方式
- **在什么场景下使用** — 工作流与呈现指南

Skills 是**平台无关**的 —— 同一份 `SKILL.md` 可以在 Claude Code、OpenClaw、Cursor 等任意支持 Markdown 指令的 AI 工具中使用。

## 目录结构

Skills 位于项目根目录的 `skills/` 文件夹中：

```
skills/
├── README.md
├── adv-story/
│   ├── SKILL.md          # 互动叙事播放器
│   └── examples/
│       └── demo.adv.md
├── adv-create/
│   ├── SKILL.md          # 项目创建工作流
│   └── examples/
│       └── session-demo.md
└── adv-debug/
    └── SKILL.md          # 调试与分析
```

每个 Skill 是一个子目录，包含 `SKILL.md` 定义文件和可选的 `examples/` 示例目录。

## 已有 Skills

| Skill                      | 版本   | 描述                                       |
| -------------------------- | ------ | ------------------------------------------ |
| [adv-story](./adv-story)   | v0.2.0 | 互动叙事播放器，支持多章节导航和上下文感知 |
| [adv-create](./adv-create) | v0.1.0 | 从概念描述创建完整 ADV.JS 视觉小说项目     |
| [adv-debug](./adv-debug)   | v0.1.0 | 调试和分析项目的分支覆盖、死路径和一致性   |

## 创建新 Skill

1. 在 `skills/` 下创建新目录
2. 添加 `SKILL.md` 文件，包含 YAML frontmatter 和 Markdown 指令
3. 在 `examples/` 中添加示例文件

`SKILL.md` 格式示例：

```yaml
---
name: my-skill
description: My custom skill description
version: 0.1.0
tools:
  - command-1
  - command-2
---

# My Skill

Skill instructions for the AI Agent...
```
