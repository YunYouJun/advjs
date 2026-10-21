# Studio iPhone／iPad 原生 App 设计规格

- 日期：2026-10-21。
- 状态：草案。功能清单**待用户确认后锁定**，确认前不进入 P1。可行性结论来自模拟器，真机项待验。
- 范围：[实施计划](../plans/2026-10-21-studio-native-ios)的 P0 交付；计划中的范围、架构决策、体验预算和 N1–N16 仍是唯一验收标准。实测数据与证据见[验收报告](../reports/studio-native-ios-acceptance)。
- 代码基线：`dfc45b9e`（`apps/studio/src`，约 8.7 万行）。可行性探针位于 `apps/studio-ios/spike/`，只用于 P0，不进入产品工程。

## 结论摘要

| 项目           | 结论                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 引擎可行性     | 成立。现有 parser、core compiler、内容序列化与资源目录打成 641 KiB 单文件，在 iOS 27 模拟器 JavaScriptCore 中运行 160 个 golden 用例，与 Node 输出逐字节一致。需要宿主补齐 4 项 Web API（见架构决策 1）。              |
| 播放器可行性   | 成立。独立打包的播放器（1.6 MB）经 `WKURLSchemeHandler` 离线运行立绘、背景、BGM（206 分段读取）、选择支和官方 `star-map` 插件；存档快照经原生落盘后恢复，光标一致；越界路径与外部请求均被拒绝。                        |
| 原生登录可行性 | 协议可行，端到端**受阻**。云乐坊 SSO v3 只接受 HTTPS 回调；iOS 拒绝 HTTPS 回调，原因是 App 未与 `studio.advjs.org` 关联。需要服务端配置、Apple 账号权限和一个原生客户端登记，见[服务端与账号依赖](#服务端与账号依赖)。 |
| 协作           | 首版暂不迁移。Yjs 在 JavaScriptCore 中与 Node 互发更新可收敛；阻塞点是 CloudBase 实时传输与产品入口，而非 CRDT。                                                                                                       |
| Capacitor 迁移 | 仓库证据显示 iOS 壳从未签名分发，倾向无需迁移；需要用户在 App Store Connect 核实。                                                                                                                                     |

## 功能清单

### 分类规则

- **首版必需**：当前生产构建可达的能力，原生首版必须提供等价或更好的实现。服务端开关控制的能力同样迁移，原生端与 Web 一样按服务端登记 fail-closed。
- **暂不迁移**：未注册路由、生产中 fail-closed 的能力、只剩空壳的功能。保留数据格式和扩展点，入口不出现在原生界面，不留失效链接。
- **仅 Web**：依赖浏览器或桌面 Chromium 的能力，原生用系统能力替代或不需要。

清单来自对 `src/main.ts` 起的静态导入图（275 个可达模块）、路由表、各页面入口和托管能力开关的逐项核对。下表的「现有入口」均相对 `apps/studio/src`。

### 待用户确认

1. 托管配音（Jobs、Voice Design、发布审核）在生产服务端是否已开放？本表按「首版必需、按服务端 fail-closed」登记；若未开放，改为「暂不迁移」。
2. 「从云端加载」当前以只读 COS 项目打开，导出、自动修复均不可用。原生首版是否改为「下载为本地项目，再与云端同步」？本表按此登记。
3. 世界 Tab 只有关系图和角色资料有实际数据，时钟、事件、日记、情感状态在生产中恒为空。本表将后者登记为暂不迁移，世界 Tab 在原生中降为「角色与关系」视图。是否同意？
4. 遥测在原生首版不采集，隐私清单保持「不收集数据」。是否同意？
5. 市场、作品集、创作者主页与数据分析按「首版必需」登记（属于计划 P6）。其中数据分析页与分享页在当前生产构建中很可能白屏（顶层 `await import`），原生按设计重做，不复刻缺陷。

### 工作区与项目

| 编号 | 功能                                      | 现有入口                                                       | 分类     | 原生形态／原因                                                                                       |
| ---- | ----------------------------------------- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| W01  | 项目列表：最近项目、打开、移除列表项      | `views/WorkspacePage.vue:872-887`                              | 首版必需 | 系统列表、搜索、滑动操作；移除支持撤销或「最近删除」。                                               |
| W02  | 新建项目：5 个模板 + 名称／slug           | `components/CreateProjectModal.vue:36-67`                      | 首版必需 | 原生表单；项目写入 Documents，「文件」App 可见。                                                     |
| W03  | 快速开始、3 个比赛示例项目                | `WorkspacePage.vue:140-181`、`composables/useContestDemos.ts`  | 首版必需 | 并入模板库。当前 iOS 壳写入 IndexedDB 却从原生目录读取，项目打开为空，原生不复刻。                   |
| W04  | 打开本地文件夹                            | `WorkspacePage.vue:357-397`                                    | 首版必需 | 以「从『文件』原地打开」实现：安全作用域书签、`NSFileCoordinator`。                                  |
| W05  | 导入 `.zip`／`.advpkg`                    | `WorkspacePage.vue:508-552`                                    | 首版必需 | `fileImporter` 与分享面板「拷贝到」。当前实现无条件调用 `showDirectoryPicker`，iOS 不可用。          |
| W06  | 导出 `.advpkg.zip`、独立部署包            | `components/ProjectOverview.vue:541-611`                       | 首版必需 | 分享面板与 `fileExporter`，替代 `a.download`。                                                       |
| W07  | 项目设置：改名、描述、封面、复制 ID、移除 | `components/ProjectSettingsModal.vue`                          | 首版必需 | 原生表单；封面经相册选择器写入项目内而非 localStorage。                                              |
| W08  | 概览：12 张内容卡片、计数、最近活动       | `ProjectOverview.vue:358-867`                                  | 首版必需 | iPhone 列表、iPad 侧栏与网格。                                                                       |
| W09  | 校验、健康面板、跳转、自动修复            | `ProjectOverview.vue:177-306`、`components/ProjectHealthPanel` | 首版必需 | 诊断由引擎产生，跳转到文件、行、列。                                                                 |
| W10  | 文件浏览与任意文本文件编辑                | `WorkspacePage.vue:926-966`                                    | 首版必需 | 原生项目文件树、文本编辑、图片音频预览、重命名、复制、删除；当前只在桌面 Chromium 可用。             |
| W11  | 项目切换器                                | `components/ProjectSwitcher.vue`                               | 首版必需 | iPhone 返回列表；iPad 每窗口一个项目。                                                               |
| W12  | 云端同步：手动同步、逐文件冲突选择        | `ProjectOverview.vue:116-163`、`components/SyncConflictModal`  | 首版必需 | 沿用 `advjsAssets` 短期上传契约；同步失败不显示成功（当前会误报）。                                  |
| W13  | 从云端加载项目                            | `WorkspacePage.vue:431-504`                                    | 首版必需 | 待确认问题 2：下载为本地项目。                                                                       |
| W14  | 周期自动同步                              | `composables/useCloudSync.ts:354-396`                          | 暂不迁移 | Web 端只在设置变更时启动，生产中基本不生效；首版以手动同步与编辑后上传为准，后续按后台任务规则设计。 |
| W15  | 从 URL 加载                               | `WorkspacePage.vue:399-429`                                    | 暂不迁移 | 只保存 URL，从未读取，是存根。                                                                       |
| W16  | 首次引导浮层                              | `components/OnboardingOverlay.vue`                             | 暂不迁移 | 5 个步骤中 2 个目标已不存在；原生以空状态说明替代，TipKit 在 P7 评估。                               |
| W17  | 分享当前页面链接                          | `ProjectOverview.vue:503-536`                                  | 首版必需 | 改为规范 HTTPS 项目链接（见 M06），不再分享运行环境地址。                                            |

### 章节、编辑器与 Flow

| 编号 | 功能                                                       | 现有入口                                                  | 分类     | 原生形态／原因                                                           |
| ---- | ---------------------------------------------------------- | --------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| C01  | 章节列表：搜索、新建、删除、草稿恢复                       | `views/workspace/ChaptersPage.vue`                        | 首版必需 | 系统列表；草稿保存在本机并能从磁盘重建。                                 |
| C02  | 章节表单：文件名、标题、梗概、正文                         | `components/ChapterEditorForm.vue`                        | 首版必需 | 原生表单 + TextKit 2 编辑器。                                            |
| C03  | 全屏编辑器 `/editor`：自动保存、撤销重做、未找到文件引导   | `views/EditorPage.vue`                                    | 首版必需 | TextKit 2 编辑器；AdvScript 高亮、补全、输入辅助栏、查找替换、硬件键盘。 |
| C04  | 运行时创作面板：实时编译、程序、诊断、跳转、提示插入、预览 | `components/RuntimeAuthoringPanel.vue`、`AdvPreviewPanel` | 首版必需 | 引擎后台编译；iPad 侧栏，iPhone sheet。                                  |
| C05  | Flow 章节工作区：图、节点编辑、校验、保存、新建章节、试玩  | `ChaptersPage.vue`（Flow 模式）、`components/flow/*`      | 首版必需 | 原生图形绘制与表单；VoiceOver 替代列表。                                 |
| C06  | BGM 绑定到章节（Markdown 与 Flow）                         | `ChaptersPage.vue`、`utils/musicWorkflow.ts`              | 首版必需 | 从音频审核跳转并预览改动。                                               |
| C07  | 内容编辑器 Markdown 标签页（Monaco）                       | `components/ContentEditorModal.vue`                       | 首版必需 | 原生「表单／源文件」两种视图；共享同一编辑器组件。                       |
| C08  | AdvScript Monaco 语言注册                                  | `utils/advLanguage.ts`                                    | 暂不迁移 | 生产中无调用方；原生高亮另行实现并做一致性测试。                         |

### 内容管理

| 编号 | 功能                                                                    | 现有入口                                                                   | 分类     | 原生形态／原因                                                  |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| K01  | 角色 CRUD：基本信息、描述、属性面板四套模板与自定义字段、关系、语音档案 | `views/workspace/CharactersPage.vue`、`components/CharacterEditorForm.vue` | 首版必需 | 原生表单；未知 frontmatter 字段保留。                           |
| K02  | 角色头像与立绘上传、删除                                                | `CharacterEditorForm.vue:51-114`                                           | 首版必需 | 相册、拍照、「文件」与拖放；HEIC 转换；写入项目资源目录。       |
| K03  | AI 图像提示词复制                                                       | `CharacterEditorForm.vue:150-165`                                          | 首版必需 | 复制到剪贴板。图像生成本身无托管能力，不提供。                  |
| K04  | 角色导出 CSV（角色、关系）                                              | `CharactersPage.vue`、`utils/csvExport.ts`                                 | 首版必需 | 分享面板。                                                      |
| K05  | 角色分享：图片卡片、`.character.md`、复制信息                           | `utils/shareUtils.ts:24-95`                                                | 首版必需 | `ImageRenderer` 生成图片，分享面板。                            |
| K06  | 批量导入角色／场景（CSV、JSON、冲突策略）                               | `views/workspace/BatchImportPage.vue`                                      | 首版必需 | `fileImporter`；结果列表。                                      |
| K07  | 场景 CRUD、缩略图、关联地点、继承图像提示词                             | `views/workspace/ScenesPage.vue`                                           | 首版必需 | 修复滑动删除与空状态缺陷，不复刻。                              |
| K08  | 场景资源发布到云                                                        | `components/SceneCard.vue`、`utils/assetUpload.ts`                         | 首版必需 | 沿用 `advjsAssets` 契约；需要登录。表单补齐资源选择。           |
| K09  | 地点 CRUD、详情页、关系图                                               | `views/workspace/LocationsPage.vue`、`LocationDetailPage.vue`              | 首版必需 | 原生关系图，缩放、平移与 VoiceOver 列表；修复详情页丢字段问题。 |
| K10  | 知识库条目 CRUD、领域筛选                                               | `views/workspace/KnowledgePage.vue`                                        | 首版必需 | 文件协调替代 30 秒轮询。                                        |
| K11  | 知识库语义检索（embedding）                                             | `composables/useKnowledgeBase.ts:642-660`                                  | 暂不迁移 | 生产中 fail-closed，只有关键词检索。                            |

### 音频与配音

| 编号 | 功能                                                     | 现有入口                                                       | 分类     | 原生形态／原因                                                                |
| ---- | -------------------------------------------------------- | -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| A01  | 初始化音频目录                                           | `components/audio/AudioWorkspace.vue:160`                      | 首版必需 | 引擎生成目录结构。                                                            |
| A02  | 资源库：导入、元数据、搜索筛选、试听、删除               | `components/audio/AudioLibrary.vue`、`AudioAssetForm.vue`      | 首版必需 | 音频会话类别、离页与切后台停止；删除前确认。                                  |
| A03  | 音乐交接 brief：复制、下载 JSON、填入导入表单、打开 Suno | `components/audio/AudioMusicBrief.vue`                         | 首版必需 | 分享面板与 `openURL`。                                                        |
| A04  | 音乐审核：试听确认、批准、拒绝、绑定章节                 | `components/audio/AudioMusicReview.vue`                        | 首版必需 | 「我已试听」只在实际播放该资源后可勾选，与 Web 规则一致。                     |
| A05  | 混音器：总线增益、静音、独奏、闪避，保存                 | `components/audio/AudioMixer.vue`                              | 首版必需 | 原生滑块与开关。                                                              |
| A06  | 配音审核：A/B 对比、绑定或替换 take、陈旧处理、来源信息  | `components/audio/AudioVoiceReview.vue`                        | 首版必需 | —                                                                             |
| A07  | 高级盲听：候选、环境、评分、导出与恢复会话 JSON          | `components/audio/AudioAdvancedListening.vue`                  | 首版必需 | 导入导出经「文件」。                                                          |
| A08  | 旁白档案、发音词典                                       | `components/audio/AudioVoiceConfiguration.vue`                 | 首版必需 | —                                                                             |
| A09  | 托管配音任务：计划、排队、运行、取消、重试、自动导入     | `components/audio/AudioVoiceJobs.vue`、`useHostedVoiceJobs.ts` | 首版必需 | 待确认问题 1；按服务端 `configured` fail-closed。                             |
| A10  | Voice Design：候选、试听、注册、应用、付费预览确认       | `components/audio/AudioVoiceDesign*.vue`                       | 首版必需 | 待确认问题 1。                                                                |
| A11  | 音频发布：检查、审核、发布                               | `components/audio/AudioPublication.vue`                        | 首版必需 | 待确认问题 1；当前托管部署未配置时返回 `ADV_AUDIO_PUBLICATION_UNCONFIGURED`。 |
| A12  | 本地配音服务配对（`127.0.0.1:3389`）                     | `components/audio/AudioLocalConnection.vue`                    | 仅 Web   | 只在 Studio 自身由回环地址提供时出现，用于本机开发。                          |
| A13  | 离线私有配音任务                                         | `utils/voiceGenerationStore.ts`                                | 暂不迁移 | 生产中没有本地生成传输，只能计划不能执行。                                    |

### 托管 AI

| 编号 | 功能                                                             | 现有入口                                                                               | 分类     | 原生形态／原因                                                         |
| ---- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| I01  | 5 项创作能力：大纲、章节草稿、剧情建议、角色扮演模拟、一致性检查 | `components/OutlineGenerateModal.vue` 等、`packages/agent/src/capabilities/catalog.ts` | 首版必需 | Swift 实现 `@advjs/agent` 版本化协议，与 TypeScript 共用 fixture。     |
| I02  | 任务轨：状态、取消、重连、点数、错误码                           | `components/agent/ManagedAgentConsole.vue`、`ManagedAgentTaskRail.vue`                 | 首版必需 | iPad 侧栏、iPhone 底部面板；SSE 在切后台、断网、换网后续接或明确失败。 |
| I03  | 提案审阅：文件列表、逐文件 diff、应用、撤销、重新校验            | `components/agent/ManagedAgentProposalReview.vue`                                      | 首版必需 | 计划要求「逐项或整体应用」，原生补齐逐文件接受与拒绝。                 |
| I04  | AI 服务状态与点数页                                              | `views/settings/SettingsAiPage.vue`                                                    | 首版必需 | 只显示点数，不提供购买入口。                                           |
| I05  | 角色记忆与状态提取、自动地点追踪                                 | `utils/aiExtraction.ts:16-63`                                                          | 暂不迁移 | 生产中恒为 fail-closed。                                               |
| I06  | 托管图像生成                                                     | —                                                                                      | 暂不迁移 | 服务端未登记该能力。                                                   |

### 试玩

| 编号 | 功能                                                                | 现有入口                                               | 分类     | 原生形态／原因                                                                               |
| ---- | ------------------------------------------------------------------- | ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------- |
| P01  | 试玩：从项目开头或指定章节开始、章节切换、重开、回退一步            | `views/PlayPage.vue`、`components/GamePlayer.vue`      | 首版必需 | 全屏播放器（受限 WKWebView）；有未保存草稿时按计划 P4 提示。                                 |
| P02  | 跳到节点（创作预览）                                                | `components/NodeSelector.vue`                          | 首版必需 | 「从当前行开始」。                                                                           |
| P03  | 存档与读档                                                          | `components/SaveSlotModal.vue`、`LoadSlotModal.vue`    | 首版必需 | 原生存档槽，快照由播放器交出、原生落盘（已在探针验证）。合并 Studio 槽与游戏内存档两套体系。 |
| P04  | CG 画廊、故事统计                                                   | `components/CgGalleryModal.vue`、`StoryStatsModal.vue` | 首版必需 | 原生网格与统计。修复游戏内图库按钮跳转不存在路由的问题。                                     |
| P05  | 分支图                                                              | `components/BranchGraphModal.vue`（Mermaid）           | 首版必需 | 原生绘制，不使用 Mermaid。                                                                   |
| P06  | 运行时 Inspector：变量、舞台、trace、诊断、报告复制与导出、预览变量 | `components/RuntimeInspectorDrawer.vue`                | 首版必需 | 原生 sheet 或 iPad 侧栏；报告经分享面板导出。                                                |
| P07  | 游戏内界面：对话、自动、跳过、历史、快存快读、设置、静音            | `packages/client`（AdvGame）                           | 首版必需 | 播放器内现有 Runtime；游戏主题不影响原生界面。游戏内存档改由原生持有（见架构决策 2）。       |
| P08  | 官方插件活动：`star-map`、`civilization`                            | `utils/studioRuntimePlugins.ts`                        | 首版必需 | 随 App 发布，已在探针验证 `star-map`。                                                       |
| P09  | 分享当前页面、元素全屏                                              | `PlayPage.vue:224-237`                                 | 仅 Web   | 分享当前 URL 在设备上无效；全屏由原生呈现方式提供。                                          |

### 世界

| 编号 | 功能                                                   | 现有入口                                                     | 分类     | 原生形态／原因                                                             |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------- |
| R01  | 角色列表与关系图                                       | `views/WorldPage.vue`、`components/RelationshipGraph.vue`    | 首版必需 | 待确认问题 3：并入「角色与关系」视图。                                     |
| R02  | 角色资料页：外貌、性格、背景、关系                     | `views/CharacterInfoPage.vue`                                | 首版必需 | —                                                                          |
| R03  | 世界时钟、视角模式、玩家角色选择与本机自定义角色       | `WorldPage.vue`、`components/SelectPlayerCharacterModal.vue` | 暂不迁移 | 时钟无监听者，视角模式只过滤列表；自定义角色只存在 IndexedDB，不写入项目。 |
| R04  | 世界事件、时间线、CSV 导出、角色日记、情感状态与情感弧 | `WorldPage.vue`、`views/CharacterDiaryPage.vue`              | 暂不迁移 | 生成函数为 fail-closed 存根，生产中数据恒为空。                            |

### 市场、社区与分享

| 编号 | 功能                                                                 | 现有入口                                                               | 分类     | 原生形态／原因                                                                                      |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| M01  | 市场：浏览、搜索、排序、筛选、详情                                   | `views/workspace/MarketplacePage.vue`                                  | 首版必需 | 计划 P6。                                                                                           |
| M02  | 市场：安装为本地项目、发布、评论、回复、点赞、举报                   | `MarketplacePage.vue`、`components/marketplace/MarketPublishModal.vue` | 首版必需 | 写操作前检查登录；安装检查 ID 冲突。                                                                |
| M03  | 创作者主页、关注                                                     | `views/CreatorPage.vue`、`composables/useFollow.ts`                    | 首版必需 | 通用链接 `/creator/:uid` 可在 App 内打开。                                                          |
| M04  | 通知中心：未读数、全部已读、点击跳转                                 | `components/NotificationCenter.vue`                                    | 首版必需 | 应用内轮询；不做推送营销。                                                                          |
| M05  | 作品集：云端项目、绑定当前项目、公开／私有                           | `views/me/PortfolioPage.vue`                                           | 首版必需 | —                                                                                                   |
| M06  | 项目分享页 `/share/:projectId`、二维码、短链接生成与 `/s/:code` 解析 | `views/ProjectSharePage.vue`、`views/ShortLinkRedirectPage.vue`        | 首版必需 | 规范 HTTPS 地址 + 通用链接；二维码用 Core Image。当前分享页只读本机数据，需在 P6 定义公开分享语义。 |
| M07  | 创作者数据分析                                                       | `views/me/CreatorAnalyticsPage.vue`                                    | 首版必需 | 待确认问题 5。                                                                                      |
| M08  | 市场演示数据写入与清理（开发者选项）                                 | `views/me/DeveloperPage.vue`                                           | 暂不迁移 | 运营调试工具，不进入 App。                                                                          |

### 我的、设置与账号

| 编号 | 功能                                         | 现有入口                                                                | 分类     | 原生形态／原因                                                                  |
| ---- | -------------------------------------------- | ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| S01  | 云乐坊登录、登出、会话恢复、会话失效处理     | `views/LoginPage.vue`、`auth/*`                                         | 首版必需 | `ASWebAuthenticationSession`、Keychain；见架构决策 3。当前 iOS 壳中登录不可用。 |
| S02  | 账户卡片                                     | `views/MePage.vue`                                                      | 首版必需 | —                                                                               |
| S03  | 外观：浅色、深色、跟随系统                   | `views/settings/SettingsAppearancePage.vue`                             | 首版必需 | 默认跟随系统，App 内可覆盖。                                                    |
| S04  | 语言：English、简体中文                      | `views/settings/SettingsLanguagePage.vue`                               | 首版必需 | 使用系统「App 语言」设置，String Catalog。                                      |
| S05  | 云同步设置：项目根前缀、编辑后上传、测试连接 | `views/settings/SettingsCloudPage.vue`                                  | 首版必需 | 「上次同步」显示真实时间（当前恒为「从未同步」）。                              |
| S06  | 关于：版本、文档、GitHub                     | `views/settings/SettingsAboutPage.vue`                                  | 首版必需 | 版本取自 Bundle。                                                               |
| S07  | 隐私：说明、隐私政策                         | `views/settings/SettingsPrivacyPage.vue`、`views/PrivacyPolicyPage.vue` | 首版必需 | 隐私政策原生页面或 `SFSafariViewController`。                                   |
| S08  | 匿名遥测开关与队列清理                       | `utils/telemetry.ts`                                                    | 暂不迁移 | 待确认问题 4；遥测云函数不在仓库，首版不采集。                                  |
| S09  | 反馈（GitHub Issue）                         | `views/me/MeFeedbackPage.vue`                                           | 首版必需 | 打开外部链接。                                                                  |
| S10  | 清除本机数据                                 | `views/me/MeSettingsPage.vue:35`                                        | 首版必需 | 原生语义：清除偏好与缓存，不删除项目文件。                                      |
| S11  | 开发者选项：调试信息复制                     | `views/me/DeveloperPage.vue`                                            | 首版必需 | 关于页隐藏入口，导出诊断信息（脱敏）。                                          |
| S12  | 开发者选项：重载 App、清空存储并重载         | `DeveloperPage.vue:117-158`                                             | 仅 Web   | 原生无页面重载语义。                                                            |

### 全局外壳

| 编号 | 功能                                                | 现有入口                                        | 分类     | 原生形态／原因                                                     |
| ---- | --------------------------------------------------- | ----------------------------------------------- | -------- | ------------------------------------------------------------------ |
| G01  | 4 个一级入口：工作区、世界、试玩、我的              | `views/TabsPage.vue`                            | 首版必需 | iPhone `TabView`，iPad `NavigationSplitView`；世界见待确认问题 3。 |
| G02  | 离线提示                                            | `components/OfflineBanner.vue`                  | 首版必需 | `NWPathMonitor`。                                                  |
| G03  | 错误边界                                            | `components/ErrorBoundary.vue`                  | 首版必需 | 原生错误状态与重试；播放器异常转结构化诊断。                       |
| G04  | 自动恢复上次项目                                    | `stores/useStudioStore.ts:255-287`              | 首版必需 | 场景状态恢复。                                                     |
| G05  | 触感反馈                                            | `utils/capacitor.ts:75-97`（无调用方）          | 首版必需 | 新增，仅用于确认、选择和错误（计划 P7）。                          |
| G06  | PWA：Service Worker、更新提示、安装                 | `components/UpdatePrompt.vue`、`vite.config.ts` | 仅 Web   | App Store 负责更新。                                               |
| G07  | 客户端 OG meta                                      | `utils/ogMeta.ts`                               | 仅 Web   | 面向爬虫。                                                         |
| G08  | 宿主身份同步（`ylf:identityChanged`、`window.ylf`） | `main.ts:140-174`                               | 仅 Web   | 用于在云乐坊容器内嵌 Web Studio。                                  |

### 未注册页面与 BYOK 遗留（暂不迁移）

| 编号 | 页面或能力                                    | 原因                                                                                                      |
| ---- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| X01  | `ChatPage`（项目 AI 聊天）                    | 无路由，`/tabs/chat` 重定向到工作区；依赖 BYOK，生产构建守卫禁止打包。                                    |
| X02  | `CharacterChatPage`（角色一对一聊天）         | 无路由，`/tabs/world/chat/:id` 重定向到资料页；依赖 BYOK 与 TTS。                                         |
| X03  | `GroupChatPage`（群聊）                       | 无路由，无重定向；依赖 BYOK。                                                                             |
| X04  | `PlayerCreatorPage`（AI 创建玩家角色）        | 无路由，重定向到角色列表；依赖 BYOK 图像生成。                                                            |
| X05  | `ImportSourcePage`（素材→项目向导，PDF、URL） | 无路由，重定向到工作区；依赖 BYOK、`pdfjs-dist`、`@mozilla/readability`。                                 |
| X06  | 协作：房间、成员、邀请、只读角色              | 生产入口仅在内容编辑器 Markdown 标签的齿轮中，没有邀请链接；传输依赖 CloudBase 实时数据库。见架构决策 4。 |

现存指向这些路由的按钮（角色卡「聊天」、资料页「聊天」、「AI 创建角色」）在原生中不出现。

### 仅 Web 汇总

除上表已标注的条目，以下实现机制在原生中由系统能力替代，不单列功能：File System Access API 与「重新连接文件夹」、Monaco 及其 Web Worker、`y-monaco`、Mermaid、`modern-screenshot`、`a.download` 与 Blob URL、`navigator.share`、由 `window.location` 推导的链接、`beforeunload` 落盘、`matchMedia` 主题、Capacitor StatusBar 与 Keyboard 插件、`@vitejs/plugin-legacy` 构建。

### Web 渲染例外登记

无。分支图、关系图、地点图改用原生绘制；Markdown 文档预览使用 swift-markdown 解析后原生渲染。原生 App 中唯一的 Web 内容是游戏试玩画面。

## 架构决策

以下决策在 P0 实测后确定，补充计划中的「架构决策」，不替代其中条款。

### 1. 引擎接口

- **入口**：`AdvEngine.call(operation, inputJson) → Promise<responseJson>`，响应固定为 `{ ok, apiVersion, result | error }`。探针接口版本为 0，包含 `project.compile`、`project.playerConfig`、`project.applyPatches`、`chapter.parseAst`、`content.parse`、`content.stringify`、`assets.normalizeManifest`、`host.digest`、`engine.info`。P1 定稿为 v1。
- **宿主能力**：JavaScriptCore 只有 ECMAScript 与 Intl。共享模块实际用到 `TextEncoder`、`TextDecoder`、`crypto.subtle.digest('SHA-256')`、`structuredClone`、`crypto.getRandomValues`。前 4 项以纯 JavaScript 预置在引擎包最前面（构建时作为 banner，不受导入排序影响），结果与 Node 逐字节一致（含 CJK、emoji、孤立代理项和 7 万字长文本）；安全随机数由 Swift 以 `SecRandomCopyBytes` 注入。引擎不得使用 `URL`、`fetch`、定时器与 DOM，P1 的依赖闭包检查需拦截这些全局。
- **异常文本**：V8 与 JavaScriptCore 的运行时异常信息不同（探针首轮唯一差异即来自此）。接口先校验输入形状并返回稳定错误码，比较与展示只使用错误码。
- **异步**：JavaScriptCore 在控制权离开虚拟机时清空微任务队列，纯计算型 Promise 在 `invokeMethod` 返回前完成。宿主把「调用返回后仍未完成」视为错误，P1 保留这条断言。
- **线程与生命周期**：每个 `JSContext` 绑定一条串行队列，在后台加载，不阻塞首帧。冷加载（evaluate）41–82 ms（模拟器）。连续运行 160 个用例后进程内存从加载后约 44 MB 升至约 120 MB，释放上下文后不回落；P1 需改为按项目重建 `JSVirtualMachine`，并在真机上用 Instruments 定位，这是当前最大的性能风险。
- **项目配置**：引擎只接受文件快照，不执行 `adv.config.ts` 等模块配置（Node 端依赖 jiti）。原生 App 读写 `adv.config.json`；仅有模块配置的项目给出明确诊断，并提示在桌面 Editor 中迁移。`public/md/chapters/**` 旧布局按 CLI `compileRuntimeChapterFiles` 的映射处理，P1 将该映射下沉为共享函数。
- **包体**：未压缩 1.29 MB，压缩后 641 KiB（gzip 166 KB）。zod 占未压缩体积 43%，P1 评估 `zod/mini` 或按需导入。

### 2. 播放器宿主

- **单一来源**：页面与当前项目同在 `advjs-player://project/` 下。`/__player/**` 映射到 App 包内的播放器，其余路径映射到当前项目目录，项目内相对路径无需改写。WebKit 将该 scheme 视为安全上下文，`crypto.subtle` 可用。
- **路径约束**：解析符号链接后必须位于根目录内；拒绝 `..`、隐藏段（`.git`）和目录。WebKit 会先规范化 `..` 与 `%2e%2e`，处理器的约束作为纵深防御。探针中 4 种越界请求均返回 404，`fetch('https://example.com/')` 被 CSP 拦截。
- **iPad 用户代理**：iPad 上 WebView 以桌面 Safari（Macintosh）身份出现，iPhone 上冻结为 `iPhone OS 18_7`；播放器不得依赖 UA 判断设备，布局只看视口与指针能力。
- **媒体**：必须支持 `Range` 请求。WebKit 媒体栈对一首 129 KB 的 AAC 发出约 70 次 206 分段请求，P4 需对文件句柄做缓存。
- **数据存储**：使用 `WKWebsiteDataStore.nonPersistent()`。游戏内设置与游戏内存档写入 `localStorage`，关闭即丢失；P4 由原生持有存档与游戏设置，经桥接注入，并合并 Studio 存档槽与游戏内存档两套体系。
- **消息协议 v0**：原生→页面 `load`、`advance`、`choose`、`activity.complete`、`snapshot.request`、`restore`、`probe`、`pause`、`resume`；页面→原生 `ready`、`loaded`、`state`、`snapshot`、`restored`、`diagnostic`、`error`。页面只接收由引擎编译好的游戏配置，不接收凭据或文件路径。选项取自当前 `choices` 节点（不是 `state.choices`）。
- **音频解锁**：原生「试玩」点击视为用户手势，配合 `mediaTypesRequiringUserActionForPlayback = []`，`load` 时直接解锁音频。
- **导航**：只允许 `advjs-player://project` 内导航，其余取消；不开放窗口。P8 再加内容规则列表兜底拦截网络请求。
- iOS 26 起 SwiftUI 的 `WebPage` 也支持 URL scheme 处理器，P4 可评估替换 `WKWebView` 包装，接口不变。

### 3. 账号与登录

- **流程**：`ASWebAuthenticationSession` 打开 `https://www.yunle.fun/auth/sso`（PKCE S256、256 位 nonce）→ 回调 `https://studio.advjs.org/auth/native/callback#ylf_sso=…` → 校验 nonce 与 issuer → `POST https://api.yunle.fun/sso-ticket`（`exchangeSsoCode`）换取 CloudBase custom ticket → 原生调用 CloudBase 身份认证 HTTP 接口登录，令牌存 Keychain。
- **回调方式**：协议只接受 HTTPS 回调，不能用自定义 scheme（`readSsoRedirectUri` 拒绝非 HTTPS），也避免回调被其他 App 劫持。HTTPS 回调需要 `webcredentials` 关联域。
- **原生客户端**：登记独立的 `advjs-studio-ios` 客户端，不复用 `advjs-studio-web`，便于按平台撤销与审计。兑换接口目前绑定浏览器 `Origin`，而 `URLSession` 不发送 `Origin`；原生客户端需要按 RFC 8252 的原生应用规则改为以 PKCE、nonce 与精确回调地址绑定。
- **会话**：默认使用共享浏览器会话，用户在 Safari 已登录云乐坊时无需再次输入；提供「使用其他账号」时传 `prompt=select_account`。
- **CloudBase**：`@cloudbase/js-sdk` 3.8.0 没有暴露可直接复用的接口路径，P5 依据 CloudBase 身份认证 HTTP API 文档实现 custom ticket 登录与刷新，并确认是否需要在控制台登记移动应用安全来源。
- **App Review 4.8**：云乐坊是开发者自有账号体系，属于 4.8 的「仅使用自有账号系统」情形，P8 复核时记录依据。

### 4. 协作

首版暂不迁移，保留项目文件为唯一真源。未来路线：在 JavaScriptCore 中运行现有 Yjs（探针：Node 与 JavaScriptCore 互发二进制更新后文本一致，含 emoji），原生实现传输层。否决 Yrs Swift 绑定：会引入第二套 CRDT 实现，绑定成熟度不足，且收益只在 CRDT 层，而真正的阻塞点是 CloudBase 实时数据库传输（Web 端依赖 SDK 的 watch 协议）与没有邀请入口的产品形态。

### 5. 托管 AI 客户端

维持计划默认：Swift 实现 `@advjs/agent` 的版本化协议，SSE 用 `URLSession.bytes(for:)` 处理。P0 未发现在 JavaScriptCore 中运行 `AgentRuntime` 更可靠的证据：它依赖 `fetch` 与流式读取，JavaScriptCore 中都需要宿主桥接。协议契约测试与 `@advjs/agent` 共用 fixture。

### 6. 平台与工程

| 项目         | 决定                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 最低系统版本 | iOS／iPadOS 26.0。Apple 2026 年 6 月数据：iOS 26 占全部兼容 iPhone 的 79%、近 4 年机型的 86%；iPadOS 26 为 68% 与 79%。可直接使用 TextKit 2 与 SwiftUI 的新文本编辑、`WebPage`、当前系统材质；支持 iPhone 11 及之后机型。 |
| Swift        | Swift 6 语言模式，`SWIFT_STRICT_CONCURRENCY = complete`。探针在该配置下零警告构建。                                                                                                                                       |
| 工程组织     | 提交 `.xcodeproj`，使用 Xcode 文件夹同步（buildable folders）加本地 Swift Package（`StudioKit`、`StudioUI`）。不引入 XcodeGen 或 Tuist；探针为快速生成使用 XcodeGen，只限 `spike/`。                                      |
| CI runner    | GitHub-hosted `xcode-27`（Apple Silicon，macOS 27，2026-10-15 GA）。固定 Xcode 版本；最低版本回归需要 iOS 26 模拟器运行时，镜像是否预装待 P8 核实。                                                                       |
| 参考实机     | iPhone 15 Pro（iPhone16,1，已在本机配对记录中出现，当前未连接）；iPad 型号待用户提供。建议另备一台 A13–A14 iPhone 作为低端预算基线。                                                                                      |
| Bundle ID    | 沿用 `org.advjs.studio`。Apple Team 待确认；云乐坊现有 App 使用 Team `QT792GAY4C`。                                                                                                                                       |

## Capacitor 分发与数据迁移

仓库证据：`apps/studio/ios` 未设置 `DEVELOPMENT_TEAM`，版本保持 1.0（1），`RELEASE.md` 清单未勾选，`ios-templates/` 的合规键与隐私清单未合入工程，`ios/` 目录自 2026-06-08 起只有图标类提交。据此判断该壳从未签名上传。

若用户在 App Store Connect 确认无构建记录，N12 记为「不适用」，P2 不实现迁移。若有构建，迁移按计划执行：同一 Bundle ID 的新 App 直接继承 `Documents/advjs/{projectId}`；`localStorage` 与 IndexedDB 位于 `capacitor://localhost` 源的 WebKit 存储中，需要在首次启动时以同源 `WKWebView` 读出后转存。

## 服务端与账号依赖

以下事项都需要用户决定或操作，P0 只记录证据，未修改任何线上配置。

| 依赖                                                      | 现状（2026-10-21 实测）                                                                                 | 需要的变更                                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio.advjs.org/.well-known/apple-app-site-association` | 返回 SPA 的 `text/html`，不是 AASA。站点由 Cloudflare Pages 项目 `advjs-studio`（生产分支 `dev`）提供。 | 发布 JSON（无重定向，`application/json`）：`webcredentials.apps` 含 `<TEAMID>.org.advjs.studio`；P6 再加 `applinks`（`/share/*`、`/s/*`、`/creator/*`）。 |
| 云乐坊 SSO 客户端登记                                     | 已登记 `advjs-studio-web`（3 个 HTTPS 源）。                                                            | 新增 `advjs-studio-ios`，回调 `https://studio.advjs.org/auth/native/callback`，scope `identity:bootstrap`，appId `advjs-studio`。                         |
| `sso-ticket` 兑换策略                                     | 文档写明校验 `Origin`；原生请求不带 `Origin`。                                                          | 为原生客户端放行无 `Origin` 请求，仍校验 PKCE、nonce、回调地址、scope 与 TTL。                                                                            |
| 回调页面                                                  | `/auth/native/callback` 不存在。                                                                        | Web Studio 增加回落页面（未安装 App 或会话已结束时提示返回 App），不消费授权码。                                                                          |
| Apple Developer                                           | Bundle ID 归属、Team、Associated Domains 能力未知。                                                     | 在 Team 中启用 `org.advjs.studio` 的 Associated Domains，并在本机 Xcode 登录。                                                                            |
| CloudBase                                                 | Web 端依赖安全域名与 `VITE_TCB_ACCESS_KEY`。                                                            | 确认原生 HTTP 调用所需的移动应用来源登记与访问密钥。                                                                                                      |
| App Store Connect                                         | 未核实。                                                                                                | 核实 `org.advjs.studio` 是否有构建记录（决定 N12）。                                                                                                      |

## 否决方案

| 方案                                | 否决原因                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| 播放器使用本地 HTTP 服务            | 需要监听端口与 ATS 例外，其他 App 可访问；scheme handler 已满足离线与分段读取。 |
| 在 `WKWebView` 中嵌入云乐坊登录页   | 无法共享 Safari 会话，页面可被宿主注入脚本，违反 OAuth 原生应用最佳实践。       |
| 自定义 scheme 作为 SSO 回调         | 协议拒绝非 HTTPS 回调，且自定义 scheme 可被其他 App 抢注。                      |
| Swift 重写 AdvScript 解析或项目格式 | 计划明确禁止；引擎一致性已验证。                                                |
| Yrs Swift 绑定实现协作              | 见架构决策 4。                                                                  |
| XcodeGen／Tuist 生成正式工程        | 增加 CI 与本机工具依赖；Xcode 文件夹同步已解决 pbxproj 合并问题。               |

## 风险与真机待验

- JavaScriptCore 内存增长与回收（架构决策 1），需真机 Instruments。
- 冷启动与首帧：iPhone 模拟器中打开播放器到首个节点 1.06–1.43 s，iPad 模拟器开机后首次打开 3.92 s，均含 WebContent 进程启动；预算 2.0 s 需真机测量，P4 评估预热播放器进程。
- WebContent 进程内存不计入 App 进程，需 Instruments 分进程记录关闭试玩后的回落。
- 最低系统版本 iOS 26 尚未运行：本机只有 iOS 27.0 与 18.3 模拟器运行时。
- 登录端到端依赖上节全部变更，完成后需在真机走通并换取 CloudBase 会话。
