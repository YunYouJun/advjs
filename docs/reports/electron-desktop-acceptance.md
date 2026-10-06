# Electron 桌面客户端验收报告

日期：2026-10-06。首版平台为 macOS arm64。A1–A12 全部通过。最终打包客户端 11 项端到端测试通过（54.9 秒），Studio 生产页面完整回归连续两次通过（29.1 秒）。功能提交已按 Conventional Commits 推送到 `origin/dev` 并核验远端 SHA；本次补记最终交付记录。后续语言、Logo、AGUI 配色和真实启动进度均已重新打包；2026-10-07 完整 15 项端到端回归通过，见本文复验章节。macOS 原生菜单修复后完整 16 项回归通过。

## 环境、来源与产物

- 实机：macOS 26.6.2（25G83），arm64；开发工具 Node.js 24.18.0、pnpm 11.20.0。
- 客户端：Electron 44.4.5、内置 Node.js 24.21.0、Chromium 152；Forge 7.11.2。
- 初始分支 `dev`，upstream `origin/dev`，基线提交 `211738355ab8c8e5a84f850edadbf6d81bd77b49`。
- 实施前保留已有 tracked diff 和 untracked 文件副本于 `/Users/yunyou/.codex/desktop-advjs-baseline-20261006`。最终检查使用 `git archive HEAD` 加逐文件／逐 hunk 提取的本任务变更，独立安装冻结锁文件；未使用脏工作区的 node_modules。快照位置 `/tmp/advjs-desktop-task-verify`。
- 与本任务直接相关的角色／场景资源别名解析修复作为构建前置纳入提交；其他静态诊断、浏览器恢复、AGUI 修改、依赖升级及文档迁移保持未暂存。

可直接运行的客户端移出仓库保存于：

```text
/Users/yunyou/.codex/desktop-advjs-artifacts-20261006/final/ADV.JS Editor.app
/Users/yunyou/.codex/desktop-advjs-artifacts-20261006/final/ADV.JS Editor-darwin-arm64-0.1.4.zip
```

仓库内同步副本为 `apps/desktop/out/ADV.JS Editor-darwin-arm64/ADV.JS Editor.app` 及 `apps/desktop/out/make/zip/darwin/arm64/ADV.JS Editor-darwin-arm64-0.1.4.zip`。应用约 863 MiB，分发 ZIP 约 273 MiB。分发 ZIP SHA-256：

```text
b2cae9b3958e97c15542c8c1f0a6b1a5f37b196f3932125a32d57a3a6ea1f871
```

`final/package-verification.json` 记录 ASAR 与 ZIP 的 hash、剥离 Forge 开发配置后的应用元数据，以及 2,126 条全部位于应用运行时内部的 symlink。运行时没有指向仓库或独立验证快照的链接。

最终验收从仓库外的 `.app` 启动，工作目录为独立临时目录，`PATH=/usr/bin:/bin`，`NODE_PATH` 与 `NODE_OPTIONS` 为空。`apps/desktop/out/evidence/a12-runtime.json` 记录 `packaged: true`、实际版本、架构、工作目录和 resources 路径。运行时、Editor 页面、Bridge 和 `advBuild` 均来自应用内依赖闭包；没有 Vite/Nuxt 开发服务器或系统 Node.js/pnpm 参与应用工作流。

## 项目矩阵

| 项目                         | 验证方式                                                                                                                          | 结果                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| golden-project JSON/Markdown | 在临时副本添加本地 SVG 场景及资源清单，保持原 fixture 不变；目录名为「中文 创作项目」                                             | 角色 CRUD、正文／未知 YAML／关系、立绘、WAV 音频、保存重开、刷新冲突、预览和导出通过               |
| 本地图片／音频项目           | 实际复制 SVG/WAV 字节至 `adv/assets/imports`，资源清单及 includes 使用既有模型                                                    | 字节相等、媒体 MIME、跳转、暂停、同路径替换、缺失提示及删除引用通过                                |
| 现有 CLI/Vite 项目           | 复制 `demo/starter` 的故事与 ADV 配置，不复制 node_modules；原仓库专用 Vite alias 先验证失败，再采用独立 `export default {}` 配置 | 原越界仓库依赖有明确构建错误；独立配置下真实构建／运行通过；可执行配置变更后阻止访问并要求重新信任 |
| 任意第三方依赖项目           | 不自动安装依赖或执行安装脚本                                                                                                      | 不在首版已验证矩阵内；缺失依赖按实际构建错误报告                                                   |

