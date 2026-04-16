# Studio 下阶段计划：移动端优先

> 📅 2026-04-09
>
> Phase 1-27 核心功能已全部完成。Studio 框架完整（项目管理、Dashboard、编辑器、角色/章节/场景列表、AI 聊天、世界模拟、游戏预览）。现在围绕移动端体验逐步完善功能。

---

## 已完成功能一览

### Phase 1-5：基础 Mobile Studio ✅

| 功能         | 说明                                 |
| ------------ | ------------------------------------ |
| 5 Tab 架构   | Workspace / Chat / World / Play / Me |
| AI 创作助手  | Chat Tab，项目上下文感知，流式回复   |
| 角色对话系统 | World Tab，角色列表 + 沉浸式角色对话 |
| 内容创建     | 角色/章节/场景的表单 + AI 辅助创建   |
| 文件管理     | 文件树浏览、Monaco Editor 预览/编辑  |
| 云同步       | 腾讯云 COS 上传/下载/同步            |
| 游戏预览     | ChapterReader + GamePlayer           |
| i18n         | 中英双语                             |

### Phase 6-12：AI Living World 深化 ✅

| Phase | 功能                 | 状态 |
| ----- | -------------------- | ---- |
| 6     | 角色记忆与对话增强   | ✅   |
| 7     | 动态角色状态         | ✅   |
| 8     | 世界事件与时间系统   | ✅   |
| 9     | 多角色群聊交互       | ✅   |
| 10    | 玩家角色与视角模式   | ✅   |
| 11    | 专业角色知识系统     | ✅   |
| 12    | IndexedDB 数据持久化 | ✅   |

### Phase 25-27：高级功能 ✅

| Phase | 功能                               | 状态 |
| ----- | ---------------------------------- | ---- |
| 25    | 角色关系图谱 + 记忆重试 + 对话存档 | ✅   |
| 26    | AI 角色自主日记                    | ✅   |
| 27    | 世界时间线                         | ✅   |

---

## 下阶段计划

### Phase M1：移动端基础体验完善 {#phase-m1}

#### M1.1 Safe Area 适配 ✅

- `viewport-fit=cover` 已在 `index.html` 中配置
- Tab bar、Footer toolbar、FAB、Editor textarea、ContentEditorModal、CharacterEditorForm 均已添加 `env(safe-area-inset-bottom)` padding
- 所有 Chat 输入区域通过 `ion-footer ion-toolbar:last-child` 全局覆盖

#### M1.2 触摸交互优化 ✅

- 所有可点击元素 ≥44px 触摸区域（`ion-item { --min-height: 44px }`）
- 章节列表：`IonItemSliding` 左滑删除
- 场景列表：`IonItemSliding` 左滑删除
- 角色列表：`CharacterCardActions` 操作按钮（编辑/聊天/删除）
- 所有内容列表：`IonRefresher` 下拉刷新

#### M1.3 Capacitor 插件集成 ✅

- **Status Bar**: 根据暗/亮主题自动切换样式，MutationObserver 监听 `dark` 类变化
- **Keyboard**: `KeyboardResize.Ionic` 模式，自动调整视口
- **Haptics**: `hapticFeedback()` / `hapticNotification()` 工具函数，可在任意页面调用
- 全局初始化：`main.ts` → `initCapacitorPlugins()`

---

### Phase M2：核心功能完善 {#phase-m2}

#### M2.1 章节阅读器增强 ✅

- GamePlayer 新增触摸左右滑动翻页（`touchstart` / `touchend`，50px 阈值）
- 新增 `prev()` 方法，支持回退到上一个可渲染节点
- 进度条从 2px 加粗到 4px，支持点击跳转到对应位置
- Footer 新增章节名显示（淡入淡出动画）
- PlayPage 新增浮动章节按钮 + 底部 sheet 章节面板（`IonModal` breakpoints）

**修改文件**:

- `apps/studio/src/components/GamePlayer.vue` — 触摸事件 + prev() + 进度条点击
- `apps/studio/src/views/PlayPage.vue` — 章节面板 + 浮动按钮

#### M2.2 内容编辑器移动端工具栏 ✅

