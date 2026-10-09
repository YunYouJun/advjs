# 试玩前的剧情与资源检查

在游戏项目目录运行：

```bash
pnpm exec adv check
pnpm exec adv check --json
```

`adv check` 复用 Markdown 解析器、项目编译器、精确地址链接器和资源目录解析器。它不会执行剧情脚本、插件 action/activity 处理函数，也不会下载远程资源。与开发服务器一样，读取 `adv.config.ts` 等模块配置时会执行该配置模块。

## 诊断内容

| 检查                    | 错误码                                                                                          | 级别与修复方式                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 跳转目标不存在          | `ADV_RUNTIME_UNKNOWN_TARGET`                                                                    | error：修正章节 ID / `{#node-id}`，或补充目标                             |
| 章节不可达              | `ADV_STATIC_UNREACHABLE_CHAPTER`                                                                | warning：从入口可达的剧情增加链接，修改入口，或移除闲置章节               |
| 本地资源不存在          | `ADV_STATIC_MISSING_RESOURCE`                                                                   | error：补充提示路径的文件，或修正引用                                     |
| 变量没有定义            | `ADV_STATIC_UNKNOWN_VARIABLE`                                                                   | error：修正拼写，在 `gameConfig.variables` 中声明，或通过内置 action 定义 |
| 变量路径不安全/为空     | `ADV_STATIC_INVALID_VARIABLE_PATH`                                                              | error：使用合法点号路径，移除原型链字段                                   |
| 确定的流程死路          | `ADV_STATIC_DEAD_END`                                                                           | error：给封闭循环添加通往结局的出口                                       |
| 常量条件必然求值失败    | `ADV_STATIC_INVALID_CONSTANT_CONDITION`                                                         | error：修正操作数类型或除零等运算                                         |
| 动态目标                | `ADV_STATIC_DYNAMIC_TARGET`                                                                     | warning、uncertain：改用字面量目标，或核对解析它的宿主逻辑                |
| 插件流程/变量、动态资源 | `ADV_STATIC_FLOW_UNCERTAIN` / `ADV_STATIC_VARIABLE_UNCERTAIN` / `ADV_STATIC_RESOURCE_UNCERTAIN` | warning、uncertain：结合对应宿主、插件及试玩验证                          |

每条诊断包含文件、行、列、稳定错误码、原因、修复建议，以及 `certain` 或 `uncertain` 确定性。多文件章节的行号会映射回实际来源文件，不使用拼接后的总行号。资源字段定位到引用值；代码块逻辑通常定位到所属代码块或选项。

有 error 时退出码为 **1**；只有 warning（包括 uncertain）时退出码为 **0**。通过静态检查意味着没有发现确定错误，仍需试玩验证动态行为。旧版可执行 JS/TS 块在检查中会标为 uncertain；它们仍不受 RuntimeProgram 的正式编译/执行支持。

## 流程规则

检查从配置的 `entryChapterId` 开始；未指定时使用编译器选定的首章。选择链接支持当前章 `#node-id`、章节 `chapter-id` 和精确地址 `chapter-id#node-id`。

章节自然结束是合法结局，文件顺序不意味着自动进入下一章。没有目标的选项按当前章顺序继续。所有选项隐藏时，运行时会跳过该选项组，因此检查器不会把它报为死路。

只有当保守流程图中的所有路径都无法抵达结局时，才会报告封闭循环。包含变量的条件按可能为真、也可能为假处理；检查器不会把可变的初始值当作永远不变的常量。存在可达的动态目标或插件导航时，检查器不再作出确定的章节不可达/死路判断，而是在相关位置提示 uncertain。

`${destination}`、`{{destination}}` 形式的目标不能静态解析为精确地址。静态检查不会据此生成可执行的替代跳转，也不会执行表达式猜测结果。

## 变量检查的范围

