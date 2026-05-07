# AI 大赛示范作品

> Phase M10 · 2026 AI 应用大赛参赛素材集

本目录收录三个面向不同评审维度的端到端 Demo 项目，配合 `apps/studio` 的"从素材生成项目"向导（`/tabs/workspace/import`）使用。

| 目录                                   | 角色                            | 主推赛道           | 体量                          |
| -------------------------------------- | ------------------------------- | ------------------ | ----------------------------- |
| [`life-story/`](./life-story/)         | **主攻** · 人生故事端到端闭环   | AI 向善 · 时光忆站 | ~1500 字源素材 → 完整可玩 ADV |
| [`history-talk/`](./history-talk/)     | **主打 Demo** · AI 历史人物对谈 | AI 教育创新        | 三位人物分章                  |
| [`murder-mystery/`](./murder-mystery/) | **技术深度** · AI 剧本杀        | 技术展示           | 多角色 + 世界时钟 + 多结局    |

每个子目录约定结构：

```
<demo>/
├── README.md              # 概述 + 90 秒 Demo 脚本
├── source.{md,txt}        # 评委粘贴的源素材
├── generation-log.md      # 真实跑过 Pipeline 后回填的元数据
├── assets/                # QR 卡片图等截图素材
└── adv/                   # 预生成的 Studio 项目（赛事 Fallback）
    ├── world.md
    ├── outline.md
    ├── characters/
    ├── chapters/
    ├── scenes/
    ├── locations/
    └── knowledge/
```

## 评审现场使用方式

- **首选 · 现场生成（展示生成体验）**：粘贴 `source.{md,txt}` 全文 → 选对应 Template → 左进度树 / 右流式预览 → 60 秒内出项目
- **兜底 · 直接打开 `adv/`**（断网或 LLM 抽风时）：在 Studio "打开本地项目" 选 `adv/` → 直接进入 Play 测试

## 素材版权

所有 `source.*` 均为合成虚构素材，参考公开历史资料或普遍生活经验编写，**不对应任何真实人物**，仅用于本届赛事演示与开源代码示例。
</content>
</invoke>
