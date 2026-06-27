# Studio · TODO

> 📅 最后更新：2026-05-07
>
> 本文件只跟踪 **当前 Sprint 内仍未完成** 的任务。
>
> - 历史完成的阶段计划见 [`next-phase-plan.md`](./next-phase-plan.md)
> - 2026 AI 应用大赛产品/活动计划见 [`ai-contest-2026.md`](./ai-contest-2026.md)

---

## ✅ Phase M10 已完成里程碑（折叠）

| Sprint                  | 范围                        | 关键产出                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **W1** · 2026-04-23     | 后端 Pipeline               | `sourceParser.ts` (657) · `sourceChunk.ts` (206) · `projectGenerator.ts` (657) · 4 步 LLM Pipeline + zod schema · `prompts.ts` cache-friendly 前缀 · YAML 模板加载器 · 46 W1 单测                                                                                                                                                                            |
| **W2** · 2026-04-24     | UI + 路由                   | `useProjectImport` (530) 状态机 · 6 个 `import/` 原子组件 · `ImportSourcePage.vue` (993) 三步向导 · 路由 `/tabs/workspace/import` · `importSource.*` i18n + en/zh 同步                                                                                                                                                                                       |
| **W3** · 2026-04-26→    | 扩源 + 分发                 | `anti-fraud` / `medical-comm` Template；PDF 解析（动态 import `pdfjs-dist`）；QR 卡片图：`ProjectShareCard.vue` + `shareUtils.shareProjectAsImage` + `qrcode` / `@types/qrcode` 入 deps；3 个 ai-contest demo 骨架（life-story/history-talk/murder-mystery，含 `source.{txt,md}` + `generation-log.md` + `assets/`）                                         |
| **W4** · 2026-05-07     | 赛事打磨（部分）            | i18n 全面审查 — fix 9 broken refs，清理 143 dead keys（en/zh 同步，1250 → 1107）；无障碍审查 — 77 button 补 `type="button"`（19 文件），W2 import 组件 a11y 单独细化（drop zone → button、aria-label、focus-visible 等）                                                                                                                                     |
| **W4 ext** · 2026-05-07 | Demo Preset + 云同步冲突 UX | **赛事 Demo Preset**（`utils/contestDemos.ts` + `useContestDemos.ts`，build-time `import.meta.glob` 烤入 3 demo `adv/**/*.md`，零权限秒开 + 6 sanity tests，**取代 `.advpkg.zip` 兜底**）；**云同步冲突 UX**（`classifySyncCandidates` baseline 比对 + `SyncConflictModal.vue` per-file 选边 + `resolveConflicts()` + 10 classifier tests），en/zh i18n 同步 |

**当前测试 / 类型状态**：`pnpm -F @advjs/studio test:unit --run` → **282 tests passed (26 files)**；`vue-tsc --noEmit` → exit 0；en/zh i18n parity 0/0；broken refs 0。

---

## 🔜 W2.5 Prompt 前缀稳定性复盘 · 需要真实 Provider

- [ ] 接一个真实 Provider（DeepSeek / Qwen / Anthropic OpenAI 兼容端点）
- [ ] 观察 Provider 控制台的 cache hit rate
- [ ] 如 <70%，调整 [`prompts.ts`](../../apps/studio/src/utils/projectGenerator/prompts.ts) 中 shared prefix 的组装顺序，确保跨 step 完全字节一致

需要：API Key + 控制台访问。直接对接赛事 §9 Critical Success Criteria 中的 cache hit ≥70% 指标。

---

## 🔜 W3.3 残留 · 静态托管位置决策

- [ ] 三选一：GitHub Pages（绑 `studio.advjs.org` 子路径）/ Cloudflare Pages（接 GitHub）/ Vercel
- [ ] 决策落定后写部署脚本 + GitHub Actions workflow

仅决策项，定下来后代码侧可以一次推完。

---

## 🔜 W3.4 残留 · 真实跑出 demo 产物（需要带屏 + AI Key）

- [ ] 用 ImportSourcePage 真实跑过 3 个 demo 的 `source.{txt,md}`，回填每个 [`generation-log.md`](https://github.com/YunYouJun/advjs/tree/dev/examples/ai-contest) 的 token / cache hit / 耗时表
- [ ] 在完成页点"保存二维码图"产出每个 demo 的 `assets/qr-card.png`
- [ ] 录每个 demo 的关键场景截图（按 [`assets/README.md`](https://github.com/YunYouJun/advjs/blob/dev/examples/ai-contest/life-story/assets/README.md) 文件清单）

---

## 🔜 W4 残留

- [ ] **90 秒 Demo 视频录制**：按 [`demo-script.md`](./demo-script.md) 分镜执行（OBS / Kap）
- [ ] **内部 Dogfood + bug fix**：找 3 位非技术同事按 [`demo-script.md`](./demo-script.md) §"Dogfood 脚本模板" 8 分钟任务清单走完整流程，记录卡点

**验收条件**：内部 Dogfood 无阻塞；[`ai-contest-2026.md`](./ai-contest-2026.md) §9 Critical Success Criteria 全部打勾。

---

## 🧊 Phase M11+ 赛后沉淀（不在本里程碑交付 · 触发条件出现再做）

| 项                                                                                                           | 触发条件                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Anthropic 原生 `cache_control` 分支                                                                          | 想脱离 Provider 端前缀缓存依赖；或评估期发现 cache hit 不稳定                                |
| 素材分段后的 Embedding 去重（[`embeddingClient.ts`](../../apps/studio/src/utils/embeddingClient.ts) 已就绪） | 用户出现"相似素材重复生成"投诉；或长素材成本超预算                                           |
| VLM 图文 OCR（绘本图片直接识别）                                                                             | 触摸绘本 demo 启动；或用户上传图片素材频次起来                                               |
| ASR 语音转文字（老人口述直接录）                                                                             | 时光忆站老用户调研显示"打字门槛"是首要卡点                                                   |
| Flow 编辑器 + 项目生成 Pipeline 联动                                                                         | 用户开始要求"自定义分支结构"；或 Flow 编辑器单独 GA                                          |
| 二维码 / 短链分发 + Marketplace 上架                                                                         | 前置 Phase 13 账号系统就绪；或第一批"想分享自己作品"用户出现                                 |
| `.advpkg.zip` 批量分发脚本（`scripts/build-contest-bundles.ts`）                                             | 想发 GitHub Release 让社区下载；或评委/同事直接问要 zip；或加 CI release artifact 流程       |
| `examples/ai-contest/touch-book/` 完整 demo                                                                  | `touch-book.yaml` Template 进生产；或 AI 向善课题 1 单独立项                                 |
| Agent / Skill 平台上架 "ADV 故事工坊"（外部仓库）                                                            | 平台 token 可用；外部仓库结构敲定                                                            |
| `autoResolveStrategy` sync 设置（B 的 fast-follow）                                                          | 高频用户反馈"每次 sync 都要选很烦"；可加 `prefer-local` / `prefer-cloud` / `always-ask` 选项 |

---

## 📌 备注

- 实施计划详见 `.claude-internal/plans/quirky-wibbling-wreath.md`（不在仓库里，仅 Claude Code session 可见）
- W1–W3 详细 checklist 历史归档：见 git log（`docs/studio/todo.md` 在 2026-05-07 之前的版本）