- EditorPage textarea 上方新增横向滚动快捷工具栏
- 支持 7 种快捷插入：`## 标题` / `@角色` / `- 列表` / `**粗体**` / `> 引用` / `---分隔线` / `【场景】`
- 使用 `selectionStart` / `selectionEnd` 精确在光标位置插入

**修改文件**: `apps/studio/src/views/EditorPage.vue`

#### M2.3 Dashboard 条目列表视图 ✅

- 道具/术语 StatsCard 点击时展开 inline section 列表（而非直接跳编辑器）
- 列表显示 `## heading` 条目（chips 布局），每条可点击跳转编辑器
- 无条目时仍直接跳编辑器

**修改文件**: `apps/studio/src/components/ProjectOverview.vue`

#### Chat 内联 Diff ✅

- `MarkdownMessage` 检测到 `saveableBlocks` 时，自动用 `readFileFromDir` 读取项目中已有文件
- 如果文件存在且内容不同，用 `computeLineDiff` 预计算行级 diff
- 保存按钮旁显示 `+N/-M` diff 摘要按钮，点击展开 `FileDiffPreview`
- 用户可在保存前预览变更

**修改文件**: `apps/studio/src/components/MarkdownMessage.vue`

---

### Phase M3：音频资源 & 场景图片 ✅ {#phase-m3}

#### M3.1 场景图片预览 + AI 生成 ✅

- `SceneInfo` / `SceneFormData` 新增 `src` 字段
- `SceneCard.vue` 重构为带缩略图预览的卡片（16:9 aspect-ratio）
- 支持三种图片来源：本地相对路径（blob URL 读取）、远程 URL、AI 生成
- `ScenesPage.vue` 集成 `generateImage()`（调用 `aiImageClient.ts`），生成后自动保存图片并更新场景 frontmatter

**新增/修改文件**:

- `apps/studio/src/utils/sceneMd.ts` — `SCENE_FRONTMATTER_KEYS` 新增 `src`
- `apps/studio/src/components/SceneCard.vue` — 完整重写，支持缩略图 + AI 生成按钮
- `apps/studio/src/views/workspace/ScenesPage.vue` — `handleGenerateImage()` 集成

#### M3.2 音频资源完整管理 ✅

- `AdvMusic` 类型扩展：新增 `duration?`, `tags?`, `linkedScenes?`, `linkedChapters?`
- 音频解析器 `audioMd.ts`：frontmatter 解析/序列化
- `useProjectContent` 扩展：`AudioInfo` 接口 + `audios` ref + `adv/audio/` 目录扫描
- `AudioCard.vue`：内联播放器（播放/暂停 + 进度条 + 时长显示）
- `AudioEditorForm.vue`：名称/描述/标签/关联场景/关联章节
- `AudioPage.vue`：完整列表页（搜索、下拉刷新、滑动删除、导入、创建/编辑）
- Dashboard 音频卡片激活 + Stats Row 音频统计

**新增文件**:

- `apps/studio/src/utils/audioMd.ts`
- `apps/studio/src/components/AudioCard.vue`
- `apps/studio/src/components/AudioEditorForm.vue`
- `apps/studio/src/views/workspace/AudioPage.vue`

**修改文件**:

- `packages/types/src/game/music.ts` — 类型扩展
- `apps/studio/src/utils/fs/utils.ts` — 集中维护文件下载、目录选择、项目检测与音频/图片扩展名检测等文件系统工具
- `apps/studio/src/composables/useProjectContent.ts` — AudioInfo + audios 加载
- `apps/studio/src/composables/useContentEditor.ts` — 支持 `audio` ContentType
- `apps/studio/src/router/index.ts` — `workspace/audio` 路由
- `apps/studio/src/components/ProjectOverview.vue` — 音频 StatsCard + 音频内容卡片
- `apps/studio/src/i18n/locales/zh-CN.json` + `en.json` — 音频/场景 i18n keys

---

### Phase M4：项目验证 & 分享 ✅ {#phase-m4}

#### M4.1 浏览器端项目验证 ✅

