---
outline: deep
---

# 调试与迁移

## Parser Playground

Parser Playground 现在提供六种视图：Markdown 预览、ADV AST、`RuntimeProgram`、Runtime Diagnostics、HTML 和 markdown-it AST。

编写选择链接、稳定 ID、条件或活动时，可直接查看编译后的规范地址、表达式树、动作调用和带源码位置的诊断。存在 error 诊断时，RuntimeProgram 视图为 `null`。

## `adv check`

`adv check` 不再只逐文件解析语法，而会编译并链接完整项目，同时检查：

- 重复稳定 ID、未知章节/节点和非法目标；
- 非法条件表达式；
- 格式无效或未知的 action、node 和 activity；
- 必需插件缺失、版本不匹配和能力未注册；
- 原有的角色、场景、地点和 frontmatter 完整性。

诊断包含稳定错误码；编译期错误尽可能附带文件、行和列。`--fix` 仍只创建缺失的角色/场景桩，不会自动改写运行时逻辑。

## CLI trace

`adv play --trace` 会向 stderr 输出 JSON Lines，每条包含命令、规范地址、状态、Effects 和变量。它适合比较浏览器与 CLI 行为，或让 Agent 保存可重放问题报告。

```bash
adv play adv/chapters/1/story.adv.md --trace
```

活动等待时使用交互指令 `activity <json>`，或 Agent 子命令：

```bash
adv play activity '{"level":1,"name":"仓生"}' \
  --session-id story-1 --json
```

## Studio Inspector

Studio 试玩预览使用同一 Vue Runtime host。Inspector 展示规范地址、状态、变量、舞台、可见选择、已读节点、checkpoint 数量、pending activity 和本次会话的命令轨迹；Studio 保存的数据也是 `RuntimeSnapshot` 加 UI 元数据。

编辑 `.adv.md` 时，右侧面板提供三种视图：

- **预览**：检查当前 Markdown 的展示结果；
- **程序结构**：查看完整项目编译后的 `chapterId#nodeId`、节点类型和 `next` 地址。点击任一行可跳回对应源码，即使目标位于另一个章节；
- **诊断**：显示当前未保存文本参与全项目编译后的错误。点击诊断可定位到文件、行和列。

诊断来源可按阶段理解：

| 阶段    | 发现的问题                                              | 常见处理位置               |
| ------- | ------------------------------------------------------- | -------------------------- |
| Parser  | Markdown/Frontmatter 无法解析、脚本结构无效             | 当前 `.adv.md` 文件        |
| Linker  | 重复 ID、未知章节/节点、断开的选择目标、非法条件或动作  | 程序结构与跨章节源码链接   |
| Plugin  | `requiredPlugins` 缺失、版本或 action/activity 能力不符 | `adv/settings/game.json`   |
| Runtime | 命令执行失败、存档不兼容、活动返回无效或状态异常        | 试玩 Inspector、轨迹与报告 |

### Trace 命令语义

Runtime 对公开导航命令使用同一套有序轨迹。每条记录包含序号、输入、执行前后地址、结束状态、Effects 和变量差异：

| 命令                | 含义                                                          |
| ------------------- | ------------------------------------------------------------- |
| `start`             | 从 Program 入口启动，并推进到第一个需要用户或宿主处理的节点   |
| `next`              | 推进当前叙事节点；需要时创建可回退 checkpoint                 |
| `choose`            | 按稳定 choice ID 执行动作并跳转到其规范目标                   |
| `go`                | 显式跳转到已经校验的 `chapterId#nodeId`                       |
| `back`              | 弹出最近 checkpoint 并恢复其状态                              |
| `restore`           | 校验 schema、Program ID/hash 后恢复完整快照                   |
| `complete-activity` | 把宿主返回的 JSON 交给等待中的插件 activity，然后继续推进剧情 |

### 分享调试报告

Inspector 的“复制报告”和“下载报告”生成完全相同的 `advjs-runtime-report.json`。报告包含 Program ID/hash、完整 `RuntimeSnapshot`、编译诊断和有界 trace；不会主动加入章节原文或文件系统 handle。

`snapshot.state.variables` 和 trace 的变量差异属于作者自定义数据，仍可能包含昵称、输入内容或业务字段。分享前必须检查 JSON；界面顶部也会持续提示这一点。

### 用仓鼠 Demo 复现

1. 运行 `pnpm studio`，在 Workspace 打开 `demo/hamster`；
2. 在编辑器中打开任一 `.adv.md`，临时把选择目标改成不存在的 `missing#ending`；
3. 在“诊断”页点击 `ADV_RUNTIME_UNKNOWN_TARGET`，确认光标回到错误链接；
4. 撤销修改并进入试玩，完成一次选择或星图活动；
5. 打开 Runtime Inspector 的 Trace 页，核对 `choose` / `complete-activity` 的地址、Effects 与变量变化；
6. 复制或下载报告，用 Program hash 和命令序号固定这次复现上下文。

## 破坏性迁移

本次升级不保留双执行路径：

| 旧方式                            | 新方式                                  |
| --------------------------------- | --------------------------------------- |
| JS/TS 代码块与 `$adv.$logic`      | `variables` + `when` + 声明式 `actions` |
| `$adv.$nav.next()` 或标题模糊跳转 | Markdown 链接 + `{#stable-id}`          |
| 浏览器局部状态 / CLI AST 存档     | 完整、版本化 `RuntimeSnapshot`          |
| 自定义代码直接打开 UI 或网络请求  | 插件 node 请求宿主 `activity`           |
| 各宿主独立推进剧情                | 共用 `createAdvRuntime()`               |

迁移步骤：

1. 为外部跳转目标补充稳定 ID，并把选择改为 Markdown 链接；
2. 把脚本中的状态初始化移到 `gameConfig.variables`；
3. 把条件和变量修改改写为 YAML `when` / `actions`；
4. 把需要 UI、网络或异步输入的逻辑提取为插件活动；
5. 在 `requiredPlugins` 声明插件版本；
6. 运行 `adv check`，再在 Playground、Studio 和 `adv play --trace` 中验证；
7. 删除旧存档，或显式导出/转换；Runtime 不会自动接受 Program hash 不匹配的快照。

旧 JS/TS 故事代码会产生 `ADV_RUNTIME_EXECUTABLE_SCRIPT` 或 `ADV_RUNTIME_EXECUTABLE_CHOICE_ACTION`，不会进入兼容执行器。
