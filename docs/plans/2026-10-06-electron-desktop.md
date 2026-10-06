# ADV.JS Electron 桌面创作客户端实施计划

日期：2026-10-06。

状态：P0–P5 实施及 A1–A12 全部验收通过；macOS arm64 打包端到端 11 项、Studio 生产页面完整工作流连续两次通过。正在复核最终提交推送。验收证据持续记录于 `docs/reports/electron-desktop-acceptance.md`；未勾选的项尚未验收。

执行交接：[GPT-6.1 sol 执行提示词](./2026-10-06-electron-desktop-handoff.md)。

## 完成目标（实施 Goal）

交付可在 macOS arm64 实际打包运行的 ADV.JS Electron 创作客户端，复用现有 AGUI Editor、ProjectWorkspace、本地 Editor Bridge 和游戏运行时，完成「原生打开项目 → 编辑角色／立绘／音频 → 保存到项目并响应外部资源刷新 → 游戏预览 → 导出可独立部署的 Web 游戏」全流程。关闭并重开客户端后内容保持一致；内置主题与已支持的静态官方插件验收项目不依赖用户安装 Node.js、pnpm 或本仓库。补齐关键自动化测试、真实客户端验收、Editor Web 与 Studio 回归、使用文档和平台支持矩阵，最终仅提交推送本任务改动。

完成是指以下各阶段及验收表有真实证据，不能以打开一个 Electron 窗口、开发模式通过或构建成功替代。

实施 Goal 已创建；只有必需验收与提交推送全部完成后才标记 complete。

## 范围与首版边界

- 桌面宿主使用 Electron，默认打包方案为 Electron Forge；Renderer 复用 `editor/core`，不创建第二套编辑器。
- 当前实机为 macOS arm64。该平台的打包后全流程是首版完成门槛；Windows/Linux 保持可移植实现并提供构建入口，只有取得对应 runner／实机证据后才能标记为已验证。签名、公证、应用商店和自动更新另立发布阶段。
- 一次编辑一个项目，支持最近项目、切换、关闭和重新打开；不扩展为多窗口协同系统。
- 「导出」指 Web 静态游戏目录及 ZIP，ZIP 解压后由普通静态 HTTP 服务运行。桌面创作工具安装包与游戏导出物分开；首版不承诺每个游戏单独生成 Electron 安装包，也不包含视频导出。
- 本地验收项目的图片、音频和字体必须随项目或应用提供，断开外网仍能编辑、预览和导出。依赖远程素材的项目明确提示其依赖，不擅自下载、替换或发布资源。
- 移动 Studio 延续 Capacitor 与自身设计规范。本次覆盖共享能力回归，不把 Studio 改为桌面 AGUI，也不包装 Studio 作为第二个桌面产品。
- 不增加云账号、素材市场、托管 AI、插件在线安装或自动发布流程。

## 已核实的代码基线与缺口

基线 HEAD 为 `21173835`，但工作区包含大量已有修改及未跟踪文件。实施前重新核对，不能只按此提交重置工作区。