- 新建 `projectValidation.ts` — 浏览器端验证函数，基于内存数据（不依赖 Node.js fs）
- 检查逻辑镜像 `packages/advjs/node/commands/check.ts`：
  1. 语法检查 — 调用 `parseAst()` 捕获解析错误
  2. 角色引用检查 — `@Name` 语法 vs characters 列表
  3. 场景引用检查 — `【place，time，inOrOut】` 语法 vs scenes 列表
  4. 音频链接完整性 — `linkedScenes` / `linkedChapters` 引用检查

**新增文件**: `apps/studio/src/utils/projectValidation.ts`

#### M4.2 Dashboard 健康状态卡片 ✅

- Stats Row 下方新增健康卡片区域
- 三态：未检查 → 检查中（spinner）→ 结果（通过 ✅ / 失败 ⚠️）
- 失败时可展开查看问题列表（最多 10 条，按分类显示）
- 支持重新检查

#### M4.3 项目级分享 ✅

- 项目 header 新增分享按钮（与设置按钮并排）
- Web Share API（移动端）/ 剪贴板复制（桌面端）

**修改文件**:

- `apps/studio/src/components/ProjectOverview.vue` — 健康卡 + 分享按钮
- `apps/studio/src/i18n/locales/zh-CN.json` + `en.json` — validation._+ dashboard.share_ keys

---

### Phase M5：桌面布局 + AI 个性化 + 知识库编辑 + 项目打包 ✅ {#phase-m5}

#### M5.1 响应式桌面双栏布局 ✅

- `useResponsive.ts` composable（基于 `@vueuse/core` `useMediaQuery`）
- TabsPage: ≥768px 时底部 tab bar 替换为左侧 72px sidebar navigation
- 桌面端 sidebar nav + 移动端 bottom tab bar 自动切换

**新增/修改文件**:

- `apps/studio/src/composables/useResponsive.ts` — 响应式断点
- `apps/studio/src/views/TabsPage.vue` — 桌面 sidebar + 移动端 tab bar

#### M5.2 角色 AI 模型/温度设置 ✅

- `CharacterAiOverride` 接口：per-character provider/model/temperature/maxTokens
- IndexedDB `characterAiConfigs` table（v9 schema）
- `resolveCharacterAiConfig()` 合并全局 + 角色覆盖配置
- `useCharacterChatStore.sendMessage()` 使用 resolved config
- `streamToMessage` 新增 `resolvedConfig` 可选参数
- `CharacterAiSettingsForm.vue` UI（IonModal bottom sheet）
- CharacterChatPage header 更多操作中新增"AI 设置"入口

**新增文件**:

- `apps/studio/src/utils/resolveAiConfig.ts`
- `apps/studio/src/components/CharacterAiSettingsForm.vue`

**修改文件**:

- `apps/studio/src/utils/db.ts` — v9 schema + characterAiConfigs table
- `apps/studio/src/utils/chatUtils.ts` — streamToMessage resolvedConfig
- `apps/studio/src/stores/useCharacterChatStore.ts` — aiOverrides + CRUD
- `apps/studio/src/views/CharacterChatPage.vue` — AI 设置入口

#### M5.3 知识库 UI 编辑 ✅

- `useKnowledgeBase` 扩展：`saveEntry` / `createEntry` / `deleteEntry`
- `KnowledgePage.vue` — 完整列表页（按 domain 分组、搜索、下拉刷新、滑动删除）
- `KnowledgeEditorForm.vue` — 标题/领域/Markdown 内容编辑
- Dashboard 知识库卡片点击跳转到 KnowledgePage

**新增文件**:

- `apps/studio/src/views/workspace/KnowledgePage.vue`
- `apps/studio/src/components/KnowledgeEditorForm.vue`

**修改文件**:

- `apps/studio/src/composables/useKnowledgeBase.ts` — 写入 API
- `apps/studio/src/router/index.ts` — workspace/knowledge 路由
- `apps/studio/src/components/ProjectOverview.vue` — 知识库卡片跳转

#### M5.4 长列表虚拟滚动 ✅

- 安装 `@tanstack/vue-virtual`
- `useVirtualScroll.ts` composable（re-export + 使用文档）
- 现有缓解策略已到位：消息 200 条上限 + 分页 50 条

**新增文件**:

