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
├── adv-review/
│   └── SKILL.md          # AI 内容质量审查
├── adv-adapt/
│   ├── SKILL.md          # 来源改编与覆盖审计
│   └── scripts/          # 确定性的来源锚点审计
├── adv-art/
│   ├── SKILL.md          # 美术生产与发布清单
│   └── scripts/          # 素材完整性审计
└── adv-hamster-demo/
    └── SKILL.md          # 仅限仓鼠旗舰 Demo 的组合约束
```

每个 Skill 是一个子目录，包含 `SKILL.md` 定义文件、推荐的
`agents/openai.yaml` 发现元数据，以及按需添加的 `scripts/`、`references/`
或 `assets/`。

## 已有 Skills

| Skill                                                                                               | 版本   | 描述                                                   |
| --------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| [adv-story](./adv-story)                                                                            | v0.3.0 | 互动叙事播放器：多章节导航、存档槽位、回退             |
| [adv-create](./adv-create)                                                                          | v0.3.0 | 从概念创建项目：MCP 批量创建、imagePrompt              |
| [adv-debug](./adv-debug)                                                                            | v0.3.0 | 结构分析：分支图、覆盖率、自动补桩（确定性）           |
| [adv-review](./adv-review)                                                                          | v0.1.0 | AI 内容质量审查：口吻一致性、对话、节奏（判断）        |
| [`adv-adapt`](https://github.com/YunYouJun/advjs/blob/main/skills/adv-adapt/SKILL.md)               | —      | 既有作品改编：来源顺序、章节映射与确定性来源覆盖审计   |
| [`adv-art`](https://github.com/YunYouJun/advjs/blob/main/skills/adv-art/SKILL.md)                   | —      | 立绘/表情/背景/CG 流水线、来源许可与不可变素材清单     |
| [`adv-hamster-demo`](https://github.com/YunYouJun/advjs/blob/main/skills/adv-hamster-demo/SKILL.md) | —      | 仅限 `demo/hamster` 的 A+ 模式、COS 路径与发布验收约束 |

## 创建新 Skill

1. 在 `skills/` 下创建新目录
2. 添加 `SKILL.md` 文件，包含 YAML frontmatter 和 Markdown 指令
3. 生成 `agents/openai.yaml` 供支持的 Agent UI 发现
4. 只添加工作流需要的 `scripts/`、`references/` 或 `assets/`

`SKILL.md` 格式示例：

```yaml
---
name: my-skill
description: 说明能力，以及应触发该 Skill 的具体任务和文件类型
---

# My Skill

Skill instructions for the AI Agent...
```

新的 Skill frontmatter 只保留 `name` 与 `description`。版本属于文档元数据，
界面文案放在 `agents/openai.yaml`，详细规范和确定性脚本按需渐进加载。