| 现有入口                                                                             | 已有能力／本次注意点                                                                                                                          |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor/core/app/workspaces/project.ts`                                              | 已有 `ProjectWorkspace.commit/snapshot/subscribe`，是 Editor 的项目接口，优先复用。                                                           |
| `editor/core/app/adapters/local/{index,workspace}.ts`                                | 已有本地桥接适配器、文件句柄兼容层、资源 Blob URL 和事件订阅；不是完整二进制文件系统。                                                        |
| `packages/advjs/node/editor/index.ts`                                                | 已有受限 loopback 服务、项目读取、文本写入、图片资源、watch、check/build；可以托管构建后的 Editor 静态产物。                                  |
| `editor/core/build-contract.ts`、`editor/core/scripts/prepare-package.mjs`           | 区分 Nuxt `.output` 与打包后的 `dist`。桌面本地模式优先使用现有 Bridge 托管静态 Editor，不默认启动整套 Nitro。                                |
| `editor/core/app/stores/useCharacterStore.ts`                                        | 同时存在浏览器目录句柄和 `/api/characters` 服务端路径；不能假定本地项目角色 CRUD 已全部接通。部分异常仅记录日志，需验证失败不会显示保存成功。 |
| `editor/core/app/components/character/TachieManager.vue`                             | 已有立绘编辑 UI；需连接项目资源导入、引用和持久化。                                                                                           |
| `editor/core/app/stores/useAudioStore.ts`、`components/panel/audio/AEAudioPanel.vue` | 主要是外部音频库和本地偏好，不等于项目音频 CRUD；本轮需要补项目资源链路。                                                                     |
| `packages/advjs/node/commands/build/index.ts`                                        | `advBuild` 已返回输出目录和产物摘要；构建会临时写入项目 `index.html` 并在 `finally` 恢复，必须检查取消／进程异常时的源文件保护。              |
| `packages/advjs/node/cli/export.ts`                                                  | 目前为硬编码演示地址的录屏实验，不能作为桌面 Web 导出实现。                                                                                   |
| `apps/studio/src/utils/fs/types.ts`                                                  | 已有 `IFileSystem`；本轮不强制将 Editor 改用它，也不新造第三套文件系统。确有双端消费者时再提取共享的最小接口。                                |

Bridge 当前还有明确缺口：资源端点只接受图片，文件 PUT 是有大小限制的 UTF-8 文本写入，不能直接用来上传音频或任意二进制；目录创建、删除、二进制导入、音频媒体响应和取消构建需要逐项补齐。现有 `commit` 对多个文件并行写入，不应将它描述为已有多文件原子事务。

## 架构决策

建议新增 `apps/desktop/`，保持职责可辨认：

```text
Electron main
  ├─ 窗口、原生对话框、最近项目、会话生命周期
  ├─ preload：有限、类型化、校验后的桌面操作
  └─ 受管理的 Node utility process
       ├─ 复用本地 Editor Bridge、项目读写与监听
       └─ 构建任务与导出暂存目录

Editor renderer（现有 AGUI）
  └─ ProjectWorkspace → 本地 Adapter → Bridge

游戏预览
  └─ 现有 Runtime／主题；作者工具栏仍归 AGUI
