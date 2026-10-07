# 桌面客户端发布与 CI 验证

日期：2026-10-07。范围：本地客户端 0.1.5、多平台打包脚本、GitHub Actions 构建与 Release 附件上传。状态：macOS arm64 本地构建与运行验证通过，远端多平台工作流尚未运行。

## 交付范围

- 保留 Electron Forge，构建 macOS arm64／x64、Windows x64、Linux x64 的便携 ZIP。
- 本地开发入口补齐缺失构建；打包入口统一处理跨平台环境变量、平台／架构与版本。
- 运行时依赖随应用携带，打包后从仓库外的临时目录启动，使用受限 PATH 打开项目并真实导出 Web 游戏。
- 桌面 CI 为相关 PR／推送生成可下载产物；Release 工作流固定源码提交和标签版本，在所有平台成功后上传 ZIP 与 `SHA256SUMS.txt`。
- 现有正式晋级工作流直接调用桌面发布，避免 `GITHUB_TOKEN` 创建 Release 后无法递归触发的问题。

用户操作、命令、触发条件和升级方式统一维护在[桌面客户端指南](../guide/editor/desktop)。完整创作功能的历史验收继续参见[桌面功能验收报告](./electron-desktop-acceptance)。

## 验证环境与来源

本地为 macOS arm64、Node.js 24.18.0、pnpm 11.20.0，工作分支为 `dev`。本次本地应用包含当前工作区已有的未提交修改，不将工作区整体视作本任务独立提交，也不宣称它对应某个已发布标签。

原安装位于 `/Applications/ADV.JS Editor.app`，版本为 0.1.4。新构建版本为 0.1.5；通过验证后替换安装。旧安装保存在 `/Users/yunyou/.codex/desktop-advjs-artifacts-20261007/release-ci-0.1.5/previous-installed-0.1.4.app`，项目与用户偏好设置保持原位置。

新应用及 ZIP 的仓库外副本位于 `/Users/yunyou/.codex/desktop-advjs-artifacts-20261007/release-ci-0.1.5/`。分发 ZIP 为 `advjs-desktop-0.1.5-darwin-arm64.zip`，约 315 MiB，SHA-256：

```text
5b85e37d18f3729fcb1fb1b4161c6fb2f1b55d0469ef26baf71aedcf25132eb9
```

## 验证记录

| 检查                        | 实际结果                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| 引擎、Editor、桌面进程构建  | 通过；包含宿主 TypeScript 检查                                                                 |
| 真实运行时暂存与 Forge make | 通过；698 个源依赖、741 个实际目录副本，产出 0.1.5 应用与 ZIP                                  |
| 打包脚本单测                | 5 项通过；覆盖版本、架构、首次开发构建、重复版本、peer 变体、循环引用和搬移后加载              |
| Release 单测及现有发布回归  | 21 项通过；包含完整平台集合、校验文件、标签移动和未发布 Release 拒绝                           |
| 桌面任务／菜单单测          | 6 项通过                                                                                       |
| 打包应用 smoke              | 通过；临时目录启动、受限 PATH、项目认证、真实 Web 导出、二进制资源相等、源文件保留，无渲染错误 |
| 桌面完整 E2E                | 首轮 18／19 通过；修正过期的亮色背景预期后，启动专项 2／2 通过，所有 19 项均已有通过结果       |
| 工作流与代码检查            | actionlint 1.7.12、限定文件 ESLint、diff 空白检查通过                                          |
| 文档检查与生产构建          | `docs:check`、`docs:build` 通过                                                                |

首轮启动测试期待旧亮色背景 `#ffffff`，而工作区现行 [AGUI 设计规范](../agui/design) 与 token 已为 `#f1f1f1`。本次仅同步测试预期，保留加载页与宿主背景一致、阶段阻塞、窄屏布局、错误重试及键盘操作断言，没有改动界面配色。

打包 smoke 证据为 `apps/desktop/out/evidence/packaged-smoke-darwin-arm64.json` 和同名 PNG。完整回归的角色、媒体、预览、ZIP 独立运行、菜单、最近项目与启动证据仍在同一目录。本次应用从仓库外副本启动，`PATH=/usr/bin:/bin`，`NODE_PATH` 和 `NODE_OPTIONS` 为空。

本机日志保存为 `/tmp/advjs-desktop-{build,stage,make,package-smoke,e2e,startup,unit,docs-build}-20261007.log`；其中 `e2e` 保留首轮颜色断言失败，修复后的专项结果在 `startup` 日志中。不要把首轮日志单独表述为全绿。

## 尚未验证与分发边界

GitHub 工作流尚未推送或运行，macOS Intel、Windows 和 Linux 的成功构建与运行需由对应 runner 提供证据。新增矩阵不等于这些平台已经完成实机验收。

产物未配置开发者签名、公证或应用内自动更新。当前交付为 ZIP，不包含 DMG、Windows 安装向导或 Linux 软件仓库包。本次没有创建公开 Release，也没有上传分发附件。
