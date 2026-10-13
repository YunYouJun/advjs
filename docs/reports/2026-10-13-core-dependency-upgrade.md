# 主要依赖升级验证记录

日期：2026-10-13。状态：本地验证记录，最终版本由 PR 的 GitHub CI 验证。范围：主要运行时、构建工具链和测试工具链；不包含业务 SDK、全部插件依赖或新 npm 版本发布。

## 版本选择

使用公共 npm registry 的版本发布时间，审计时间为 `2026-10-12T17:59:26.683Z`，24 小时截止时间为 `2026-10-11T17:59:26.683Z`。选择截止时间前已发布的最高稳定版本；现有预览版本不自动升级或降级。仓库依赖年龄设置调整为 1440 分钟，保留严格模式。Node LTS 已固定为 24.21.0，此次没有修改 Node 版本。

| 依赖                           | 原版本                        | 目标版本   | 发布日期（UTC） |
| ------------------------------ | ----------------------------- | ---------- | --------------- |
| `pnpm`                         | `11.20.0`                     | `12.12.1`  | 2026-10-11      |
| `electron`                     | `44.4.5`                      | `44.7.0`   | 2026-10-07      |
| `devframe`                     | `1.1.0`                       | `1.2.3`    | 2026-10-07      |
| `@devframes/vite`              | `1.1.0`                       | `1.2.3`    | 2026-10-07      |
| `@devframes/service-shiki`     | `1.1.0`                       | `1.2.3`    | 2026-10-07      |
| `@intlify/unplugin-vue-i18n`   | `^11.2.4`                     | `^11.2.5`  | 2026-08-14      |
| `@playwright/test`             | `^1.63.0`                     | `^1.64.0`  | 2026-10-07      |
| `@shikijs/markdown-exit`       | `@shikijs/markdown-it ^4.4.2` | `^4.5.0`   | 2026-10-01      |
| `@shikijs/vitepress-twoslash`  | `^4.4.2`                      | `^4.5.0`   | 2026-10-01      |
| `@tanstack/vue-virtual`        | `^3.13.35`                    | `^3.13.41` | 2026-10-11      |
| `@types/node`                  | `^24.13.3`                    | `^24.19.2` | 2026-10-09      |
| `@types/three`                 | `0.183.1`                     | `0.186.0`  | 2026-09-11      |
| `@unhead/vue`                  | `^3.4.1`                      | `^3.4.2`   | 2026-09-29      |
| `@vitejs/plugin-legacy`        | `^8.2.2`                      | `^8.2.3`   | 2026-08-06      |
| `@vitejs/plugin-vue`           | `^6.0.9`                      | `^6.0.10`  | 2026-10-10      |
| `@vitest/ui`                   | `^5.0.2`                      | `^5.0.3`   | 2026-09-30      |
| `beasties`                     | `^0.3.5`                      | `^0.5.4`   | 2026-09-04      |
| `eslint`                       | `^10.11.0`                    | `^10.12.0` | 2026-10-02      |
| `jsdom`                        | `^30.0.1`                     | `^30.1.2`  | 2026-10-04      |
| `lint-staged`                  | `^17.3.0`                     | `^17.6.0`  | 2026-09-26      |
| `markdown-it`                  | `^15.0.0`                     | `^15.0.2`  | 2026-09-11      |
| `nuxt`                         | `^4.5.2`                      | `^4.6.1`   | 2026-10-09      |
| `oxc-parser`                   | `^0.141.0`                    | `^0.153.0` | 2026-10-05      |
| `pixi.js`                      | `8.21.0`                      | `8.22.0`   | 2026-10-01      |
| `reka-ui`                      | `^2.10.5`                     | `^2.11.0`  | 2026-10-05      |
| `rollup`                       | `^4.63.5`                     | `^4.64.5`  | 2026-10-10      |
| `sass`                         | `^1.105.0`                    | `^1.105.1` | 2026-09-29      |
| `shiki`                        | `4.4.3`                       | `4.5.0`    | 2026-10-01      |
| `three`                        | `0.183.2`                     | `0.186.1`  | 2026-09-24      |
| `typedoc-plugin-markdown`      | `^4.12.0`                     | `^4.13.1`  | 2026-09-18      |
| `typedoc-vitepress-theme`      | `^1.1.3`                      | `^1.1.4`   | 2026-09-07      |
| `vite`                         | `^8.3.1`                      | `^8.3.4`   | 2026-10-08      |
| `vite-plugin-dts`              | `^5.0.3`                      | `^5.1.2`   | 2026-10-03      |
| `vite-plugin-inspect`          | `^12.0.2`                     | `^12.1.0`  | 2026-10-09      |
| `vite-plugin-pwa`              | `^1.3.0`                      | `^2.0.0`   | 2026-10-03      |
| `vite-plugin-vue-layouts-next` | `^2.1.0`                      | `^3.3.0`   | 2026-10-09      |
| `vitest`                       | `^5.0.2`                      | `^5.0.3`   | 2026-09-30      |
| `vue-i18n`                     | `^11.4.12`                    | `^11.4.14` | 2026-10-10      |
| `vue-router`                   | `^5.3.1`                      | `^5.4.0`   | 2026-10-07      |
| `vue-tsc`                      | `^3.3.11`                     | `^3.3.13`  | 2026-10-10      |
| `wrangler`                     | `4.119.0`                     | `4.149.0`  | 2026-10-08      |

