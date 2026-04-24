# 90 秒 Demo 视频分镜脚本

> 📅 Phase M10 · Week 4 · Sprint 交付物
>
> **目标**：让评审在 90 秒内看懂「ADV.JS Studio 把一段回忆变成可玩剧情」这件事。
>
> **原则**：不解释技术栈，用「痛点 → 奇迹时刻 → 价值」三幕结构讲人话。

---

## 分镜（总 90s）

| 时间       | 时长 | 画面                                                                                                                                             | 解说（中文）                                                                                              |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 00:00–0:10 | 10s  | **Cold Open**：老人家中场景照片 → 一张手写回忆纸 → 一段微信语音条的 UI 截图                                                                      | "每一位长辈都有一生的故事。<br>我们拍了照片、录了语音、写了文字，但这些记忆永远只是**让后人看**的档案。"  |
| 00:10–0:20 | 10s  | 文字卡片切换：`文字 / 照片 / 录音`（淡出）→ 一句话 slogan：**"让回忆可以被'走进去'"**                                                            | "如果家人可以**走进**奶奶的故事，替十九岁的她做一次选择，看到另一种可能——会怎样？"                        |
| 00:20–0:35 | 15s  | Studio 屏幕录制：打开 ProjectsPage → 点「从素材生成」卡片 → Step 2 粘贴 source.txt → 输入「奶奶的一生」→ 点「开始生成」                          | "我们把一段 1500 字的口述回忆素材……贴进 ADV.JS Studio……选 life-story 模板……点生成。"                      |
| 00:35–0:55 | 20s  | **核心爆点**：左侧进度树点亮 characters → 右侧流式展开角色卡 → chapters 一章一章出现 → scenes / knowledge 陆续完成 · 文件计数 chip 一路攀升到 13 | "60 秒不到，AI 提取出 2 个角色、3 章情节、2 个场景、2 条时代背景。<br>整个过程**可见、可中断、可重试**。" |
| 00:55–1:10 | 15s  | 点击「保存到项目」→ 选目录 → 自动进入 Play Tab → 从第一章读起 → 第二章遇到 3 选项，评委选择「报名跟着工作队北上」→ 看到剧情推进                  | "进入 Play，替奶奶做一次选择。<br>（停顿 2 秒，让观众看到选项和分支画面）"                                |
| 01:10–1:25 | 15s  | 镜头拉远：同一个界面，切换 Template 为 training-drill → 上传一份 SOP.txt → 同样的流式生成 → 产出培训剧本                                         | "同一个引擎，换一份素材、换一个模板——<br>企业培训、客服上岗、医患沟通，都能用。"                          |
| 01:25–1:30 | 5s   | 落版：ADV.JS 品牌 + slogan「**Source → Playable Scenario in 60 seconds**」+ 开源地址                                                             | "ADV.JS Studio。开源、免费、离线可用。"                                                                   |

---

## 解说（英文版，用于国际评审 / 双语字幕）

> 1. "Every elder has a life's worth of stories. Photos, recordings, written letters — but they're all _archives to look at_, never _worlds you can step into_."
> 2. "What if the family could step _into_ Grandma's story — make a different choice at age 19, and see how it would unfold?"
> 3. "Here's a 1,500-word oral memoir. We paste it into ADV.JS Studio… pick the 'life-story' template… hit Generate."
> 4. "In under 60 seconds, the AI extracts 2 characters, 3 chapters, 2 scenes, 2 era notes — visible, cancellable, retryable."
> 5. "Hit Play. Make Grandma's choice — the one she actually made, or the one she didn't."
> 6. "Same engine. Different source. Different template — enterprise training, customer service, medical communication."
> 7. "ADV.JS Studio. Open source. Free. Works offline."

---

## 录制清单

### 前置准备

- [ ] Chrome 浏览器 + Studio 本地 dev 版本（`pnpm --filter @advjs/studio dev`）
- [ ] 一个已配置 AI Key 的 AI Provider（推荐 DeepSeek，延迟低成本低）
- [ ] 浏览器窗口尺寸固定为 **1920×1080**（便于录制）
- [ ] **预准备 2 份项目**（作为 Fallback，万一生成失败可切换画面）：
  - `examples/ai-contest/life-story/`
  - 一个 training-drill 预生成项目（Week 4 临阵补）
