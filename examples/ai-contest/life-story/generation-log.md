# 生成日志 · 奶奶的一生

> 真实跑过 Studio "从素材生成项目" 后回填本表。Pipeline = `apps/studio/src/utils/projectGenerator.ts`（4 步）

## 输入

| 字段         | 值                           |
| ------------ | ---------------------------- |
| Template     | `life-story.yaml`            |
| Source 类型  | `text`                       |
| Source 文件  | [`source.txt`](./source.txt) |
| Source 字数  | ~1500 字                     |
| 估算 tokens  | ~2300                        |
| 段数         | 4（按 `## ` 切分）           |
| Project name | 奶奶的一生                   |
| Project slug | `grandma-life`               |

## AI 配置

| 字段                   | 值（待回填）                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| Provider               | _（DeepSeek / Qwen / Anthropic OpenAI 兼容端点 / Custom）_            |
| Model                  | _e.g. `deepseek-chat` / `qwen2.5-72b-instruct` / `claude-sonnet-4-6`_ |
| Temperature            | `0.7`（默认）                                                         |
| 是否启用 cache_control | _Anthropic 原生_ / _依赖 Provider 端前缀缓存_                         |

## Pipeline 4 步运行情况

| Step           | 状态   | 输入 tokens | 输出 tokens | Cache hit     | 耗时          |
| -------------- | ------ | ----------- | ----------- | ------------- | ------------- |
| 1 · characters | _待填_ |             |             |               |               |
| 2 · chapters   | _待填_ |             |             |               |               |
| 3 · scenes     | _待填_ |             |             |               |               |
| 4 · knowledge  | _待填_ |             |             |               |               |
| **合计**       |        |             |             | **目标 ≥70%** | **目标 ≤60s** |

## 产出文件清单（实际生成）

```
adv/
├── world.md              # ?
├── outline.md            # ?
├── characters/
│   └── ?
├── chapters/
│   └── ?
├── scenes/
│   └── ?
└── knowledge/
    └── ?
```

> ⚠️ 跑完后用 `tree adv/` 替换上面的占位结构。

## 复盘

- **Cache hit rate < 70% 怎么办？** 调整 [`apps/studio/src/utils/projectGenerator/prompts.ts`](../../../apps/studio/src/utils/projectGenerator/prompts.ts) 中 shared prefix 的组装顺序，确保跨 step 字节级一致
- **生成超时？** 把 source.txt 拆得更细，或换更小更快的模型
- **schema 校验失败？** 看具体哪一步——通常是 character 字段或 chapter 选项不符合 zod schema，调 prompt 强约束

## 评审现场 Fallback 触发条件

- 现场网络不稳定或模型 5xx 时，跳过生成步骤直接打开本目录的 `adv/`
- Studio "打开本地项目" → 选 `examples/ai-contest/life-story/` → Play Tab 应可直接玩
  </content>
  </invoke>
