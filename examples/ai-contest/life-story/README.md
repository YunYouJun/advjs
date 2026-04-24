# 奶奶的一生 · Life Story 示范作品

> **Phase M10 赛事 Fallback** — 评审现场即便 LLM 临时抽风，这个 `adv/` 目录也能被 Studio 直接打开为可玩的 ADV 项目。
>
> 生成自：`life-story` Template + `source.txt`（本目录下的合成素材，1500 字）
>
> 生成时间：2026-04-24（立项 Week 2）

## 如何打开

### 选项 A · 作为 Studio 项目直接打开

```bash
# 在 ADV.JS Studio 里 "打开本地项目" → 选本目录 → 进入 Play Tab
pnpm --filter @advjs/studio dev
```

### 选项 B · CLI 预览

```bash
cd examples/ai-contest/life-story
npx advjs dev
```

## 示范场景

1. **评委现场点击「从素材生成」**
2. 粘贴 `source.txt` 全文（或直接上传文件）
3. 选 `life-story` Template，项目名「奶奶的一生」
4. **左进度树** 实时点亮：characters(2) → chapters(3) → scenes(2) → knowledge(3)
5. **右侧预览** 流式展开：角色卡 → 第一章章节 → 场景描述 → 知识条目
6. 保存到项目后进入 Play：
   - **第一章·童年**：评委替"奶奶"选择「偷偷去看戏 / 乖乖待在家」
   - **第二章·转折**：选择「跟着运输队北上 / 留在老家照顾父母」
   - **第三章·回望**：纯叙事结局，情感收束

## 文件清单

```
adv/
├── world.md                          # 世界观
├── outline.md                        # 大纲
├── characters/
│   ├── grandma.character.md          # 主角·奶奶
│   └── granddaughter.character.md    # 旁白视角·孙女
├── chapters/
│   ├── 01-childhood.adv.md           # 第一章 童年 · 带 2 选项分支
│   ├── 02-turning.adv.md             # 第二章 转折 · 带 3 选项分支
│   └── 03-reflection.adv.md          # 第三章 回望 · 纯叙事
├── scenes/
│   ├── seaside-village.md
│   └── winter-station.md
├── locations/
│   ├── village-shore.md
│   └── northern-port.md
└── knowledge/
    └── era/
        ├── fishing-village-1960s.md
        └── work-team-movement.md
```

## 素材版权声明

`source.txt` 为**合成虚构素材**，参考 1960-80 年代东南沿海渔村普遍生活经验编写，**不对应任何真实人物**。
用于本届赛事演示 + 开源代码示例，不作商业用途。
