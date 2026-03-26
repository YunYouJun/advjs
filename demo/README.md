# Demo

完整的 ADV.JS 参考项目，展示各种游戏场景和引擎能力。每个 demo 都是一个可独立运行的完整游戏工程，适合作为新项目的起点或学习参考。

## 项目列表

| 项目               | 说明                                                     | 启动命令                                  |
| ------------------ | -------------------------------------------------------- | ----------------------------------------- |
| **starter**        | 标准模板项目，基于 Markdown (`.adv.md`) 的多章节对话系统 | `pnpm demo`                               |
| **love**           | 完整的恋爱剧情游戏，展示复杂叙事和角色系统               | `pnpm --filter @advjs/demo-love dev`      |
| **ai**             | AI 驱动的游戏，集成 OpenAI，使用 Flow (JSON) 格式        | `pnpm --filter @advjs/demo-ai dev`        |
| **flow**           | 基于节点的可视化游戏设计，运行时加载流程图               | `pnpm --filter @advjs/demo-flow dev`      |
| **use-dialog-box** | 对话框组件集成示例，展示 Vue 3 组件用法                  | `pnpm --filter @advjs/use-dialog-box dev` |

## 与 examples 的区别

- **demo/** — 完整的游戏工程，包含多文件、多章节、完整的配置和资源，适合深入学习和作为项目模板
- **examples/** — 最小化的代码示例，聚焦于某个特定功能或用法，适合快速理解单一概念

## 如何创建新游戏

推荐以 `starter` 为模板：

```bash
cp -r demo/starter my-game
cd my-game
# 编辑 package.json 中的 name 字段
pnpm install
pnpm dev
```

游戏脚本位于 `pages/` 目录下的 `.adv.md` 文件中。
