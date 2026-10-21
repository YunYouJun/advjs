# Studio iPhone／iPad 原生 App 实施计划

日期：2026-10-21。

状态：待启动。本文为计划，不代表任何阶段已完成；验收证据记录于 `docs/reports/studio-native-ios-acceptance.md`（由 P0 创建）。

执行交接：[执行提示词](./2026-10-21-studio-native-ios-handoff)。

## 完成目标（实施 Goal）

交付 iPhone 与 iPad 上的 SwiftUI 原生 ADV.JS Studio，以同一 Bundle ID `org.advjs.studio` 取代当前 Capacitor iOS 壳。作者可见的界面全部由 SwiftUI 与系统组件实现；解析、编译、诊断与项目内容读写复用现有 TypeScript 实现，在 JavaScriptCore 中无界面运行；游戏试玩在受限 WKWebView 中运行现有 Runtime。功能覆盖 P0 盘点出的全部生产可达 Studio 能力，项目文件与 Web Studio、桌面 Editor 双向兼容，已有 Capacitor 安装的数据可迁移。以实机体验指标（启动、滚动、输入延迟、内存）和系统集成（文件 App、分享、相册、通用链接、多窗口、硬件键盘、无障碍）验收，最终上传 TestFlight 内部测试构建，补齐自动化测试、CI、文档与 Capacitor iOS 退役说明，仅提交推送本任务改动。

完成是指下方验收表 N1–N16 均有真实证据。模拟器通过、构建成功、截图像原生，都不能替代实机验收。必需验收与提交推送全部完成前，不能标记 Goal complete。

## 为什么选择 SwiftUI 原生

审计（2026-10-21，基于 `dev` 工作区）显示当前 Capacitor 壳的问题不是个别样式，而是平台能力缺位：

- 首屏前预加载约 3.39 MB JS／CSS，`dist/` 共 23 MB；Monaco 及其 worker 超过 13 MB，CloudBase SDK 静态进入入口块。
- iOS 上的文件浏览依赖 `showDirectoryPicker`（`apps/studio/src/views/WorkspacePage.vue:927`），原生项目无法浏览文件；ZIP 导入在 `WorkspacePage.vue:521` 无条件调用桌面 Chromium API。
- 导出依赖 8 处 `a.download`；分享依赖 Web Share API；分享链接由 `window.location` 生成，在设备上会得到 `capacitor://` 地址。
- SSO 只匹配 HTTPS origin（`apps/studio/src/auth/sso-config.ts:60`），原生壳内登录不可用。
- 触感反馈函数没有调用方；`@capacitor/app` 没有生命周期、深链监听；键盘无输入辅助栏；144 条 `:hover` 规则没有 `(hover: hover)` 保护。
- `ios/App/App/Info.plist` 未合并 `ios-templates/` 中的合规键，`PrivacyInfo.xcprivacy` 未加入工程；Studio 测试不在 CI 中运行。

继续打磨 WebView 可以修正上述问题，但滚动物理、文本编辑、多窗口、拖放、菜单栏与无障碍的上限受 WebView 限制。本计划以最佳体验为目标，接受更大的工作量和两套界面（Web Studio 与原生 Studio）的长期维护成本。

## 范围与首版边界