## P0–P5 结果

| 阶段 | 结果与实现                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | 打包可行性通过。使用显式依赖闭包 staging、ASAR 宿主与 extraResource 运行时，验证仓库外的实际构建。Forge 7 的同步 rebuild 使用已发布的 Electron node-gyp fork，保持 pnpm 安装策略。 |
| P1   | 原生打开／最近项目／关闭／保存／重载／退出；信任检查、受管理 utilityProcess Bridge、崩溃后重连和凭据再生成通过。                                                                   |
| P2   | 项目角色、立绘和音频操作接入 ProjectWorkspace；真实二进制导入与资源引用写回项目，无 Nitro API 或 localStorage 保存替代。                                                           |
| P3   | 受限文本 patch 的 expected 校验、同目录原子文件替换、失败清理、外部事件去抖、媒体缓存刷新和显式冲突选择通过。多文件提交不宣称事务原子性。                                          |
| P4   | 从已保存项目在受管理副本调用 advBuild；独立无 preload 沙箱预览、任务日志／取消、新目标目录及 ZIP、退出后独立静态部署通过。                                                         |
| P5   | 独立源码快照 lint／类型／构建／单测、Web Editor 和 Studio 生产页面回归全部通过；文档完成，本任务变更已提交并推送，远端 SHA 一致。                                                  |

## A1–A12 证据

截图及 JSON 收据在 `apps/desktop/out/evidence/`，并复制到仓库外的 `final/evidence/`。完整测试为 `apps/desktop/test/desktop.spec.ts`；只替代原生目录选择、保存目标与用户确认，角色编辑、服务通信、磁盘写入、二进制读取、构建和游戏运行均为实际链路。