检查条件表达式中引用的完整点号路径，并结合初始变量及剧情中的内置变量 action 判断是否有定义。`variables/set`、`increment`、`decrement`、`toggle`、`push`、`push-unique` 都可按运行时规则创建键；不能把首次 increment 误报为未声明变量。

这是声明与引用检查，不是完整的路径敏感类型检查：某条分支才初始化变量、先读后写、对象后续被覆盖等情况仍需试玩。插件可能提供的变量、被父对象写入影响的未知子路径会标为 uncertain。检查器不执行任意插件来推断变量形状。

## 本地资源路径

- 剧情 YAML/JSON 中的 `url` / `src`、角色头像/立绘、场景 frontmatter、游戏封面/图库/音乐等资源字段：`/room.svg` 对应项目的 `public/room.svg`，相对 URL 也按 `public/` 解析。
- Markdown 图片：相对链接从 Markdown 所在目录解析；以 `/` 开头时从 `public/` 解析，支持图片引用定义。
- `adv/assets.json`（含拆分清单和 variants）：复用资源目录的 project profile，按 `profile.root + path` 从项目目录定位。声明了本地 `path` 的资源都会检查，不仅检查当前可达剧情使用的资源；只有 HTTP profile 时，本地 `path` 按项目目录解析。
- 普通资源 URL 会解码百分号编码，并剥离 query/fragment；资源清单的 `path` 是字面文件路径。
- `https:`、`http:`、`data:`、`blob:` 和 `//` URL 不做网络可用性检查。动态引用和自定义协议标为 uncertain。存在性检查不验证图片、音频或模型的媒体内容。

标准项目支持 JSON/TS 模块配置、配置中的 `public/` 章节及多文件章节。模块配置只声明章节列表、`adv/settings/game.json` 只存元数据的布局也能检查。未配置项目时，仍可用 `--root ./adv` 扫描旧版内容目录。没有找到 `.adv.md` 的旧项目会明确提示覆盖范围未知；序列化 Flow 格式仍由现有编译器报告不支持。

## JSON 与自动修复

成功时诊断位于 `data.diagnostics`：

```json
{
  "severity": "warning",
  "code": "ADV_STATIC_UNREACHABLE_CHAPTER",
  "path": "adv/chapters/extra.adv.md",
  "line": 1,
  "column": 1,
  "certainty": "certain",
  "message": "Chapter \"extra\" cannot be reached from the configured entry.",
  "suggestion": "Add a reachable choice linking to this chapter, change entryChapterId, or remove the unused chapter."
}
```

失败时保持现有 CLI 信封格式，完整 `CheckIssue[]` 位于 `errors[0].details.diagnostics`，其中级别字段为 `type`，路径字段为 `file`；行列、建议和确定性同样保留。Node/MCP 可继续复用 `runCheck({ cwd })` 及其 `issues` 数组。

`adv check --fix` 只为缺失角色/场景创建桩文件，然后重新检查。它不会猜测跳转目标、替换剧情、创建假资源或覆盖已有文件。

## 可重复验证

仓库包含 `tests/fixtures/diagnostics/valid` 与 `broken` 两个最小项目。先在仓库根目录构建：

```bash
pnpm build:advjs
pnpm exec tsc -p tests/tsconfig.static-diagnostics.json
pnpm vitest run tests/unit/cli/check-static.test.ts
pnpm exec tsx scripts/check-examples.ts /tmp/advjs-example-diagnostics.json
```

也可直接运行构建后的检查命令：

```bash
cd tests/fixtures/diagnostics/valid
node ../../../../packages/advjs/bin/adv.mjs check --json
```

将目录改为 `broken`，应得到五类目标诊断并退出 1。测试会依次修复链接、资源、变量和循环出口，确认各诊断消失且最终检查通过。示例扫描脚本会记录所有项目的问题；为便于一次扫描全部旧例，它只在检查器异常时退出 1，不能替代单个项目在 CI 中的 `adv check`。
