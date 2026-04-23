# ADV.JS Studio · 2026 AI 应用大赛参赛计划

> 📅 立项时间：2026-04-23
> 📌 参赛主体：ADV.JS Studio（`apps/studio`）
> 🎯 参赛形态：**Source-to-Project Pipeline**（素材一键成交互剧情）
> 🏆 主攻赛道：**AI 提效** · 副攻赛道：**AI 向善**
> 🧩 承载载体：现有 `apps/studio`，**不新开 app**
> 📎 技术计划：见 [Phase M10](./next-phase-plan.md#phase-m10)

---

## 一、愿景 & 一句话定位

> **把任何一份素材，变成一段可以"玩"的剧情。**
>
> Any Source → Playable Scenario in 60 seconds.

市面上所有 AI 内容工具都在生成"让你看"的东西（PPT / 视频 / 数字人口播）。ADV.JS Studio 独一份的能力是：**让 AI 生成"让你玩"的东西**——有选择、有角色、有分支、有反馈的交互叙事。

这是我们在本次大赛中区别于 90% 参赛方案的**核心差异点**。

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

### 2.2 Studio 现有能力盘点

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

---

## 三、Pipeline 设计

### 3.1 数据流

```
┌───────────────────────────────────────────────────────────────┐
│                          素材入口                              │
│  📄 纯文本 / PDF / Markdown                                    │
│  🎙  语音录音 / 访谈（ASR → 文本）                             │
│  🖼  图文绘本（OCR + VLM → 结构化描述）                        │
│  💬 群聊记录 / 社群问答（JSON/HTML 导入）                      │
│  🔗 URL（文章 / 公众号 / 政策文档）                            │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                   sourceParser.ts · 归一化                     │
│  → { title, segments[], metadata, suggestedTemplate }         │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│              projectGenerator.ts · LLM Pipeline               │
│  ① 主题/角色提取 → characters/*.md                            │
│  ② 叙事骨架生成 → chapters/*.adv.md（含分支选项）              │
│  ③ 场景切分 + 图片提示 → scenes/*.md                          │
│  ④ 背景知识沉淀 → knowledge/*.md                              │
│  ⑤ TTS 音色匹配 → 按角色分配                                  │
│                                                                │
│  （复用 resolveAiConfig.ts / embeddingClient.ts / 流式进度）   │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                 useProjectImport.ts · 预览 & 写盘              │
│  → 用户确认 → 写入 IndexedDB / dirHandle                      │
│  → ProjectsPage 自动出现新项目                                 │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                         分发与复用                             │
│  ▶ Play Tab 即刻可玩                                          │
│  ▶ Editor Tab 可继续精修                                       │
│  ▶ 一键导出 .advpkg                                            │
│  ▶ 专属二维码 + 短链分享                                       │
│  ▶ 上架 Marketplace                                            │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 Prompt Caching 策略

遵循 `claude-api` skill 规范：

| Cache Block | 内容                                     | TTL |
| ----------- | ---------------------------------------- | --- |
| Block 1     | System prompt + Template YAML            | 1h  |
| Block 2     | 素材正文（去重后的 segments）            | 5m  |
| Block 3     | 已生成的上文（characters/chapters 增量） | 5m  |

预期：生成一整个项目 ≈ 4 轮 LLM 调用，Cache Hit 率 >70%，单项目成本 < ¥0.3。

---

## 四、Template 系统与赛题覆盖

### 4.1 官方 Template 清单

| Template                      | 输入素材                  | 产出形态                    | 对接赛题                  |
| ----------------------------- | ------------------------- | --------------------------- | ------------------------- |
| **life-story** 人生故事       | 老人口述录音 / 回忆文字   | 多章人生 ADV + 数字人讲述   | AI 向善·课题5（时光忆站） |
| **touch-book** 触摸绘本教学   | 绘本图文 + 触感说明       | 家长陪读引导剧情 + 教学视频 | AI 向善·课题1（绘本AI）   |
| **anti-fraud** 防诈剧场       | 真实诈骗案例库            | 老年人沉浸式防诈练习        | AI 向善·通用              |
| **training-drill** 培训剧本   | 销售手册 / SOP / 合规红线 | 员工角色扮演练习 + 评分     | AI 提效·主力              |
| **customer-service** 客诉话术 | 历史工单 / FAQ            | 客服上岗前模拟对话          | AI 提效·客服              |
| **medical-comm** 医患沟通     | 典型病例集                | 医学生告知坏消息练习        | AI 向善·医疗              |

### 4.2 Template 文件格式示例

```yaml
# apps/studio/src/templates/training-drill.yaml
id: training-drill
name: 企业培训剧本
description: 把一份 SOP/合规材料变成角色扮演练习
recommendedSources: [pdf, markdown, text]

systemPrompt: |
  你是一位资深的企业培训设计师……
  目标：把素材转化为带分支选项的角色扮演剧情……

characterArchetypes:
  - {role: mentor, voice: calm-male, tone: 专业耐心}
  - {role: customer, voice: anxious-female, tone: 情绪化}

chapterStructure:
  - {phase: 建立情境, choices: 0}
  - {phase: 冲突升级, choices: 3}
  - {phase: 关键决策, choices: 4}
  - {phase: 反馈复盘, choices: 0}

sceneStyle: realistic-office
ttsEnabled: true
knowledgeExtraction: true
```

---

## 五、赛事交付物清单

### 5.1 必选项

| #   | 交付物                            | 负责模块                                  | 验收标准                              |
| --- | --------------------------------- | ----------------------------------------- | ------------------------------------- |
| 1   | **ImportSourcePage.vue** 导入向导 | `apps/studio`                             | 5 种素材类型 × 6 个 Template 全部跑通 |
| 2   | **Source-to-Project Pipeline**    | `utils/projectGenerator.ts`               | 单项目生成 < 60s，Cache Hit >70%      |
| 3   | **3 个示范作品**                  | `examples/ai-contest/*`                   | 1 个人生故事 + 1 个绘本 + 1 个培训    |
| 4   | **Agent 平台 Skill**              | 独立 skill 仓库                           | 平台调用即出结果链接                  |
| 5   | **二维码分发**                    | `apps/studio` + 静态托管                  | 扫码 3 秒内打开 Play 页               |
| 6   | **赛事文档**                      | `docs/studio/ai-contest-2026.md` (本文件) | -                                     |
| 7   | **Demo 视频**                     | 90 秒                                     | 展示"素材丢进去 → 角色出现 → 可玩"    |

### 5.2 加分项

| #   | 加分项               | 说明                                              |
| --- | -------------------- | ------------------------------------------------- |
| A   | 学习数据看板         | 玩家选择轨迹、卡点分析，管理员可见                |
| B   | 多 Template 一键切换 | 同一份素材在不同 Template 下的对比演示            |
| C   | AI 讲师数字人        | 复用 `@advjs/vrm` 的 3D 讲师角色                  |
| D   | 无障碍支持           | 屏幕阅读器、字体放大、语音操作（延续 Phase M8.5） |
| E   | 方言 TTS             | 粤语 / 沪语 / 闽南语（接云端 TTS 服务）           |
| F   | 离线可用             | 复用 Phase M6.3 PWA 能力                          |

---

## 六、赛道叙事

### 6.1 主攻：AI 提效赛道

**题目定义**：「ADV 故事工坊——企业培训/客服/合规的交互剧本自动化平台」

**核心卖点**：

1. 传统互动课件：2 周外包，数万块成本 → 我们：5 分钟生成，边际成本 < ¥1
2. 传统 eLearning 完课率 <30% → 我们：沉浸式角色扮演，留存率理论 >75%
3. 管理层首次拿到"员工在哪一步犯错"的可量化数据

**Demo 场景**：

- 现场把一份真实的客诉 SOP 丢进去
- 30 秒后生成一个「愤怒客户 vs 客服新人」的可玩剧情
- 评委亲自扮演客服，做 3 个选择，看到不同走向

### 6.2 副攻：AI 向善赛道

**同一个引擎，内容侧一换 = 一个全新公益产品**：

- **时光忆站**（课题5）：奶奶讲一段回忆 → 自动生成一本"可玩的人生 ADV"
- **触摸绘本**（课题1）：一本绘本照片 → 自动生成家长陪读引导剧情 + 教学视频
- **防诈剧场**（自命题）：真实案例 → 老人沉浸式防诈练习

**一鱼两吃**：评委两个赛道都能看到同一个引擎的不同化身，**故事完整度大幅领先**。

---

## 七、技术里程碑

| 阶段       | 周期         | 关键节点                                                           |
| ---------- | ------------ | ------------------------------------------------------------------ |
| **Week 1** | 立项后 D1–D7 | sourceParser + projectGenerator 核心 Pipeline + 1 个 Template 跑通 |
| **Week 2** | D8–D14       | ImportSourcePage 向导 UI + 另 2 个 Template + Prompt Caching 接入  |
| **Week 3** | D15–D21      | 剩余 3 个 Template + 二维码分发 + 生成 3 个示范作品                |
| **Week 4** | D22–D28      | Skill 平台上架 + Demo 视频录制 + 文档完善 + 内部 Dogfood           |

**每周验收物**：一条 3 分钟演示视频 + 对应示范项目链接。

---

## 八、风险与应对

| 风险               | 应对                                                               |
| ------------------ | ------------------------------------------------------------------ |
| LLM 生成质量不稳定 | Template 兜底 + Embedding 去重 + 人工可编辑（已有 Studio 编辑器）  |
| 素材版权           | 示范作品一律使用公开素材或授权素材；产品层提供水印 & 用户授权声明  |
| 素材过大超上下文   | `sourceParser.ts` 分段 + Embedding 选段 + 分章节渐进生成           |
| 单次生成成本过高   | Prompt Caching（claude-api skill 规范）+ 各步骤可选模型            |
| 非技术用户不会用   | ImportSourcePage 做成 Stepper 向导 + 每步示例 + 一键 Template 填充 |
| 赛事评委体验链路长 | 准备 3 个预生成二维码作为 Fallback Demo，现场网不好也能演          |

---

## 九、赛后价值（Why It Matters Beyond Contest）

1. **产品定位升级**：Studio 从"脚本编辑器"→"**叙事生成平台**"，差异化叙事直接拔高一档
2. **引擎商业化场景打通**：企业培训 / 公益教育 / IP 孵化三条线天然就位
3. **开源社区故事**：ADV.JS 作为"唯一 AI 原生交互叙事引擎"，可争取国际开源聚光
4. **可持续迭代**：生成 Pipeline 本身会随 LLM 能力增长而增值，不是一锤子买卖

---

## 十、下一步行动

- [ ] 本文档通过 Review 后，同步创建 `examples/ai-contest/` 目录
- [ ] 创建 `apps/studio/src/templates/` 目录与 `life-story.yaml` 首个 Template
- [ ] 新增 Phase M10 追踪任务（拆分到 `next-phase-plan.md`，已完成 ✅）
- [ ] 组建赛事小组（创意 1 + 全栈 2 + 设计 1 + 内容 1）

---

## 附录 A：术语对照

| 赛事用语     | Studio 对应                                     |
| ------------ | ----------------------------------------------- |
| AI 应用      | Studio 前端 App（PWA + Capacitor）              |
| Skill / 专家 | Agent / Skill 平台上的「ADV 故事工坊」          |
| Agent        | Studio 内 AI Chat / Character Chat              |
| 知识库       | `adv/knowledge/*.md` + IndexedDB Embedding 缓存 |
| 数字人       | `@advjs/vrm` + TTS Provider                     |
| 二维码分发   | `useProjectExport` + 短链服务                   |

## 附录 B：参考

- [Phase M10 技术计划](./next-phase-plan.md#phase-m10)
- [Studio AGENTS.md](../../apps/studio/AGENTS.md)
- [`@advjs/parser` 语法树](https://parser.advjs.org)
- 大赛赛题：AI 向善课题 1/5 + AI 提效自命题