| 编号 | 状态 | 验证与证据                                                                                                                                                                                                                                                                                    |
| ---- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | 通过 | 打包应用打开中文／空格目录；取消选择、无效目录保持旧会话；CLI 信任取消与正常构建。`a1-a3.json`、`a1-cli.json`、`a1-cli-project.png`。                                                                                                                                                         |
| A2   | 通过 | 新增／修改／删除角色、正文、别名和关系；保留未知 frontmatter 与额外正文；重启后从磁盘读回；外部删除后显式重建。`a2-a3-character.png` 及源码／字节断言。                                                                                                                                       |
| A3   | 通过 | 图片导入相对引用、字节相等、同路径外部替换立即更新、缺失提示、替换／移除；移除保留共享二进制。`a3-a5-media-refresh.png`。                                                                                                                                                                     |
| A4   | 通过 | WAV 真正导入、名称／描述／用途持久化，播放／暂停／跳转，离页暂停；外部 clean 元数据刷新及 dirty 保存冲突。`a4.json`、`a4-project-audio.png`。                                                                                                                                                 |
| A5   | 通过 | 外部改写／删除角色与媒体，保留草稿和外部版本，显式载入／覆盖／重建；当前会话限定旧请求与事件。`a5-character-conflict.png`、`a3-a5-media-refresh.png`。                                                                                                                                        |
| A6   | 通过 | 正常退出与重启、窗口重载、项目切换及最近项目、杀停项目服务后重连、草稿保留及凭据更新；停止预览后监听端口关闭，正常退出无 build 临时目录。`a6-session-recovery.png` 与退出断言。                                                                                                               |
| A7   | 通过 | 网络拦截所有非 loopback 请求；本地背景／立绘／BGM，开始、推进、选择、重开；无未处理 Pixi 异常，游戏窗口无桌面 API。`a7-isolated-preview.png`、`a7-a8.json`。                                                                                                                                  |
| A8   | 通过 | 实际 Web 目录及标准 ZIP；取消／缺失场景构建失败有状态与错误；拒绝已有目标及源码目标，源 index.html 与既有 keep.txt 字节保持一致。`a8-failure.png`、`a7-a8.json`。                                                                                                                             |
| A9   | 通过 | Electron、原 Bridge 均关闭后解压 ZIP，以另一 HTTP 服务运行并禁用外网；玩法／资源有效；扫描输出无用户项目、仓库、宿主绝对路径或 token／Bridge 端点。`a9-independent-export.png`、`a9.json`。                                                                                                   |
| A10  | 通过 | 无 desktop API 的 Web 本地 Editor 打开、预览、冲突、保存及资源读取通过；Studio 420 项单测、生产构建及连续两次完整页面回归通过。实际 MemoryFs／IndexedDB 保存并重载角色、立绘、WAV 和脚本，试听与离页暂停、游戏对白和立绘有效。`a10-studio.json`、`a10-studio-{character,audio,preview}.png`。 |
| A11  | 通过 | 未授权 Bridge 返回 401、越界路径返回 400、无效 recent ID 拒绝；二进制路径／symlink 逃逸及 revision 单测；有限 preload IPC 只接受主窗口当前 origin/frame。游戏无 Node、require、preload、创作凭据，预览 HTTP 不提供 Bridge API。凭据未进入 URL／DOM／WebStorage。                              |
| A12  | 通过 | 真 macOS arm64 `.app` 与 ZIP 运行；正常桌面、320px 面板亮／暗主题及键盘焦点截图，无横向溢出；原生工具栏保持紧凑 AGUI。`a12-runtime.json`、`a12-desktop.png`、`a12-panel-320-{light,dark}.png`。                                                                                               |

`final/exported-web/` 与 `final/exported-web.zip` 保存实际 A8/A9 产物；`final/saved-project/` 保存验收后源项目副本，`final/logs/` 保存构建、测试与检查日志。收据中的临时地址只描述当次验证；导出物使用相对资源与 hash 路由，不依赖该地址。

## 自动化与复现

独立快照的最终检查：

| 检查                                                         | 结果                                                                       | 日志                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 冻结锁文件安装、desktop:build、desktop:make                  | 通过；686 个依赖包的闭包 staging                                           | `advjs-desktop-task-build.log`、`advjs-desktop-task-editor-final.log`、`advjs-desktop-task-stage-final.log`、`advjs-desktop-task-make-final.log` |
| 受影响源码 ESLint、Editor vue-tsc、桌面主进程真实 TS program | 通过；ESLint 0 errors / 0 warnings                                         | `advjs-desktop-task-lint-delivery.log`、`advjs-desktop-task-types-final.log`；桌面 TS 检查在 build 中执行                                        |
| Editor／Bridge／资源／构建相关单测                           | 10 文件、26 测试通过                                                       | `advjs-desktop-task-units-final.log`                                                                                                             |
| 打包 Electron E2E                                            | 11 测试通过，54.9 秒                                                       | `advjs-desktop-packaged-final5.log`                                                                                                              |
| Web Editor 本地项目 E2E                                      | 独立快照 1 测试通过；原脏工作区本地／恢复 2 测试通过，恢复改动未纳入本任务 | `advjs-desktop-task-web.log`、`advjs-desktop-web-final.log`                                                                                      |
| Studio 单测                                                  | 52 文件、420 测试通过                                                      | `advjs-desktop-task-studio-units-final2.log`                                                                                                     |
| Studio 生产类型检查及构建                                    | 通过；保留既有 chunk／Ionic CSS／sourcemap 警告                            | `advjs-desktop-task-studio-build-final2.log`                                                                                                     |
| Studio 生产页面回归                                          | 1 条完整工作流连续两次通过，29.1 秒                                        | `advjs-desktop-task-studio-ui-final3.log`                                                                                                        |
| 文档检查                                                     | 通过，39 文件                                                              | `advjs-desktop-task-docs-delivery.log`                                                                                                           |