Vue 3.5.43、Pinia 4.0.3 和 UnoCSS 66.10.5 已是满足条件的最新稳定版本。更晚发布且未满 24 小时的 Vitest 5.0.4、UnoCSS 66.11.0 和 TanStack Vue Virtual 最新补丁未采用。

## 兼容性约束

- TypeScript 保留 5.9.3：当前 unbuild 3.6.1 的 peer range 为 `^5.9.2`；Vue language-tools 仍调用 TypeScript 的 JavaScript 编译器 API，TypeScript 7 改为原生编译器与不同导出。
- Monaco 保留 0.55.1：y-monaco 0.1.6 使用的编辑器子路径不兼容 Monaco 0.56 及之后版本。
- Parser Playground、Playground 与 VRM 的 Markdown 渲染使用 markdown-exit，Shiki 更换为官方 `@shikijs/markdown-exit` 适配器及 `markdownSetup` hook。已直接转换含代码块和外链的 Markdown，确认双主题高亮和外链属性。
- Layouts 3 的虚拟模块新增 runtime 导入；从 ADV.JS 的依赖位置解析该模块，使独立项目根目录也能构建。路径解析回归检查在修复前失败。
- pnpm 12 为不同入口生成独立 peer context；i18n 测试按各消费包实际解析的路径 mock locale compiler，继续检查默认启用、显式启用和交给宿主处理三种行为。

- pnpm 12 的 workspace 自动编辑要求块状 YAML；消费者验证配置改用 YAML 序列化。锁文件验证遍历全部 YAML 文档，并检查后续文档中的本地引用及解析错误。
- pnpm 12 拒绝带 CRLF shebang 的 bin 文件；Git attributes 将可执行脚本固定为 LF，避免 Windows checkout 改写脚本头后打包失败。
- Nuxt i18n 的解析别名曾将新版 vue-i18n 指向旧版 shared；对齐 `@intlify/core-base`、`@intlify/message-compiler`、`@intlify/shared` 的 11.x 运行时到 11.4.14。
- SSR 将 vue-i18n 与 `@intlify/*` 一并打包，避免输出中的外部导入被宿主解析到不同版本的 shared 包。Playground 的 10 个页面和 Beasties critical CSS 生成已通过。
- VRM 的 Devframe 工具链对齐到 1.2.3，并显式声明所需 peer；Vite SSG 的 Beasties 0.5.4 peer 范围例外经过实际生产构建验证。

- 桌面自动化单独固定 Playwright 1.63.0，Web 测试使用 1.64.0。相同打包应用在 Electron 44.4.5 与 44.7.0 下，1.64 无法发现已显示的 BrowserWindow；1.63 的启动与导出验收通过。失败记录包含脱敏进程日志与主进程窗口状态。

