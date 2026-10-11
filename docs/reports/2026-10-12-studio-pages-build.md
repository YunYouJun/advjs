# Studio Pages 构建耗时调查与优化

- 日期：2026-10-12，Asia/Shanghai。
- 状态：优化实现与干净构建验证完成；Pages 缓存和监视路径已在线更新。云端效果须以优化提交对应的部署阶段和日志确认。
- 范围：Cloudflare Pages `advjs-studio`，构建入口 `pnpm studio:build`。

## 实际瓶颈

通过现有 Wrangler 登录调用 Cloudflare Pages API，分别检查部署阶段和构建日志。

| 部署                                                                                                                                  | 环境       | 排队        | 构建阶段（含安装依赖） | 部署  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------- | ----- |
| [3b9fc286](https://dash.cloudflare.com/ecac80638e001ece1b79584ffef5e65a/pages/view/advjs-studio/3b9fc286-a98d-4541-8703-233b836afe35) | Preview    | 25 分 20 秒 | 4 分 49 秒             | 19 秒 |
| [e52f492f](https://dash.cloudflare.com/ecac80638e001ece1b79584ffef5e65a/pages/view/advjs-studio/e52f492f-14ea-47e8-a924-1edf9609c374) | Production | 15 分 9 秒  | 6 分 57 秒             | 12 秒 |

用户提供的 [c08fc341 部署](https://dash.cloudflare.com/ecac80638e001ece1b79584ffef5e65a/pages/view/advjs-studio/c08fc341-e957-461e-85b9-371eb7d9ec13)
在 2026-10-11 23:58:51（Asia/Shanghai）的 API 快照中仍处于 `queued/active`，
从 23:19:47 起已排队约 39 分钟，初始化、克隆和构建都没有开始，构建日志为零条。
长等待的直接原因是平台排队；现有数据不足以确定是账户并发额度还是平台调度容量。

前一个 Preview 构建日志还显示：

- 安装全部 54 个工作区的依赖，耗时 43.3 秒。
- `prepare:workspace studio` 选择全部 19 个包和 11 个插件，实际执行 23 个构建脚本。
- 工作区准备约 104 秒，包含 Studio 不使用的 CLI、MCP、创建器、开发工具和插件。
- Studio 类型检查约 15 秒；Vite 同时生成现代浏览器和旧浏览器版本，处理 6215 个模块。

线上构建命令原本就是 `pnpm studio:build`。CloudBase README 中要求先运行
`pnpm run build` 的说明已经过时，重复构建没有发生在上述线上部署中。

## 修复与线上配置

- `scripts/prepare-workspace.mjs` 的 Studio profile 改为
  `pnpm -r --filter '@advjs/studio^...' run build`，按拓扑顺序构建完整依赖图，并由
  `studio:build` 执行 Studio 自身构建。选择器自动包含新增依赖，不依赖手写包列表。
- 保留 Studio 的 `vue-tsc` 和默认 legacy 构建；关闭 Vite 的 gzip 大小估算，省去仅用于日志展示的压缩工作。
- GitHub CI 增加 `studio-pages-build` 并纳入 `launch-required`，在干净 runner 中执行与 Pages 相同的命令，验证 `index.html` 和 `sw.js`。
- 更新 `apps/studio/cloudbase/README.md` 的构建入口、缓存与监视路径说明。
- 在线设置 `build_config.build_caching=true`，并在原有排除路径中追加 `docs/*`，保留包含路径 `*`。
  PATCH 后重新 GET 验证成功；构建命令、输出目录、根目录及部署环境配置均与修改前一致。

[Pages 构建缓存](https://developers.cloudflare.com/pages/configuration/build-caching/)
可复用 pnpm 下载缓存，本项目的 Vite 编译产物不属于其自动缓存范围。
[构建监视路径](https://developers.cloudflare.com/pages/configuration/build-watch-paths/)
排除纯文档变更；有其他文件变更的混合提交仍触发构建。Studio 会打包
`examples/ai-contest/` 的 Markdown，不能整体排除 `examples/`。

这些设置减少后续构建工作与无关触发，不能强制已排队任务获得执行资源。

## 验证结果

环境：macOS，Node.js 24.18.0，pnpm 11.20.0。将当前工作区源码复制到独立临时目录，
不复制 `node_modules`、既有 `dist` 或本地环境变量文件，再从 pnpm 本地 store 安装锁定依赖。
快照包含工作区已有的未提交音频改动，因此比上述线上提交多一个 `@advjs/audio` 包。

```bash
pnpm --filter '@advjs/studio...' install --frozen-lockfile --offline
pnpm studio:build
pnpm vitest run tests/unit/tooling/workspace-preparation.test.ts tests/unit/tooling/ci-workflow-contract.test.ts --reporter=default
```

- 安装成功，耗时 17 秒；完整构建成功，耗时 116.10 秒，其中 Vite 为 54.17 秒。
- 依赖图含 10 个工作区，实际运行 9 个构建脚本：types、unocss、gui、audio、assets、parser、core、agent 和 plugin-interactions。
- 未执行 `advjs`、`mcp-server` 或其他插件的构建。
- 验证 `index.html`、`sw.js`、`manifest.webmanifest` 均存在，HTML 的 22 个本地资源引用全部可解析。
- HTML 保留 `nomodule` 入口，生成 203 个 legacy JavaScript 资源。
- 两个相关测试文件共 6 项测试通过；所有修改文件的 ESLint 和 `git diff --check` 通过。

116.10 秒是本机当前源码快照的结果，不能与不同提交、不同机器的云端结果直接计算提速比例。
提交并部署优化代码后，再比较 Pages 的排队、依赖安装、工作区准备与 Vite 阶段耗时。

## 独立提交验证

为排除原工作区的其他未提交改动，基于最新 `origin/dev`（`cbc6bba0`）创建干净工作区，
仅应用本次优化的 7 个文件；依赖清单、锁文件和业务代码均采用该远端提交。

- `pnpm install --frozen-lockfile --offline` 成功，耗时 22.3 秒。
- `pnpm studio:build` 成功，耗时 112.31 秒；依赖图含 9 个工作区，实际执行 8 个构建脚本。
- 该远端版本不包含尚未提交的 `@advjs/audio`，因此构建脚本数量比前述源码快照少一个。
- 相关测试共 7 项通过；修改文件的 ESLint 与 `git diff --check` 通过。
- 网页入口、PWA 与旧浏览器兼容资源完整。