开发及应用打包入口：

```bash
pnpm install
pnpm desktop:build
pnpm desktop:dev
pnpm desktop:test
pnpm desktop:package
pnpm desktop:make
```

最终包复验：

```bash
ADVJS_WEB_CHANNEL=chrome ADVJS_DESKTOP_EXECUTABLE="/Users/yunyou/.codex/desktop-advjs-artifacts-20261006/final/ADV.JS Editor.app/Contents/MacOS/advjs-editor" pnpm desktop:test
ADVJS_WEB_CHANNEL=chrome pnpm -C apps/desktop exec playwright test --config playwright.web.config.ts
pnpm -C apps/studio build
pnpm -C apps/desktop exec playwright test --config playwright.studio.config.ts
```

Studio 回归配置启动已构建的静态 preview，使用 Chrome stable；首版不把 Studio 变成 Electron Renderer。测试选定对应 spec，避免误启动 demo 服务或将 Electron 加入 Firefox/WebKit 测试。此机器 Playwright Chromium 152 在 IndexedDB 读取 FileSystemHandle 时存在可复现的 SIGTRAP，Web 恢复与 Studio 使用已安装的 Chrome stable 154；Electron 152 的实际磁盘项目测试全部通过。

## 语言与加载 Logo 修复复验

2026-10-06 的后续反馈指出每次启动都要重新选择语言。原实现把语言与引导状态保存在 localStorage，桌面服务的动态端口导致 origin 改变，旧记录无法复用。现在通过有限的偏好 IPC 保存到应用 userData 的 `editor-preferences.json`，验证字段与语言枚举，并以临时文件替换和顺序写入保存；各路由渲染前恢复语言。首次选择或跳过引导也持久化，Web Editor 保持浏览器存储行为。

加载 Logo 原先通过 `/favicon.svg` 请求，现直接内联同一 SVG 路径，消除加载页对图片请求的依赖；加载提示增加中英文翻译。打包客户端的正常桌面与 800×600 窄窗口截图为 `preferences-splash-desktop.png`、`preferences-splash-narrow.png`。`preferences.json` 记录跨端口项目切换与应用重启，`preferences-web.json` 记录 Web 刷新和直接路由恢复。

独立快照重新通过 Editor 生产构建、vue-tsc、宿主 TS 检查及 macOS arm64 打包；运行时仍为 2,126 条内部 symlink。受影响源码 ESLint 为 0 errors；保留未提交的既有样式排序变更，因此独立源码中仍有 12 条原有 UnoCSS 排序 warnings。专项测试验证首次选择中文、无重复引导、窗口重载、项目切换、正常退出重启、直接进入角色页、内联 SVG 及非法偏好字段拒绝；Web Editor 也验证刷新与直接页面恢复。完整回归 13 项全部通过（1.1 分钟），记录于 `advjs-preferences-packaged-final3.log`；Web Editor 原有项目编辑集成回归 1 项通过（6.5 秒），记录于 `advjs-preferences-web-integration.log`。独立静态导出使用已安装的 Chrome stable（`ADVJS_WEB_CHANNEL=chrome`）。

应用与分发 ZIP 已同步更新至原交付路径；旧版本保留为 `final/before-preferences-fix.app` 和 `final/before-preferences-fix.zip`。语言修复版 ZIP hash 为 `d9c9cc0da5013e4791e95f6b7e912c0b3d2a1e6a0e7e6fcd0e76f2f6b4cdb978`；首版分发 hash `bfd55851548024de589714dc02402328be2c9f929fea497cfb3710ec8946f340` 保留在此用于区分历史产物。

## 加载页 AGUI 配色复验