## cssnano 发布来源核验

pnpm 的 `no-downgrade` 将早期带 `_npmUser.approver` 的发布排在 OIDC 可信发布之上。Nuxt 4.6.1 引入的 cssnano 9 系列因此受到拦截。对下列 30 个具体版本核验 npm registry 签名、下载归档 SHA-512、provenance subject 的归档摘要，以及 provenance 中的 `cssnano/cssnano` 官方仓库与发布 workflow 后，添加精确版本例外并固定相关 9.x 解析。没有按整个包名或组织添加例外；后续版本仍需通过信任策略。原有 `trustPolicyIgnoreAfter: 10080` 保持不变。

这些归档的 provenance 指向 [官方发布 run 38086395065](https://github.com/cssnano/cssnano/actions/runs/38086395065) 和 [官方发布 run 37803651022](https://github.com/cssnano/cssnano/actions/runs/37803651022)。这里记录声明来源和 registry 签名核验，不声称独立验证了完整 Sigstore 证书链。

| 包名                                 | 精确版本 |
| ------------------------------------ | -------- |
| `cssnano`                            | `9.6.0`  |
| `cssnano-preset-default`             | `9.6.0`  |
| `cssnano-utils`                      | `9.0.0`  |
| `postcss-colormin`                   | `9.0.8`  |
| `postcss-convert-values`             | `9.0.9`  |
| `postcss-discard-comments`           | `9.0.8`  |
| `postcss-discard-duplicates`         | `9.0.7`  |
| `postcss-discard-empty`              | `9.0.8`  |
| `postcss-discard-overridden`         | `9.0.6`  |
| `postcss-merge-longhand`             | `9.4.0`  |
| `postcss-merge-rules`                | `9.1.4`  |
| `postcss-minify-font-values`         | `9.0.9`  |
| `postcss-minify-gradients`           | `9.0.8`  |
| `postcss-minify-params`              | `9.0.8`  |
| `postcss-minify-selectors`           | `9.0.8`  |
| `postcss-normalize-charset`          | `9.0.6`  |
| `postcss-normalize-display-values`   | `9.0.7`  |
| `postcss-normalize-positions`        | `9.0.8`  |
| `postcss-normalize-repeat-style`     | `9.0.7`  |
| `postcss-normalize-string`           | `9.0.7`  |
| `postcss-normalize-timing-functions` | `9.0.7`  |
| `postcss-normalize-unicode`          | `9.1.1`  |
| `postcss-normalize-url`              | `9.0.7`  |
| `postcss-normalize-whitespace`       | `9.0.8`  |
| `postcss-ordered-values`             | `9.0.9`  |
| `postcss-reduce-initial`             | `9.0.7`  |
| `postcss-reduce-transforms`          | `9.0.6`  |
| `postcss-svgo`                       | `9.0.6`  |
| `postcss-unique-selectors`           | `9.0.6`  |
| `stylehacks`                         | `9.0.8`  |

## 验证

环境：macOS arm64、Node 24.21.0、pnpm 12.12.1。

- 冻结安装：通过。
- ESLint：完整检查及改动文件检查通过。
- 类型检查：通过。
- 单元测试：244 个文件通过、1 个文件跳过；1752 项通过、2 项跳过。Devframe 最后对齐后的完整检查由 GitHub CI 再次运行。后续消费者配置调整另通过 22 项工具链测试。
- 包及插件构建、文档构建、Parser、VRM、Editor 页面构建和 Playground SSG 构建：通过。
- pnpm 12 公共指定版本验证：`pnpm create adv@0.1.4` 游戏及插件的安装、检查、构建通过，游戏预览 HTTP 200。
- peer dependency 检查：通过。
- GitHub CI：以本改动 PR 的检查记录为准。

参考 [pnpm 12 发布说明](https://github.com/pnpm/pnpm/releases/tag/v12.0.0)、[依赖年龄与信任策略](https://pnpm.io/settings/dependency-resolution)、[Shiki markdown-exit 适配器](https://shiki.style/packages/markdown-exit)。
