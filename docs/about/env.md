# 环境配置

从干净仓库安装依赖、构建引擎，再启动游戏 Demo 或 Editor。以下命令在仓库根目录运行；只制作游戏时请先阅读[快速开始](/guide/quick-start)。

## 安装工具与依赖

需要 Git、[Node.js](https://nodejs.org/en/download/) **24.15.0 或更新的兼容版本**，以及 [pnpm](https://pnpm.io/installation)。以根目录 `package.json` 的 `engines` 和 `packageManager` 为准，当前固定使用 **pnpm 12.12.1**。子包允许较旧 Node.js，不代表整个仓库支持该版本。

```bash
git clone https://github.com/YunYouJun/advjs.git
cd advjs
node --version
pnpm --version
pnpm install --frozen-lockfile
```

请按 pnpm 官方安装说明安装所需版本；已安装 Corepack 时可以使用 `corepack pnpm --version` 检查项目声明的版本。不要混用 npm/yarn 安装依赖，也不要为了安装成功删除锁文件或关闭仓库的依赖安全策略。

## 构建并启动 Demo

工作区依赖会引用包的 `dist` 产物，安装依赖不等于已经构建。首次启动先按依赖顺序构建：

```bash
pnpm build:advjs
pnpm demo
```

`build:advjs` 依次构建 types、assets、unocss、parser、core、devtools 和 advjs。`demo` 启动 `demo/starter`，默认地址为 `http://localhost:3333`，以终端实际打印的地址为准；浏览器不会自动打开。进入游戏后确认能显示首句对白并推进剧情。

修改包源码后可重新运行 `pnpm build:advjs` 并重启 Demo。`pnpm dev` 会并行生成各包和插件的开发 stub，适合熟悉工作区后的开发，不替代首次有序构建；不要让 stub 任务与正式构建同时写入同一个 `dist`。

## 启动 Editor

Editor 使用额外工作区包、插件和 Nuxt 生成文件，不能只做 Demo 的构建：

```bash
pnpm prepare:workspace editor
pnpm editor
```

准备命令会构建全部 `packages/*`、插件并执行 `nuxt prepare`。等待成功后，在浏览器打开终端显示的地址（默认 `http://localhost:3000`），确认欢迎页或工作区加载。这里启动的是 Web Editor；Electron 主进程与桌面打包见[桌面客户端指南](/guide/editor/desktop)。Studio 是独立应用，不要用它的启动命令代替 Editor。

## 验证与下一步

先跑一个不依赖浏览器的运行时测试：

```bash
pnpm exec vitest run tests/unit/runtime/core-runtime-entry.test.ts
```

预期两个测试通过。其中依赖闭包测试会读取 `packages/core/dist/runtime.mjs`，因此必须先构建。完整测试、源码断点、CLI 调试和故障排查见[贡献者调试指南](/contributing/debugging)。剧情诊断、会话 trace 与存档迁移见[运行时调试与迁移](/guide/runtime/debugging-and-migration)。