- `apps/studio/src/composables/useVirtualScroll.ts`

#### M5.5 项目打包导出 (.advpkg) ✅

- 安装 `jszip`
- `useProjectExport.ts`：`exportProject()` 递归收集 `adv/` 文件 → JSZip 打包 + `manifest.json`
- `importProject()` 解压 + 校验 manifest → 写入 dirHandle
- Dashboard header 新增导出按钮（与分享按钮并排）

**新增文件**:

- `apps/studio/src/composables/useProjectExport.ts`

**修改文件**:

- `apps/studio/src/components/ProjectOverview.vue` — 导出按钮

---

### Phase M6：桌面双栏 + 项目导入 + PWA + 体验优化 ✅ {#phase-m6}

#### M6.1 桌面双栏布局深化 ✅

- WorldPage 桌面端左栏角色列表（280px）+ 右栏世界动态/事件/群聊
- ChatPage 桌面端左栏项目上下文摘要 + 右栏消息流
- 使用 `useResponsive` 的 `isDesktop` 控制，移动端保持不变

**修改文件**: `WorldPage.vue`, `ChatPage.vue`

#### M6.2 项目导入 UI 补全 ✅

- ProjectsPage 新增「导入 .advpkg」action-card
- 文件选择器 + dirHandle 选择 → `importProject()` → 自动切换项目

**修改文件**: `ProjectsPage.vue`

#### M6.3 PWA 离线模式 ✅

- `vite-plugin-pwa` + Workbox 缓存策略
- App shell CacheFirst / AI API NetworkOnly / 静态资源 CacheFirst
- PWA manifest 配置完成

**修改文件**: `vite.config.ts`

#### M6.4 知识库增量更新 ✅

- `useKnowledgeBase` 新增 `watchForChanges(dirHandle)` + `stopWatching()`
- 每 30 秒扫描 `adv/knowledge/` 文件变更，自动静默刷新
- 项目加载时自动启动 watch

**修改文件**: `useKnowledgeBase.ts`, `useProjectContent.ts`

#### M6.5 消息自动归档 ✅

- Dexie v10 新增 `archivedBatches` table
- `trimMessagesIfNeeded` 增强：被裁剪的消息自动存入归档
- 新增 `getArchivedBatches()` / `hasArchivedMessages()` 查询方法

**修改文件**: `db.ts`, `useCharacterChatStore.ts`

#### M6.6 上下文压缩优化 ✅

- `tokenEstimate.ts` — 中英文 token 估算（CJK ~1.5 tokens/char, Latin ~4 chars/token）
- `buildSmartContext` 从固定消息数改为 4096 token budget 动态分配
- 按 budget 从最新消息向前累积，保证至少 KEEP_RECENT 条

**新增文件**: `utils/tokenEstimate.ts`
**修改文件**: `useCharacterChatStore.ts`

#### M6.7 市场页面原型 ✅

- `MarketplacePage.vue` — 搜索/分类标签/卡片网格/详情 Modal
- 5 个 Mock 示例项目（樱花学院、Cyber Noir、仙途录、Haunted Manor、Star Voyager）
- ProjectsPage 新增「浏览市场」action-card 入口

**新增文件**: `views/workspace/MarketplacePage.vue`
**修改文件**: `ProjectsPage.vue`, `router/index.ts`

---

### Phase M7：M6 遗留缺口补全 ✅ {#phase-m7}

补全 M6 实现中遗漏的 UI 和资源文件。

#### M7.1 归档消息查看 UI ✅

- CharacterChatPage 更多操作中新增「查看归档消息」按钮
- IonModal bottom sheet 展示归档 batches（按时间分组、折叠/展开、只读消息列表）
- 调用已有 `getArchivedBatches()` / `hasArchivedMessages()` store 方法

**修改文件**: `CharacterChatPage.vue`, i18n `zh-CN.json` + `en.json`

#### M7.2 PWA 图标生成 ✅

- 从紫色背景 + 白色 "A" 字母 SVG 生成 PNG 图标
- `pwa-192x192.png` (192×192) + `pwa-512x512.png` (512×512) + `favicon.ico` (32×32)
- 补全 `vite.config.ts` PWA manifest 引用的图标文件

