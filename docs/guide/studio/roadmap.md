# 开发路线 {#roadmap}

## 已完成阶段

### 核心功能（Phase 1-27）

| 阶段          | 主题                | 核心交付                                                                                                                         |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1-5** | 基础 Mobile Studio  | Ionic Vue 五 Tab 框架、项目 CRUD、文件树 + Monaco 预览、AI 聊天、COS 云同步、i18n、内容编辑器、设置系统                          |
| **Phase 6**   | 角色记忆            | `useCharacterMemoryStore`（自动提取 facts/preferences/emotion）、Smart Context Window、对话导出、消息搜索                        |
| **Phase 7**   | 动态角色状态        | `useCharacterStateStore`（位置/健康/活动/自定义属性）、角色卡片位置 + 心情展示                                                   |
| **Phase 8**   | 世界时间系统        | `useWorldClockStore`（日期/时段/天气）、`useWorldEventStore`（AI 生成事件）、时钟上下文注入对话                                  |
| **Phase 9**   | 多角色群聊          | `useGroupChatStore`（AI 自动选人轮流发言）、群聊 UI、创建群聊 Modal                                                              |
| **Phase 10**  | 视角与玩家角色      | 三种视角模式（角色/上帝/访客）、玩家角色创建（AI 或手动）、视角切换控件                                                          |
| **Phase 11**  | 专业角色知识库      | RAG 检索增强生成（`adv/knowledge/` → `##` 拆分 → 关键词/向量检索 → 注入系统提示词）；详见 [知识库使用](./index#专业角色与知识库) |
| **Phase 12**  | 数据持久化迁移      | 全量 Store 迁入 IndexedDB（Dexie v2→v6），项目级数据隔离，通用持久化 composable                                                  |
| **Phase 25**  | 关系图谱 + 对话存档 | 角色关系 SVG 图谱、AI 记忆提取重试、对话快照（保存/恢复/分支树）                                                                 |
| **Phase 26**  | 角色自主日记        | AI 生成内心独白/日记（融合记忆+状态+事件），World 页一键生成，角色详情查看                                                       |
| **Phase 27**  | 世界时间线          | 统一时间轴视图（事件+日记），三级过滤器（类型/事件类/角色），纯 CSS 实现                                                         |

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
80+ 组件、35 页面、13 Store、17 单测文件、9 E2E 测试、24 composables、40+ 工具函数。
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
8. 📋 **P7 — 数据结构化**：角色属性结构化 schema（N8 ✅）

---

### Phase N0：基础设施加固 ✅ {#phase-n0}

- [x] **全局错误边界** — `ErrorBoundary.vue` + `app.config.errorHandler` + `unhandledrejection` 监听，白屏时展示友好 fallback UI（重试/返回首页）
- [x] **离线状态感知** — 基于 `@vueuse/core` `useOnline()` 的 `OfflineBanner` 组件，离线时顶部显示提示横幅
- [x] **编辑器 Undo/Redo** — `useUndoHistory` composable（基于 `useDebouncedRefHistory`，debounce 500ms，50 步容量），EditorPage 工具栏 + ⌘Z/⌘⇧Z 快捷键
- [x] **首次使用引导** — `OnboardingOverlay` 5 步 tooltip tour（QuickStart → World → Chat → Play → Me），localStorage 记录完成状态
- [x] **Marketplace 标记**（已被 Phase 14 取代）— 早期用 Coming Soon 横幅 + 入口卡片角标占位；Phase 14 市场上线后横幅与「即将上线」角标均已移除，入口卡片改为「新」角标直达市场

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
- [x] **对话质量自动评估** — `chatQualityEvaluator.ts` 基于 `FeedbackTrendChart` 已有数据，AI 自动评分三维度（连贯性/角色一致性/信息密度），每 10 轮对话后自动执行，`QualityScore` 持久化到 IndexedDB
- [x] **AI 记忆摘要压缩** — `useCharacterMemoryStore` 中 `keyEvents` 达到 40 条时自动触发 AI 压缩，将旧事件合并为 ~5 条摘要，保留最近 15 条原始事件；同时去重 `userProfile`。压缩在后台静默执行，不阻塞对话
- [x] **多模型切换** — `CharacterAiOverride` 接口支持角色级 provider/model/temperature/maxTokens 覆盖，`resolveCharacterAiConfig()` 合并全局与角色配置，`CharacterAiSettingsForm.vue` 提供 UI（含 TTS 独立覆盖）

---

### Phase N7：编辑器体验 ✅ {#phase-n7}

- [x] **Monaco 智能提示** — `advLanguage.ts` 为 `.adv.md` 文件注册自定义语言（`adv-markdown`），Monarch tokenizer 高亮角色引用/场景标记/旁白/对话/选项等 ADV 语法，completion provider 从项目文件索引提供角色名/场景名/地点名自动补全
- [x] **Markdown 实时预览** — `AdvPreviewPanel.vue` 编辑器右侧分栏渲染 `.adv.md` 脚本预览（角色对话气泡 + 场景标注高亮），动态导入 `@advjs/parser` 实时解析 AST，debounced 更新
- [x] **内容模板增强** — `projectTemplate.ts` 已包含 5 种预置模板：视觉小说入门（starter）、校园恋爱（school-romance）、悬疑推理（mystery-detective）、奇幻冒险（fantasy-adventure）、现代都市（modern-urban），各含完整 world.md + outline.md + 章节 + 角色
- [x] **批量操作增强** — `BatchImportPage` 支持角色/场景两种类型切换的 CSV/JSON 批量导入（复用 `csvParser.ts` + `stringifySceneMd`），增加全选/多选、批量标签编辑（分号分隔批量添加）、批量删除确认弹窗

---

### Phase N8：角色属性结构化 ✅ {#phase-n8}

为 `.character.md` frontmatter 引入可选的 `attributes.*` 分层 schema，把作者手写的结构化设定从 Markdown 自由描述中分离出来，提升 AI prompt 注入的稳定性。

- [x] **Zod schema + 类型定义** — `@advjs/types` 新增 `AdvCharacterAttributes` / `AdvCharacterProfile` / `AdvCharacterGalgameAttrs` / `AdvCharacterRpgAttrs` / `AdvCharacterRpgStats` / `AdvCharacterCustomField` / `AdvCharacterAttributesAi` 接口；`@advjs/parser` 引入 `zod` 作为运行时校验器，导出 `CharacterFrontmatterSchema` 等 `safeParse` 友好的 schema（严格模式 + 友好错误格式化 `formatCharacterFrontmatterError`）
- [x] **Parser 往返保真** — `parseCharacterMd` 解析时跑 schema 软校验（失败 warn 不抛错，保证向后兼容），`stringifyCharacterMd` 通过 `pruneEmpty` 递归剔除空子对象，避免写入 `attributes: {}` / `profile: {}` 这种空字段；数字 `0` / 布尔 `false` 作为合法值保留
- [x] **三个初始模板** — `template: 'universal' | 'galgame' | 'rpg'` 控制 Studio UI 字段分组；`universal.profile` 含 age/gender/occupation/personalityTags/appearanceSummary；`galgame` 含 birthday/bloodType/zodiac/height/likes/dislikes/affinityInitial；`rpg` 含 race/class/level/stats(STR/DEX/INT/CON/WIS/CHA)/hpInitial/mpInitial/skills/equipment/alignment
- [x] **Studio UI 集成** — `CharacterAttributesPanel.vue` 集成到 `CharacterEditorForm` 的「描述」和「立绘」section 之间；主开关 opt-in（默认关闭）+ 模板切换 `IonSegment` + 按模板动态渲染字段分组 + RPG 六维紧凑 3×2 网格 + AI 注入开关 + Custom 自定义字段 CRUD（支持 text / number / tags 三种值类型，key 自动 sanitize 防冲突）
- [x] **Monaco frontmatter completion** — `characterFrontmatterCompletion.ts` 为 YAML / Markdown / adv-markdown 三种语言注册 completion provider，光标定位在 `attributes.*` 子树时自动提示对应字段名（根据路径动态解析），`template:` 行提供 enum 值提示。纯函数 `resolveFrontmatterPath` / `isLineInFrontmatter` / `getFieldsForPath` 便于独立测试，17 个单测覆盖嵌套路径解析
- [x] **分层约定（关键设计）** — frontmatter 只存**作者手写的静态 Profile**；运行时状态（当前好感度/HP/位置）走 `AdvCharacter.dynamicState` + `useCharacterStateStore` 的 IndexedDB，不污染 `.character.md`；AI 自动提取的记忆走 `useCharacterMemoryStore`

::: tip Schema 样例

```yaml
---
id: alice
name: 爱丽丝
attributes:
  template: galgame
  profile:
    age: 17
    personalityTags: [温柔, 腹黑]
    appearanceSummary: 银发红眸
  galgame:
    birthday: 03-14
    bloodType: AB
    likes: [红茶, 推理小说]
    affinityInitial: 0
  ai:
    promptInject: true
    excludeFields: [galgame.bloodType]
---
```

:::

**后续计划**（N8 后续迭代，不阻塞当前发布）：

- Mystery 模板 + `ai.visibility: 'gm-only'` 字段级可见性（与 Phase 10 视角系统联动）
- AI 从 Markdown 描述一键回填 attributes（复用 Phase N6 的 `keyEvents` 压缩思路）

---

## 远期路线

```text
Phase N（核心体验冲刺 N1-N8）✅
    ↓ 「可发布品质」
Phase 13（账号系统 — CloudBase 统一认证）✅
    ↓ 用户身份基础设施
Phase 14（世界/故事市场）✅
    ↓ 社区生态
Phase 15a（多人协作） / 15b（插件系统）✅
    ↓ 多人协作 + 引擎扩展
Phase 16（AI Agent 自主创作）✅
    ↓ AI 深度参与创作
Phase 17（运行时与发布）✅
    ↓ 让作品「真正可玩、可分发」
Phase 18（协作与社区强化）✅
    ↓ 标签体系 / 评论 / 社区安全
```

::: tip 战略决策（已定）
N1-N8 与 Phase 13-18 的仓库内 MVP 均已完成；后续以真实运营数据驱动增量迭代，不再预建复杂社区基础设施。

- **账号模式**：可选。保持 Local-First 产品定位，未登录可完整使用，登录后解锁云同步和发布
- **后端选型**：**CloudBase**（腾讯云开发）—— 与云乐坊（yunle.fun）共享同一 CloudBase 环境和用户池
- **产品定位**：ADV.JS Studio 作为云乐坊旗下子应用，使用统一账号体系（`@cloudbase/js-sdk` 短信验证码登录）
- **认证架构**：复用云乐坊已有的 `modules/cloudbase.ts` + `composables/useCloudbase.ts` 模式

:::

### Phase 13：账号系统（云乐坊统一认证） ✅ {#phase-13}

ADV.JS Studio 接入云乐坊 CloudBase 账号体系，作为子应用共享用户池。

- [x] **CloudBase SDK 接入** — `@cloudbase/js-sdk` v3.3.3 安装到 pnpm catalog，`utils/cloudbase.ts` Vue Plugin 初始化 SDK（`cloudbase.init()` → `cloudApp.auth()`），`composables/useCloudbase.ts` 通过 `provide/inject` 注入 App 和 Auth 实例，`main.ts` 在 Pinia 之后注册插件，环境 ID 通过 `VITE_TCB_ENV_ID` 配置（共享云乐坊环境 `yunlefun-8g7ybcxc7345c490`）
- [x] **短信验证码登录** — `LoginPage.vue` 实现两步 SMS 登录：`auth.getVerification()` 发送验证码 → `auth.signInWithSms()` 验证登录，区号选择（14 国）+ 手机号校验（`utils/phone.ts`）+ 60s 倒计时 + Ionic UI，`/login` 路由，中英文 i18n 文案
- [x] **登录状态管理** — `useAuthStore` Pinia store：`loginState`（`useStorage` 持久化到 `advjs-studio:loginState`）/ `userInfo` / `isLoggedIn` / `displayName` / `maskedPhone` 响应式状态，`refreshLoginState()` 启动时恢复会话，`useSettingsStore.account` 改为 computed 代理保持向后兼容
- [x] **用户资料展示** — `MePage.vue` 改造：handleLogin/handleRegister 跳转 `/login` 页，已登录态展示 `authStore.displayName` + `maskedPhone`（手机号脱敏），退出登录调用 `authStore.logout(auth)` → `auth.signOut()`；未登录态保持 hero card 引导
- [x] **项目云端绑定** — `useCloudBinding` composable 实现项目元数据与 CloudBase 数据库（`advjs_projects` 集合）的双向绑定：`bindProject()` 创建/更新云端记录（关联用户 UID + 项目 slug），`fetchMyProjects()` 获取全部云端项目，`togglePublished()` 切换公开/私密状态。`StudioProject` 接口扩展 `cloudId` / `ownerId` / `syncedAt` 三个字段，序列化/反序列化已同步更新
- [x] **个人作品集页面** — `PortfolioPage.vue`（`/tabs/me/portfolio`）展示当前用户的云端项目列表：2×2 统计面板（项目/角色/章节/场景总数）、一键绑定当前项目按钮、项目卡片列表（封面/名称/简介/统计/日期）、公开/私密切换按钮（`eyeOutline`/`eyeOffOutline`）。`MePage.vue` 已登录态新增「我的作品集」导航入口（`ribbonOutline` 图标），中英文 i18n 文案完整

### Phase 14：世界/故事市场 ✅ {#phase-14}

::: tip 前置依赖
Phase 13 账号系统已完成。✅
:::

让用户发布和发现其他创作者的世界与故事，一键加载开始游玩。

- [x] **市场浏览** — `MarketplacePage.vue` 重写为 CloudBase 数据库驱动：`useMarketplace` composable 查询 `advjs_marketplace` 集合，支持三种排序（最新/热门/好评）+ 标签筛选 + 关键词搜索（客户端过滤），卡片网格展示封面/作者/统计/评分，移除 Coming Soon 横幅和 mock 数据
- [x] **世界发布** — `useMarketplace.publishProject()` 实现项目发布：复用 `useProjectExport` 的 `.advpkg` 打包 → 上传 COS → 在 `advjs_marketplace` 集合创建/更新记录（upsert by `projectId + ownerId`），包含版本号、标签、统计快照。`MarketplacePage` 顶部新增发布按钮（仅登录后可见）
- [x] **一键加载** — `MarketplacePage` 详情 Modal 的 Install 按钮：`cloudApp.getTempFileURL()` 获取 COS 临时下载链接 → `fetch()` 下载 `.advpkg.zip` → `importProject()` 解压到 `MemoryFsAdapter` → `studioStore.switchProject()` 打开项目，同时 `incrementDownloads()` 更新下载计数
- [x] **角色预览** — 详情 Modal 展示角色数/章节数/下载量/评分四维统计面板，作者名可点击跳转创作者主页，标签 chips 展示项目分类
- [x] **评价系统** — `advjs_reviews` 集合：`submitReview()` 创建/更新评价（1-5 星 + 文字评论），自动更新 `advjs_marketplace` 的 `ratingSum` / `ratingCount` 聚合字段，`fetchReviews()` 按时间倒序查询。UI 包含星级选择器 + 文本输入 + 评价列表（作者/星级/内容/日期/点赞按钮）
- [x] **创作者主页** — `CreatorPage.vue`（`/creator/:uid` 路由）展示指定用户的公开作品列表：四维统计面板（作品数/下载量/角色数/平均评分）+ 作品卡片列表（封面/名称/简介/统计），`useMarketplace.fetchCreatorProjects()` 查询 `advjs_marketplace` 集合中该用户的 published 记录

- [x] **市场上线（go-live）** — 入口卡片「即将上线」角标改为「新」直达市场；`apps/studio/cloudbase/` 版本化 4 个集合的安全规则（`advjs_marketplace` / `advjs_reviews` / `advjs_market_installs` / `advjs_review_likes`）+ `marketStats` 云函数与控制台/CLI 配置说明；开发者选项新增「市场工具」一键填充/清除示例数据（`utils/seedMarketplace.ts`）。下载量、评分聚合、评价点赞这类跨用户写入已统一走云函数原子更新，并通过去重台账保证登录用户幂等计数

### Phase 15：协作与扩展 {#phase-15}

Phase 15 分为两个独立子阶段：先做协作（15a），再做插件系统（15b）。

#### Phase 15a：多人协作 / 实时同步 {#phase-15a}

基于 CloudBase 实时数据库 `watch()` + Yjs CRDT，实现零额外部署的协作编辑。

- [x] **协作房间模型** — `useCollabStore` Pinia store + `advjs_collab_rooms` 集合（房间 CRUD、成员管理、角色权限 owner/editor/viewer）、`advjs_collab_state` 在线心跳（10s 周期）
- [x] **y-cloudbase Provider** — 自定义 Yjs 同步 provider（`y-cloudbase.ts`）：增量 base64 写入 `advjs_collab_updates` 集合，`watch()` 实时订阅远端更新，300ms debounce flush，每 200 条自动 snapshot 压缩
- [x] **useCollabRoom composable** — 封装 Yjs Doc 生命周期、房间加入/创建/离开、`getSharedText()`/`getSharedMap()`/`getSharedArray()` 共享类型 API
- [x] **Monaco Yjs binding** — `FilePreview` 接入 `y-monaco`，Content Editor 的 Markdown Tab 可将 `.adv.md` / `.character.md` / `.md` 绑定到 `Y.Text` 实时协同；同时保留单人编辑模式
- [x] **协作状态条（MVP）** — `ContentEditorModal` Markdown Tab 顶部提供启用/离开协作、连接状态与在线人数展示
- [x] **协作设置 UI** — `CollabSettingsPage.vue`（`/tabs/workspace/collab`）：成员列表（头像/昵称/角色/在线状态指示灯）、邀请成员（输入 UID + 选择角色）、移除成员（滑动删除，仅 owner）、角色切换（editor/viewer），从协作状态条齿轮图标导航进入
- [x] **权限与发布闭环** — `collab-auth` 云函数封装 invite/remove/updateRole 三个 action，通过 `context.auth.uid` 校验调用者为 owner；`useCollabStore` 的成员管理改为 `callFunction()` 调用，不再客户端直写数据库
- [x] **状态数据协同** — `useCollabSync` composable 双向桥接 Pinia Store ↔ Yjs 共享类型：角色状态走 `Y.Map`（`state:characterStates`）、世界时钟走 `Y.Map`（`state:worldClock`）、对话消息走 `Y.Array`（`state:chatMessages`），含 transaction origin 防回环、断线自动停止/重连恢复、`useCollabRoom` 在 `synced` 事件时自动启动
- [ ] **E2E 端到端测试增强** — 双客户端收敛、断线重连数据一致性、权限拒绝场景（需 CloudBase 真实环境，暂 mock 覆盖 UI 流程）
- [x] **离线缓存** — `y-indexeddb` 集成，Yjs 文档本地持久化，断线后继续编辑，重连自动合并
- [x] **Presence TTL 清理** — 心跳记录超过 60s 自动清理，避免永久脏数据
- [x] **Viewer 只读降级** — viewer 角色进入协作时 Monaco readonly，不写入本地变更到 Y.Doc

#### Phase M11：短链分发与示范作品 {#phase-m11}

- [x] **Marketplace 短链分享** — 详情 Modal 增加 Share 按钮，调用 shortlink 云函数生成短链，一键复制到剪贴板
- [x] **history-talk 示范作品（主打）** — `examples/ai-contest/history-talk/` AI 历史人物对谈（孔子/图灵/达芬奇 × 3 章节 + 3 角色 + 3 场景 + 知识参考），Demo 视频主展示案例
- [x] **murder-mystery 示范作品（辅助）** — `examples/ai-contest/murder-mystery/` AI 剧本杀（6 NPC + 线索矩阵 + 世界时钟 × 3 章节 + 3 场景），技术深度展示案例

#### Phase 15b：插件系统 {#phase-15b}

- [x] **StudioPlugin 接口** — `pluginTypes.ts` 定义统一 `StudioPlugin` 基础接口（id/name/type/version/description），`StudioPluginType = 'ai-provider' | 'tts-provider' | 'export-format'`
- [x] **AI Provider 插件化** — `aiProviderRegistry.ts` 实现注册式 AI Provider 管理（`registerAiProvider`/`getAiProvider`/`listAiProviders`），6 个内置 Provider 自动注册，`useAiSettingsStore` 改为从 registry 获取
- [x] **插件注册表** — `usePluginRegistry` composable：聚合 AI + TTS 注册表，提供 `listPlugins`/`getPlugin`/`registerPlugin`/`unregisterPlugin` 统一 API
- [x] **内置 TTS 插件元数据** — `ttsClient.ts` 4 个内置 provider（web-speech / openai / doubao / custom）统一带上 `id` / `name` / `type` / `version` / `description` 元数据，与 `aiProviderRegistry.ts` 的 AI Provider 注册表对齐，可被 `usePluginRegistry` 聚合枚举

---

### 运行时与引擎集成

Studio Play Tab 已接入 `@advjs/client` 的 `AdvGame` 运行时（commit `cb91c8f` / `5d35317`），可直接在创作环境内试玩当前项目。底层引擎能力（存档槽位、分支可视化、`adv check --fix` 自动修复、MCP bulk 工具等）的迭代路线见 [AI 路线图](../../ai/skills/roadmap)；Studio 仅以「依赖」关系承接，不在本文档展开。

---

### Phase 16：AI Agent 自主创作 {#phase-16}

目标：让 AI 从「被动回答」变为「主动创作」，缩短作者从灵感到可玩 demo 的链路。

- [x] **章节大纲一键生成** — `utils/aiAuthoring/outlineGenerator.ts` + `OutlineGenerateModal.vue`：基于 `world.md` + 角色卡流式生成 outline.md，可写回项目或写回后跳到 Monaco 编辑；入口在 `ProjectOverview` 顶部工具栏（受 `useAiSettingsStore.isConfigured` 控制）
- [x] **场景脚本草稿** — `utils/aiAuthoring/chapterDraftGenerator.ts` + `ChapterDraftModal.vue`：给定章节 + 选定角色集 → 流式生成符合 AdvScript 语法的 chapter body，支持「替换 / 追加 / 复制」三种应用方式；入口在 `ChapterEditorForm` 的章节正文 section 头部
- [x] **角色互动模拟** — `utils/aiAuthoring/roleplaySimulator.ts` + `RoleplaySimulationModal.vue`：作者指定场景目标 + 参与角色 + 轮数（1-20），AI round-robin 自演，可一键导出为 AdvScript 追加到当前章节
- [x] **剧情提议器** — `utils/aiAuthoring/plotSuggester.ts` + `PlotSuggestionModal.vue`：基于当前章节正文 + 角色 + `useWorldEventStore` 最近 5 条事件，AI 给出 3 条差异化走向（label / synopsis / hook），点击一条即追加为 HTML 注释块到章节末
- [x] **一致性守门** — `utils/aiAuthoring/consistencyChecker.ts` + `ConsistencyCheckModal.vue`：对当前章节做 6 类问题扫描（人设漂移 / 时间线 / 世界观冲突 / 伏笔未回收 / 连贯性 / 其他），输出带严重度（info / warn / error）的 issues 列表
- [x] **Agent 工具化** — `utils/aiAuthoring/agentRegistry.ts`：5 个能力以稳定 id（`generate-outline` / `generate-chapter-draft` / `suggest-plot` / `simulate-roleplay` / `check-consistency`）注册到统一 registry，`invokeAgentTool(id, input)` 提供类型安全的调用入口，便于未来对外暴露给 MCP / Agent SDK

**打磨与稳定性**（Phase 16 后续）：

- [x] **结构化错误处理** — 新增 `utils/aiAuthoring/result.ts`（`AiAuthoringError` + `classifyError`），5 个 generator 返回类型从 `T | null` 改为 `{ data: T } | { error: AiAuthoringError }`，保留 `AiApiError.type`（auth / rate_limit / network / timeout / aborted / not_found / not_configured / unknown）。新增 `AiErrorBanner.vue` 通用错误展示组件：含错误类型 i18n 文案 + 「重试」按钮（`retryable` 时显示）+ 「跳转 AI 设置」按钮（auth / not_configured 时显示）。5 个 modal 全部用 banner 替换原通用 toast
- [x] **移动端 AI 工具菜单** — `ChapterEditorForm` 章节正文头部 4 个 AI 按钮在窄屏（< 768px）折叠为单按钮「✨ AI 工具 ▾」+ `AiToolsPopover.vue`（4 项 IonItem 含一行说明文案），桌面端（≥ 768px）保留原 4 按钮一字排开。CSS media query 切换，无 JS 重计算开销

---

### Phase 17：运行时与发布 ✅ {#phase-17}

目标：让作品「真正可玩、可分发」。承接 Play Tab 与 Capacitor 已完成的基础设施。

#### Phase 17a：Play Tab 完整化 ✅

- [x] **引擎层扩展** — `PlaySession` 新增 `visitedNodes` / `unlockedCGs` / `history` 三个可选字段（[`types.ts`](https://github.com/YunYouJun/advjs/blob/main/packages/core/src/engine/types.ts)），runtime 在 advance 时自动追踪节点访问 + 背景 CG 解锁；`SessionManager.rollback(sessionId, steps?)` API 弹出 history 栈顶并跳回（7 个单测覆盖单步/批量/历史不足/状态强制 playing 等场景）
- [x] **Studio 进度跟踪** — `usePlayProgress(projectId)` composable 用 `useStorage` 持久化 visited/history/unlockedCGs 到 localStorage（per-project + per-chapter），`usePlaySaveSlots(projectId)` 用 Dexie v14 `playSaveSlots` 表存档槽位（每槽位嵌入完整快照）
- [x] **Play Tab UI 接入** — `PlayPage.vue` 工具栏新增 5 个按钮（存档 / 读档 / CG 回廊 / 剧情统计 / 分支图）+ 底部回滚 FAB（仅当 history 非空时显示）；`SaveSlotModal.vue`（12 槽位 2-3 列网格 + 备注 + 删除）、`LoadSlotModal.vue`（按时间排序的列表）、`CgGalleryModal.vue`（4 列网格 + Lightbox）、`StoryStatsModal.vue`（完成度% + CG% + 分支% 三栏进度条）、`BranchGraphModal.vue`（mermaid 渲染 + 当前节点/已访问路径高亮）
- [x] **分支可视化模块化** — `analyzeBranches` / `formatMermaid` / `formatJson` / `formatText` 从 `packages/advjs/node/commands/branches.ts` 抽到 `@advjs/core/engine/branches.ts`，浏览器与 CLI 共享同一份纯逻辑（CLI 仅保留 `analyzeBranchesFromFile` 文件 IO 包装）
- [x] **跳过已读** — skip 模式在踩到未访问节点时自动关闭（`GamePlayer.vue` 在 `currentIndex` watcher 里比对 `progress.isVisited`，未读则关 `$adv.$auto.skipEnabled`）
- [x] **i18n + E2E** — 中英文新增 30+ `preview.*` 文案；`tests/e2e/play-tab.spec.ts` 覆盖 5 个工具栏按钮可见性、CG/Stats 弹层、localStorage 进度跨刷新持久化

#### Phase 17b：独立 build 导出 + PWA 更新提示 ✅

- [x] **独立 build 导出** — `useStandaloneBuild.ts` 生成 `<project>-standalone.zip`，含 index.html 着陆页（封面 + 简介 + 「在 Studio 中打开」深链）、`_redirects`（Netlify SPA 兜底）、`vercel.json`（rewrites）、`manifest.webmanifest`、README。`ProjectOverview.vue` 工具栏「Export」旁新增「导出独立站点」按钮（`globeOutline` 图标），与 `.advpkg.zip` 并列
- [x] **PWA 更新提示** — `vite.config.ts` `registerType: 'autoUpdate'` 改为 `'prompt'`；`UpdatePrompt.vue` 通过 `virtual:pwa-register/vue` 监听 `needRefresh` 弹「立即刷新」Toast、`offlineReady` 首装时弹「应用已支持离线」Toast，全局挂载于 `App.vue`

#### Phase 17c：埋点与崩溃监控 ✅

- [x] **Telemetry 客户端** — `utils/telemetry.ts`：默认 OFF + 首启 `TelemetryOptInPrompt.vue` 询问；`track(name, props?)` 写入 localStorage 队列，30s 周期 + 50 条阈值 + tab 关闭 flush 到 CloudBase 云函数 `advjs-telemetry`（缺函数环境静默降级）；props 过滤长字符串与非原始类型，避免项目内容泄漏；关键路径埋点：`project_published`（useMarketplace）/ `standalone_exported`（ProjectOverview）/ `error.vue` / `error.promise` / `error.boundary`
- [x] **崩溃上报** — `main.ts` 的 `errorHandler` 与 `unhandledrejection` + `ErrorBoundary.vue` 的 `onErrorCaptured` 均调 `track('error.*')`（截断 stack 至 800 字符）
- [x] **创作者仪表盘** — 复用既有 `CreatorAnalyticsPage.vue`（`/tabs/me/analytics`），`MePage.vue` 已登录态新增「我的数据」导航入口（与「我的作品集」并列）

#### 范围外（明确不做，承接 Phase 18 之后）

- ~~**Capacitor iOS/Android 上架**~~ — 脚手架已就绪（`apps/studio/CAPACITOR.md`），本阶段不做真机上架（成本 / 商店审核）；后续小迭代或 Phase 18 之后启动
- ~~**PWA 离线包细化**~~ — 当前 `vite-plugin-pwa` Workbox 配置（30 天 CacheFirst + AI API NetworkOnly）已足够，后续视用量再分级（covers/scenes/audio 分级缓存）

---

### Phase 18：协作与社区强化 ✅ {#phase-18}

目标：承接 Phase 14 / 15a 已搭好的市场与协作骨架，做生态运营。

- [x] **关注与订阅 + 站内通知中心** — `advjs_follows` 集合（[`useFollow.ts`](https://github.com/YunYouJun/advjs/blob/main/apps/studio/src/composables/useFollow.ts) follow/unfollow/isFollowing/listFollowers/countFollowers），`advjs_notifications` 集合（[`useNotificationsStore.ts`](https://github.com/YunYouJun/advjs/blob/main/apps/studio/src/stores/useNotificationsStore.ts) 30s 轮询 + 标记已读 + bulk fan-out helper）；`CreatorPage` 头部 Follow / Unfollow 按钮 + 实时粉丝数；`publishProject` 首次发布后自动向所有关注者写入 `new_project` 通知；`MePage` 标题栏 🔔 图标 + 未读红点徽章；[`NotificationCenter.vue`](https://github.com/YunYouJun/advjs/blob/main/apps/studio/src/components/NotificationCenter.vue) 列表 + 「全部已读」 + 相对时间 + 点击跳转作品详情或创作者主页。**不做** Web Push / Capacitor 原生推送，纯站内通知中心路线
- [x] **协作 E2E 补全**（承接 Phase 15a 待办） — [`collab.spec.ts`](https://github.com/YunYouJun/advjs/blob/main/apps/studio/tests/e2e/collab.spec.ts) 已覆盖协作设置入口、双客户端收敛、断线重连后追平并继续发布，以及观察者写入被拒且不污染编辑者；测试使用浏览器内确定性 CloudBase 传输夹具，不依赖线上账号或共享测试数据
- [x] **市场分类与标签体系** — [`marketTaxonomy.ts`](https://github.com/YunYouJun/advjs/blob/main/apps/studio/src/utils/marketTaxonomy.ts) 定义题材（10）/ 风格（5）/ 时长（3）三维结构化分类的单一事实源（id + i18n labelKey + icon + `deriveDuration` 按章节数推断时长 + `normalize*` 校验器），由发布表单、市场筛选器、AI 打标共享。`MarketplaceRecord` 扩展 `genre` / `style` / `duration` 字段，`browseMarket` 支持服务端等值筛选，`MarketplacePage` 新增可折叠筛选面板（三维 chip + 激活计数徽章 + 一键清除）与卡片/详情页分类徽章（点击徽章回填筛选）。AI 自动打标 [`marketTagger.ts`](https://github.com/YunYouJun/advjs/blob/main/apps/studio/src/utils/aiAuthoring/marketTagger.ts) 复用 `runAiJsonExtractionResult`，依据项目名/简介/world.md/角色卡输出受枚举约束的 genre/style + 自由 tags（去重 + 截断 + 上限 6）。人工策展：`setFeatured` + 详情页 owner-only「设为精选」开关驱动精选位。新增 [`MarketPublishModal.vue`](https://github.com/YunYouJun/advjs/blob/main/apps/studio/src/components/marketplace/MarketPublishModal.vue) 取代一键发布（标签 chip 输入 + 三维选择 + AI 打标按钮），中英文 i18n 完整，11 单测覆盖 taxonomy 与 tagger 校验
- [x] **评论与回复（最简实现）** — 每条 `advjs_reviews` 记录允许一个 `authorReply`，作者可新增或覆盖回复；评价与回复均由 `marketStats` 做长度和敏感词校验，不引入任意层级评论树
- [x] **举报与审核（最简实现）** — `reportProject` 将去重后的举报写入私有 `advjs_reports` pending 队列；配置 `ADVJS_MODERATOR_UIDS` 后，`moderateReport` 只提供 `dismiss` / `unlist` 两种人工决策，下架直接复用市场 `unlisted` 状态
- [x] **创作者激励（确认延期）** — 当前真实发布量与运营数据不足，不预建徽章、月度精选或积分账本；保留既有热门/好评排序、创作者数据页和人工精选，待运营需求与云乐坊积分 API 明确后再实现

---

### 待孵化方向

短期不阻塞、需前置依赖成熟后再启动的方向：

- **位置驱动剧情** — 在 Flow 编辑器中支持「角色到达某地点」作为分支条件。**前置依赖**：Flow 节点系统重构（自定义节点类型 / AST 双向绑定）。当前 `packages/flow/` 仍是骨架，预计 Phase 17 之后再启动
- **Mystery 角色属性模板** — `attributes.template: mystery` + `ai.visibility: 'gm-only'` 字段级可见性，与 Phase 10 视角系统联动（继承自 N8 后续计划）
- **AI 从 Markdown 描述回填 attributes** — 一键把作者手写的角色描述结构化到 frontmatter（继承自 N8 后续计划，复用 Phase N6 的 `keyEvents` 压缩思路）