- [ ] 系统音量静音 · 不让 Slack 通知串场

### 录制工具

- **屏幕录制**：macOS 内置 QuickTime 或 OBS Studio
- **剪辑**：Final Cut Pro / DaVinci Resolve / 剪映
- **字幕**：中英双语，字号 ≥ 28pt，底部 10% 区域

### 素材准备

- [ ] 开场照片（无水印·自拍或 Unsplash 免版权）
  - 老人家中场景 × 1
  - 手写文字纸 × 1（找纸亲手写几行字拍照）
  - 微信语音 UI 截图 × 1（自己录一个演示）
- [ ] 落版：ADV.JS logo（现有 `apps/studio/public/pwa-512x512.png` 可用）
- [ ] 音乐：钢琴 / 弦乐，温柔但不煽情。推荐 `YouTube Audio Library` 或 `Epidemic Sound`，选择带"Storytelling / Documentary"标签的。

### 核心录制技巧

1. **屏幕录制分段录**，不要一镜到底。每段 8-12 秒，剪辑时再串。
2. **光标移动要慢**，给观众看清楚点击的位置；必要时用后期加"点击高亮"效果。
3. **生成过程不加速**！流式进度正是我们的差异化点，真实时长就是感受——但如果整体超时，可以在"chapters 2/3 完成"到"scenes 完成"之间做 3 秒跳切。
4. **选项高亮**：Play 阶段做选择时，用后期加红框强调评委要点击的位置。

---

## Dogfood 脚本模板（3 位非技术同事）

> 目标：验证"非技术用户 5 分钟内能走通生成→试玩全流程"。

### 同意书 · 30 秒

"接下来请你用一个新产品，不用看文档、不用问我。
我们会记录你的操作过程和遇到的卡点。
全程大概 5-10 分钟，完全匿名，可以随时停止。"

### 任务 · 8 分钟

**任务 1（2 分钟）**：打开 Studio（给链接或本地地址），找到"从素材生成"入口。

- ⏱ 起：给出链接
- 📊 记录：他们花多久才找到那张 highlight 卡？有没有走错路径（点别的卡片 → 再退回）？

**任务 2（4 分钟）**：把这段素材（给出 `source.txt` 的打印稿）生成一个项目。

- 📊 记录：
  - Step 1 选模板：是否一眼看到 life-story 的 Recommended 徽章？
  - Step 2 输入项目名：有没有遗漏必填字段？对 token 计数有没有关注？
  - Step 3 生成中：有没有盯着进度树看？会不会想点「取消」？
  - 生成后他们第一反应是点什么——Play / Edit / Export？

**任务 3（2 分钟）**：进入 Play Tab，玩到第二章，做一次选择。

- 📊 记录：能否找到 Play Tab？做选择后有无困惑？

### 访谈 · 3-5 分钟

1. "整个过程最让你困惑的一步是哪一步？"
2. "生成的这个故事，你觉得'成色'怎么样？哪里让你觉得像 AI 生成的，哪里像人写的？"
3. "如果你身边真的有长辈的回忆素材，你会用这个工具吗？为什么？"
4. "你觉得这个工具除了生成人生故事，还能用来做什么？"

### 分析 · Week 4 内部复盘

- 3 人的卡点清单合并、按"影响人数 × 体验破坏程度"排序
- 前 3 名卡点当天 fix；其余放进 Phase M11 backlog
- 卡点修复后 dogfood 时间不超过 5 分钟视为达标

---

## 验收标准

- [ ] 视频成片 ≤ 92 秒，无硬切跳帧
- [ ] 中英双语字幕全覆盖，不依赖声音也能看懂
- [ ] 画面里至少有 **2 个** 完整的流式生成过程（life-story + training-drill）
- [ ] Play Tab 至少呈现 **1 次** 选项决策与不同分支的画面
- [ ] 结尾 5 秒品牌落版清晰
- [ ] Dogfood 3 人平均总时长 ≤ 7 分钟（生成 + 试玩）
