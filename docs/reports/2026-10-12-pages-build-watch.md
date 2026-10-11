# Studio、Editor、VRM 的 Pages 构建触发规则

- 日期：2026-10-12，Asia/Shanghai。
- 范围：`advjs-studio`（Studio）、`advjs`（Editor）、`advjs-vrm`（VRM）。
- 状态：三个项目的线上规则已同步并重新读取验证；45 项回归检查和 ESLint 通过。实际推送的触发结果按下述流程核对。

## 触发范围

原先三个项目的包含路径均为 `*`，仅 Studio 排除了 `docs/*`。
同一次推送会触发多个无关的站点构建，竞争账号共享的构建并发额度。

权威规则保存在 `config/cloudflare-pages-build-watch.json`。各项目监听自己的应用源码、
配置和实际依赖目录；锁文件、workspace/catalog、根 package、TypeScript 配置、
pnpm patch 和运行时版本配置属于共享输入，仍触发三个项目。

| 变更                                                                  | Studio         | Editor         | VRM            |
| --------------------------------------------------------------------- | -------------- | -------------- | -------------- |
| Studio 网页源码、public、Vite、UnoCSS、legacy 配置                    | 构建           | 跳过           | 跳过           |
| Editor 应用源码与 Nuxt 配置                                           | 跳过           | 构建           | 跳过           |
| VRM 应用源码与 Vite、UnoCSS 配置                                      | 跳过           | 跳过           | 构建           |
| `examples/ai-contest/` 剧情                                           | 构建           | 跳过           | 跳过           |
| Editor diagnostics 插件、引用的 starter 模板与桌面共享文件            | 跳过           | 构建           | 跳过           |
| 引擎、客户端、默认主题和共享依赖配置                                  | 按依赖范围构建 | 按依赖范围构建 | 按依赖范围构建 |
| docs、根 tests、CI 工作流、其他 demo/example、Studio 云函数与原生工程 | 跳过           | 跳过           | 跳过           |

Studio 的比赛剧情通过 `import.meta.glob` 打包，Editor 的 starter 示例、默认模板 README、
默认主题和 Pominis 预览源码也进入产物；不能统一排除 `*.md`、`examples/*` 或所有桌面文件。
应用内 TypeScript 测试仍在各自源码范围内，保留 Studio `vue-tsc` 的输入。
Editor 和 VRM 当前准备命令仍会构建较宽的工作区；此规则按发布产物的依赖判断相关变更。

## 同步与维护

默认命令只输出规则，不访问账号。预测一个提交中所有变更路径的触发结果：

```bash
node scripts/cloudflare-pages-watch.mjs
node scripts/cloudflare-pages-watch.mjs --paths docs/guide/intro.md editor/vrm/src/main.ts
```

使用已有 Cloudflare Pages 写权限的凭证，将账号和令牌放在
`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 环境变量中，然后执行：

```bash
node scripts/cloudflare-pages-watch.mjs --apply
node scripts/cloudflare-pages-watch.mjs --check
```

脚本先核对三个项目的 GitHub 仓库、构建命令和输出目录，再只 PATCH `source` 的路径字段。
应用后重新 GET，检查路径一致，并验证分支规则、构建设置、缓存和环境配置没有改变。
已有生产分支继续采用线上设置：Studio 为 `dev`，Editor 与 VRM 为 `main`；其他分支的预览仍开启。

增加 workspace 依赖或应用外的源码导入时，更新包含路径并运行回归测试后同步线上规则。
测试覆盖工作区依赖链和应用的相对路径导入，防止漏掉新增包、模板素材或共享模块。
纯规则文件和维护脚本变更无需重新编译三个网站；Cloudflare 不会自行读取仓库中的 JSON，
规则修改后必须执行 `--apply`。

## 验证

在独立工作区基于远端 `dev` 的 `1b402111` 提交，仅修改规则、同步脚本、回归测试和本文。
未复制原工作区的其他未提交业务变更，也未修改站点构建命令、依赖清单和锁文件。
45 项测试验证各应用独立触发、混合提交、共享输入、嵌入内容、工作区依赖链、相对路径导入和 API 更新范围。
在线同步后的 GET 确认路径一致，分支、构建命令、输出目录、缓存和部署环境配置均保留。

```bash
pnpm vitest run tests/unit/tooling/cloudflare-pages-watch.test.ts
pnpm exec eslint config/cloudflare-pages-build-watch.json scripts/cloudflare-pages-watch.mjs tests/unit/tooling/cloudflare-pages-watch.test.ts docs/reports/2026-10-12-pages-build-watch.md
node scripts/cloudflare-pages-watch.mjs --check
```

推送仅包含规则、维护脚本、回归测试和本文的提交，核对三个项目该 SHA 的部署记录均跳过，
或未创建部署，且没有进入初始化与构建阶段；同时核对 GitHub 已处理该次推送。
相关应用变更的正向触发由路径矩阵验证，不添加空提交或无效应用改动制造构建队列。

依据 [Cloudflare build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/)，
`*` 匹配包括 `/` 在内的任意字符，排除规则先于包含规则，混合提交中任一有效匹配即可触发。
空推送、包含 3000 个以上文件或 20 个以上提交的推送会绕过路径过滤。
[跳过构建时不会创建 GitHub check run](https://developers.cloudflare.com/pages/configuration/monorepos/#github-check-runs-and-gitlab-commit-statuses)，
因此不能仅凭检查条目缺失认定 webhook 失败，应结合 Pages API 和正常 GitHub CI 事件判断。