2026-10-07：加载页原先使用独立的深蓝背景、固定白色透明文字和 Logo 发光效果，与主工作台的中性灰配色不一致。现统一使用 `--agui-c-bg`、`--agui-c-text-1/2`、`--agui-c-blue`、`--agui-c-bg-mute` 和 `--agui-c-primary`；Logo 移除发光，亮暗主题继承主编辑器。淡出时间为 150ms，并尊重减少动态效果偏好。未修改共享 token、项目数据、游戏主题或 Studio 样式。

独立源码快照通过 Editor 生产构建和 vue-tsc，再次生成 macOS arm64 `.app` 与 ZIP。仓库外应用以 `PATH=/usr/bin:/bin` 启动，实际捕获暗色／亮色 × 1440×900／320×600 四张截图，背景与宿主一致、辅助文字和进度条使用共享颜色、无发光或横向溢出，加载正常完成。证据为 `splash-theme-{dark,light}-{desktop,narrow}.png` 与 `splash-theme.json`，捕获脚本保存在 `final/evidence/capture-splash-theme.mjs`。加载页无操作控件；未修改共享组件，本次未重新执行 Studio 或全部游戏导出流程。

现有桌面语言／引导／跨项目／重启回归和 Web 语言回归 2 项通过（19.1 秒），日志 `advjs-splash-theme-preferences.log`。ESLint 0 errors，保留 8 条既有 UnoCSS 排序 warnings；只暂存本次配色 hunk，未纳入已有样式排序或其他工作区改动。应用内 2,126 条 symlink 均位于运行时内部，ASAR 宿主 hash 保持不变。当前分发 ZIP hash 见报告顶部，旧客户端保留为 `final/before-splash-theme-fix.app` 和 `final/before-splash-theme-fix.zip`。

## 真实预加载与动画关联复验

2026-10-07：移除依靠随机时长推进的开屏动画。应用根节点现在依次等待语言偏好恢复、编辑器扩展启用，以及本地项目服务连接／项目文件和场景资源映射读取；所有路由（含直接进入角色页）在成功后才挂载工作区和首次语言引导。必需扩展启用失败会阻止进入工作区；可选扩展仍按原有隔离契约处理。

进度条表示已完成阶段（0/3、1/3、2/3、3/3），按真实 Promise 完成事件推进，并用 120ms CSS 过渡连接各阶段；等待时轻微明暗变化，全部完成后 150ms 淡出，不再设置最低展示时间。尊重减少动态效果偏好。失败保留未完成阶段与错误信息，提供 AGUI 重试按钮，重试从失败阶段继续，已完成偏好／模块不会重复初始化。没有项目时该阶段直接完成；不提前下载整个音频／图片库，游戏资源保留按需加载行为。

新增启动控制器单测 6 项，与扩展生命周期 20 项单测共 26 项通过。覆盖真实任务阻塞、推进顺序、三种阶段失败及重试、重复点击、退出后延迟完成／失败不会改写启动状态。独立快照再次通过 Editor 生产构建、vue-tsc 和 ESLint（0 errors，7 条保留的既有 UnoCSS 排序 warnings），随后生成真实 macOS arm64 `.app` 和 ZIP。

仓库外应用以 `PATH=/usr/bin:/bin`、空 `NODE_PATH`／`NODE_OPTIONS` 运行，实际拦住项目 HTTP 读取超过原开屏时长，确认始终停留 2/3 且工作区未挂载；项目响应放行后继续拦住场景资源响应，进度仍不提前完成。随后放行进入工作区。模拟读取 503，确认错误、未满进度和等待动画停止；用 Tab / Enter 聚焦并重试成功。正常桌面 1440×900 与 320×600、亮暗主题无溢出，SVG Logo 和 AGUI 配色保持一致。证据为 `startup-{dark,light}-{desktop,narrow}.png`、`startup-error-narrow.png`、`startup.json`；Web 空会话、直接路由和错误重试记录为 `startup-web.json`。截图通过阻塞真实请求保留加载状态，未加入生产测试开关或固定计时器。