**新增文件**: `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/favicon.ico`

#### M7.3 文档更新 ✅

- `docs/guide/studio.md` 已知待优化项全部标记为已完成：
  - 消息清理策略 → ✅ M6.5 + M7.1
  - 知识库增量更新 → ✅ M6.4
  - 上下文压缩 → ✅ M6.6
  - 离线体验 → ✅ M6.3 + M7.2

---

### Phase M8：TTS 语音合成 + 单元测试 + 无障碍 ✅ {#phase-m8}

#### M8.1 TTS 插件架构 ✅

- `TtsProvider` 插件接口：`id`, `name`, `needsKey`, `canGenerateBlob`, `generate()`, `play()`
- Provider 注册表：`registerTtsProvider()` / `getTtsProvider()` / `listTtsProviders()`
- 4 个内置 provider：Web Speech API（免费离线）、OpenAI TTS、豆包 TTS、Custom
- OpenAI + 豆包共用 `openaiCompatibleGenerate()`（OpenAI `/v1/audio/speech` 兼容格式）
- 统一 API：`ttsSpeak()`, `ttsStop()`, `ttsPlayBlob()`
- AiConfig 扩展 6 个 TTS 字段

**新增文件**: `utils/ttsClient.ts`
**修改文件**: `useAiSettingsStore.ts`

#### M8.2 TTS 设置 UI ✅

- SettingsAiPage 新增 TTS 折叠面板（沿用 Image Generation 相同 UI 模式）
- Provider grid chips + API Key + Model + Voice + Speed 滑块
- Web Speech API 动态获取浏览器声音列表

**修改文件**: `SettingsAiPage.vue`, i18n `zh-CN.json` + `en.json`

#### M8.3 消息 TTS 播放 ✅

- CharacterChatPage 每条 assistant 消息旁 🔊 播放按钮
- 模式 1：按需生成 + 自动缓存到 `adv/audio/tts/{characterId}-{timestamp}.mp3`
- 模式 2：更多操作中「批量生成语音」按钮，串行生成带进度 toast
- 已缓存消息直接读取文件播放
- `CharacterChatMessage` 新增 `ttsAudioPath` 可选字段

**修改文件**: `CharacterChatPage.vue`, `useCharacterChatStore.ts`

#### M8.4 单元测试 ✅

- 删除过时 `example.spec.ts`，新建 `src/__tests__/` 目录
- `tokenEstimate.test.ts` — 10 tests（纯英文/纯中文/混合/边界值）
- `ttsClient.test.ts` — 9 tests（注册表/OpenAI generate/错误处理）
- `sceneMd.test.ts` — 10 tests（解析/序列化/round-trip/边界值）
- 共 29 tests，全部通过

**新增文件**: `src/__tests__/tokenEstimate.test.ts`, `src/__tests__/ttsClient.test.ts`, `src/__tests__/sceneMd.test.ts`

#### M8.5 无障碍改进 ✅

- CharacterChatPage: 消息列表 `role="log" aria-live="polite"` + 输入框 `aria-label`
- TTS 按钮: `aria-label` + `aria-pressed` 状态
- WorldPage: 角色列表 `role="navigation"` + `role="list"` + `role="listitem"`

**修改文件**: `CharacterChatPage.vue`, `WorldPage.vue`

---

### Phase M9：知识库 Embedding V2 + 测试补全 + 性能优化 ✅ {#phase-m9}

#### M9.1 知识库 Embedding V2 ✅

- `embeddingClient.ts`（新建）— OpenAI 兼容 `/v1/embeddings` 客户端 + cosine similarity + ranking
- `EMBEDDING_PROVIDERS` 预设：Same as Chat / OpenAI / SiliconFlow / Custom
- AiConfig 扩展：`embeddingEnabled`（默认 false）+ provider/apiKey/model
- IndexedDB v11 新增 `knowledgeEmbeddings` table（向量缓存，content hash 变更检测）
- `useKnowledgeBase.selectRelevantKnowledgeV2()` — 向量检索 + IndexedDB 缓存 + 批量生成（20/batch）+ fallback V1
- SettingsAiPage Embedding 折叠面板：开关 + provider + model

