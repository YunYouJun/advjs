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
60+ 组件、32+ 页面、13 Store、170+ 单测、26 E2E。
:::

---

## Phase N：核心体验冲刺 {#phase-n}

目标：**先把已有功能做「丝滑」**，再推进新功能。

**优先级排序**：

1. 🔴 **P0 — 体验阻断**：用户核心路径上的断裂点（N1）
2. 🟠 **P1 — 上手门槛**：新用户首次体验的摩擦点（N2）
3. 🟡 **P2 — 性能感知**：用户可感知的卡顿和加载慢（N3）
4. 🟢 **P3 — 平台扩展**：原生平台和文件系统完备性（N4）
5. 🔵 **P4 — 传播增长**：分享和社交能力（N5）

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

### Phase N2：项目管理极简化 🟠 {#phase-n2}

目标：新用户 **3 步内开始对话**。

- [x] **一键体验模式** — `QuickStartButton` 自动创建 MemoryFs 项目 + 预置模板，跳转 World 页开始对话
- [x] **最近对话快捷入口** — `RecentCharacterPopover` 已集成到 WorldPage，弹出最近对话角色
- [x] **项目封面与简介** — `cover` + `description` 字段，ProjectSettingsModal 封面上传/移除 + 简介编辑，项目卡片展示封面缩略图
- [x] **项目健康自动修复** — `ProjectHealthPanel.vue`（按类别分组 + 单个/批量修复按钮）+ `autoFixIssues()` 自动移除断链引用，集成到 `ProjectOverview` 自动验证

---

### Phase N3：性能与包体积 🟡 {#phase-n3}

- [x] **首屏骨架屏** — `WorldSkeleton` / `ChatSkeleton` / `AppSkeleton` 已实现，Tab 切换渲染骨架屏
- [x] **Monaco 按需加载** — `monacoSetup.ts` 动态 `import('monaco-editor')` 单例缓存，仅加载 json/ts/css/html/editor 五类 worker（节省 ~7MB）
- [x] **Ionic 组件审计** — 全部使用 `import { IonButton, ... } from '@ionic/vue'` 显式按需导入，无全局注册
- [ ] **虚拟滚动扩展** — 角色列表 + 时间线接入 `@tanstack/vue-virtual`（聊天页已覆盖）
- [x] **IndexedDB 批量事务** — 所有 store 的 flush/load 已使用 `bulkPut` / `bulkDelete` / `db.transaction()` 批量操作

---

### Phase N4：平台扩展与文件系统 🟢 {#phase-n4}

- [x] **IFileSystem 抽象层** — Browser/Capacitor/Memory 三适配器，消费者全量迁移完成
- [x] **MemoryFs 持久化验证** — Playwright E2E 测试：QuickStart 创建 → IndexedDB 数据写入 → 刷新 → 自动恢复验证
- [ ] **Capacitor 首次构建** — 初始化 iOS/Android 工程，模拟器首次启动

---

### Phase N5：分享与传播 🔵 {#phase-n5}

- [ ] **项目封面生成** — AI 图片服务生成封面，或手动上传
- [ ] **分享链增强** — 附加封面图 + OG meta 标签（微信/Twitter 预览卡片）
- [ ] **对话片段分享** — 选中 N 条消息，生成精美分享图

---

## 远期路线

```
Phase N（核心体验冲刺，N1-N5）
    ↓ 达到「可发布品质」
Phase 13（账号系统）
    ↓ 用户身份基础设施
Phase 14（世界/故事市场）
    ↓ 社区生态
后续迭代（多人协作、插件系统等）
```

### Phase 13：账号系统 {#phase-13}

- [ ] 用户注册/登录（邮箱 + OAuth）
- [ ] 用户资料（头像、昵称、简介）
- [ ] 项目云端绑定（账号关联项目，跨设备同步）
- [ ] 个人作品集页面

### Phase 14：世界/故事市场 {#phase-14}

::: tip 前置依赖
需要 Phase 13 账号系统完成后实施。
:::

让用户发布和发现其他创作者的世界与故事，一键加载开始游玩。核心功能：市场浏览（搜索/标签/排序）、世界发布（.advpkg 打包）、一键加载、角色预览、评价系统、创作者主页。

### 其他远期

- [ ] **Capacitor 原生打包** — iOS/Android 原生应用（→ [Phase N4](#phase-n4)）
- [ ] **多人协作 / 实时同步** — 基于 CRDT 或 OT 的协同编辑
- [ ] **插件系统** — 接入 Babylon/Three/OpenAI 等引擎插件
