# ADV.JS 剧情与资源静态诊断验证报告

验证日期：2026-10-05。环境：Node.js 24.18.0、pnpm 11.20.0。

## 交付结果

原有 `adv check` / `adv check --json` 及 Node/MCP 共用的 `runCheck()` 已具备五类静态诊断：不存在的跳转目标、不可达章节、缺失本地资源、变量引用错误、可以确定的封闭流程死路。诊断包含文件、行列、问题原因、修复建议和确定性。

诊断复用现有解析器、RuntimeProgram 链接器、条件表达式解析/求值器、项目加载器和资源目录解析器。动态目标、旧版脚本及插件控制的流程标记为 uncertain，不据此报告确定的不可达或死路。只含 warning 的项目退出 0；确定错误退出 1。静态检查通过不表示动态内容已完成试玩验证。

实现同时修正了多文件章节的来源映射、模块配置中章节被元数据文件遮蔽、已声明资源别名遗漏、行内 Markdown 对话产生空 AST 节点等实际扫描中发现的问题。`--fix` 仍只创建角色/场景桩文件，并在创建后重新检查。

使用说明：[剧情与资源静态诊断](../guide/runtime/static-diagnostics.md)。完整示例诊断：[static-diagnostics-examples.json](./static-diagnostics-examples.json)。

## 最小样例验收

样例位于 `tests/fixtures/diagnostics/valid` 与 `tests/fixtures/diagnostics/broken`。通过构建后的 `packages/advjs/bin/adv.mjs check --json` 验证实际命令，而不只调用内部函数。

| 验收项           | 故障与结果                                                                  | 修复后结果                         |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------- |
| 有效项目         | 3 个可达章节、已有资源、合法变量、有出口循环                                | 0 条诊断，退出 0                   |
| 缺失跳转目标     | `missing#extra` 触发 `ADV_RUNTIME_UNKNOWN_TARGET`，定位 `start.adv.md:15:1` | 改成 `extra` 后消失                |
| 不可达章节       | `extra` 没有来自入口的路径，触发 `ADV_STATIC_UNREACHABLE_CHAPTER`           | 补上到 `extra` 的链接后消失        |
| 缺失资源         | `/missing.svg` 触发 `ADV_STATIC_MISSING_RESOURCE`，定位资源字段             | 改成已存在的 `/room.svg` 后消失    |
| 变量引用错误     | `raedy` 触发 `ADV_STATIC_UNKNOWN_VARIABLE`，定位条件块 `start.adv.md:8:1`   | 改成 `ready` 后消失                |
| 确定死路         | `loop` 仅能返回自身，触发 `ADV_STATIC_DEAD_END`                             | 增加到 `start#finish` 的出口后消失 |
| 损坏项目全部修复 | 五类诊断可在同一次检查中同时报告，初始退出 1                                | 逐项修复后诊断为空、检查通过       |

自动测试在临时目录的副本上修复，原始样例保持可重复使用。

## 防误报与兼容性验证

新增 17 项测试覆盖上述验收，以及：

- 自然章节结束、条件选项全部隐藏、可变条件保守分支均不会被误报为死路；无条件自循环不会被错误地添加一个顺序出口。
- `${destination}` 和旧版 JS 块只产生 uncertain 提示；常规 RuntimeProgram 编译仍拒绝不受支持的动态/可执行语法。
- 内置 action 可创建变量；插件提供的未知变量标记为 uncertain；不执行插件处理函数。
- 精确映射多文件章节的位置；模块配置加元数据文件的组合能发现 `public/` 中的剧情问题。
- 本地图片、角色/场景字段、拆分资源清单和 variants；URL 编码与 query/fragment；跳过远程 URL 的网络检测。
- 畸形 YAML/JSON/场景 frontmatter 不会让其他文件的检查消失或使检查器崩溃；行内 Markdown 对话保留文本。
- 资源别名、模块配置中的插件能力、`--root` 资源清单、CLI JSON 字段及退出码。

变量检查是声明/引用检查，不承诺完整的路径敏感初始化、类型推导或任意插件行为分析。资源检查确认文件存在，不验证媒体内容或远程服务可用性。

## 测试与构建

