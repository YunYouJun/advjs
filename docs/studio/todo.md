# Studio · TODO

> 📅 最后更新：2026-04-23
>
> 本文件跟踪 Studio 下一步要做的具体任务清单。历史完成的阶段见 [`next-phase-plan.md`](./next-phase-plan.md)；2026 AI 应用大赛的产品活动计划见 [`ai-contest-2026.md`](./ai-contest-2026.md)。

---

## ✅ Phase M10 · W1 已完成（2026-04-23）

Source-to-Project Pipeline 核心后端能力全部就绪。

| 交付                                     | 文件                                                                          | 状态 |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ---- |
| `writeTemplateFiles` 重构                | `apps/studio/src/utils/projectTemplate.ts`                                    | ✅   |
| 素材分段                                 | `apps/studio/src/utils/sourceChunk.ts`                                        | ✅   |
| 素材归一化（text / markdown / chat-log） | `apps/studio/src/utils/sourceParser.ts`                                       | ✅   |
| 人生故事模板                             | `apps/studio/src/templates/life-story.yaml`                                   | ✅   |
| 企业培训模板                             | `apps/studio/src/templates/training-drill.yaml`                               | ✅   |
| YAML 加载器                              | `apps/studio/src/utils/templates/loadTemplate.ts`                             | ✅   |
| JSON 校验器（4 步）                      | `apps/studio/src/utils/projectGenerator/schemas.ts`                           | ✅   |
| Prompt 构造（cache-prefix-friendly）     | `apps/studio/src/utils/projectGenerator/prompts.ts`                           | ✅   |
| 4 步 LLM Pipeline                        | `apps/studio/src/utils/projectGenerator.ts`                                   | ✅   |
| W1 单测 46 tests                         | `src/__tests__/{sourceChunk,sourceParser,templates,projectGenerator}.test.ts` | ✅   |

**验收**：`pnpm -F @advjs/studio test` → 216 tests passed；`vue-tsc --noEmit` 无错；`projectGenerator` 在 Memory fs 下端到端产出 life-story / training-drill 项目。

---

## 🚧 Phase M10 · W2 待办（UI + 路由对接）

目标：**UI 粘贴文本 → 60 秒内获得可玩项目**。

### W2.1 导入状态机 composable

- [ ] 新建 `apps/studio/src/composables/useProjectImport.ts`
  - 状态机：`idle → parsing → ready → generating → preview → writing → done|error`
  - 封装 `parseSource` / `generateProject` / `writeTemplateFiles`
  - slug 冲突检测（三策略：skip / rename / overwrite）
  - 写盘完成后调用 `useProjectContent().reload()`
  - 支持 `AbortSignal`（向下透传给 `generateProject`）
- [ ] 新建 `apps/studio/src/__tests__/useProjectImport.test.ts`（Memory fs 单测，3 种冲突策略）

### W2.2 向导 UI（Stepper）

参考 `views/workspace/BatchImportPage.vue` 的多步骤 + 冲突选择模式。**所有 Ionic slot 必须用原生 `slot="..."`**（见 `apps/studio/AGENTS.md`）。

- [ ] `apps/studio/src/views/workspace/ImportSourcePage.vue`（5 步 Stepper 主框架）
- [ ] `apps/studio/src/components/ImportSourceUpload.vue`（步骤 1：类型 Segment + 文件/粘贴/拖拽）
- [ ] `apps/studio/src/components/ImportTemplateCard.vue`（步骤 2：卡片选择，suggestedTemplateId 默认高亮）
- [ ] `apps/studio/src/components/ImportProgressLog.vue`（步骤 3：流式进度日志，绑定 `GenerateProgressEvent`）
- [ ] `apps/studio/src/components/ImportFilePreviewTree.vue`（步骤 4：生成文件树，只读）
- [ ] 步骤 5：项目名 + slug + 冲突策略（inline 在主 Page 内）

### W2.3 接入既有入口

- [ ] `apps/studio/src/router/index.ts` 新增 `workspace/import` 路由
- [ ] `apps/studio/src/views/ProjectsPage.vue` 新增 "导入素材一键生成" action-card
- [ ] `apps/studio/src/components/CreateProjectModal.vue` footer 增加 "From Source…" 入口跳转到向导
- [ ] `apps/studio/src/i18n/locales/{en,zh-CN}.json` 新增 `importSource.*` 文案键

