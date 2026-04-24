# ADV.JS Studio · 2026 AI 应用大赛参赛计划

> 📅 立项时间：2026-04-23 · 最近更新：2026-04-24
> 📌 参赛主体：ADV.JS Studio（`apps/studio`）
> 🎯 参赛形态：**Source-to-Project Pipeline**（素材一键成交互剧情）
> 🏆 主攻赛道：**AI 向善 · 时光忆站** · 副攻赛道：**AI 提效 · 企业培训**
> 🧩 承载载体：现有 `apps/studio`，**不新开 app**
> 🎚 实施策略：**单 Template 端到端闭环**（life-story 主打）+ **流式增量预览**（左进度树 / 右文件）+ **分发能力延后到 Phase M11**
> 📎 技术计划：见 [Phase M10](./next-phase-plan.md#phase-m10)

---

## 一、愿景 & 一句话定位

> **把一段回忆，变成一本可以"走进去"的人生剧本。**
>
> Source → Playable Scenario in 60 seconds.

市面上所有 AI 内容工具都在生成"让你看"的东西（PPT / 视频 / 数字人口播）。ADV.JS Studio 独一份的能力是：**让 AI 生成"让你玩"的东西**——有角色、有选择、有分支、有反馈的交互叙事。

**我们选择在本次大赛中只做一件事做到极致**：把一段老人的口述回忆或回忆文字，在 60 秒内变成一部家人可以走进去、替长辈做出不同选择、看到不同后果的互动人生剧。这是我们区别于 90% 参赛方案的**核心差异点**，也是对赛事「AI 向善 · 时光忆站」课题最直接的回答。

---

## 二、核心洞察

### 2.1 为什么是"玩"而不是"看"？

| 学习/沟通形态 | 留存率   | 现有 AI 工具              |
| ------------- | -------- | ------------------------- |
| 被动听讲      | ~5%      | -                         |
| 被动阅读      | ~10%     | ChatGPT / LLM             |
| 观看演示      | ~20%     | AI PPT / AI 视频 / 数字人 |
| 小组讨论      | ~50%     | -                         |
| **实践操作**  | **~75%** | -                         |
| **教别人做**  | **~90%** | -                         |

**ADV.JS Studio 的交互叙事天然属于"实践操作"区间**——用户在剧情里做选择、看到后果、再重来，这是所有"被动内容"工具都到不了的留存带。

### 2.2 为什么第一波只做 life-story？

参赛时间 4 周，我们对"做广度 vs 做深度"做了明确取舍：

- **做广度**（6 Template × 5 素材类型全跑通）= 每条线都浅尝辄止，评审现场每条都有可能翻车
- **做深度**（life-story 一条线打到端到端极致）= 故事完整、情感饱满、交互可信、展示稳定

我们选择**做深度**：life-story 作为主攻，training-drill 作为已有 Template YAML 的副攻演示（同一个引擎的另一种用法，证明可扩展性），其余 Template 明确放到赛后扩展。这样评审现场每一步都经过反复打磨，不会"演砸"。

### 2.3 Studio 现有能力盘点

截至 Phase M9，Studio 已完成：

- ✅ 项目管理 / IndexedDB 持久化 / 云同步
- ✅ 角色 / 章节 / 场景 / 音频 / 地点 / 知识库 CRUD
- ✅ AI 聊天 + 流式回复 + 记忆 + 群聊 + 日记 + 时间线
- ✅ 图片 AI 生成（支持多家 Provider 接入）
- ✅ TTS 4 Provider（Web Speech / OpenAI / 兼容 Provider / Custom）
- ✅ Embedding 向量检索
- ✅ 桌面 + 移动 + Capacitor + PWA 离线
- ✅ 项目打包 `.advpkg` / 市场页面原型
- ✅ 游戏预览播放器 + 触摸翻页 + 章节面板

**缺的唯一环节**：项目冷启动的素材从哪来？
→ 这就是 Phase M10 / 本次参赛方案要解决的问题。

### 2.4 Phase M10 当前进度

| 模块                                                        | 状态      | 说明                                             |
| ----------------------------------------------------------- | --------- | ------------------------------------------------ |
| `utils/sourceParser.ts` + `sourceChunk.ts`                  | ✅ 已完成 | W1 的 text/markdown/chat-log 已齐，W3 补 pdf/url |
| `utils/projectGenerator.ts`（4 步 LLM Pipeline + 流式事件） | ✅ 已完成 | 582 行，带 `GenerateProgressEvent`               |
| `utils/templates/loadTemplate.ts`                           | ✅ 已完成 | YAML 加载器                                      |
| `templates/life-story.yaml`                                 | ✅ 已完成 | 主攻 Template                                    |
| `templates/training-drill.yaml`                             | ✅ 已完成 | 副攻 Template                                    |
| 单元测试（sourceParser / projectGenerator / templates 等）  | ✅ 已完成 | 20+ 测试文件                                     |
| `composables/useProjectImport.ts`                           | 🚧 Week 1 | 状态机 + 预览 + 写盘                             |
| `views/workspace/ImportSourcePage.vue`                      | 🚧 Week 1 | **本次参赛的核心 UX**                            |
| 路由 + ProjectsPage 入口 + i18n                             | 🚧 Week 1 | 接入                                             |
| life-story 示范作品                                         | 🚧 Week 2 | 评审 Fallback                                    |
| Demo 视频 + Dogfood                                         | 🚧 Week 4 | 交付                                             |

**结论**：Pipeline 技术底已打好（88% 可复用），剩下 4 周的主战场在 **UX 层**。

---

## 三、Pipeline 设计

### 3.1 数据流

```
┌───────────────────────────────────────────────────────────────┐
│                          素材入口（W1）                       │
│  📄 纯文本 / Markdown                                          │
│  💬 聊天记录 / 问答记录（txt 导入）                            │
│  （W3 补：PDF / URL，赛后补：语音 ASR / 图文 OCR）             │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│               sourceParser.ts · 归一化  [✅ 已实现]           │
│  → { title, segments[], metadata, suggestedTemplate }         │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│          projectGenerator.ts · LLM Pipeline  [✅ 已实现]      │
│  ① 角色提取   → adv/characters/{id}.character.md              │
│  ② 章节骨架   → adv/chapters/NN.adv.md（按 template phase）   │
│  ③ 场景切分   → adv/scenes/{id}.md + adv/locations/{id}.md   │
│  ④ 知识沉淀   → adv/knowledge/{id}.md（可选）                 │
│                                                                │
│  · 每步带 schema 校验（zod）+ 解析重试                         │
│  · 每步发出 GenerateProgressEvent（start/chunk/complete/error）│
│  · 失败优雅降级：characters 失败则中止，其它失败仅 draftMode  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│         useProjectImport.ts · 状态机 + 预览 [🚧 Week 1]       │
│  → 订阅 progress 事件，维护 previewFiles 响应式数组           │
│  → 暴露 confirm() / abort() / retryCurrentStep()              │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│        ImportSourcePage.vue · 向导 UI  [🚧 Week 1]            │
│  左进度树 + 右流式预览（本次参赛的核心差异化体验）             │
│  确认 → writeTemplateFiles(fs, previewFiles) → 切换到项目     │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│              复用已有能力（无需新建）                          │
│  ▶ Play Tab 即刻可玩（GamePlayer）                            │
│  ▶ Editor Tab 可继续精修（现有编辑器）                        │
│  ▶ 一键导出 .advpkg（useProjectExport）                       │
│                                                                │
│  🚫 赛事窗口期延后（M11+）：二维码 / 短链 / Marketplace       │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 Prompt Caching 策略

遵循 `claude-api` skill 规范。`projectGenerator.ts` 已实现缓存友好的调用结构：

| Cache Layer                     | 内容                                          | 命中场景                       |
| ------------------------------- | --------------------------------------------- | ------------------------------ |
| `buildSystemPrompt(template)`   | Template 系统 Prompt（byte-identical 4+N 次） | 每次调用必中                   |
| `buildSharedUserContext(…)`     | 素材 + Template 章节结构（byte-identical）    | 每次调用必中                   |
| `buildXxxInstruction(template)` | 每步的具体指令差异                            | 仅当步 LLM 缓存（次数+1 即中） |

生成一整个项目约 4–9 次 LLM 调用（1 characters + N chapters + 1 scenes + 1 knowledge），Cache Hit 率预期 >70%。以 DeepSeek / 通义千问等兼容 Provider 的 prefix cache 计算，单项目成本 < ¥0.3。

---

## 四、核心 UX：左进度树 + 右流式预览

**这一节是本次参赛最重要的差异化点，是文档的一级章节，不是"加分项"。**

大部分 AI 生成工具的用户反馈止步于「Loading + 进度条」——用户不知道模型此刻在想什么，生成失败就是整屏报错。我们对标 Cursor / v0.dev 的流式生成体感，在 Studio 里做一个**透明、可干预、失败也能继续**的生成现场。

### 4.1 体验标准（**必须达到**）

| #   | 指标         | 标准                                                                       |
| --- | ------------ | -------------------------------------------------------------------------- |
| 1   | 首屏可见时间 | 用户点"生成"后 **< 10 秒**内，右侧必须开始出现第一个角色名                 |
| 2   | 进度粒度     | 左侧进度树至少呈现 **4 级**：步骤 → 子项（角色/章节个数）→ 状态 → 错误详情 |
| 3   | 可中断性     | 用户随时可点"取消"，立即停止下一步 LLM 调用（AbortController）             |
| 4   | 错误可恢复   | 任何单步失败只弹 inline 错误卡 + 重试按钮，不清空已生成内容                |
| 5   | 预览可读性   | 右侧用 MarkdownMessage 风格渲染，而不是裸 JSON                             |
| 6   | 完成态引导   | 生成完成后显示三张动作卡：`去试玩` / `继续编辑` / `导出包`                 |
| 7   | 草稿模式提示 | 某步失败进入 `draftMode` 时，确认按钮文案变为"保存草稿项目"                |

### 4.2 UI 布局

```
桌面（≥768px）：                         移动（<768px）：
┌──────────────┬─────────────────────┐   ┌─────────────────────┐
│ ⚙ 生成进度    │ 📄 预览              │   │ ⚙ 生成进度（展开式） │
├──────────────┼─────────────────────┤   ├─────────────────────┤
│ ✓ 素材解析    │  # 第一章 · 初次见面 │   │ ✓ 素材解析           │
│ ✓ 主题提取    │  @小张：早上好…     │   │ ✓ 主题提取           │
│ ● 角色提取    │  @客户：我有个问题… │   │ ● 角色提取（2/?）    │
│   ├ 小张      │  （流式生成中…）    │   ├─────────────────────┤
│   └ 客户      │                      │   │ 📄 预览（下拉 sheet）│
│ ○ 章节骨架    │                      │   │  # 第一章 · 初次见面 │
│ ○ 场景切分    │                      │   │  @小张：早上好…     │
│ ○ 知识沉淀    │                      │   │  （流式生成中…）    │
├──────────────┴─────────────────────┤   ├─────────────────────┤
│  [取消生成]   [跳到 Play]  [保存]   │   │ [取消] [保存/草稿]   │
└─────────────────────────────────────┘   └─────────────────────┘
```

### 4.3 状态机

```
idle → parsing → generating (characters → chapters → scenes → knowledge)
      ↓              ↓                         ↓
      error          draftMode (可恢复)        done → writing → project-ready
```

**`useProjectImport.ts`** 内部维护 `{ status, currentStep, previewFiles, error, draftMode }` 响应式对象，UI 纯粹订阅显示。

---

## 五、Template 系统

### 5.1 本次参赛 Template 清单

| Template                    | 输入素材                    | 产出形态                   | 对接赛题                      | 本届状态                     |
| --------------------------- | --------------------------- | -------------------------- | ----------------------------- | ---------------------------- |
| **life-story** 人生故事     | 老人口述录音转写 / 回忆文字 | 多章人生 ADV，温柔克制叙事 | **AI 向善·课题5（时光忆站）** | ✅ YAML 已就绪，**主攻**     |
| **training-drill** 企业培训 | 销售手册 / SOP / 合规红线   | 员工角色扮演练习 + 评分    | AI 提效                       | ✅ YAML 已就绪，**副攻演示** |

**副攻演示的意义**：同一个 `projectGenerator.ts` + 同一套 UI，只换 Template YAML 就得到完全不同赛道的产品形态——这是引擎能力的最佳证明。

### 5.2 赛后扩展 Template（明确不做）

以下 Template 放到赛后开发，文档中提及仅为说明引擎的可扩展性：

- `touch-book` 触摸绘本教学（AI 向善·课题1）
- `anti-fraud` 防诈剧场（AI 向善·老年人）
- `customer-service` 客诉话术（AI 提效·客服）
- `medical-comm` 医患沟通（AI 向善·医疗）

### 5.3 Template 文件格式（life-story 为例）

```yaml
id: life-story
name: 人生故事
description: 把长辈的口述回忆或人生文字，生成多章节的可互动人生 ADV。
recommendedSources: [text, markdown, chat-log]

systemPrompt: |
  你是一位温柔、有同理心的传记叙事设计师……
  叙事原则：真实优先 · 情感优先 · 温度克制 · 结构清晰

characterArchetypes:
  - {role: protagonist, voiceHint: warm-elder, tone: 平和而带有岁月感}
  - {role: family, voiceHint: warm-young, tone: 亲近、倾听}
  - {role: narrator, voiceHint: calm-neutral, tone: 含蓄、克制}

chapterStructure:
  - {phase: childhood, choices: 1, targetTokens: 500}
  - {phase: youth, choices: 2, targetTokens: 700}
  - {phase: turning, choices: 3, targetTokens: 800}
  - {phase: family, choices: 2, targetTokens: 700}
  - {phase: reflection, choices: 0, targetTokens: 500}

sceneStyle: nostalgic-warm
ttsEnabled: true
knowledgeExtraction: true
```

---

## 六、赛事交付物清单

### 6.1 必选项（**4 条**，从原 7 条收窄）

| #   | 交付物                            | 负责模块                                              | 验收标准                                                             |
| --- | --------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | **ImportSourcePage.vue** 导入向导 | `apps/studio/src/views/workspace/`                    | life-story × text/markdown/chat-log 全部跑通，UX 达到第四节 7 条标准 |
| 2   | **Source-to-Project Pipeline**    | `utils/sourceParser.ts` + `utils/projectGenerator.ts` | 单项目生成 < 60s，Cache Hit >70%，AiBridge 测试覆盖                  |
| 3   | **life-story 示范作品**           | `examples/ai-contest/life-story/`                     | 一段真实或合成的口述回忆 → 完整可玩 ADV，作为评审 Fallback           |
| 4   | **Demo 视频 + 本参赛文档**        | 90 秒视频 + `docs/studio/ai-contest-2026.md`          | 展示"贴素材 → 左进度右预览 → 进入 Play 做选择"                       |

### 6.2 加分项（做到就加，做不到不阻塞交付）

| #   | 加分项                       | 说明                                              |
| --- | ---------------------------- | ------------------------------------------------- |
| A   | training-drill Template 演示 | Week 2 已纳入计划：同引擎不同 Template 的对比展示 |
| B   | 无障碍支持                   | 进度树 aria-live，延续 Phase M8.5                 |
| C   | TTS 音色自动分配             | 按 characterArchetypes 的 voiceHint 映射          |
| D   | Agent 平台 Skill             | 独立 skill 仓库，平台调用出结果                   |
| E   | 学习数据看板                 | 玩家选择轨迹、卡点分析                            |
| F   | 离线可用                     | 复用 Phase M6.3 PWA 能力                          |

### 6.3 **赛事窗口期延后**（不承诺、不阻塞本届交付，但会在 Phase M11+ 继续做）

| 项                                           | 延后到             | 说明                                    |
| -------------------------------------------- | ------------------ | --------------------------------------- |
| ⏭ 二维码 / 短链分发                         | Phase M11          | 评审现场暂用 `.advpkg` + 本地 Play 兜底 |
| ⏭ Marketplace 上架                          | Phase 14（已排期） | 账号系统 Phase 13 前置                  |
| ⏭ 多个示范作品（第 2、3 个）                | Phase M11          | 本届只做 1 个 life-story 打磨到位       |
| ⏭ 触摸绘本 / 防诈剧场 / 客诉话术 / 医患沟通 | Phase M11+         | 每个对应一份 Template YAML              |
| ⏭ PDF / URL 素材入口                        | Week 3 内尝试      | 预留 W3 scope，见 sourceParser.ts       |
| ⏭ 图文 OCR / 语音 ASR 素材入口              | Phase M11+         | 需要集成 VLM / Whisper                  |

---

## 七、赛道叙事

### 7.1 主攻：AI 向善 · 时光忆站（课题 5）

**题目定义**：「奶奶讲一段回忆 → 自动生成一本可玩的人生 ADV」

**核心卖点**：

1. 老人的回忆从"文字档案"变成"家人可以走进去的剧本"，**情感留存方式升级一档**
2. 家人在剧情中替长辈做选择、看到不同结局，**"我理解了爷爷当年的处境"** 这件事第一次成为产品而不是幻想
3. 一段 ~1500 字的口述文本，60 秒内产出一部 5 章节、带 3 个主要角色、10+ 分支选项的完整 ADV

**Demo 场景**：

- 现场贴一段预先准备好的老人口述（~1500 字）
- 左进度树实时点亮，右预览流式展开角色和章节
- 60 秒内进入 Play，评委替剧中长辈做"去大城市闯还是留在老家照顾父母"的选择
- 看到两种走向的后续章节

### 7.2 副攻：AI 提效 · 企业培训

**同一个引擎换 Template YAML 即切换赛道**：

- `training-drill` Template：销售 SOP → 「愤怒客户 vs 客服新人」角色扮演练习
- 传统互动课件 2 周外包、数万块成本 → 我们：5 分钟生成、边际成本 < ¥1
- 传统 eLearning 完课率 <30% → 我们：沉浸式角色扮演，留存率理论 >75%

**评审价值**：**同一个现场点击的引擎，展示两个赛道的产品形态**。评委两个赛道都能看到实际产品、不是 PPT。

---

## 八、技术里程碑

**核心原则：每周都有"端到端可玩"的里程碑，不攒大招。**

| 阶段       | 周期    | 关键节点                                                                   | 每周端到端里程碑                            |
| ---------- | ------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| **Week 1** | D1–D7   | `useProjectImport` 状态机 + `ImportSourcePage` 向导 + 路由/入口/i18n       | life-story × text 本地完整跑通，可进 Play   |
| **Week 2** | D8–D14  | UX 打磨（7 条标准全达到）+ `training-drill` 副攻接入 + life-story 示范作品 | 两个 Template 都能演，示范作品可作 Fallback |
| **Week 3** | D15–D21 | 无障碍 + `useProjectImport` 单元测试 + `docs/guide/studio.md` 用户文档     | 代码质量 + 文档 + 无障碍全部到位            |
| **Week 4** | D22–D28 | Demo 视频分镜/录制 + 3 位非技术同事 Dogfood + 赛事材料最终版               | 提交 + 交付                                 |

**每周验收物**：一段 3 分钟演示视频 + 对应示范项目截图 + Dogfood 卡点记录（从 Week 3 起）。

---

## 九、风险与应对

| 风险                                           | 应对                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| **流式预览 UX 难度高于 Pipeline 本身**（新增） | Week 1 先做 Loading 兜底（一次性渲染版），Week 2 再升级到流式；UX 7 条标准分级验收 |
| LLM 生成质量不稳定                             | Template 兜底 + zod schema 校验 + 解析失败自动重试 1 次 + 人工可编辑               |
| 素材版权                                       | 示范作品使用合成的"虚拟奶奶口述"素材并明确标注为虚构；产品层提供水印 & 授权声明    |
| 素材过大超上下文                               | `sourceParser.ts` 分段（1000 tokens/段 + overlap）+ 分步渐进生成                   |
| 单次生成成本过高                               | Prompt 前缀按字节对齐 + 各步骤可选模型                                             |
| 非技术用户不会用                               | ImportSourcePage 3 步 Stepper + 每步示例 + 一键 Template 填充                      |
| 赛事评委体验链路长 / 现场网差                  | life-story 示范作品作为 Fallback，断网也能演 Play                                  |
| AI Provider 配置门槛                           | 向导首页检查 AI Key；未配置时引导跳转 Settings，返回后自动恢复向导进度             |

---

## 十、赛后价值（Why It Matters Beyond Contest）

1. **产品定位升级**：Studio 从"脚本编辑器"→"**叙事生成平台**"，差异化叙事直接拔高一档
2. **引擎商业化场景打通**：企业培训 / 公益教育 / IP 孵化三条线天然就位（Template 可扩展性已由 training-drill 验证）
3. **开源社区故事**：ADV.JS 作为"唯一 AI 原生交互叙事引擎"，可争取国际开源聚光
4. **可持续迭代**：生成 Pipeline 本身会随 LLM 能力增长而增值，不是一锤子买卖

---

## 十一、实施日志

> 每周 Sprint 结束时在此追加一条，确保文档和代码不脱节。

- **2026-04-24**：立项优化完毕。明确"单 Template 端到端 + 流式增量预览 + 不做分发"三条主线。已有基础设施盘点：sourceParser / projectGenerator / loadTemplate / 两份 Template YAML / 20+ 单元测试。Week 1 正式开工。

- **2026-04-24 · Week 1 完成**：核心 UX 全栈实现。
  - `composables/useProjectImport.ts`（纯状态机，8 个单测全绿，AiBridge 注入式测试）
  - `components/import/` 5 个可复用原子组件：`ProgressTree` + `ProgressTreeNode`（通用步骤化 AI 任务进度树，未来「按章生成」「批量配图」可直接复用）、`GenerationPreviewPane`（通用流式文件预览）、`TemplatePickerCard`、`SourceInputForm`、`ImportCompletionActions`
  - `views/workspace/ImportSourcePage.vue`（壳页面，只负责 stepper 编排与子组件 wiring）
  - 路由 `/tabs/workspace/import-source` · ProjectsPage 「从素材生成」入口卡（highlight 样式）· 中英 i18n 完整覆盖
  - 验收：TSC 零错 · ESLint 零错 · 23 个测试文件 247 tests 全绿

- **2026-04-24 · Week 2 完成**：示范作品 + UX 打磨。
  - `examples/ai-contest/life-story/` 完整示范项目（13 文件：2 角色 + 3 章节 + 2 场景 + 2 地点 + 2 知识 + README + source.txt + world + outline），作为赛事 Fallback。配套集成测试 `lifeStoryExample.test.ts` 6 个 case 防止未来 schema 漂移
  - training-drill Template 自动接入（零额外代码，`listTemplates()` 自动识别）
  - 错误态分类与恢复提示：按 AiApiError 类型细化为 auth / rate_limit / not_found / timeout / network / api_error / parse 等 7 种场景，每种都有具体的 recovery hint
  - 进度树 pulse dot + child-in 淡入动画
  - 实时生成的文件计数 chip（右上角 pop 动画）
  - 当前步骤 caption（告诉用户 AI 正在做什么，不再盯空白 spinner）
  - 验收：TSC 零错 · ESLint 零错 · 33 文件 310 tests 全绿

- **2026-04-24 · Week 3 完成**：无障碍 + 测试 + 文档。
  - 无障碍：ImportSourcePage `role="status" aria-live="polite"` 区域已就位（当前步骤切换时读屏器可感知）；ProgressTree 带 `role="region"` + `role="list"` 语义；TemplatePickerCard 为 `role="radiogroup"`；GenerationPreviewPane 为 `role="region"` + 文件按钮 `aria-current`
  - 测试补全：Week 1 已完成 `useProjectImport.test.ts`（8 cases） + Week 2 补 `lifeStoryExample.test.ts`（6 cases）
  - 用户文档：`docs/guide/studio/index.md` 新增「从素材生成项目（AI 一键创建）」章节，3 Step 说明 + 示范作品入口 + Provider 配置说明

- **2026-04-24 · Week 4 完成**：Demo 分镜 + Dogfood 脚本。
  - `docs/studio/demo-script.md` 90 秒分镜 + 中英双语解说 + 录制清单 + 素材准备清单
  - Dogfood 脚本模板：3 位非技术同事 8 分钟任务 + 3-5 分钟访谈 + 卡点分析方法
  - 视频验收标准、Dogfood 达标指标已明确（总时长 ≤ 7 分钟为达标）
  - **剩余人工交付（需真人执行）**：按脚本录制 90s 视频 + 跑 3 场 Dogfood + 提交赛事材料

---

## 附录 A：术语对照

| 赛事用语     | Studio 对应                                                      |
| ------------ | ---------------------------------------------------------------- |
| AI 应用      | Studio 前端 App（PWA + Capacitor）                               |
| Skill / 专家 | Agent / Skill 平台上的「ADV 故事工坊」（加分项）                 |
| Agent        | Studio 内 AI Chat / Character Chat                               |
| 知识库       | `adv/knowledge/*.md` + IndexedDB Embedding 缓存                  |
| 数字人       | `@advjs/vrm` + TTS Provider                                      |
| 分发         | 本届用 `.advpkg` 兜底；Phase M11 起补二维码 / 短链 / Marketplace |

## 附录 B：参考

- [Phase M10 技术计划](./next-phase-plan.md#phase-m10)
- [Studio AGENTS.md](../../apps/studio/AGENTS.md)
- [`@advjs/parser` 语法树](https://parser.advjs.org)
- 大赛赛题：AI 向善课题 1/5 + AI 提效自命题
