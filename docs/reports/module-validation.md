# ADV.JS 模块问题修复与验证

验证日期：2026-10-05。环境：Node.js 24.18.0、pnpm 11.20.0。

## 修复范围

本次处理上一轮全仓 `pnpm typecheck` 报告的全部 68 条错误，覆盖 AI、benchmarks、Core、create-adv、Flow、MCP Server、Parser Playground、WebContainer 和插件。

- 使用 `pnpm install --frozen-lockfile --ignore-scripts --offline` 恢复 49 个工作区项目的依赖。64 条缺失模块及其连带类型错误随之消失，无需更改 SDK 调用或放宽类型检查。
- Core 的 `MaybeRef`、`MaybeRefOrGetter` 改为从 Vue 导入，删除两处过期的 `@ts-expect-error` 和无效的 `@ts-nocheck`。
- MCP 工作区工具以 `CallToolResult` 检查返回契约，并将结构化快照展开为普通对象，解决两处 SDK 回调类型错误，保持返回字段不变。
- 为没有独立包清单的 Flow 源码在根工具依赖中声明 `mitt`；为 WebContainer 声明 `@xterm/addon-fit`。两项均通过 pnpm catalog 管理并更新锁文件，不依赖其他包的间接提升。
- ESLint 忽略 `.superdesign` 设计工具生成的上下文摘录，与已有工具缓存目录同类处理；不改写摘录，不排除任何源码模块。
- CLI JSON 回归改为启动构建后的真实 `adv` 可执行入口，避免每个子进程通过 tsx 重复编译源码；将使用方式、校验、构建和内部错误拆成独立测试，避免多个命令争用同一份测试超时预算。原有断言和超时上限保留。

## 验证

| 检查                                                        | 结果                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 全仓 `pnpm typecheck`                                       | 通过，68 条错误全部消失                                           |
| `pnpm build`                                                | 通过，全部 12 个具备 build 脚本的基础包完成构建                   |
| `pnpm build:plugins`                                        | 通过，全部 7 个具备 build 脚本的插件完成构建                      |
| `pnpm -C editor/core exec nuxt prepare`                     | 通过，生成回归测试所需类型                                        |
| `pnpm install --frozen-lockfile --ignore-scripts --offline` | 最终复核通过，49 个工作区项目与锁文件一致                         |
| `pnpm exec eslint . --max-warnings 0`                       | 排序修复后通过，0 个 error、0 个 warning                          |
| `pnpm docs:check`                                           | 通过，38 个文档文件                                               |
| `pnpm exec tsc -p tests/tsconfig.static-diagnostics.json`   | 通过，静态诊断相关代码严格类型检查                                |
| 单元、包及插件回归                                          | 修复后合计 115 个文件、505 项测试通过；CLI 文件单独复跑，详见下文 |
| `git diff --check`                                          | 通过                                                              |

回归命令：

```bash
pnpm vitest run tests/unit packages plugins --reporter=default
pnpm vitest run tests/unit/cli-json-output.test.ts --reporter=default
```

首轮广泛回归中，CLI 之外的 114 个文件、497 项测试全部通过，包含静态诊断 17 项、MCP 工作区 5 项、音频和 WebContainer 回归。CLI 原有 6 项测试中的 2 项因 20 秒测试预算和 15 秒子进程预算超时失败，并非错误码或 JSON 断言失败。修正启动入口和测试拆分后，单独复跑 CLI 的全部 8 项测试均通过，耗时约 20 秒（包含一次生产构建）；未改动已通过的其他测试或产品代码。合计 497 + 8 = 505 项。

后续按“修复排序警告”的要求清理 93 个 Vue 文件中的 330 条 UnoCSS 警告（295 条类名排序、35 条属性排序）。排序修复完成时，经 Vue 解析器逐文件比较，脚本、样式、自定义块内容一致；模板仅有类名、无值属性顺序及空白变化，绑定、事件和属性集合保持一致。复核期间新增的 `ProjectContextView.vue` 格式错误也仅调整空白，保留其功能改动。工作区随后并行发生的 AGUI 按钮、工具栏视觉更新保持原样，不计入本次排序变更的结构对比。

本报告覆盖上述模块检查、构建及回归；未运行完整浏览器 E2E 或调用真实第三方云服务。排序修复未修改视觉设计和组件行为，未新增测试或重跑整套构建。

所有安装均使用本地缓存，未升级现有依赖版本。没有新增类型抑制、关闭严格检查或跳过失败测试。
