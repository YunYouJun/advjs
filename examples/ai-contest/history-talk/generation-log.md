# 生成日志 · 跨越时空的对谈

> 真实跑过 Studio "从素材生成项目" 后回填本表。Pipeline = `apps/studio/src/utils/projectGenerator.ts`（4 步）

## 输入

| 字段         | 值                                                              |
| ------------ | --------------------------------------------------------------- |
| Template     | _建议 `life-story.yaml` 或 `training-drill.yaml`，按生成节奏选_ |
| Source 类型  | `markdown`                                                      |
| Source 文件  | [`source.md`](./source.md)                                      |
| Source 字数  | ~2000 字                                                        |
| 估算 tokens  | ~3200                                                           |
| 段数         | 5（主角档案 × 3 + 设定 + 路径建议）                             |
| Project name | 跨越时空的对谈                                                  |
| Project slug | `history-talk`                                                  |

## AI 配置

| 字段        | 值（待回填）                                                          |
| ----------- | --------------------------------------------------------------------- |
| Provider    | _（DeepSeek / Qwen / Anthropic OpenAI 兼容端点 / Custom）_            |
| Model       | _e.g. `deepseek-chat` / `qwen2.5-72b-instruct` / `claude-sonnet-4-6`_ |
| Temperature | `0.7`（默认）                                                         |

## Pipeline 4 步运行情况

| Step           | 状态   | 输入 tokens | 输出 tokens | Cache hit     | 耗时                    |
| -------------- | ------ | ----------- | ----------- | ------------- | ----------------------- |
| 1 · characters | _待填_ |             |             |               |                         |
| 2 · chapters   | _待填_ |             |             |               |                         |
| 3 · scenes     | _待填_ |             |             |               |                         |
| 4 · knowledge  | _待填_ |             |             |               |                         |
| **合计**       |        |             |             | **目标 ≥70%** | **目标 ≤90s（多角色）** |

## 期望产出（按 source.md 拆解）

```
adv/
├── world.md
├── outline.md
├── characters/
│   ├── confucius.character.md
│   ├── turing.character.md
│   └── davinci.character.md
├── chapters/
│   ├── 01-confucius.adv.md      # 杏坛
│   ├── 02-turing.adv.md         # 布莱切利园
│   └── 03-davinci.adv.md        # 工坊
├── scenes/
│   ├── apricot-altar.md
│   ├── bletchley-park.md
│   └── florence-studio.md
└── knowledge/
    ├── confucianism.md
    ├── turing-test.md
    └── renaissance-polymath.md
```

## 复盘

- **三位人物 system prompt 区分度不够？** 检查 source.md 中"说话方式"部分是否被截断 → 加大 chapter step 的 prompt budget
- **历史人物口吻漂移？** 在 character.md 的 `expertisePrompt` 字段增加文体约束，例如"始终使用论语对仗体"
- **跨章节 scene 复用问题？** scene step 应识别同一场景被多章引用，避免重复生成
  </content>
  </invoke>