**新增文件**: `utils/embeddingClient.ts`
**修改文件**: `useAiSettingsStore.ts`, `db.ts`, `useKnowledgeBase.ts`, `SettingsAiPage.vue`, i18n

#### M9.2 单元测试补全 ✅

7 个新测试文件，覆盖核心 utils：

- `mdFrontmatter.test.ts` (9 tests) — 前置数据解析/序列化
- `audioMd.test.ts` (8 tests) — 音频 markdown 解析
- `chapterMd.test.ts` (7 tests) — 章节解析
- `slug.test.ts` (12 tests) — slug 生成 + CJK 保留
- `lineDiff.test.ts` (8 tests) — 行级 diff
- `resolveAiConfig.test.ts` (6 tests) — AI 配置合并
- `embeddingClient.test.ts` (13 tests) — 向量运算 + API mock

总计：10 个测试文件，92 tests，全部通过

#### M9.4 性能优化 ✅

- `useProjectExport.ts` — JSZip 从静态 import 改为 `await import('jszip')`（按需加载）
- Monaco Editor 已为动态导入（FilePreview.vue）

---

### Phase 13：账号系统 {#phase-13}

- 用户注册/登录（邮箱 + OAuth）
- 用户资料（头像、昵称、简介）
- 项目云端绑定（跨设备同步）

### Phase 14：世界/故事市场 {#phase-14}

> 前置依赖：Phase 13 账号系统

- 市场浏览（分类、搜索、排序）
- 世界发布（打包 `.advpkg.zip`）
- 一键加载
- 评价系统

---

## 地点系统路线 {#location-roadmap}

地点（Location）模块为 Studio 新增世界观组织维度。文件存储在 `adv/locations/*.md`。

### Phase L1：基础 CRUD ✅ {#phase-l1}

| 功能                 | 说明                                                        | 状态 |
| -------------------- | ----------------------------------------------------------- | ---- |
| 地点 Markdown 解析   | `locationMd.ts`，YAML frontmatter + body                    | ✅   |
| 地点卡片 + 编辑表单  | `LocationCard.vue` + `LocationEditorForm.vue`               | ✅   |
| 地点列表页           | `LocationsPage.vue`（搜索、CRUD、草稿恢复、AI 辅助）        | ✅   |
| 通用 composable 扩展 | `useProjectContent` / `useContentEditor` / `useContentSave` | ✅   |
| 路由 + i18n          | `workspace/locations` 路由，中英双语翻译                    | ✅   |
| Dashboard 集成       | Stats Row 地点统计卡 + Content Cards 地点地图入口           | ✅   |

**地点数据模型**：

```ts
interface LocationFormData {
  id: string // 唯一标识
  name: string // 显示名称
  type?: 'indoor' | 'outdoor' | 'virtual' | 'other'
  description?: string // 地点描述
  tags?: string[] // 标签
  linkedScenes?: string[] // 关联场景 ID
  linkedCharacters?: string[] // 常出现角色 ID
}
```

**新增/修改文件**：

| 操作 | 文件                                                  |
| ---- | ----------------------------------------------------- |
| 新建 | `apps/studio/src/utils/locationMd.ts`                 |
| 新建 | `apps/studio/src/components/LocationCard.vue`         |
| 新建 | `apps/studio/src/components/LocationEditorForm.vue`   |
| 新建 | `apps/studio/src/views/workspace/LocationsPage.vue`   |
| 修改 | `apps/studio/src/composables/useProjectContent.ts`    |
| 修改 | `apps/studio/src/composables/useContentEditor.ts`     |
| 修改 | `apps/studio/src/composables/useContentSave.ts`       |
| 修改 | `apps/studio/src/router/index.ts`                     |
| 修改 | `apps/studio/src/i18n/locales/en.json` + `zh-CN.json` |
| 修改 | `apps/studio/src/components/ProjectOverview.vue`      |

### Phase L2：关联增强 ✅ {#phase-l2}

- [x] **Scene ↔ Location 双向关联**
  - 场景编辑表单新增 `linkedLocation` 字段
  - Location 详情页显示关联 Scene 列表（反查）
  - `projectValidation.ts` 检查 `linkedLocation` 引用完整性
