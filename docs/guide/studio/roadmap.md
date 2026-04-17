# 开发路线 {#roadmap}

## 已完成阶段

### 核心功能（Phase 1-27）

| 阶段          | 主题                | 核心交付                                                                                                                            |
| ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1-5** | 基础 Mobile Studio  | Ionic Vue 五 Tab 框架、项目 CRUD、文件树 + Monaco 预览、AI 聊天、COS 云同步、i18n、内容编辑器、设置系统                             |
| **Phase 6**   | 角色记忆            | `useCharacterMemoryStore`（自动提取 facts/preferences/emotion）、Smart Context Window、对话导出、消息搜索                           |
| **Phase 7**   | 动态角色状态        | `useCharacterStateStore`（位置/健康/活动/自定义属性）、角色卡片位置 + 心情展示                                                      |
| **Phase 8**   | 世界时间系统        | `useWorldClockStore`（日期/时段/天气）、`useWorldEventStore`（AI 生成事件）、时钟上下文注入对话                                     |
| **Phase 9**   | 多角色群聊          | `useGroupChatStore`（AI 自动选人轮流发言）、群聊 UI、创建群聊 Modal                                                                 |
| **Phase 10**  | 视角与玩家角色      | 三种视角模式（角色/上帝/访客）、玩家角色创建（AI 或手动）、视角切换控件                                                             |
| **Phase 11**  | 专业角色知识库      | RAG 检索增强生成（`adv/knowledge/` → `##` 拆分 → 关键词/向量检索 → 注入系统提示词）；详见 [知识库使用](./index.md#专业角色与知识库) |
| **Phase 12**  | 数据持久化迁移      | 全量 Store 迁入 IndexedDB（Dexie v2→v6），项目级数据隔离，通用持久化 composable                                                     |
| **Phase 25**  | 关系图谱 + 对话存档 | 角色关系 SVG 图谱、AI 记忆提取重试、对话快照（保存/恢复/分支树）                                                                    |
| **Phase 26**  | 角色自主日记        | AI 生成内心独白/日记（融合记忆+状态+事件），World 页一键生成，角色详情查看                                                          |
| **Phase 27**  | 世界时间线          | 统一时间轴视图（事件+日记），三级过滤器（类型/事件类/角色），纯 CSS 实现                                                            |

### 移动端迭代（M1-M17）

| 阶段         | 主题            | 核心交付                                                                   |
| ------------ | --------------- | -------------------------------------------------------------------------- |
| **M1-M2**    | 移动端基础      | Safe Area、触摸 ≥44px、Capacitor 插件、章节翻页、编辑器工具栏              |
| **M3-M4**    | 资源 & 验证     | 场景 AI 图片、音频管理、项目验证、Web Share                                |
| **M5-M7**    | 桌面 & PWA      | 响应式双栏、角色 AI 覆盖、知识库 UI、.advpkg 导出/导入、PWA 离线、消息归档 |
| **M8-M9**    | TTS & 知识库 V2 | TTS 插件架构（4 provider）、Embedding 向量检索、测试补全                   |
| **M10-M12**  | 语音 & 模板     | 角色独立 TTS、自动朗读、对话/群聊分支树、5 种项目模板、E2E 测试            |
| **M13-M14**  | MCP & 导出      | MCP Server 8 个工具、批量角色导入、情感弧光可视化、CSV/Markdown 导出       |
| **M15-M15b** | 稳定性 & UI     | 流式重试、记忆增强、对话质量评分、多语言对话、健康仪表盘、26 E2E、UI 打磨  |
| **M16-M17**  | 分享 & 原生     | 角色分享图、对话 HTML 导出、IFileSystem 抽象层（3 适配器）、对话虚拟滚动   |

### 地点系统（L1-L3）

- **L1 基础 CRUD** ✅ — Markdown 解析/序列化、卡片 + 编辑表单、列表页、Dashboard 统计
- **L2 关联增强** ✅ — Scene ↔ Location 双向关联、角色位置动态匹配、场景背景继承、Location 详情页
- **L3 可视化** ✅ — 地点关系图（纯 SVG）、AST 地点引用打通、CLI `adv check` 集成

::: tip 里程碑统计
74+ 组件、32 页面、13 Store、16 单测文件、8 E2E 测试、21 composables、37+ 工具函数。
:::

---

## Phase N：核心体验冲刺 {#phase-n}

目标：**先把已有功能做「丝滑」**，再推进新功能。

**优先级排序**：

1. 🔴 **P0 — 体验阻断**：用户核心路径上的断裂点（N1 ✅）
2. 🟠 **P1 — 上手门槛**：新用户首次体验的摩擦点（N2 ✅）
3. 🟡 **P2 — 性能感知**：用户可感知的卡顿和加载慢（N3 ✅）
4. 🟢 **P3 — 平台扩展**：原生平台和文件系统完备性（N4 ✅）
5. 🔵 **P4 — 传播增长**：分享和社交能力（N5 ✅）
6. 🟣 **P5 — AI 增强**：AI 能力深度整合与智能化（N6 ✅）
7. 🔧 **P6 — 编辑体验**：创作工具链打磨（N7 ✅）

---

### Phase N0：基础设施加固 ✅ {#phase-n0}

- [x] **全局错误边界** — `ErrorBoundary.vue` + `app.config.errorHandler` + `unhandledrejection` 监听，白屏时展示友好 fallback UI（重试/返回首页）
- [x] **离线状态感知** — 基于 `@vueuse/core` `useOnline()` 的 `OfflineBanner` 组件，离线时顶部显示提示横幅
- [x] **编辑器 Undo/Redo** — `useUndoHistory` composable（基于 `useDebouncedRefHistory`，debounce 500ms，50 步容量），EditorPage 工具栏 + ⌘Z/⌘⇧Z 快捷键
- [x] **首次使用引导** — `OnboardingOverlay` 5 步 tooltip tour（QuickStart → World → Chat → Play → Me），localStorage 记录完成状态
- [x] **Marketplace 标记** — 页面顶部 Coming Soon 横幅 + ProjectsPage 入口卡片角标

---

### Phase N1：对话体验闭环 ✅ {#phase-n1}

对话是 Studio 最高频的交互，是产品核心价值的直接载体。

- [x] **虚拟滚动实装** — 对话消息已接入 `@tanstack/vue-virtual`，1000+ 条消息无感滚动
- [x] **流式输出恢复提示** — `RetryButton` 组件 + `handleStreamError` 自动附加错误信息，重试失败后显示错误类型 + 重试按钮
- [x] **输入体验优化** — `autoGrow` + Shift+Enter 换行 + Enter 发送 + `scrollToBottomOnFocus` 键盘弹起自动滚动
- [x] **对话预热与懒加载** — `switchProject` 时 `chatStore.init(pid)` 已批量加载全部对话到内存，WorldPage 预取 Store 实例确保数据就绪
- [x] **对话质量反馈闭环** — `FeedbackTrendChart.vue` SVG 折线图（滑动窗口好评率）+ `MessageActions.vue` 👍/👎 反馈按钮，数据持久化到 IndexedDB

---

### Phase N2：项目管理极简化 ✅ {#phase-n2}

目标：新用户 **3 步内开始对话**。

- [x] **一键体验模式** — `QuickStartButton` 自动创建 MemoryFs 项目 + 预置模板，跳转 World 页开始对话
- [x] **最近对话快捷入口** — `RecentCharacterPopover` 已集成到 WorldPage，弹出最近对话角色
- [x] **项目封面与简介** — `cover` + `description` 字段，ProjectSettingsModal 封面上传/移除 + 简介编辑，项目卡片展示封面缩略图
- [x] **项目健康自动修复** — `ProjectHealthPanel.vue`（按类别分组 + 单个/批量修复按钮）+ `autoFixIssues()` 自动移除断链引用，集成到 `ProjectOverview` 自动验证

---

### Phase N3：性能与包体积 ✅ {#phase-n3}

- [x] **首屏骨架屏** — `WorldSkeleton` / `ChatSkeleton` / `AppSkeleton` 已实现，Tab 切换渲染骨架屏
- [x] **Monaco 按需加载** — `monacoSetup.ts` 动态 `import('monaco-editor')` 单例缓存，仅加载 json/ts/css/html/editor 五类 worker（节省 ~7MB）
- [x] **Ionic 组件审计** — 全部使用 `import { IonButton, ... } from '@ionic/vue'` 显式按需导入，无全局注册
- [x] **虚拟滚动扩展** — `WorldTimeline` 超 50 条时间线条目自动切换虚拟滚动（扁平化 date/period 分组行），≤50 条保持原有分页渲染。`CharactersPage` 经评估**不需要虚拟滚动**：单项目角色数通常 5-30 个（极端 ~100），CSS Grid 网格布局与单列虚拟滚动不兼容，已有 `useIncrementalList(30)` + `IonInfiniteScroll` 足以覆盖
- [x] **IndexedDB 批量事务** — 所有 store 的 flush/load 已使用 `bulkPut` / `bulkDelete` / `db.transaction()` 批量操作

---

### Phase N4：平台扩展与文件系统 ✅ {#phase-n4}

- [x] **IFileSystem 抽象层** — Browser/Capacitor/Memory 三适配器，消费者全量迁移完成
- [x] **MemoryFs 持久化验证** — Playwright E2E 测试：QuickStart 创建 → IndexedDB 数据写入 → 刷新 → 自动恢复验证
- [x] **Capacitor 脚手架就绪** — `capacitor.config.ts` 配置（appId `org.advjs.studio`）+ package.json 原生构建脚本（`cap:init:ios/android`、`cap:sync`、`cap:run:ios/android`）+ `.gitignore` 平台忽略规则 + `CAPACITOR.md` 完整构建与真机验证指南。实际 `cap add ios/android` 需开发者在本地执行（会生成 ~1GB 原生工程文件）
- [x] **原生运行时适配** — `src/utils/capacitor.ts` 封装 StatusBar 自适应暗色/Keyboard resize 模式/Haptics 三档反馈，所有原生插件调用有 `isNativePlatform()` 守卫，Web 端无感降级。真机权限弹窗、Safe Area、相册选择器在 CAPACITOR.md 中定义验证清单

---

### Phase N5：分享与传播 ✅ {#phase-n5}

- [x] **项目封面 AI 生成** — `ProjectSettingsModal` 新增 AI 生成按钮，输入 prompt（留空时自动使用项目简介）调用 `aiImageClient.generateImage()`，自动下载 URL → canvas 压缩为 800px JPEG data URL 持久化到项目。腾讯混元 TextToImageLite 通过 OpenAI 兼容端点 `https://api.hunyuan.cloud.tencent.com/v1` 接入（支持 4 种 provider：SiliconFlow/OpenAI/Hunyuan/Runware）
- [x] **分享链增强** — `ogMeta.ts` 扩展：动态注入 `og:title` / `og:description` / `og:image` / `og:type` / `og:site_name` / `twitter:card`（自适应 `summary_large_image`）；新增 `setCharacterOgMeta()` 角色分享场景、`buildImportUrl()` 导入深链构建；router `afterEach` 钩子自动在工作区路由注入项目 OG 元数据
- [x] **对话片段分享** — `useSnippetShare` 重写，基于 `modern-screenshot` 可靠渲染（SVG foreignObject 作为兜底），新增 `selectLastN()` / `selectRange()` 批量选择 API、3 主题切换 ref；`ChatSnippetShare.vue` 动态主题令牌（dark/light/sepia），`CharacterChatPage` 导出菜单新增"生成精美分享图"入口，弹出预览 modal 可切换主题 → Web Share API 或下载 PNG
- [x] **项目分享页** — 新增 `/share/:projectId` 路由 + `ProjectSharePage.vue`（只读预览：封面 Hero、角色卡片网格、章节目录、QR Code、一键"在 Studio 打开"深链）；从 `ProjectSettingsModal` info tab 可一键打开；`ProjectsPage` 处理 `?import=<id>` 深链自动切换项目

---

### Phase N6：AI 能力增强 ✅ {#phase-n6}

- [x] **腾讯混元图片生成** — `aiImageClient.ts` 中 `hunyuan` case 已接入，通过 OpenAI 兼容端点 `https://api.hunyuan.cloud.tencent.com/v1` 调用，封面/场景/角色头像三场景可统一使用
- [ ] **对话质量自动评估** — 基于 `FeedbackTrendChart` 已有数据，增加 AI 自动评分（连贯性/角色一致性/信息密度），每 10 轮对话后自动执行，结果持久化到 IndexedDB
- [x] **AI 记忆摘要压缩** — `useCharacterMemoryStore` 中 `keyEvents` 达到 40 条时自动触发 AI 压缩，将旧事件合并为 ~5 条摘要，保留最近 15 条原始事件；同时去重 `userProfile`。压缩在后台静默执行，不阻塞对话
- [x] **多模型切换** — `CharacterAiOverride` 接口支持角色级 provider/model/temperature/maxTokens 覆盖，`resolveCharacterAiConfig()` 合并全局与角色配置，`CharacterAiSettingsForm.vue` 提供 UI（含 TTS 独立覆盖）

---

### Phase N7：编辑器体验 ✅ {#phase-n7}

- [ ] **Monaco 智能提示** — 为 `.adv.md` 文件注册自定义语言，提供角色名/场景名/地点名自动补全（从项目文件索引构建 completion provider）
- [ ] **Markdown 实时预览** — 编辑器右侧分栏渲染 `.adv.md` 脚本预览（角色对话气泡 + 场景标注高亮），基于 `@advjs/parser` 实时解析 AST
- [x] **内容模板增强** — `projectTemplate.ts` 已包含 5 种预置模板：视觉小说入门（starter）、校园恋爱（school-romance）、悬疑推理（mystery-detective）、奇幻冒险（fantasy-adventure）、现代都市（modern-urban），各含完整 world.md + outline.md + 章节 + 角色
- [x] **批量操作增强** — `BatchImportPage` 支持角色/场景两种类型切换的 CSV/JSON 批量导入（复用 `csvParser.ts` + `stringifySceneMd`），增加全选/多选、批量标签编辑（分号分隔批量添加）、批量删除确认弹窗

---

## 远期路线

```
Phase N（核心体验冲刺，N1-N7）
    ↓ 达到「可发布品质」
Phase 13（账号系统）
    ↓ 用户身份基础设施
Phase 14（世界/故事市场）
    ↓ 社区生态
Phase 15（协作与插件）
    ↓ 多人协作 + 引擎扩展
```

::: tip 进入 Phase 13 的门槛
N1-N7 已全部完成，核心体验冲刺阶段达到「可发布品质」。启动 Phase 13 前仍需一次**战略决策**：

- 账号是强制 vs 可选？（建议：可选。保持 Local-First 产品定位）
- 后端选型：Supabase / CloudBase / 自建？
- 账号最小价值：先做"只读账号 + 作品发布"为 Phase 14 铺路，再迭代云同步

:::

### Phase 13：账号系统 {#phase-13}

- [ ] **用户注册/登录** — 邮箱 + OAuth（GitHub/Google/微信），JWT token 管理，自动续期
- [ ] **用户资料** — 头像上传（复用 COS 云同步通道）、昵称、简介、偏好设置云端同步
- [ ] **项目云端绑定** — 账号关联项目 ID，基于 COS 的跨设备自动同步（增量 diff + 冲突合并策略）
- [ ] **个人作品集页面** — 公开主页展示已发布项目列表、创作统计（角色数/章节数/对话轮数）、精选角色卡片

### Phase 14：世界/故事市场 {#phase-14}

::: tip 前置依赖
需要 Phase 13 账号系统完成后实施。
:::

让用户发布和发现其他创作者的世界与故事，一键加载开始游玩。

- [ ] **市场浏览** — 首页推荐 + 标签/类型筛选 + 关键词搜索 + 热门/最新排序，`MarketplacePage.vue` 已有页面骨架
- [ ] **世界发布** — 基于 `useProjectExport` 的 `.advpkg` 打包 + 版本号 + 内容审核（封面/简介/角色名合规检查）
- [ ] **一键加载** — 从市场深链点击 → 自动下载 `.advpkg` → 解压到 MemoryFs → 打开项目
- [ ] **角色预览** — 市场页内嵌角色卡片预览（头像/性格/初始对话），支持试聊 3 轮
- [ ] **评价系统** — 星级评分 + 文字评论 + 点赞/收藏，创作者可回复
- [ ] **创作者主页** — 展示已发布作品、粉丝数、总游玩量

### Phase 15：协作与扩展 {#phase-15}

- [ ] **多人协作 / 实时同步** — 基于 CRDT（Yjs）的协同编辑，支持多人同时编辑章节/角色/场景，冲突自动合并
- [ ] **插件系统** — 定义 `AdvPlugin` 接口，支持注册自定义 AI Provider / TTS Provider / 渲染引擎（Babylon/Three/Pixi）/ 数据导出格式
- [ ] **Capacitor 原生打包** — iOS/Android 原生应用发布（App Store / Google Play），包含推送通知、原生分享、Siri 快捷指令
- [ ] **位置驱动剧情** — 在 Flow 编辑器中支持"角色到达某地点"作为分支条件（需 editor/studio 数据层统一后实施）