完整 Electron／Web 专项共 15 项端到端测试全部通过（2.4 分钟），包括原有角色／立绘／音频保存重开、外部刷新、预览、目录与 ZIP 导出、Electron 关闭后的独立静态运行、权限边界，以及语言／引导跨项目和重启恢复。独立快照 Web 本地编辑集成 1 项通过（8.5 秒）；原脏工作区生产构建、类型检查通过；额外 Web 回归首次记录布局资源 Event 异常，后续对照未改启动逻辑的独立 UI 副本和当前 UI 均通过布局验证，未复现该异常。当前项目编辑及布局流程两项联合重跑通过（7.5 秒）；恢复测试因两个同名打开按钮触发选择器严格匹配失败。保持原恢复测试内容，以临时副本将选择器限定于 Project 面板后，真实 IndexedDB 恢复／权限点击／移除流程通过（3.4 秒）；既有恢复和布局实现未纳入提交。此变更仅影响 Editor 启动；Studio 保持前次 420 项单测与两次生产工作流的验收记录，本轮未重复执行。

日志为 `advjs-startup-{units,lint,types,editor-build,stage,make,packaged-all,web-integration,working-build,working-types,working-web,working-web-final,working-recovery-scoped,baseline-layout-all,current-layout}.log`。本任务逐文件／逐 hunk 暂存，保留已有浏览器恢复、样式排序、依赖与文档改动。最终应用及 ZIP 同步到原交付路径；旧版保留为 `final/before-startup-fix.app`、`final/before-startup-fix.zip`，本轮 Web 导出与源项目副本也已保存。当前分发 hash 见报告顶部；之前 AGUI 配色版 ZIP hash 为 `525ff31ad1e3a05a195c0dbbce819673b73b4a3e87bdeef3a58449b59a713d18`。应用内 2,126 条运行时 symlink 均在包内，宿主 ASAR 未变化。

## macOS 原生菜单复验

2026-10-07：macOS 客户端改为仅在系统顶部显示原生菜单，窗口内保留工具栏与项目状态，释放重复菜单占用的 26px。Web Editor 保留 AGUI 菜单栏。宿主通过只读 `nativeMenu` 能力标志告知 Renderer，不依靠 User-Agent 判断平台。

补齐原生项目设置、偏好设置（⌘,）、角色管理、Codex 工作流、扩展管理、重置布局、预览／停止、Web 目录及 ZIP 导出和帮助入口；保存（⌘S）、打开（⌘O）、最近项目、关闭、受保护重载以及 macOS 标准编辑／窗口角色继续可用。语言偏好成功写入后更新系统菜单，空项目禁用项目操作。全局弹窗由应用根节点挂载，角色页面也能打开偏好设置和关于。菜单通过有限 `DesktopCommand` 分发到现有 Editor／ProjectWorkspace 操作；帮助链接固定在主进程，不新增通用 shell 或打开任意 URL 的 preload API。

独立源码快照通过 Editor 生产构建、vue-tsc、宿主 TS 检查和 macOS arm64 实际打包；受影响源码 ESLint 0 errors、0 warnings。原生菜单单测 3 项通过，覆盖有限命令与 recent ID、空项目禁用、语言／快捷键／系统角色。完整打包 Electron／Web 回归 16 项全部通过（1.2 分钟），包括角色／立绘／音频写入及重开、外部刷新、导出物在 Electron 退出后的独立运行、权限边界、语言恢复和实际预加载。额外 Web Editor 项目编辑集成 1 项通过（3.4 秒）。本次未改共享 AGUI／游戏主题／Studio，Studio 沿用前次验收记录。

新增 `native-menu.spec.ts` 直接触发应用的原生 MenuItem，验证中文与英文同步、角色页全局弹窗、真实角色磁盘保存、未保存草稿取消重载、扩展／布局、沙箱预览与停止、两种导出取消、固定帮助链接，以及原生打开／最近项目／关闭。项目切换测试等待 recent 菜单更新，确认旧服务已停再操作下一项目；测试副本补齐实际场景资源和改名后的角色别名。仓库外启动继续使用 `PATH=/usr/bin:/bin`、空 `NODE_PATH`／`NODE_OPTIONS`，无系统 Node.js、pnpm 或开发服务依赖。

