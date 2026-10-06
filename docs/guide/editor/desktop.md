# Electron 桌面创作客户端

ADV.JS Editor 桌面客户端复用 AGUI Editor，主进程负责原生目录选择、窗口和项目服务。macOS arm64 是首版验收平台；其他系统的构建与运行状态以[验收报告](../../reports/electron-desktop-acceptance)为准。

## 打开与编辑

启动 `ADV.JS Editor.app`，点击「打开项目」或使用 `⌘O`，选择含 `adv.config.json` 或 `adv.config.ts` 的项目目录。最近项目记录保存目录路径，每次启动重新建立服务和凭据。取消选择或打开无效目录不会替换当前项目。

macOS 客户端的菜单位于系统顶部，窗口内只保留工具栏、项目状态和工作面板。系统菜单提供打开／最近项目／保存／关闭、项目设置、角色管理、Codex 创作工作流、扩展与布局、游戏预览及 Web／ZIP 导出；`ADV.JS Editor → 偏好设置…`（`⌘,`）和「关于」在角色等页面也可打开。菜单文字随语言选择更新；剪切、复制、粘贴等使用系统标准行为。Web Editor 保留窗口内的菜单栏。

首次选择语言或跳过引导后，客户端会记住选择；切换项目、刷新窗口及退出重开都不会再次要求选择。以后可在偏好设置的「界面 → 语言」修改。语言与引导完成状态保存于应用 userData 下的 `editor-preferences.json`，独立于项目与本地服务端口；Web Editor 继续使用浏览器存储。加载页采用内联 SVG Logo，提示文字跟随所选语言；背景、文字与进度条复用 AGUI token，和主编辑器一起切换亮暗主题。

开屏进度与实际初始化任务关联：恢复语言偏好、启用编辑器模块、连接并读取项目文件及场景资源映射。计数表示已完成阶段，不代表下载字节；任务完成才推进进度，全部完成后进入工作区，没有固定等待时间。读取失败会显示原因，可点击「重试」继续失败阶段。直接打开角色等页面也会先完成初始化；没有项目时无需加载项目资源。游戏的大型图片和音频继续按需加载。

JSON/Markdown 项目可编辑 `.character.md` 角色、正文描述、别名、关系和立绘。图片与项目音频导入会复制真实二进制文件到项目资源目录，并更新 `adv/assets.json` 或现有 includes 分片。文件名使用新 ID，避免覆盖共享资源；移除引用保留二进制文件，作者可以确认没有引用后自行清理。

项目音频支持名称、描述、BGM／音效／语音用途、播放、暂停与跳转。切换面板会暂停试听；音频库浏览是另一种资源来源。保存到项目文件成功才算保存完成，localStorage 中的创建草稿和面板布局不是项目保存。

`⌘S` 保存当前已登记草稿和打开的源文件。关闭、退出、重载、切换项目、预览和导出遇到未保存内容时，提供「保存并继续／取消」。保存失败会保留草稿并阻止继续。外部修改会刷新项目；写入前检查原始内容，冲突时选择载入外部版本或保留草稿覆盖。外部删除后可明确选择重建草稿文件。

可执行配置需要原生信任确认，配置可访问本机文件。不要打开不信任的项目；配置入口被外部修改后需要重新连接并再次确认。服务停止时点击「重新连接项目」，当前窗口中的表单草稿保留。窗口刷新与应用重启只恢复已保存数据。

## 预览与游戏导出

「游戏预览」从已保存项目构建，打开独立沙箱游戏窗口。「停止预览」关闭窗口、媒体与临时 HTTP 服务。游戏窗口不含桌面 preload、Node.js 或创作客户端的项目凭据。

「导出 Web 目录」和「导出 ZIP」调用同一 `advBuild`，在受管理项目副本中构建，成功后才交付指定的新目录或 ZIP。已有目标、项目源码目录和应用资源目录会被拒绝。构建期间可取消；失败会显示错误和日志，原项目的 `index.html` 与既有目标保持完整。

导出使用相对资源路径与 hash 路由，ZIP 只含 Web 构建产物。关闭 Electron 后，解压 ZIP 并使用普通静态 HTTP 服务即可运行，例如在解压目录中执行 `python3 -m http.server 8080`，浏览器打开 `http://localhost:8080`。静态服务器属于导出物的运行环境，桌面应用本身不需要系统 Node.js、pnpm、本仓库或开发服务器。

本地图片与项目音频会随导出复制；作者主动引用的远程资源仍是远程依赖，构建日志会列出依赖的远程 origin，离线项目应使用本地资源。桌面构建禁用默认的联网界面音效和示例装饰图片；项目 BGM 与自定义主题保持原有语义，默认主题优先使用项目封面。

## 开发与打包

开发环境需要仓库指定的 Node.js LTS 与 pnpm：

```bash
pnpm install
pnpm desktop:build
pnpm desktop:dev
pnpm desktop:test
pnpm desktop:package
pnpm desktop:make
```

`desktop:build` 编译引擎、静态 Editor 和桌面进程；`desktop:dev` 启动桌面开发宿主；`desktop:package` 生成 `.app`；`desktop:make` 生成桌面安装分发 ZIP。这些命令与应用内的「导出 Web 游戏」是不同产物。打包会验证运行时依赖闭包没有指向本仓库的外部 symlink。

macOS arm64 产物在 `apps/desktop/out/ADV.JS Editor-darwin-arm64/ADV.JS Editor.app`，分发 ZIP 在 `apps/desktop/out/make/`。最终验收使用移出仓库的应用副本和受限 PATH，证据位置见验收报告。

```bash
ADVJS_WEB_CHANNEL=chrome ADVJS_DESKTOP_EXECUTABLE="/absolute/path/ADV.JS Editor.app/Contents/MacOS/advjs-editor" pnpm desktop:test
```

## 支持边界

- JSON/Markdown 源项目：角色、立绘、项目音频、真实保存、外部刷新、预览和导出。
- 现有 CLI/Vite 项目：信任后的配置加载、预览和导出；内联 TS 配置属于可执行源，结构化编辑器不会自动改写 TS。建议把可视化编辑内容迁入 Markdown 与资源清单。
- 仓库 `demo/starter/vite.config.ts` 包含指向仓库工具的开发 alias，复制该工程用于独立创作时应换成普通独立 Vite 配置（例如 `export default {}`）。验收使用同一份 starter 故事与 ADV 配置，以及这个独立 Vite 配置；原仓库专用配置会报告越界依赖失败。
- ZIP 使用标准 ZIP 格式，最多 65,535 个文件；大于 4 GiB 的项目应导出 Web 目录。
- 打包工具链包含 ADV.JS 默认运行时与默认主题，不自动安装任意第三方依赖或执行安装脚本。自定义主题／插件／配置缺失依赖时构建会失败并报告原因。
- 首版不包含开发者签名、公证、自动更新、自动 Release、多平台发布或协作账号流程。

Studio 回归同时修复了内存项目的 IndexedDB 二进制持久化；旧版本已经丢失的二进制文件需要重新导入，不影响真实目录项目。

宿主与安全边界在 `apps/desktop/src/`；面板通过 `ProjectWorkspace` 读写项目，保持 AGUI Editor、游戏主题和移动 Studio 的设计边界。
