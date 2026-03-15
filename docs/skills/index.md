# Skills

ADV.JS Skills 是为 AI Agent（如 OpenClaw）设计的技能定义，使 Agent 能够通过 CLI 命令驱动 ADV.JS 互动叙事引擎。

## 什么是 Skills？

Skills 是一组标准化的指令定义文件，告诉 AI Agent：

- **可以使用哪些工具**（CLI 命令）
- **如何正确调用这些工具**（参数格式、输出解析）
- **在什么场景下使用**（工作流描述）

## 已有 Skills

| Skill | 描述 |
|-------|------|
| [adv-story](./adv-story) | 互动叙事播放器，通过 `adv play` 命令组驱动 ADV.JS 故事 |

## 目录结构

```
skills/
├── README.md
└── adv-story/
    ├── SKILL.md          # OpenClaw Skill 定义文件
    └── examples/
        └── demo.adv.md   # 示例剧本
```

## 快速开始

1. 在项目根目录的 `skills/` 文件夹中找到对应的 Skill
2. 将 `SKILL.md` 的内容提供给 AI Agent
3. Agent 即可按照定义调用 `adv` CLI 命令

详细集成指南请参考 [OpenClaw 集成](./openclaw)。
