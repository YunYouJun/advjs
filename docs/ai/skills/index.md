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
├── adv-debug/
│   └── SKILL.md          # 结构调试与分析
└── adv-review/
    └── SKILL.md          # AI 内容质量审查
```

每个 Skill 是一个子目录，包含 `SKILL.md` 定义文件和可选的 `examples/` 示例目录。

## 已有 Skills

| Skill                      | 版本   | 描述                                            |
| -------------------------- | ------ | ----------------------------------------------- |
| [adv-story](./adv-story)   | v0.3.0 | 互动叙事播放器：多章节导航、存档槽位、回退      |
| [adv-create](./adv-create) | v0.3.0 | 从概念创建项目：MCP 批量创建、imagePrompt       |
| [adv-debug](./adv-debug)   | v0.3.0 | 结构分析：分支图、覆盖率、自动补桩（确定性）    |
| [adv-review](./adv-review) | v0.1.0 | AI 内容质量审查：口吻一致性、对话、节奏（判断） |

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