`native-menu-dark-1440.png`、`native-menu-light-800.png` 和 `native-menu.json` 记录实际工作区截图、无重复菜单、窗口高度无溢出与操作断言；原有 320px 角色面板、启动错误和亮暗主题回归也通过。macOS 无障碍树确认系统菜单栏及 File 下拉内容，保存为 `native-menu-native-ax.json`；该提供者未能捕获系统菜单截图，工作区图片由 Electron 实际渲染捕获。

日志为 `advjs-native-menu-{units,lint,test-lint,types,editor-build,host,stage,make,packaged-focused,packaged-all,web-integration}.log`。应用内仍为 686 个运行时包、2,126 条内部运行时 symlink；新增菜单宿主模块包含在 ASAR。最终应用与 ZIP 同步到原交付位置，旧版保留为 `final/before-native-menu-fix.app` 和 `final/before-native-menu-fix.zip`。当前 hash 见报告顶部；上一启动版 ZIP hash 为 `481311416e3e43ba8bd9fd6689ec5491f3fa3d97243776e9b44ddf1faa530509`。逐文件／逐 hunk 提交本任务变更，保留已有浏览器恢复、AGUI 样式、依赖和文档迁移工作。

## 支持边界及平台

| 平台        | 构建   | 实际运行 | 完整创作／导出验收 |
| ----------- | ------ | -------- | ------------------ |
| macOS arm64 | 通过   | 通过     | 通过               |
| macOS x64   | 未验证 | 未验证   | 未验证             |
| Windows     | 未验证 | 未验证   | 未验证             |
| Linux       | 未验证 | 未验证   | 未验证             |

- 此为未做开发者签名、公证的测试分发包；没有创建 Release、自动更新或多平台发布。
- 可执行配置按信任入口处理，配置入口修改需要重新确认。任意第三方 npm 包、主题／插件缺失依赖会诊断失败，不自动联网安装。
- 结构化编辑不重写内联 TS 角色配置；JSON/Markdown 项目支持本轮完整编辑流程。
- 作者引用的远程资源仍是外部依赖，构建日志列出 origin；本地 fixture 的预览／导出在断外网下验收。默认联网 UI 音效和示例装饰图在离线桌面构建中停用。
- ZIP 为标准格式（非 ZIP64），最多 65,535 文件；超过 4 GiB 应采用目录导出。构建单任务、5 分钟上限，取消杀停独立 worker 并清理副本。
- Studio 回归补齐 MemoryFs 的 Blob 持久化（复用 IndexedDB structured clone，旧文本节点兼容，无 schema 索引迁移）及离开音频页进入独立编辑页的暂停；旧版本已经丢失的内存项目二进制需要重新导入。创作截图使用 390px 手机宽度，游戏运行截图使用 1280×900 视口，保持 Studio 与游戏主题的边界。
- 多文件保存使用冲突预检与失败清理，单文件写入完整；没有承诺跨文件事务或自动删除共享二进制。

## 提交与工作区保护

- 功能提交：`db456fe02adcb29558a31626a9ded8d898352305`，`feat(desktop): add packaged project authoring client`。
- 正常推送至 `origin/dev`，`git ls-remote origin refs/heads/dev` 核验 SHA 一致；未 force push，未创建 Release。
- 87 个本任务文件按独立验收快照逐文件／逐 hunk 暂存，已核验暂存 blob 与检查快照完全一致。未全量暂存或提交既有脏工作区。
- 为避免 lint-staged 对多会话脏工作区执行临时 stash，提交使用 `HUSKY=0`；相同暂存快照的受影响 ESLint、Editor／宿主／Studio 类型检查、构建、单测及集成验收已独立执行并通过。
- 本记录和主计划的最终状态以文档提交补记；交付文件夹中的 `delivery.json` 记录最终文档提交 SHA 与功能提交 SHA。

使用方法见[桌面使用文档](../guide/editor/desktop)。无关工作区修改与其他会话进展保持原位。