- **平台：** iPhone 与 iPad 为首版完成门槛。最低系统版本在 P0 根据目标用户与 API 需求确定，建议 iOS／iPadOS 26。Mac（Catalyst 或原生 macOS）、visionOS、watchOS 不在本计划内。
- **Android：** 不在本计划内。Android 继续沿用 Vue Studio 与 Capacitor 路线，是否改用 Compose 另行立项；本计划不得为 iOS 删除 Android 可复用的 Web 能力。
- **Web Studio 保留。** `apps/studio` 继续作为 Web／PWA 产品发布。共享逻辑下沉后 Vue Studio 改用同一实现，行为不得回退。
- **界面全部原生。** 原生 App 不嵌入 Vue Studio 页面作为过渡。唯一的 Web 内容是游戏试玩画面，以及经 P0 评估、确实无法原生实现的只读渲染（如 Mermaid 图），需在规格中逐项登记理由。
- **引擎不重写。** Parser、Compiler、Linker、诊断、frontmatter 序列化和资源目录使用现有 TypeScript 实现。Swift 侧不维护第二份 AdvScript 语法或项目格式解析器；纯显示用途的轻量词法高亮除外，且必须有与引擎一致性的测试。
- **功能对齐以生产可达为准。** P0 从当前路由、导航入口、服务端能力登记和 fail-closed 开关中整理功能清单。未注册路由的页面（`ChatPage`、`CharacterChatPage`、`GroupChatPage`、`PlayerCreatorPage`、`ImportSourcePage`）以及托管能力尚未开放的功能，记为「暂不迁移」，并保留扩展点，不能因代码存在就算作对齐范围。
- **项目格式不变。** 项目以 `adv/` 目录为唯一真源，与 Web Studio、桌面 Editor、CLI 互通。原生 App 不引入私有存档格式；App 本地索引（最近项目、偏好、存档槽等）必须能从磁盘重建或明确标注为本机数据。
- **代码执行边界不变。** 只执行随 App 发布、经审核的官方插件（当前为 `star-map@1.0.0`、`civilization@1.0.0`），不下载或执行项目携带的脚本，同时满足 App Review 2.5.2。
- **不新增服务端产品能力。** 登录回调、通用链接所需的服务端配置属于本计划依赖，需记录变更和验证；托管 AI 能力、价格、模型仍由服务端登记，App 不内置 Provider key。
- **不包含：** App 内购买点数、推送营销、广告、跨 App 追踪、Mac 版、Android 原生版。

## 已核实的代码基线

实施前以当时的 HEAD 和工作区重新核对。工作区包含其他会话的未提交修改（桌面客户端、文档站首页等），必须保留，不能重置或混入本任务提交。