- [x] **Character ↔ Location 动态关联**
  - `locationMatch.ts` 模糊匹配（id 精确 → 名称精确 → 名称包含）
  - 角色卡片显示当前所在地点名称
  - 地点详情页显示当前在此的角色 + frontmatter 关联角色
- [ ] **场景背景继承**
  - Location 可配置默认 `imagePrompt`
  - 新建关联 Scene 时自动填充提示词
- [x] **Location 详情页**
  - 点击地点卡片进入独立详情页（`LocationDetailPage.vue`）
  - 展示：描述、标签、关联场景列表、出现角色列表
  - 快捷操作：编辑、跳转到关联场景/角色

### Phase L3：可视化地图 {#phase-l3}

- [ ] **关系图谱 (LocationMapView.vue)**
  - 基于 `@advjs/flow`（Vue Flow）的节点图
  - 地点为节点，连接关系为边
  - 角色位置标注（当前所在地点高亮）
  - 支持拖拽布局和缩放
- [ ] **自定义地图图片**
  - Location 新增 `mapImage` 字段
  - 支持上传世界地图底图
  - 在底图上叠加地点标注
- [ ] **热区标注**
  - 在地图图片上标注地点热区（坐标 + 半径）
  - 点击热区跳转到对应 Location 详情
  - 悬停显示地点名称和当前角色

### Phase L4：运行时集成 {#phase-l4}

- [ ] **AST 层打通**
  - `@advjs/parser` 解析 `【place，time，inOrOut】` 时匹配 `adv/locations/{place}.md`
  - 丰富 `SceneInfo` AST 节点，注入 Location 元数据（type、description）
  - `adv check` 检查场景引用与地点目录的一致性
- [ ] **游戏内地图 UI**
  - `@advjs/client` 新增可选地图组件
  - 玩家可在游戏中查看地点地图、已访问地点
  - 支持地图图片 + 热区 + 已探索/未探索状态
- [ ] **位置驱动剧情**
  - Flow 编辑器支持"角色到达某地点"作为分支条件
  - 地点触发器（进入/离开地点时触发事件）

---

## 关键文件清单

| 文件                                                     | 说明                   |
| -------------------------------------------------------- | ---------------------- |
| `apps/studio/src/utils/capacitor.ts`                     | Capacitor 插件初始化   |
| `apps/studio/src/main.ts`                                | 全局初始化入口         |
| `apps/studio/src/theme/global.css`                       | Safe area 全局配置     |
| `apps/studio/index.html`                                 | viewport-fit=cover     |
| `apps/studio/src/views/TabsPage.vue`                     | Tab bar + 桌面 sidebar |
| `apps/studio/src/views/ChatPage.vue`                     | 聊天输入框             |
| `apps/studio/src/views/EditorPage.vue`                   | 编辑器                 |
| `apps/studio/src/components/ProjectOverview.vue`         | Dashboard 卡片         |
| `apps/studio/src/components/GamePlayer.vue`              | 游戏预览               |
| `apps/studio/src/utils/resolveAiConfig.ts`               | 角色 AI 配置合并       |
| `apps/studio/src/components/CharacterAiSettingsForm.vue` | 角色 AI 设置表单       |
| `apps/studio/src/views/workspace/KnowledgePage.vue`      | 知识库管理页           |
| `apps/studio/src/composables/useProjectExport.ts`        | 项目打包导出           |
| `apps/studio/src/composables/useResponsive.ts`           | 响应式断点             |
| `apps/studio/src/utils/tokenEstimate.ts`                 | Token 估算             |
| `apps/studio/src/views/workspace/MarketplacePage.vue`    | 市场页面原型           |
| `apps/studio/vite.config.ts`                             | PWA 配置               |

## 验证方式

1. `pnpm exec vue-tsc --noEmit --project apps/studio/tsconfig.json` — 零错误
2. `pnpm --filter @advjs/studio dev` — 浏览器中可正常访问
3. Chrome DevTools 移动端模拟器中测试各页面
4. 后续：`npx cap add android && npx cap sync && npx cap open android`