### W2.4 新增 Template

- [ ] `apps/studio/src/templates/touch-book.yaml`（触摸绘本教学，AI 向善·课题1）

### W2.5 Prompt 前缀稳定性复盘

- [ ] 接一个真实 Provider（DeepSeek / Qwen / Anthropic OpenAI 兼容端点）
- [ ] 观察 Provider 控制台的 cache hit rate
- [ ] 如 <70%，调整 `prompts.ts` 中 shared prefix 的组装顺序，确保跨 step 完全字节一致

**验收条件**：本地 `pnpm -F @advjs/studio dev` 中，用户从 `/tabs/workspace` 选"导入素材一键生成"，粘贴 `apps/studio/tests/fixtures/m10/*.md` → <60s 出项目 → WorkspacePage 立即可见 → Play Tab 可玩。

---

## 🔜 Phase M10 · W3 待办（扩源 + 分发 + Demo）

### W3.1 更多 Template

- [ ] `apps/studio/src/templates/anti-fraud.yaml`（防诈剧场，AI 向善）
- [ ] `apps/studio/src/templates/medical-comm.yaml`（医患沟通，AI 向善）

### W3.2 PDF 解析

- [ ] `sourceParser.ts` 加 `type: 'pdf'` 分支
- [ ] 动态 import `pdfjs-dist`（避免 bundle 膨胀）
- [ ] `apps/studio/package.json` 按需增加依赖
- [ ] 补 `sourceParser.test.ts` 的 PDF 测试样本

### W3.3 分发（二维码 + 静态托管）

- [ ] 新增 "项目分享" 入口：生成项目后自动生成短链 + QR
- [ ] 决定静态托管位置（可选：GitHub Pages / 自建 / 内部静态资源）
- [ ] 复用 `modern-screenshot` 生成 QR 卡片图

### W3.4 Demo 作品

在 `examples/ai-contest/` 目录下：

- [ ] `examples/ai-contest/life-story-demo/` — 真实人生故事 Demo
- [ ] `examples/ai-contest/history-talk-demo/` — AI 历史人物对谈 Demo
- [ ] `examples/ai-contest/murder-mystery-demo/` — AI 剧本杀 Demo
- [ ] `examples/ai-contest/touch-book-demo/` — 绘本教学 Demo
- [ ] 每个 Demo 附生成素材、生成日志、QR 图

**验收条件**：3 个 QR 扫码 3 秒内打开 Play 页；6 个 Template × 3 个源类型矩阵通过冒烟测试。

---

## 🔜 Phase M10 · W4 待办（赛事打磨）

- [ ] Agent / Skill 平台上架 "ADV 故事工坊"（外部仓库）
- [ ] 90 秒 Demo 视频录制
- [ ] i18n 全面审查（en / zh-CN 覆盖 M10 新增键）
- [ ] 无障碍审查（延续 Phase M8.5 规范）
- [ ] 内部 Dogfood + bug fix
- [ ] 比赛彩排：准备 3 个预生成项目作为网络故障兜底
- [ ] `docs/studio/ai-contest-2026.md` "下一步行动" 清单逐一勾选

**验收条件**：Skill 调用返回可用项目链接；内部 Dogfood 无阻塞；Critical Success Criteria（见 `ai-contest-2026.md` §8）全部打勾。

---

## 🧊 赛后沉淀（不在本里程碑交付）

- [ ] Anthropic 原生 `cache_control` 分支（目前依赖 Provider 端前缀缓存）
- [ ] 素材分段后的 Embedding 去重（当前 W1 已就绪 `embeddingClient.ts`，待接入）
- [ ] VLM 图文 OCR（绘本图片直接识别）
- [ ] ASR 语音转文字（老人口述直接录）
- [ ] Flow 编辑器 + 项目生成 Pipeline 联动（地点驱动分支）

---

## 📌 备注

- 实施计划详见 `.claude-internal/plans/quirky-wibbling-wreath.md`（不在仓库里，仅 Claude Code session 可见）
- 产品活动计划：`docs/studio/ai-contest-2026.md`
- 历史阶段计划：`docs/studio/next-phase-plan.md` 的 Phase M10 章节
