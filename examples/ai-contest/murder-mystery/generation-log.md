# 生成日志 · 雪夜庄园

> 真实跑过 Studio "从素材生成项目" 后回填本表。Pipeline = `apps/studio/src/utils/projectGenerator.ts`（4 步）

## 输入

| 字段         | 值                                                                |
| ------------ | ----------------------------------------------------------------- |
| Template     | _暂用 `training-drill.yaml`，等 `murder-mystery.yaml` 上线后切换_ |
| Source 类型  | `markdown`                                                        |
| Source 文件  | [`source.md`](./source.md)                                        |
| Source 字数  | ~1900 字                                                          |
| 估算 tokens  | ~3000                                                             |
| 段数         | 6（设定 + 嫌疑人 × 6 + 时空 + 风格）                              |
| Project name | 雪夜庄园                                                          |
| Project slug | `snowy-manor`                                                     |

## AI 配置

| 字段        | 值（待回填）                                                          |
| ----------- | --------------------------------------------------------------------- |
| Provider    | _（DeepSeek / Qwen / Anthropic OpenAI 兼容端点 / Custom）_            |
| Model       | _e.g. `deepseek-chat` / `qwen2.5-72b-instruct` / `claude-sonnet-4-6`_ |
| Temperature | `0.6`（推理类素材建议略低）                                           |

## Pipeline 4 步运行情况

| Step                         | 状态   | 输入 tokens | 输出 tokens | Cache hit     | 耗时                   |
| ---------------------------- | ------ | ----------- | ----------- | ------------- | ---------------------- |
| 1 · characters（6 位嫌疑人） | _待填_ |             |             |               |                        |
| 2 · chapters（3 幕）         | _待填_ |             |             |               |                        |
| 3 · scenes                   | _待填_ |             |             |               |                        |
| 4 · knowledge（线索矩阵）    | _待填_ |             |             |               |                        |
| **合计**                     |        |             |             | **目标 ≥70%** | **目标 ≤120s（人多）** |

## 期望产出

```
adv/
├── world.md
├── outline.md                       # 含真相，仅创作者读
├── characters/
│   ├── butler.character.md
│   ├── widow.character.md
│   ├── doctor.character.md
│   ├── actress.character.md
│   ├── nephew.character.md
│   └── maid.character.md
├── chapters/
│   ├── 01-discovery.adv.md
│   ├── 02-investigation.adv.md
│   └── 03-confrontation.adv.md
├── scenes/
│   ├── manor-hall.md
│   ├── study-room.md
│   └── conservatory.md
└── knowledge/
    └── clue-matrix.md
```

## 复盘要点

- **AI 是否泄露凶手？** source.md 故意不写真相，检查生成的 character/chapter/scene 是否守住"凶手身份"机密
- **嫌疑人独立人格？** 6 位都需要 `secret` + `lie_strategy` 字段——若 character schema 还没这两个字段，需要在 prompts.ts 提示模型加到 `custom.*`
- **多结局触发？** chapter step 输出的对话节点要包含 `endings` 数组：正确指认 / 错误指认 / 超时
- **现场协作？** murder-mystery 的现场玩法依赖 `@advjs/collab`，评审现场可演示同一项目两个浏览器同步线索面板

## 评审现场 Fallback 触发条件

- 现场断网或 LLM 抽风 → 直接打开 `adv/`（`outline.md` 中的真相需要现场口播给评委，不要让玩家先看）
  </content>
  </invoke>