```

1. **宿主保持薄层。** Main 不承载重型构建；先验证 `utilityProcess` 能运行所需 Node 依赖。按实际消费提取 Bridge 的 Node 公共入口，不让桌面壳依赖 Editor store 内部实现。主进程、preload、服务入口可使用现有 TS 构建工具，Nuxt 继续构建 Renderer。
2. **沿用项目接口。** 角色、立绘、音频、源码与预览共享当前 ProjectWorkspace、项目 revision 和资源清单。优先复用 `@advjs/assets`、`@advjs/parser`、`@advjs/core` 的模型与序列化，避免桌面专用存档格式或全量重写 Markdown 丢失未知字段。
3. **只暴露有限能力。** 默认 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。Preload 不暴露原始 `ipcRenderer`、任意 shell、任意路径读写或 `require`；校验 IPC 调用方与参数。文件服务保留项目根目录、路径穿越／符号链接限制和会话验证。
4. **分清可信宿主与项目内容。** Bridge 凭据不进入日志、文档、用户持久化存储或公共 Editor SDK；首版静态 UI 插件仍由显式 catalog 装配。可执行项目配置遵循现有信任边界，不把打开文件夹变成任意脚本自动执行。若预览需要执行项目代码，使用不带桌面 preload 和凭据的独立文档／WebContents；同一 DOM 下的主题作用域不是权限隔离。
5. **生命周期属于宿主。** 监听器、SSE、媒体、Blob URL、构建进程和本地端口在切换项目／退出时清理。用 session/revision 标识丢弃旧项目的异步结果。服务仅绑定 loopback，使用动态端口和 ready 握手，不能固定等待几秒或依赖 3000 端口。
6. **离线工具链要随包可用。** 生产路径来自打包资源，不引用源码工作区、全局 pnpm、系统 Node 或开发服务器。分别验证 Electron 内嵌 Node 版本、Vite/ESM、源码包/SFC、动态 import、ASAR 和原生依赖，不把开发机成功等同于自包含成功。
7. **pnpm 打包先做小验证。** Forge 官方提示其依赖收集对符号链接有限制。先验证独立打包 staging、显式资源和所需运行时依赖；不要为桌面包擅自改动整个 monorepo 的依赖布局。若证据表明必须调整打包器，记录原因、替代实现和验证结果，只保留一套发布管线。
8. **界面继续现有设计体系。** 遵循 `docs/about/design/design-system.md`、`docs/agui/design.md`、游戏与 Studio 各自规范；原生窗口行为优先，不新增装饰性自绘标题栏。桌面能力用明确的宿主检测接入，Web 不依赖 `window` 上存在 Electron API。

## 分阶段任务

### P0：基线与打包可行性

- [x] 记录 Git 分支、upstream、已有改动和相关检查基线；保留原有修改，识别直接相关的未提交前置工作。
- [x] 阅读根目录及子目录 AGENTS、UI 规范、Editor UI 插件文档；核对项目数据格式与命令，不从截图或历史文案推断 API。
- [x] 固定经当前官方文档核对的 Electron／Forge 版本，依赖写入 pnpm catalog，遵守现有安装脚本、release-age 与信任策略。
- [x] 做最小真实打包验证：构建后的 Editor 页面、Bridge 项目读取和 `advBuild` 在打包产物中运行；产物移到工作区外后复验。该结果决定打包 staging 与资源布局。
- [x] 明确支持的项目矩阵：至少包含 golden-project 的 JSON/Markdown 源项目、带本地图片／音频的项目，以及一个现有 CLI/Vite 项目。任意第三方依赖项目若不支持，提前诊断，不能伪装成功或自动安装执行脚本。

交付：`apps/desktop` 最小结构、架构决策、可行性日志；发现打包障碍先解决，不能推迟到全部 UI 做完。

### P1：打开、关闭与恢复项目

- [x] 增加原生「打开项目」和最近项目入口，取消选择保持当前状态；无效目录、目录移除、权限错误有可恢复提示。
- [x] 启动受管理 Bridge 并连接现有 ProjectWorkspace；增加最小桌面宿主接口及类型声明。桌面模式不依赖 `showDirectoryPicker` 和用户手动复制 token。
- [x] 支持保存、关闭、切换、退出快捷键和原生菜单，复用已有命令行为；项目切换前处理未保存内容，取消切换保留草稿。
- [x] 重启时根据最近项目重新创建服务与凭据；处理服务崩溃、窗口刷新、恢复失败和再次打开，退出后不残留子进程／监听端口。

交付：真实 Electron 打开 fixture、刷新窗口与重启的验证证据。

### P2：角色、立绘、音频项目编辑

- [x] 角色列表／树／检查器从当前项目读取；新增、修改、删除、立绘变更走统一 workspace。无需另外填写服务器绝对目录，不能回退到不可用的 Nitro API。
- [x] 核验角色正文描述、未知 frontmatter、ID、立绘和关系的 round-trip；保存失败保留草稿并显示失败，不触发成功 toast。删除保持现有确认／撤销交互，避免误删共享资源。
- [x] 立绘支持原生选择图片并复制到项目资源目录，保存相对路径或现有 asset ID；重复名称、重名文件、替换／移除、缺失资源给出明确结果。
- [x] 音频支持本地导入、名称／描述及现有模型支持的用途编辑、保存资源引用、试听／暂停／移除；音频库浏览仍可保留为独立来源，不能只写 `localStorage` 冒充项目保存。
- [x] 复用 `adv/assets.json` 及已有 includes/Profile 解析。只在确有模型缺口时补共享类型及迁移说明；不新增平行资源清单。
- [x] 为真实用例补齐目录创建、受限二进制导入和资源读取；保证字节不损坏，正确媒体类型，验证音频跳转／播放生命周期，按实际需要支持 Range 或受管理 Blob。

交付：编辑后落盘的文本与二进制证据；关闭并重开仍能读取和试听。

### P3：保存、外部刷新与冲突

- [x] 保存时采用现有 patch 机制，核验当前 revision，保证单文件写入完整；跨文件资源导入需要失败清理或可恢复状态，不能谎称天然多文件原子性。
- [x] 监听外部增加／修改／删除的角色、图片、音频与脚本，去抖刷新目录、资源缓存、检查器和预览数据；避免把应用自身写入变成无限刷新。
- [x] 外部变化遇到未保存编辑时保留双方内容并让作者选择；切换项目后旧事件、旧请求和旧媒体不能污染新项目。
- [x] 项目重开验证真实磁盘状态；权限错误、资源缺失与服务失联可以重试。替换同路径图片／音频后，不能继续显示或播放旧缓存。

交付：自动化断言与实际 UI 冲突处理、资源替换验证。

### P4：游戏预览与 Web 构建导出

- [x] 复用现有游戏 Runtime 和 Pixi 预览；开始、推进、选择、重开、停止以及角色立绘／BGM 能正常运行，无新增未处理异常。隐藏或退出后停止媒体。
- [x] 明确预览与导出的数据版本：首版从已保存项目启动；有草稿时提供「保存并继续／取消」，写入失败不得继续构建。已经支持的浏览器草稿预览行为不被无意改变。
- [x] 导出调用 `advBuild` 服务而不是 `adv export` 录屏入口；先进行项目校验，显示任务状态、日志、结构化错误和取消入口。
- [x] 构建到受管理的临时输出，成功后再交付用户选择的目录／ZIP；拒绝覆盖项目源码和应用资源目录，对现有目标内容提供明确处理。ZIP 不包含源码凭据、应用配置、日志或桥接 token。
- [x] 核验 Vite 的输出清理、临时 `index.html`、构建取消和异常退出；选择受控构建副本或可恢复的清理策略，不能强杀任务后遗留源文件改动。
- [x] 导出后可定位产物；在关闭 Electron 与原 Bridge 后，从独立静态服务器打开解压产物，验证相对资源、路由、人物、立绘、音频和对话选择。

交付：断网本地预览、真实导出目录和 ZIP、独立运行证据；失败／取消不会留下成功状态或破坏源项目。

### P5：整体验收、文档与收尾

- [x] 提供统一开发／构建／打包／测试入口，建议 `desktop:dev`、`desktop:build`、`desktop:package`、`desktop:make`、`desktop:test`；文档解释 build/package/make 与「游戏导出」的区别。
- [x] 新增独立 Electron Playwright 配置，复用已有 fixture 和断言，不把 Electron 测试误放进 Firefox/WebKit 项目，也不无意启动所有 demo 服务。
- [x] 单测覆盖项目会话、路径限制、二进制保存、失败传播、保存冲突和任务清理等实际风险；集成测试经过 Renderer → Bridge → 磁盘，关键业务与构建不使用全链路 mock 替代。
- [x] 运行受影响 lint／类型检查、Editor 与 Studio 构建及相关单测，回归 Web 本地项目和 Studio 角色／立绘／音频／预览。已有失败单独记录基线，不能为了绿灯删除测试或降低断言。
- [x] 按下方验收表检查打包后客户端，截图保留正常桌面、约 320px 面板及必要亮暗主题／键盘状态。记录产物位置、日志和复现步骤。
- [x] 新增桌面使用文档与开发说明，更新 Editor 入口文档和文档导航、构建说明、支持矩阵、已知限制；若宿主规则变化，在 AGENTS 添加指向正式文档的简短规则。
- [ ] 复核本任务 diff，按 Conventional Commits 分阶段提交并推送当前合适分支。逐文件／逐 hunk 暂存，不能全量暂存既有脏工作区；不得 force push。核验推送后的提交 SHA。

## 必须留下证据的验收表

| 编号 | 操作                                           | 通过条件                                                                        |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| A1   | 在真实打包客户端打开 fixture，路径含中文和空格 | 无需本仓库／系统 Node/pnpm；当前项目明确，取消或无效目录不破坏现有会话。        |
| A2   | 创建、编辑、删除角色，编辑正文与立绘关系       | 磁盘格式正确，未知字段／正文保留；失败不报成功；重开结果一致。                  |
| A3   | 导入、替换并移除一张立绘                       | 资源字节完整，项目引用有效，同路径替换立即可见，缺失资源有提示。                |
| A4   | 导入与编辑音频，试听、暂停、跳转并切换面板     | 本地资源可用，元数据持久化，离页／切换项目停止音频。                            |
| A5   | 用外部进程改写／删除资源，并制造草稿冲突       | UI 刷新，冲突可选择，草稿不丢；旧项目事件不能污染新项目。                       |
| A6   | 重载窗口、关闭并重启、切换项目、杀停服务       | 可恢复或可重试，凭据重新生成，无监听器／媒体／端口泄漏。                        |
| A7   | 断网运行游戏预览                               | 本地角色、立绘、BGM、对白、选择、重开正常；无 Pixi 未处理异常或编辑器主题污染。 |
| A8   | 导出目录与 ZIP，再取消／故意触发一次构建失败   | 成功产物可定位，失败可诊断，取消后无成功状态，源项目与既有目标数据保持完整。    |
| A9   | 关闭 Electron 后在独立 HTTP 服务运行解压产物   | 无桌面 Bridge 依赖，无源码绝对路径和 token；完整玩法及资源可用。                |
| A10  | 无桌面 API 的浏览器 Editor 与 Studio 回归      | 打开、编辑、保存、资源读取及预览无回归；Studio 视觉保持独立。                   |
| A11  | 调用无授权文件／IPC 路径，检查预览环境         | 不越过当前项目授权边界；项目预览不能获得通用 Node／桌面权限。                   |
| A12  | macOS arm64 打包验收与平台记录                 | 有真实运行证据；其他 OS 按已构建／已运行／未验证区分，不能笼统宣称全平台完成。  |

## 验证命令与报告

以下已有命令可作为起点，执行时检查实际 scripts。新增桌面命令由实现补齐后使用，不把本节当作已可执行的脚手架：

```bash
pnpm build:advjs
pnpm editor:build
pnpm -C editor/core typecheck
pnpm studio:build
pnpm -C apps/studio exec vitest run
pnpm exec vitest run tests/unit/editor-bridge.test.ts tests/unit/editor-local-adapter.test.ts tests/unit/editor-local-assets.test.ts tests/unit/editor-workspace.test.ts tests/unit/editor-resource-panels.test.ts tests/unit/editor-build-contract.test.ts tests/unit/project-roundtrip.test.ts
pnpm docs:check
```

另外运行本次新增桌面测试、受影响文件 lint，以及独立配置的 Electron E2E 和 Web/Studio 相关流程。选定 Electron 版本时检查 Playwright 的 Electron 支持限制，不为了测试方便关闭生产隔离设置。

验收报告建议写入 `docs/reports/electron-desktop-acceptance.md`，逐项记录：环境与版本、fixture、开发／生产模式、命令及结果、截图／trace／日志／安装产物、A1–A12 状态、已知问题和对应提交。目标尚有必需项未完成时不能标记 Goal complete；可选平台未验证必须与首版完成范围一起说明。

## 官方资料与决策依据

- [Electron 进程模型](https://www.electronjs.org/docs/latest/tutorial/process-model)：主进程、渲染进程和 preload 分工。
- [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process)：可启动带 Node.js 的子进程；本计划用于避免重型任务占用窗口主进程，具体依赖兼容性须实测。
- [Electron 进程沙箱](https://www.electronjs.org/docs/latest/tutorial/sandbox)：Renderer 的 Node 集成与沙箱边界。
- [Electron Forge 入门](https://www.electronforge.io/)：打包／分发工具链及 pnpm 符号链接相关限制。采用 staging 是针对本仓库的实施建议，不是已验证的现成方案。
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)：Electron 自动化目前仍标为实验支持，应验证选定版本及打包产物。
