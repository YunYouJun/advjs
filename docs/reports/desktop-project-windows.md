# 桌面多项目窗口与状态反馈验证

- 日期：2026-10-07。
- 状态：工作区实现完成，本地与打包版回归通过，macOS 安装已更新。
- 范围：[实施计划](../plans/2026-10-07-desktop-project-windows.md)；实际使用规则见[桌面指南](../guide/editor/desktop.md)。
- 环境：macOS arm64，Node.js 24.18.0、pnpm 11.20.0、Electron 44.4.5。
- 边界：初始验证使用开发宿主加载构建后的 Editor；随后重新生成并安装 macOS arm64 应用，见下方重装记录。Windows、Linux 安装包未在本次运行。

## 实际结果

| 项目       | 验证结果                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 单主进程   | 同一 userData 再次启动进程后，交给已有主进程打开并聚焦项目，第二个进程退出。                                                         |
| 窗口策略   | 已有项目默认新窗口；空窗口直接载入；显式当前窗口操作替换项目。带未保存内容默认打开新窗口不会触发原窗口保存或丢弃。                   |
| 路径去重   | 符号链接与真实路径、并发打开请求均聚焦同一个项目窗口。                                                                               |
| 项目切换器 | 同时显示已打开与最近使用；已打开项直接聚焦，窗口与历史变化同步刷新。                                                                 |
| 会话隔离   | 两个项目的服务地址与 token 独立，A 的 token 访问 B 服务返回 401；IPC 按发送窗口校验。                                                |
| 状态恢复   | 面板比例、激活面板、当前文件、光标与滚动位置按真实项目路径持久化；关闭后重开及应用重启恢复，项目间不串用。当前编辑区仍是单文档区域。 |
| 未保存保护 | 当前窗口替换、关闭项目、关闭窗口、退出可取消；保存失败保留窗口和草稿；退出先检查所有窗口，取消时不提前关闭其他窗口。                 |
| 标题与反馈 | 原生标题栏显示文件夹名与未保存标记；底栏显示连接、保存、文件、位置和任务结果，顶部项目／日志栏已删除。                               |
| 错误报告   | 实际缺失资源触发右下角通知，复制报告包含错误、环境和日志，凭据被脱敏；通知关闭后可从任务详情再次复制。                               |
| 既有流程   | 原生菜单、角色与文件保存、外部修改冲突、媒体导入、服务重连、沙箱预览、Web／ZIP 导出、引导与语言偏好继续通过。                        |

关闭或替换项目前明确等待状态落盘；状态文件位于 userData 的 `workspace-state/`，文件名由真实项目路径的 SHA-256 生成，写入采用队列与原子重命名。项目源文件仍通过原有 ProjectWorkspace 写入。

## 检查记录

- `node apps/desktop/scripts/build.mjs`：宿主 TypeScript 检查与编译通过。
- `ADVJS_EDITOR_MODE=local pnpm -C editor/core build`：Editor 生产构建通过。
- `pnpm -C editor/core typecheck`：通过。
- 修改范围的 ESLint 与 `git diff --check`：通过。
- Vitest：`desktop-menu`、`desktop-workspace-state`、`editor-error-report`、`editor-file-workspace` 共 20 条用例通过；新增菜单断言后单独复验 4 条菜单用例通过。
- Electron／浏览器回归：`apps/desktop/playwright.config.ts` 中 21 条用例分批全部通过。首次全量执行暴露旧测试仍依赖默认当前窗口打开及通知遮挡表单；已按新窗口语义修订，并通过关闭真实通知继续验证表单操作。最后一批 17 条中 15 条通过，随后单独复验剩余生命周期与 CLI 项目 2 条通过；其他 4 条在全量批次中通过。

关键回归位于 `apps/desktop/test/multi-window.spec.ts`，涵盖第二进程转交、并发与符号链接路径去重、未保存窗口的新建／替换／关闭、保存失败、应用退出取消、真实 Monaco 光标恢复、错误复制与状态栏几何。

## 视觉证据

已检查实际渲染的亮暗截图，通知、状态栏与项目切换器使用 AGUI；通知最多三条且区域不超过半屏，空白区域不拦截鼠标。工作区填满状态栏上方空间。正常宽度 1440px、窄窗口 800px，以及状态栏 320px 检查均无自身横向溢出。

截图保存在本地构建产物中，不作为源码提交：

- `apps/desktop/out/evidence/windows-toast-status-dark-1440.png`。
- `apps/desktop/out/evidence/windows-toast-status-light-800.png`。
- `apps/desktop/out/evidence/windows-project-switcher.png`。
- `apps/desktop/out/evidence/native-menu-status-dark-320.png` 与 `native-menu-status-light-320.png`。

测试过程中还修复了首次加载误停当前服务、页面路由切换误清空宿主就绪状态、标题被页面覆盖、工作区高度不足及旧会话刷新请求产生未处理拒绝的问题。

## macOS 重装验证

2026-10-07 执行 `pnpm desktop:package`，重新构建 Editor、引擎与宿主并生成 0.1.5 安装包。实际打包版的多窗口／状态恢复与原生菜单用例共 2 条通过（30.3 秒）。

将新应用安装到 `/Applications/ADV.JS Editor.app`，复制后校验宿主与 Editor 入口文件内容一致，再替换原应用。旧应用备份于 `/Users/yunyou/.codex/desktop-advjs-artifacts-20261007/project-windows-reinstall-3c893197/previous-installed-0.1.5.app`；项目与用户数据目录保持原位置。宿主 ASAR 的 SHA-256 为 `ce36b284f11144ca1637bd106eb2ff17783654a2e9335f63092335080199cbe8`。

已通过 Launch Services 启动安装版，并读取实际窗口确认：系统原生菜单、底部编辑器状态、项目欢迎页与游戏专用空状态均已出现，未重复展示游戏欢迎页。构建及打包版测试日志保存在 `/Users/yunyou/.codex/desktop-advjs-artifacts-20261007/project-windows-reinstall-3c893197`。