| 现有入口                                                                          | 与本计划的关系                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/studio/src/router/index.ts`                                                 | 功能盘点起点：4 个 Tab、约 40 个路由，栈深最多 3 层；`/editor`、`/share/:projectId`、`/s/:code`、`/creator/:uid` 位于 Tab 之外。                                                                                        |
| `apps/studio/src/utils/{chapter,scene,location,audio}Md.ts`、`packages/character` | 内容 frontmatter 解析与序列化。需要下沉为平台无关模块，供 Vue Studio 和原生引擎共用，并保留未知字段。                                                                                                                   |
| `apps/studio/src/utils/fs/*`                                                      | `IFileSystem` 及 Browser／Capacitor／Memory 适配器。Capacitor 项目位于 `Documents/advjs/{projectId}`，迁移时需要读取。                                                                                                  |
| `apps/studio/src/stores/useStudioStore.ts`、`src/utils/db.ts`                     | 项目列表存于 `localStorage`；聊天、存档槽、memfs 等存于 Dexie（IndexedDB）；协作使用 `y-indexeddb`。                                                                                                                    |
| `packages/core`（`runtime`、`compiler`、`authoring`、`project/*` 子入口）         | 已有无界面运行时、编译器和可移植的 Flow 创作契约，是 JavaScriptCore 引擎包的首选依赖。`packages/parser`、`packages/assets`、`packages/agent` 的 `src/` 不引用 `node:` 模块，但传递依赖（如 `to-vfile`）需要在 P0 实测。 |
| `packages/agent`                                                                  | 托管 AI 协议、SSE 恢复、任务状态机与提案审阅。原生客户端必须与其协议版本一致。                                                                                                                                          |
| `packages/client`、`apps/studio/src/components/GamePlayer.vue`                    | 试玩 Runtime 与 Pixi 渲染。当前与 Studio 共用 DOM，原生方案需要独立打包的播放器页面。                                                                                                                                   |
| `apps/studio/ios/`                                                                | Capacitor 8 SPM 工程，部署目标 15.0，无自定义 Swift 代码、无 entitlements。切换前保留用于对照，切换后退役。                                                                                                             |
| `apps/studio/ios-templates/`、`RELEASE.md`、`CAPACITOR.md`                        | 合规键、隐私清单和 TestFlight 流程可以复用，切换后需要更新为原生工程说明。                                                                                                                                              |
| `vitest.config.ts:33`、`.github/workflows/`                                       | 根 Vitest 排除 `apps/studio/**`；目前 Studio 只有 Pages 构建检查，没有 iOS CI。                                                                                                                                         |

## 架构决策

建议目录：

```text
apps/studio-ios/
├── package.json            私有 workspace 包 @advjs/studio-ios，统一 build/test 脚本
├── engine/                 TypeScript 入口，打包为 JavaScriptCore 可加载的单文件
├── player/                 TypeScript 入口，打包为 WKWebView 内的离线播放器页面
├── StudioApp/              SwiftUI App 目标（iPhone + iPad）
├── Packages/
│   ├── StudioKit/          领域模型、项目存储、引擎桥、服务客户端（无 UI）
│   └── StudioUI/           可复用 SwiftUI 组件、设计 token
└── Tests/                  Swift Testing 单测、XCUITest 流程、性能测试
```

```text
SwiftUI 界面（全部作者界面）
  └─ StudioKit
       ├─ ProjectStore：文件读写、文件协调、外部变更、事务与撤销
       ├─ EngineBridge → JavaScriptCore（engine.js：解析／编译／诊断／序列化）
       ├─ PlayerHost → WKWebView（player：Runtime + Pixi，经 scheme handler 读当前项目）
       ├─ AccountClient：ASWebAuthenticationSession + Keychain
       └─ AgentClient：托管 AI 协议、SSE 恢复、提案审阅
```

1. **引擎是有版本的消息接口。** `engine.js` 导出少量 JSON 进出的操作：打开项目（接收文件快照或按需读取回调）、编译与诊断、内容解析／序列化、资源目录规范化、提案应用预演。接口带版本号，Swift 侧不调用引擎内部函数。JavaScriptCore 不提供 `fetch`、定时器和 DOM；引擎不依赖它们，需要的宿主能力由 Swift 显式注入。引擎在后台线程或专用队列加载，不阻塞首帧。
2. **一致性靠同一组 fixture。** 引擎操作在 Node（Vitest）和 JavaScriptCore（Swift Testing）中运行同一组 golden 项目，输出 JSON 逐字节比较。共享模块的任何修改都要通过两侧测试。
3. **共享逻辑下沉，不复制。** `apps/studio/src/utils/*Md.ts`、项目校验、资源目录等平台无关逻辑迁到 `packages/` 中已有的合适位置（优先 `@advjs/core` 的项目子入口或 `@advjs/assets`），Vue Studio 改为引用共享实现。不新建平行的内容模型。
4. **项目存储以文件为真源。** App 内项目位于 Documents 下，在「文件」App 中可见（`UIFileSharingEnabled`、`LSSupportsOpeningDocumentsInPlace`）。iCloud Drive 或其他提供者中的项目通过安全作用域书签原地打开，使用 `NSFileCoordinator`／`NSFilePresenter` 处理外部修改。保存采用临时文件加原子替换；跨文件操作提供失败清理或可恢复状态，不宣称天然多文件原子性。
5. **播放器与创作宿主隔离。** 播放器页面和项目资源经 `WKURLSchemeHandler` 从 App 包和当前项目目录读取，不启动本地 HTTP 服务。只开放当前项目的只读路径和有限的类型化消息（加载程序、起点、快照、存档、事件、诊断）；不注入账号凭据，不暴露任意文件路径，导航限制在播放器 scheme 内。
6. **账号与 AI 走原生网络栈。** 登录使用 `ASWebAuthenticationSession`，回调优先使用通用链接；令牌存入 Keychain。托管 AI 由 Swift 实现 `@advjs/agent` 的版本化协议，SSE 恢复覆盖切后台、断网、换网络（`NWPathMonitor`）场景。协议契约测试使用与 `@advjs/agent` 相同的 fixture。若 P0 证明在 JavaScriptCore 中运行 `AgentRuntime` 更可靠，必须在规格中写明理由及流式桥接方式，二选一，不保留两套。
7. **界面遵循系统规范，品牌通过强调色体现。** 使用 `TabView`（iPhone）和 `NavigationSplitView`（iPad）、系统列表、表单、工具栏、菜单、搜索和 sheet，采用当前系统材质与动效。「紫幕金章」通过 Asset Catalog 中的强调色、App 图标和空状态插画表达，不用自绘控件模仿 Ionic。规则写入新的原生设计规范（P2），游戏画面仍遵循[游戏 UI 规范](/about/design/game-ui)。
8. **工程文件可合并。** 使用 Xcode 的文件夹同步（buildable folders）加本地 Swift Package，避免手工维护大量 pbxproj 条目。是否引入 XcodeGen／Tuist 在 P0 根据 CI 与多人协作需求决定，只保留一种方式。第三方 Swift 依赖必须锁定版本并记录用途，如 YAML 或 ZIP 库；引擎已经覆盖的格式能力不再引入 Swift 库重复实现。

## 分阶段任务

### P0：基线、功能盘点与可行性

- [ ] 记录分支、upstream、已有改动与基线检查结果；阅读根目录和 `apps/studio` 的 AGENTS、Studio 设计规范、本计划，创建验收报告骨架。
- [ ] 整理功能清单：逐个路由、Tab、弹窗入口和托管能力，标记「首版必需／暂不迁移（附原因）／仅 Web」。清单写入 `docs/specs/2026-10-21-studio-native-ios-design.md`，作为 N2 的对照依据；用户确认后锁定。
- [ ] 引擎可行性：打包 parser、core compiler、内容序列化与资源目录为单文件，在 iOS 真机 JavaScriptCore 中运行 golden 项目（含 `public/md/chapters/**` 兼容布局与仓鼠示例），与 Node 输出逐字节比较；记录加载耗时、编译耗时和内存。
- [ ] 播放器可行性：独立打包播放器，在 WKWebView 中经 scheme handler 离线运行带立绘、BGM、选择支和官方插件的项目，验证消息桥、存档快照往返和媒体生命周期。
- [ ] 登录可行性：在真机上用 `ASWebAuthenticationSession` 完成云乐坊 SSO 并换取 CloudBase 会话；列出需要的服务端配置（回调地址、Associated Domains 的 `apple-app-site-association`），区分已具备和需要变更的部分。
- [ ] 确定最低系统版本、Swift 语言模式、工程组织方式、CI runner（需要带 Xcode 与 iOS 模拟器的 macOS 镜像）、参考实机型号（至少一台 iPhone、一台 iPad）。
- [ ] 核实现有 Capacitor 构建是否分发过（App Store Connect 构建记录）。若分发过，验证迁移路径：读取 `Documents/advjs/*`，以及在 `capacitor://localhost` 源的 WKWebView 中读出 `localStorage`／IndexedDB 数据。
- [ ] 评估协作（Yjs 与 Yrs Swift 绑定的互通）是否在首版范围内，结论写入规格。

交付：设计规格（含功能清单、架构决策与否决方案）、可行性日志与实测数据。可行性不成立时先调整方案并取得用户确认，不能带着未验证的假设进入 P1。

### P1：共享层下沉与引擎包

- [ ] 将内容解析／序列化、项目校验、资源目录规范化等平台无关逻辑从 `apps/studio/src/utils/` 下沉到共享包；Vue Studio 改为引用共享实现，相关单测与 E2E 不回退。
- [ ] 建立 `apps/studio-ios/engine`：版本化 JSON 接口、错误归一、结构化诊断（文件／行／列），以及构建产物大小和依赖闭包检查（不含 Vue、DOM、Node 模块）。
- [ ] 建立 Node 与 JavaScriptCore 双端 golden 测试，覆盖未知 frontmatter 字段、正文、ID、立绘、关系、资源 `includes` 的读写往返。
- [ ] 将 Studio 单测纳入 CI（或新增独立 job），避免共享层修改只在原生侧验证。

交付：引擎包、双端一致性测试、Vue Studio 回归记录。

### P2：原生骨架、设计规范与项目管理

- [ ] 创建 SwiftUI App、`StudioKit`、`StudioUI` 和测试目标；接入 String Catalog（简体中文、英文），术语与现有 `i18n/locales` 保持一致。
- [ ] 新增原生设计规范（建议 `docs/about/design/studio-native.md`），说明系统组件优先、强调色与品牌资产、字体随动态字体、动效与触感反馈的使用场景，以及与 Ionic 版规范的关系；在根目录和 `apps/studio-ios` 的 AGENTS 中添加指向它的简短规则。
- [ ] iPhone 使用 Tab 结构，iPad 使用三栏 `NavigationSplitView`；支持多窗口（每个窗口一个项目）、场景状态恢复、iPad 菜单栏命令与常用快捷键（新建、保存、查找、运行、切换面板）。
- [ ] 项目管理：列表、搜索、模板新建、重命名、删除（可撤销或移到最近删除）、从「文件」原地打开、导入 ZIP／文件夹、经分享面板或 `fileExporter` 导出 ZIP 与独立部署包。
- [ ] 外部修改：文件协调与去抖刷新；遇到未保存草稿时保留双方内容并让作者选择。
- [ ] Capacitor 数据迁移（若 P0 确认需要）：首次启动扫描旧项目目录并重建列表，迁移存档槽等本机数据；迁移可重复执行且不覆盖新数据，失败时保留原数据并提示。

交付：模拟器与实机上的项目生命周期证据、iPad 多窗口截图、外部修改与冲突处理记录。

### P3：内容创作

- [ ] 角色、场景、地点、音频，以及 P0 清单中的其他内容类型：原生列表（滑动操作、上下文菜单、搜索、排序、拖放）和原生表单；保存失败保留草稿，不显示成功。
- [ ] 图片：相册选择器、拍照（如清单需要）、从「文件」或其他 App 拖入；导入时复制到项目资源目录并写相对路径，重名、替换、缺失资源给出明确结果，并处理 HEIC 与尺寸。
- [ ] 音频：导入、元数据编辑、试听／暂停／拖动进度；配置音频会话类别，离页、切后台和切换项目时停止播放。
- [ ] 章节编辑器：基于 TextKit 2 的原生编辑器，提供 AdvScript 高亮、实时诊断标注（编译去抖，在后台执行）、角色与场景引用补全、键盘上方输入辅助栏（快捷插入）、查找替换、撤销重做、硬件键盘快捷键、大文件流畅滚动。
- [ ] 程序结构与诊断面板：点击节点或诊断跳转到对应文件、行和列；跨章节跳转保留编辑位置。
- [ ] 关系图、地点图等可视化使用原生绘制，支持缩放、平移与 VoiceOver 替代列表。

交付：磁盘 diff 证据（字段与正文往返）、输入延迟和滚动的 Instruments 记录、VoiceOver 走查记录。

### P4：试玩与调试

- [ ] 播放器以全屏方式呈现，按游戏设置支持横屏，自动隐藏 Home 指示条；可从项目开头、当前章节或当前行开始，有未保存草稿时提示「保存并试玩」或「以草稿试玩」，行为在规格中定义。
- [ ] 存档槽、读档、重开与原生确认交互；Inspector（变量、舞台、选择、checkpoint、trace、诊断）以原生 sheet 或 iPad 侧栏呈现，调试报告可经分享面板导出。
- [ ] 关闭播放器后释放 WebView 与媒体；切后台暂停；播放器内异常转为结构化诊断，不导致 App 崩溃。
- [ ] 验证官方插件 renderer、立绘、BGM、对白、选择支在离线状态下工作正常，且游戏主题不影响原生界面。

交付：断网试玩录屏、内存曲线、存档往返证据。

### P5：账号、托管 AI 与云端能力

- [ ] 登录、退出、会话恢复和失效处理；令牌只存 Keychain，不写日志。若 P0 确认登录方式触发 App Review 4.8，按规定补充登录选项。
- [ ] 托管 AI：P0 清单中开放的创作入口、全局任务轨、点数显示、取消与失败恢复；SSE 在切后台、锁屏、断网恢复后续接或明确失败。评估用实时活动（Live Activity）展示长任务进度。
- [ ] 提案审阅：原生 diff 视图，逐项或整体应用，经 ProjectStore 事务写入并可撤销；未确认的候选不写入项目。
- [ ] 云端资源发布、音频与配音任务等清单内能力，沿用现有服务端契约（如 `advjsAssets` 短期上传流程），不在客户端持有永久密钥。
- [ ] App 内只显示点数，不提供购买入口或外部购买引导；如需售卖，另行立项评估 App 内购买。

交付：真实环境（非 mock）的登录、AI 任务、恢复与提案应用证据；mock 与真实环境的结果分开记录。

### P6：分享、社区与协作

- [ ] 分享链接统一使用规范的 HTTPS 域名，不再从运行环境 origin 推导；配置通用链接，`/share/:projectId`、`/s/:code`、`/creator/:uid` 可在 App 内直接打开，未安装时回落到 Web。
- [ ] 系统分享面板、二维码和分享卡片图片生成使用原生实现。
- [ ] 市场、作品集、创作者主页、数据分析等 P0 清单中的社区能力。
- [ ] 协作：P0 判定可行时，实现与 Web 端 Yjs 文档互通的协作同步，覆盖双客户端收敛、断线恢复和权限拒绝；判定不可行时记录原因和替代方案，不能静默缺失。

交付：通用链接实机证据、跨端（iOS 与 Web）分享和协作证据。

### P7：体验打磨与系统集成

- [ ] 性能：按下方预算用 Instruments 和 XCTest 性能指标测量，回归测试进入 CI；引擎与播放器延迟加载，首帧不等待网络。
- [ ] 无障碍：动态字体（含辅助功能字号）、VoiceOver、减弱动态效果、增强对比度、深色模式；核心流程全部可由 VoiceOver 完成。
- [ ] 触感反馈只用于有意义的确认、选择和错误，遵循设计规范。
- [ ] 系统集成：Spotlight 索引项目与角色，App Intents 与快捷指令（打开项目、新建章节、开始试玩），主屏幕小组件（最近项目）为可选项，需在规格中确认后实施。
- [ ] iPad：指针悬停效果、拖放跨 App、键盘快捷键提示、台前调度与分屏下各尺寸布局。

交付：性能报告、无障碍走查、iPad 各尺寸截图。

### P8：发布、切换与收尾

- [ ] 合规：`Info.plist` 用途说明、`ITSAppUsesNonExemptEncryption`、`PrivacyInfo.xcprivacy`、entitlements（Associated Domains、Keychain 共享等仅按需添加）；逐项复核 App Review 2.5.2、3.1.1、4.8、5.1。
- [ ] CI：新增 iOS workflow，构建引擎与播放器、运行 Swift 测试和关键 XCUITest、检查产物大小；与现有 CI 门禁规则保持一致。
- [ ] 发布：版本号与构建号规则、Archive、上传 TestFlight 内部测试；签名与 App Store Connect 权限需要用户在本机 Xcode 中提供，缺失时记录为阻塞，不绕过。
- [ ] 切换：原生 App 通过验收并取得用户确认后，停止从 `apps/studio/ios` 分发；删除或归档 Capacitor iOS 工程需要用户确认。更新 `CAPACITOR.md`、`RELEASE.md`、[Studio 开发路线](/guide/studio/roadmap)、Studio 指南与 AGENTS；Android 与 Web 说明保持有效。
- [ ] 复核本任务 diff，按 Conventional Commits 分阶段提交并推送合适分支。逐文件或逐 hunk 暂存，不全量暂存既有脏工作区；不 force push，核验推送后的提交 SHA。

## 体验预算

预算在 P0 用参考实机测得基线后可以调整，调整须写明理由。测量使用 Release 构建与真机，模拟器数据只用于回归趋势。

| 指标                   | 目标                                                 |
| ---------------------- | ---------------------------------------------------- |
| 冷启动到项目列表可交互 | ≤ 1.0 s（参考 iPhone）                               |
| 打开 50 章项目到可编辑 | ≤ 1.5 s；引擎首次加载不阻塞主线程                    |
| 章节编辑输入           | 连续输入无掉帧；诊断刷新延迟 ≤ 500 ms                |
| 500 项列表滚动         | 无可感知卡顿（Instruments hitch 比例达到「良好」档） |
| 打开试玩到首帧         | ≤ 2.0 s（本地资源项目）                              |
| 关闭试玩后内存         | 回到打开前基线的 +20 MB 以内                         |
| App 包体               | 记录基线并在 CI 中设上限，增长需说明                 |

## 必须留下证据的验收表

| 编号 | 操作                                                                              | 通过条件                                                                                                      |
| ---- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| N1   | 实机安装 TestFlight 构建，冷启动并浏览全部一级入口                                | 无白屏、无崩溃；作者界面中没有 Web 控件；符合体验预算。                                                       |
| N2   | 对照 P0 功能清单逐项操作                                                          | 「首版必需」全部可用；「暂不迁移」项有原因和入口策略，不出现失效链接或空页面。                                |
| N3   | 同一项目在 iOS、Web Studio、桌面 Editor 之间往返编辑                              | 文件逐字节一致或差异符合规格；未知字段与正文保留；诊断结果一致。                                              |
| N4   | 创建、编辑、删除角色／场景／地点／音频，导入替换立绘与音频                        | 磁盘格式正确；失败不报成功；资源字节完整；重开后结果一致。                                                    |
| N5   | 用章节编辑器完成一章：补全、诊断跳转、查找替换、撤销，接硬件键盘重复一次          | 输入流畅，诊断准确定位，快捷键与输入辅助栏可用。                                                              |
| N6   | 断网试玩含立绘、BGM、选择支和官方插件的项目，存读档后关闭                         | 玩法正常；媒体在离开或切后台时停止；内存回落；原生界面不受游戏主题影响。                                      |
| N7   | 从「文件」App 原地打开 iCloud Drive 项目，在其他设备或 Web 端修改，并制造草稿冲突 | App 刷新；冲突可选择；草稿不丢；书签失效时可恢复。                                                            |
| N8   | 登录、发起 AI 任务后切后台、锁屏、断网再恢复，审阅并应用提案后撤销                | 任务续接或明确失败；点数显示一致；未确认内容不写入；撤销恢复原文件。                                          |
| N9   | 分享项目链接与二维码，点击通用链接                                                | 链接为 HTTPS 规范地址；已安装时 App 内打开，未安装时打开 Web。                                                |
| N10  | iPad 多窗口打开两个项目，分屏与台前调度切换尺寸，使用菜单栏和拖放                 | 两个窗口互不污染；布局在各尺寸可用；跨 App 拖入图片成功。                                                     |
| N11  | VoiceOver 完成「新建项目 → 写一章 → 试玩」，再用最大辅助功能字号走查              | 全程可完成；无截断、遮挡；减弱动态效果生效。                                                                  |
| N12  | 从已有 Capacitor 安装升级（若 P0 确认需要）                                       | 项目与本机数据迁移完整；重复执行无副作用；失败保留原数据。                                                    |
| N13  | 检查播放器与引擎边界                                                              | 播放器读不到当前项目之外的文件和账号凭据；不加载网络脚本；只执行内置官方插件。                                |
| N14  | Web Studio 与桌面 Editor 回归                                                     | 共享层下沉后打开、编辑、保存、预览无回归；Studio Web 视觉不变。                                               |
| N15  | CI 与测试                                                                         | iOS workflow 通过；Node 与 JavaScriptCore 一致性测试、Swift 单测、关键 XCUITest、性能回归测试都在 CI 中运行。 |
| N16  | 发布与文档                                                                        | TestFlight 内部测试构建可安装；合规项齐全；文档、路线与 AGENTS 已更新；提交已推送并核验 SHA。                 |

## 验证命令与报告

以下为现有命令，执行时以实际 scripts 为准。`apps/studio-ios` 的命令由 P1、P2 补齐，不能把本节当作已有脚手架：

```bash
pnpm build:advjs
pnpm studio:build
pnpm -C apps/studio exec vitest run
pnpm typecheck
pnpm docs:check
```

原生侧预计提供 `pnpm -C apps/studio-ios build:engine`、`build:player`、`test:engine`，以及基于 `xcodebuild test` 的单测、UI 测试和性能测试入口，名称以实现为准。

验收报告写入 `docs/reports/studio-native-ios-acceptance.md`，逐项记录：环境（Xcode、系统版本、设备型号）、构建类型、fixture、命令与结果、截图／录屏／Instruments 文件、N1–N16 状态、已知问题和对应提交。实机证据与模拟器证据分开记录。

## 官方资料与决策依据

- [SwiftUI](https://developer.apple.com/documentation/swiftui)：App 结构、导航、多窗口与命令。
- [JavaScriptCore](https://developer.apple.com/documentation/javascriptcore)：引擎宿主；不含 DOM、`fetch` 与定时器。
- [WKURLSchemeHandler](https://developer.apple.com/documentation/webkit/wkurlschemehandler)：播放器与项目资源的离线加载。
- [ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession)：网页账号登录。
- [文件协调](https://developer.apple.com/documentation/foundation/nsfilecoordinator)与[安全作用域书签](https://developer.apple.com/documentation/foundation/nsurl/bookmarkcreationoptions)：「文件」App 中的原地编辑。
- [支持通用链接](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)：分享与回调链接。
- [人机界面指南](https://developer.apple.com/design/human-interface-guidelines)与 [App 审核指南](https://developer.apple.com/app-store/review/guidelines/)：界面与上架约束。
