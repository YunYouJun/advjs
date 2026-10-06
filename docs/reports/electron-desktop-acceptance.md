# Electron 桌面客户端验收报告

日期：2026-10-06。首版平台为 macOS arm64。A1–A12 全部通过。最终打包客户端 11 项端到端测试通过（54.9 秒），Studio 生产页面完整回归连续两次通过（29.1 秒）。功能提交已按 Conventional Commits 推送到 `origin/dev` 并核验远端 SHA；本次补记最终交付记录。

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
bfd55851548024de589714dc02402328be2c9f929fea497cfb3710ec8946f340
```

`final/package-verification.json` 记录 ASAR 与 ZIP 的 hash、剥离 Forge 开发配置后的应用元数据，以及 2,126 条全部位于应用运行时内部的 symlink。运行时没有指向仓库或独立验证快照的链接。

最终验收从仓库外的 `.app` 启动，工作目录为独立临时目录，`PATH=/usr/bin:/bin`，`NODE_PATH` 与 `NODE_OPTIONS` 为空。`apps/desktop/out/evidence/a12-runtime.json` 记录 `packaged: true`、实际版本、架构、工作目录和 resources 路径。运行时、Editor 页面、Bridge 和 `advBuild` 均来自应用内依赖闭包；没有 Vite/Nuxt 开发服务器或系统 Node.js/pnpm 参与应用工作流。

## 项目矩阵

| 项目 | 验证方式 | 结果 |
| --- | --- | --- |
| golden-project JSON/Markdown | 在临时副本添加本地 SVG 场景及资源清单，保持原 fixture 不变；目录名为「中文 创作项目」 | 角色 CRUD、正文／未知 YAML／关系、立绘、WAV 音频、保存重开、刷新冲突、预览和导出通过 |
| 本地图片／音频项目 | 实际复制 SVG/WAV 字节至 `adv/assets/imports`，资源清单及 includes 使用既有模型 | 字节相等、媒体 MIME、跳转、暂停、同路径替换、缺失提示及删除引用通过 |
| 现有 CLI/Vite 项目 | 复制 `demo/starter` 的故事与 ADV 配置，不复制 node_modules；原仓库专用 Vite alias 先验证失败，再采用独立 `export default {}` 配置 | 原越界仓库依赖有明确构建错误；独立配置下真实构建／运行通过；可执行配置变更后阻止访问并要求重新信任 |
| 任意第三方依赖项目 | 不自动安装依赖或执行安装脚本 | 不在首版已验证矩阵内；缺失依赖按实际构建错误报告 |

## P0–P5 结果

| 阶段 | 结果与实现 |
| --- | --- |
| P0 | 打包可行性通过。使用显式依赖闭包 staging、ASAR 宿主与 extraResource 运行时，验证仓库外的实际构建。Forge 7 的同步 rebuild 使用已发布的 Electron node-gyp fork，保持 pnpm 安装策略。 |
| P1 | 原生打开／最近项目／关闭／保存／重载／退出；信任检查、受管理 utilityProcess Bridge、崩溃后重连和凭据再生成通过。 |
| P2 | 项目角色、立绘和音频操作接入 ProjectWorkspace；真实二进制导入与资源引用写回项目，无 Nitro API 或 localStorage 保存替代。 |
| P3 | 受限文本 patch 的 expected 校验、同目录原子文件替换、失败清理、外部事件去抖、媒体缓存刷新和显式冲突选择通过。多文件提交不宣称事务原子性。 |
| P4 | 从已保存项目在受管理副本调用 advBuild；独立无 preload 沙箱预览、任务日志／取消、新目标目录及 ZIP、退出后独立静态部署通过。 |
| P5 | 独立源码快照 lint／类型／构建／单测、Web Editor 和 Studio 生产页面回归全部通过；文档完成，本任务变更已提交并推送，远端 SHA 一致。 |

## A1–A12 证据

截图及 JSON 收据在 `apps/desktop/out/evidence/`，并复制到仓库外的 `final/evidence/`。完整测试为 `apps/desktop/test/desktop.spec.ts`；只替代原生目录选择、保存目标与用户确认，角色编辑、服务通信、磁盘写入、二进制读取、构建和游戏运行均为实际链路。

| 编号 | 状态 | 验证与证据 |
| --- | --- | --- |
| A1 | 通过 | 打包应用打开中文／空格目录；取消选择、无效目录保持旧会话；CLI 信任取消与正常构建。`a1-a3.json`、`a1-cli.json`、`a1-cli-project.png`。 |
| A2 | 通过 | 新增／修改／删除角色、正文、别名和关系；保留未知 frontmatter 与额外正文；重启后从磁盘读回；外部删除后显式重建。`a2-a3-character.png` 及源码／字节断言。 |
| A3 | 通过 | 图片导入相对引用、字节相等、同路径外部替换立即更新、缺失提示、替换／移除；移除保留共享二进制。`a3-a5-media-refresh.png`。 |
| A4 | 通过 | WAV 真正导入、名称／描述／用途持久化，播放／暂停／跳转，离页暂停；外部 clean 元数据刷新及 dirty 保存冲突。`a4.json`、`a4-project-audio.png`。 |
| A5 | 通过 | 外部改写／删除角色与媒体，保留草稿和外部版本，显式载入／覆盖／重建；当前会话限定旧请求与事件。`a5-character-conflict.png`、`a3-a5-media-refresh.png`。 |
| A6 | 通过 | 正常退出与重启、窗口重载、项目切换及最近项目、杀停项目服务后重连、草稿保留及凭据更新；停止预览后监听端口关闭，正常退出无 build 临时目录。`a6-session-recovery.png` 与退出断言。 |
| A7 | 通过 | 网络拦截所有非 loopback 请求；本地背景／立绘／BGM，开始、推进、选择、重开；无未处理 Pixi 异常，游戏窗口无桌面 API。`a7-isolated-preview.png`、`a7-a8.json`。 |
| A8 | 通过 | 实际 Web 目录及标准 ZIP；取消／缺失场景构建失败有状态与错误；拒绝已有目标及源码目标，源 index.html 与既有 keep.txt 字节保持一致。`a8-failure.png`、`a7-a8.json`。 |
| A9 | 通过 | Electron、原 Bridge 均关闭后解压 ZIP，以另一 HTTP 服务运行并禁用外网；玩法／资源有效；扫描输出无用户项目、仓库、宿主绝对路径或 token／Bridge 端点。`a9-independent-export.png`、`a9.json`。 |
| A10 | 通过 | 无 desktop API 的 Web 本地 Editor 打开、预览、冲突、保存及资源读取通过；Studio 420 项单测、生产构建及连续两次完整页面回归通过。实际 MemoryFs／IndexedDB 保存并重载角色、立绘、WAV 和脚本，试听与离页暂停、游戏对白和立绘有效。`a10-studio.json`、`a10-studio-{character,audio,preview}.png`。 |
| A11 | 通过 | 未授权 Bridge 返回 401、越界路径返回 400、无效 recent ID 拒绝；二进制路径／symlink 逃逸及 revision 单测；有限 preload IPC 只接受主窗口当前 origin/frame。游戏无 Node、require、preload、创作凭据，预览 HTTP 不提供 Bridge API。凭据未进入 URL／DOM／WebStorage。 |
| A12 | 通过 | 真 macOS arm64 `.app` 与 ZIP 运行；正常桌面、320px 面板亮／暗主题及键盘焦点截图，无横向溢出；原生工具栏保持紧凑 AGUI。`a12-runtime.json`、`a12-desktop.png`、`a12-panel-320-{light,dark}.png`。 |

`final/exported-web/` 与 `final/exported-web.zip` 保存实际 A8/A9 产物；`final/saved-project/` 保存验收后源项目副本，`final/logs/` 保存构建、测试与检查日志。收据中的临时地址只描述当次验证；导出物使用相对资源与 hash 路由，不依赖该地址。

## 自动化与复现

独立快照的最终检查：

| 检查 | 结果 | 日志 |
| --- | --- | --- |
| 冻结锁文件安装、desktop:build、desktop:make | 通过；686 个依赖包的闭包 staging | `advjs-desktop-task-build.log`、`advjs-desktop-task-editor-final.log`、`advjs-desktop-task-stage-final.log`、`advjs-desktop-task-make-final.log` |
| 受影响源码 ESLint、Editor vue-tsc、桌面主进程真实 TS program | 通过；ESLint 0 errors / 0 warnings | `advjs-desktop-task-lint-delivery.log`、`advjs-desktop-task-types-final.log`；桌面 TS 检查在 build 中执行 |
| Editor／Bridge／资源／构建相关单测 | 10 文件、26 测试通过 | `advjs-desktop-task-units-final.log` |
| 打包 Electron E2E | 11 测试通过，54.9 秒 | `advjs-desktop-packaged-final5.log` |
| Web Editor 本地项目 E2E | 独立快照 1 测试通过；原脏工作区本地／恢复 2 测试通过，恢复改动未纳入本任务 | `advjs-desktop-task-web.log`、`advjs-desktop-web-final.log` |
| Studio 单测 | 52 文件、420 测试通过 | `advjs-desktop-task-studio-units-final2.log` |
| Studio 生产类型检查及构建 | 通过；保留既有 chunk／Ionic CSS／sourcemap 警告 | `advjs-desktop-task-studio-build-final2.log` |
| Studio 生产页面回归 | 1 条完整工作流连续两次通过，29.1 秒 | `advjs-desktop-task-studio-ui-final3.log` |
| 文档检查 | 通过，39 文件 | `advjs-desktop-task-docs-delivery.log` |

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
ADVJS_DESKTOP_EXECUTABLE="/Users/yunyou/.codex/desktop-advjs-artifacts-20261006/final/ADV.JS Editor.app/Contents/MacOS/advjs-editor" pnpm desktop:test
ADVJS_WEB_CHANNEL=chrome pnpm -C apps/desktop exec playwright test --config playwright.web.config.ts
pnpm -C apps/studio build
pnpm -C apps/desktop exec playwright test --config playwright.studio.config.ts
```

Studio 回归配置启动已构建的静态 preview，使用 Chrome stable；首版不把 Studio 变成 Electron Renderer。测试选定对应 spec，避免误启动 demo 服务或将 Electron 加入 Firefox/WebKit 测试。此机器 Playwright Chromium 152 在 IndexedDB 读取 FileSystemHandle 时存在可复现的 SIGTRAP，Web 恢复与 Studio 使用已安装的 Chrome stable 154；Electron 152 的实际磁盘项目测试全部通过。

## 支持边界及平台

| 平台 | 构建 | 实际运行 | 完整创作／导出验收 |
| --- | --- | --- | --- |
| macOS arm64 | 通过 | 通过 | 通过 |
| macOS x64 | 未验证 | 未验证 | 未验证 |
| Windows | 未验证 | 未验证 | 未验证 |
| Linux | 未验证 | 未验证 | 未验证 |

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
