# Skills

ADV.JS Skills 是为 AI Agent（如 [OpenClaw](https://openclaw.com)）设计的标准化技能定义，使 Agent 能够通过 CLI 命令驱动 ADV.JS 互动叙事引擎。

## 什么是 Skills？

Skills 是一组标准化的指令定义文件（`SKILL.md`），告诉 AI Agent：

- **可以使用哪些工具** — CLI 命令列表
- **如何正确调用** — 参数格式、输出解析方式
- **在什么场景下使用** — 工作流与呈现指南

## 目录结构

Skills 位于项目根目录的 `skills/` 文件夹中：

```
skills/
├── README.md
└── adv-story/
    ├── SKILL.md          # OpenClaw Skill 定义文件
    └── examples/
        └── demo.adv.md   # 示例剧本
```

每个 Skill 是一个子目录，包含 `SKILL.md` 定义文件和可选的 `examples/` 示例目录。

## 已有 Skills

| Skill                    | 版本   | 描述                                                   |
| ------------------------ | ------ | ------------------------------------------------------ |
| [adv-story](./adv-story) | v0.1.0 | 互动叙事播放器，通过 `adv play` 命令组驱动 ADV.JS 故事 |

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
