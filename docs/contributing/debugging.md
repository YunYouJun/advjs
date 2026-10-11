# 贡献者调试

定位 ADV.JS 仓库里的引擎、CLI 或 Editor 问题，并用最小测试验证修改。先完成[环境配置](/about/env)中的安装和对应构建；剧情错误、DevTools 报告与旧存档迁移统一查阅[运行时调试与迁移](/guide/runtime/debugging-and-migration)。

## 选择调试入口

- 游戏画面、对白交互：`pnpm demo`，入口为 `demo/starter`、`packages/client` 和 `themes/theme-default`。
- Editor 界面：`pnpm prepare:workspace editor` 成功后运行 `pnpm editor`，入口为 `editor/core/app`。
- 剧情状态转换：`packages/core/src/runtime`，优先使用下面的单文件测试。
- Markdown 编译：`packages/parser` 与 `packages/core/src/compiler`；可使用[Parser Playground](/guide/runtime/debugging-and-migration#parser-playground)查看中间结果。
- CLI 与开发服务器：`packages/advjs/node/cli/index.ts`，使用 Node.js 调试器。

浏览器的 Console / Network 面板适合定位客户端异常与资源加载；终端日志用于 CLI、Vite 和 Nuxt 服务端错误。出现问题时先确定它发生在哪一侧，避免在浏览器中寻找 Node.js 的断点。

## 浏览器源码断点

1. 启动 Demo，打开终端显示的 URL，再打开浏览器开发者工具的 Sources 面板。
2. 用文件搜索打开 `packages/client/composables/useAdvDialogBox.ts`，在 `next()` 的 `if (!printed.value)` 处设置断点，再点击游戏中的对白框。首击可能只补全打字动画；对白完整后再次点击才会调用 `$adv.runtime.next()`。
3. 暂停后检查 Call Stack、局部变量与 Scope，单步进入下一次状态更新。运行时状态也可以在 [ADV.JS DevTools](/guide/runtime/devtools) 中核对。
4. 调试 Editor 时，对 `editor/core/app` 下实际加载的组件使用相同步骤；Nuxt 服务端代码需要 Node.js 调试器。

如果搜索只找到 `dist/*.mjs`，说明该依赖当前使用正式构建产物，不要假设源文件断点一定能映射。可以在实际加载的文件中断点，或在停止正式构建后对需要的包运行开发 stub（例如 `pnpm core:dev`），再重启 Demo。修改后仍未命中时，确认页面和端口、刷新页面，并检查该事件路径是否真正执行。不要直接修改生成的 `dist` 作为修复。

## 最小运行时测试与断点

根目录已有一个包含两项断言场景的最小入口测试：`tests/unit/runtime/core-runtime-entry.test.ts`。它创建只有一句对白的 Program，启动、保存、恢复并推进至结束，还检查已构建运行时的依赖闭包。

```bash
pnpm build:advjs
pnpm exec vitest run tests/unit/runtime/core-runtime-entry.test.ts
```

要逐行跟踪源码，使用 Node.js inspector，只启动一个测试 worker：

```bash
pnpm exec vitest run tests/unit/runtime/core-runtime-entry.test.ts \
  --inspectBrk=127.0.0.1:9229 --no-file-parallelism
```

1. 在 VS Code 中打开仓库，执行 “Debug: Attach to Node Process”，选择监听 9229 的测试进程；也可以在 Chromium 的 `chrome://inspect` 中连接该目标。
2. 在测试中 `await runtime.start()` 这一行设置断点，继续执行至断点；单步进入 `packages/core/src/runtime/create.ts`，观察 `runtime.state` 和 `runtime.current`。
3. 继续执行，确认两个测试通过。只想跑第一项时追加 `-t 'executes a compiled program'`。

`--inspectBrk` 会在调试器连接前暂停，这是预期行为。调试端口只绑定本机，不要暴露到公网。受限容器若禁止创建监听 socket，可先运行不带 inspector 的单文件测试；它不等于已验证断点连接。

修复问题时在对应 `tests/unit/` 文件添加最小复现，先确认修复前失败，再确认修复后通过。较广范围的单元测试需要额外生成文件：

```bash
pnpm prepare:workspace unit
pnpm exec vitest run tests/unit
```

## CLI 源码调试

以下命令从仓库根目录执行已构建 CLI 的只读检查，避免误用全局安装版本：

```bash
pnpm -C demo/starter exec adv check
```

需要对 CLI TypeScript 源码断点时，在 `demo/starter` 目录运行：

```bash
cd demo/starter
node --import tsx --inspect-brk=127.0.0.1:9229 \
  ../../packages/advjs/node/cli/index.ts check
```

在 `packages/advjs/node/cli/index.ts` 设置断点，按上一节连接调试器。命令仍需要前置包构建；`--import tsx` 只负责加载 TypeScript，不负责构建工作区依赖。省略 `--inspect-brk` 可直接执行源码命令。此写法也避免了某些受限环境中 `tsx` CLI 创建 IPC socket 失败的问题。

检查结束后回到仓库根目录再运行其他章节的命令。具体诊断码、`adv play --trace` 和报告分享边界见[运行时调试与迁移](/guide/runtime/debugging-and-migration)。

## 常见故障

- **Node.js 或 pnpm 版本不符**：核对根目录 `package.json`，不是某个子包的 `engines`；重新打开终端后再检查版本。
- **找不到 `dist`、包入口或导出**：先完成相应有序构建；Editor 使用 `prepare:workspace editor`，不能只执行 `build:advjs`。
- **缺少 `.nuxt/tsconfig.json` 或 Nuxt 生成声明**：运行 `pnpm -C editor/core exec nuxt prepare`，再重试；依赖包尚未构建时先完成 Editor 准备命令。
- **端口占用或 URL 无法访问**：以服务终端输出为准，关闭自己启动的旧服务，或使用脚本支持的端口参数。远程容器还需要平台允许的端口转发；不要关闭安全限制来访问本机服务。
- **受限容器报 `listen EPERM` 或 `uv_interface_addresses`**：前者可能来自 `tsx` CLI 的 IPC socket，后者来自开发服务器枚举网卡。CLI 源码可用上面的 `node --import tsx` 在不创建 IPC socket 的情况下运行；开发服务器与 Editor 仍需具备相应权限的开发环境。保留阻塞信息，不将安全限制关闭作为安装步骤。
- **安装缓存目录不可写**：将 `XDG_DATA_HOME` 与 pnpm `--store-dir` 指向自己有权限的目录；记录此环境差异，不修改仓库锁文件。
- **安装缺包或无法连接 registry**：检查网络、代理和缓存是否完整。只有完整缓存才能用于离线安装；`--frozen-lockfile` 报锁文件不匹配时应核对分支与 pnpm 版本，不静默更新依赖。
- **单文件通过但全量检查失败**：保留失败命令和第一条错误，区分本次回归与现有基线。不要把单文件通过写成全量测试通过。

## 验证与问题报告

提交前根据改动范围运行相关测试，以及项目要求的检查：

```bash
pnpm prepare:workspace lint
pnpm lint
pnpm typecheck
pnpm docs:check
pnpm docs:build
```

`docs:build` 还会生成 TypeDoc，可能暴露与文案无关的类型错误；如失败应保留真实错误，不宣称文档构建通过。仅通过测试或 HTTP 请求也不能证明游戏画面、Editor 操作或断点已经在浏览器中通过验证。

问题报告至少包含：提交 SHA、操作系统、Node.js/pnpm 版本、启动目录与命令、最小复现步骤、预期和实际结果、首条报错，以及哪些测试实际通过或被环境阻止。必要时附已脱敏的运行时报告；不要上传密钥、个人路径或未经检查的变量快照。
