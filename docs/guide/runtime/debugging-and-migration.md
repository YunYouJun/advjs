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

Studio 试玩预览使用同一 Vue Runtime host。Inspector 展示规范地址、状态、变量、舞台、可见选择、已读节点、checkpoint 数量和 pending activity；Studio 保存的数据也是 `RuntimeSnapshot` 加 UI 元数据。

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