| 检查                                                      | 最终结果                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm build:advjs`                                        | 通过：types → assets → unocss → parser → core → advjs，包含声明文件与可执行 CLI   |
| 相关 Vitest 回归                                          | **24 个文件、132 项测试全部通过**，包含浏览器生产构建和 CLI JSON 合约             |
| `pnpm exec tsc -p tests/tsconfig.static-diagnostics.json` | 通过：相关 Node/编译器源码、样例扫描脚本及新增测试的严格类型检查                  |
| 变更代码与文档 ESLint                                     | 通过                                                                              |
| `pnpm docs:check`                                         | 通过，38 个文档文件                                                               |
| `git diff --check`                                        | 通过                                                                              |
| `pnpm typecheck`                                          | 通过：后续已修复全仓 68 条依赖/类型问题，见[模块验证报告](./module-validation.md) |

相关回归命令：

```bash
pnpm vitest run \
  tests/unit/check-static.test.ts \
  tests/unit/check-runtime.test.ts \
  tests/unit/check-fix.test.ts \
  tests/unit/runtime-project-loader.test.ts \
  tests/unit/hamster-demo-runtime.test.ts \
  tests/unit/project-roundtrip.test.ts \
  tests/unit/runtime-markdown-choice-id.test.ts \
  packages/core/test/runtime \
  packages/core/test/project \
  tests/unit/basic.test.ts \
  tests/unit/cli-json-output.test.ts
```

浏览器构建最初因本地缺少 `@advjs/client` 已声明的依赖链接失败；使用 `pnpm install --frozen-lockfile --ignore-scripts --filter @advjs/client --offline` 从本地缓存恢复后，重新测试通过，没有改变锁文件。后续按“修复所有模块问题”的要求恢复全工作区依赖、补齐直接依赖声明并修正 Core/MCP 类型错误，全仓类型检查现已通过；详细结果见[模块验证报告](./module-validation.md)。

## 现有示例扫描

运行 `pnpm exec tsx scripts/check-examples.ts docs/reports/static-diagnostics-examples.json`。共扫描 14 个示例/模板、34 个 `.adv.md` 文件，检查器无异常。示例原始内容未被改写。

| 示例/模板                            | 剧情文件 | error | warning | 说明                                                         |
| ------------------------------------ | -------: | ----: | ------: | ------------------------------------------------------------ |
| `demo/starter`                       |        1 |     0 |       0 | 通过                                                         |
| `demo/hamster`                       |       16 |     0 |       3 | 三处插件流程 uncertain，静态检查通过                         |
| `demo/love`                          |        1 |     0 |       0 | 通过                                                         |
| `demo/md`                            |        0 |     3 |       0 | 旧 `.chapter.md` 不属于当前 `.adv.md` 入口；缺少两张角色图片 |
| `demo/ai`                            |        0 |     1 |       0 | 配置对应的内容根目录不存在                                   |
| `demo/flow`                          |        0 |     1 |       0 | 现有项目编译器尚不支持序列化 Flow                            |
| `examples/ai-contest/history-talk`   |        3 |     0 |       8 | 未连接章节及场景/地点引用提示                                |
| `examples/ai-contest/life-story`     |        3 |     0 |       4 | 未连接章节及场景/地点引用提示                                |
| `examples/ai-contest/murder-mystery` |        3 |     0 |       9 | 未连接章节、场景引用及 frontmatter 提示                      |
| `examples/singlefile`                |        0 |     4 |       1 | 两个章节源和两张头像缺失；一个章节可达性提示                 |
| `examples/singlefile-script`         |        0 |     0 |       1 | 无 `.adv.md` 输入，覆盖范围 uncertain                        |
| `examples/adv-format`                |        3 |    12 |       2 | 独立语法示例缺少角色定义，两个独立章节不可达                 |
| `packages/advjs/template`            |        3 |     0 |       2 | 后续章节未连接                                               |
| `packages/advjs/template-galgame`    |        1 |     0 |       0 | 通过                                                         |

零剧情输入不会被解释为“整部剧情已经验证”。原始诊断 JSON 保留每条问题的文件位置、解释、建议和确定性，可用于后续修复旧示例。
