# 现有 3D 游戏接入运行时验证

日期：2026-10-08。状态：本地验证完成，上游改动尚未发布。范围：`@advjs/core` 的嵌入入口与 Markdown 终止语义；消费端为 `YunLeFun/dayun-kicker`。

## 从游戏接入得到的改动

游戏已有 Three.js 场景、Vue 界面、输入、配送业务与存档，需要编译后的剧情状态机。新增 `@advjs/core/runtime`，导出既有运行时、插件、条件与快照能力，依赖闭包不包含 Markdown 解析、资源加载或存储模块；新增 `@advjs/core/compiler` 供构建脚本使用。原根入口与 Markdown 便捷接口保持兼容。没有新建第二套运行时或独立包。

消费端将 `.adv.md` 在构建前编译为 JSON，首次交谈才导入运行时。登记和接单通过宿主活动调用原有游戏规则，奖励由原配送结算执行。剧情快照作为原存档的可选字段，取消交谈、旧存档、条件刷新和剧本 hash 变化均由消费端处理。

试点发现单独的 YAML `type: end` 被编译成普通效果，可能继续执行下一个对白分支。现编译为 `end` 节点，保留文本、条件和节点动作；回归测试覆盖分支终止、条件终止以及终止快照恢复。

## 实际验证

以下命令通过：

```bash
pnpm --filter @advjs/core build
pnpm exec vue-tsc --noEmit --pretty false
pnpm exec eslint packages/core/src/runtime/headless.ts packages/core/src/runtime/index.ts packages/core/src/compiler/markdown.ts packages/core/build.config.ts tests/unit/runtime/core-runtime-entry.test.ts tests/unit/runtime/runtime-markdown-end.test.ts
pnpm exec vitest run tests/unit/runtime/core-runtime-entry.test.ts tests/unit/runtime/runtime-markdown-end.test.ts tests/unit/runtime/runtime-host-conformance.test.ts tests/unit/runtime/runtime-markdown-choice-id.test.ts
pnpm docs:check
pnpm docs:build
```

4 个测试文件、9 项测试通过。入口测试同时检查构建后的依赖闭包与公共子路径。文档检查通过 42 个文件，文档构建通过，TypeDoc 输出 57 项警告、0 项错误。消费端生产构建中，剧情与运行时块约 8.04 KiB gzip（压缩级别 9），首次进入城市不加载它。消费端详细流程、设置与后续发行限制以其 `docs/advjs-narrative.md` 为准。

## 发行边界

消费端当前以本地 `link:` 指向此仓库，不能用于独立 CI checkout。发布包含子入口与统一运行时的固定版本后，消费端应替换本地链接并重新验证锁文件、生产构建和实际任务流程。联调时先完成上游构建再运行浏览器测试，避免链接包重建触发消费端 Vite 重载。

## 通用指南与 AI 示例验证

后续将接入方式整理为[轻量嵌入指南](/guide/runtime/embedding)和 [Web 游戏 AI 接入](/ai/web-game-integration)，并加入站点导航。可复制源码位于 `docs/examples/web-game/`，覆盖任务对白、编译脚本、宿主适配器和 NPC AI 活动；AI 示例协议由宿主后端实现，不是内置推理服务。

实际执行 `node docs/examples/web-game/compile.mjs /tmp/advjs-web-game-program.json`，产物生成通过；编译器报告一项宿主活动静态不确定性警告。使用构建后的 Core 子入口和可控宿主 / transport 跑通示例的任务成功、连续确认、稳定快照恢复、当前条件刷新、hash 变化重启，以及 AI 正常回复、无效 / 失败回复兜底、等待快照恢复和取消后的迟到回复。

示例 TypeScript 单独按已构建包的声明检查通过，未使用工作区源码 path alias；仓库类型检查与示例 / 导航定向 ESLint 通过。文档检查通过 43 个文件，文档构建通过。真实模型请求、后端身份认证 / 缓存和新示例在不同 Web 框架中的 UI 没有在本次验证，不作为已发布的产品能力承诺。

示例验证确认：`activityRollback: 'unsupported'` 会拒绝恢复到待处理活动，即使 checkpoint 数量为 0。任务示例重新交谈；需要重试或恢复的 AI 活动使用 `supported`，以宿主保存的请求 ID 与后端回答缓存作为恢复前提。指南与原活动 / 存档文档同步说明这一边界。

## SDK 打包与多会话编排验证

指南补充 ESM 异步 SDK 包装、external 与自包含打包边界、多章节 Program 编译和独立会话加载。新增 `entry.adv.md`、`compile-chapters.mjs` 与宿主参考 `catalog.ts`；这些文件没有增加 Core API。AI 接入契约同步要求章节入口、加载白名单和独立快照键，消费端文档明确当前只配置陈叔会话。

实际执行 `node docs/examples/web-game/compile-chapters.mjs /tmp/advjs-town-program.json`，生成街口 / 守门人两章；保留一项宿主活动静态不确定性警告。用已构建入口跑通跨章选择、`go('keeper#leave')`、跨章快照恢复与未知章节拒绝；验证 Program 缓存并发去重、失败重试、加载白名单与两个独立 Runtime 的状态隔离。

临时 SDK / Vite 消费端生产构建通过：ESM 库 external 保留 `import('@advjs/core/runtime')`，最终游戏构建把 runtime 和两份 JSON 分为动态块。Playwright 验证首次打开页面不请求这三个块，选择守门人只请求对应 JSON 与 runtime，之后打开多章节剧情才请求另一份 JSON，并复用已加载 runtime。消费端模块图没有 Markdown 解析器、编译入口、完整 Client、资源或存储驱动。示例源码及 SDK 片段类型检查通过，定向 ESLint 通过。

文档站排除 `examples/**/*.adv.md` 的独立页面生成，保留指南中的源码片段引用；剧本跨章链接不能作为站点链接检查。该验证没有发布 SDK 包，也没有实现 Core 的章节增量下载；按需边界是独立 Program，场景中的会话选择与存档隔离仍由宿主控制。

本轮 `pnpm docs:check` 通过 43 个文件；`pnpm docs:build` 通过，用时 30.42 秒，TypeDoc 仍为 57 项警告、0 项错误。两个仓库的 `git diff --check` 通过。
