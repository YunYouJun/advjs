# ADV.JS 统一运行时与扩展体系设计

状态：已确认；运行时基础阶段已实现

日期：2026-07-16

## 1. 背景

ADV.JS 当前存在两套执行语义：

- `@advjs/core` 的 `AdvPlayEngine` 面向 CLI，以单个 Markdown AST 和 `PlaySession` 推进剧情，已经具备基础舞台状态、存档槽位和索引历史回退。
- `@advjs/client` 通过 Pinia、`useAdvLogic`、`useAdvNav` 和 Flow/Fountain 节点驱动浏览器；选择跳转、章节加载、存档和代码执行均有独立实现。

这造成了几个直接问题：

- 浏览器与 CLI 对相同剧本可能产生不同结果。
- Markdown 列表选择尚未可靠解析 `choice.target`；客户端还存在按标题或文件名模糊匹配章节的兜底逻辑。
- CLI 快照包含序列化 AST，浏览器存档只保存局部 Vue 状态，二者都不是统一的完整运行时快照。
- 浏览器仍通过 `new Function` 执行脚本，无法安全地支持可重放条件和动作。
- 节点、动作和互动能力缺少统一扩展入口。

本设计采用破坏性升级，不保留旧 `$adv.$logic`、`$adv.$nav` 和旧存档结构的兼容层。现有 Demo、主题、Studio 和 CLI 将迁移到新 API。

## 2. 目标

1. 浏览器、CLI、Studio 试玩使用同一个运行时状态转移实现。
2. Markdown AST 和 Flow 编辑器数据编译为同一种、可读且版本化的纯数据 Program。
3. 可靠支持同章节和跨章节选择跳转，不再依赖模糊匹配。
4. 存档、读档和回退基于完整的 JSON 可序列化快照。
5. 用变量、受限条件表达式和声明式动作替代 `new Function`。
6. 以接近 Vite/Pinia 的普通对象 API 扩展节点、动作和活动。
7. 以“星图比对”“文明初始化”等轻量互动验证活动接口。
8. 同步升级 Parser Playground、Studio、CLI 调试能力和用户文档。
9. 用新的仓鼠故事 Demo 展示已有的对话、场景、立绘、BGM、章节、存档、回退和插件能力。

## 3. 非目标

- 第一轮不实现战斗系统、复杂证物系统或大型小游戏框架。
- 不实现完整事件溯源、分布式 Actor 系统或字节码虚拟机。
- 不引入 XState 作为运行时依赖。
- 不允许插件向 Program 或 Snapshot 写入函数、类、Vue Ref、Map、DOM 节点等非 JSON 数据。
- 不为了兼容旧行为保留两套运行时语义。

## 4. 总体架构

```text
Markdown ── parse ──┐
                    ├── compile/link ── RuntimeProgram
Flow 编辑器数据 ────┘                       │
                                             ▼
                                 createAdvRuntime(program)
                                             │
                         ┌───────────────────┴───────────────────┐
                         ▼                                       ▼
                 Browser Host Adapter                     CLI Host Adapter
                 Vue/Pixi/Audio/Storage                    Text/FS/Storage
```

作者格式只负责表达内容。编译阶段将不同格式转换为统一的 `RuntimeProgram`；浏览器与 CLI 只执行 Program，不直接解释 Markdown 或 Flow。

内部状态转移保持确定性：相同的 Program、Snapshot 和用户操作必须得到相同的新 Snapshot 与 Effects。渲染、音频、文件、网络和互动 UI 由宿主处理，不进入纯数据状态转移。

## 5. 纯数据协议

### 5.1 RuntimeProgram

第一版 Program 使用可读 JSON，而不是字节码：

```ts
interface RuntimeProgram {
  schemaVersion: 1
  id: string
  hash: string
  entry: RuntimeAddress
  chapters: Record<string, RuntimeChapter>
  requiredPlugins: Record<string, string>
}

interface RuntimeAddress {
  chapterId: string
  nodeId: string
}

interface RuntimeNode {
  id: string
  kind: string
  data?: JsonObject
  next?: RuntimeAddress
  when?: string
  actions?: RuntimeActionCall[]
}

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
interface JsonObject { [key: string]: JsonValue }
```

`hash` 根据除 `hash` 字段本身以外、会影响执行语义的规范化 Program 数据生成，用于存档兼容性校验。节点地址在编译期标准化为 `{ chapterId, nodeId }`，运行时不再猜测标题、文件名或场景名。

### 5.2 RuntimeState 与 RuntimeSnapshot

```ts
interface RuntimeState {
  status: 'idle' | 'playing' | 'waiting-choice' | 'waiting-activity' | 'ended' | 'error'
  cursor: RuntimeAddress
  variables: JsonObject
  stage: RuntimeStageState
  choices: RuntimeChoiceRecord[]
  visited: string[]
  pendingActivity?: RuntimePendingActivity
  error?: RuntimeErrorData
}

interface RuntimeSnapshot {
  schemaVersion: 1
  program: {
    id: string
    hash: string
  }
  state: RuntimeState
  checkpoints: RuntimeCheckpoint[]
  createdAt: number
}

interface RuntimeCheckpoint {
  id: string
  state: RuntimeState
  createdAt: number
}
```

Snapshot 不保存 AST、函数、注册表或宿主对象。`JSON.stringify(snapshot)` 必须始终成功，并可在 Node 和浏览器间往返。

回退使用有上限的完整状态 checkpoint 栈，不依赖逆向执行动作。默认在可展示节点、选择前和活动前建立 checkpoint；连续重复状态会折叠。第一版不保存无限事件日志，详细 trace 作为可选 DevTools 能力。

若快照保存时存在待处理活动，`pendingActivity` 只记录活动 ID、请求 ID 和输入。恢复后由宿主重新呈现该活动，不自动重复网络写入等外部副作用。

## 6. 简洁运行时 API

普通使用者只接触 Pinia 风格的实例 API：

```ts
const runtime = createAdvRuntime({
  program,
  plugins,
  initialVariables,
})

runtime.state
runtime.current

await runtime.start()
await runtime.next()
await runtime.choose('observe-stars')
await runtime.go('chapter-2#compare')
runtime.back()

const snapshot = runtime.snapshot()
runtime.restore(snapshot)

const stop = runtime.subscribe((state, effects) => {
  // Browser 或 CLI 宿主消费更新
})
```

`next()`、`choose()`、`go()` 是内部命令分发的友好封装。底层 Reducer、Registry 和 checkpoint 管理不进入常用 API。

`state` 对外只读。插件动作可以修改运行时提供的临时 draft，但所有提交后的状态仍是纯 JSON 数据。

## 7. Markdown 选择与章节跳转

### Star Map

Markdown 选择使用普通链接表达目标，以下用星图节点作为示例：

```text
- 留在当前场景
- [观察星图](#star-map)
- [进入第二章](chapter-2)
- [直接开始比对](chapter-2#compare)

【天文台，夜，内景】 {#star-map}

## 比对结果 {#compare}
```

规则如下：

- 无链接：选择后按顺序继续。
- `#node-id`：跳到当前章节的节点。
- `chapter-id`：跳到目标章节入口。
- `chapter-id#node-id`：跳到目标章节的指定节点。

Parser 将链接文本写入 `choice.text`，链接目标写入 `choice.target`。Compiler 再把字符串目标解析为 `RuntimeAddress`。

可被显式跳转的 Markdown 节点必须使用 `{#node-id}` 声明稳定 ID；第一版支持场景行和标题。没有显式 ID 的顺序节点仍可正常播放，Compiler 可以为其生成内部 ID，但该 ID 不作为跨文件链接或长期存档地址。这样修改展示文本不会意外破坏跳转。

所有目标必须在 link 阶段精确解析。未知章节、未知节点、重复 ID 和非法目标格式产生带源码位置的诊断，不允许模糊匹配或静默 fall-through。

## 8. Variables、Conditions 与 Actions

### 8.1 Variables

变量只允许 JSON 值，初始值来自项目配置或章节声明：

```yaml
variables:
  starMatched: false
  civilizationLevel: 0
  observationCount: 0
```

### 8.2 Conditions

条件采用受限表达式解释器，不使用 `eval` 或 `new Function`。第一版支持：

- JSON 字面量和变量路径
- `!`、`&&`、`||`
- `==`、`!=`、`<`、`<=`、`>`、`>=`
- `+`、`-`、`*`、`/`、`%`
- 括号

不支持函数调用、原型访问、动态属性执行、赋值表达式和全局对象访问。表达式在编译期解析为纯数据表达式树，运行时只解释该树。

### 8.3 Actions

动作是带名称和参数的纯数据调用：

```yaml
actions:
  - type: variables/increment
    key: observationCount
    by: 1
  - type: variables/set
    key: starMatched
    value: true
```

内置动作至少包括 `set`、`increment`、`decrement`、`toggle`、`push` 和 `remove`。插件动作使用自动命名空间。

## 9. Vite/Pinia 风格插件 API

插件是普通对象，`defineAdvPlugin()` 只提供类型推导：

```ts
export function starMap(options: StarMapOptions = {}) {
  return defineAdvPlugin({
    name: 'star-map',
    version: '1.0.0',

    nodes: {
      compare(ctx, node) {
        return ctx.activity('compare', node.input)
      },
    },

    actions: {
      record(state, result) {
        state.variables.starMatched = result.matched
      },
    },

    activities: {
      compare(ctx, input) {
        return ctx.host.runActivity('star-map/compare', {
          tolerance: options.tolerance ?? 0.8,
          ...input,
        })
      },
    },
  })
}
```

安装方式：

```ts
const runtime = createAdvRuntime({
  program,
  plugins: [starMap(), civilization()],
})
```

约束：

- `name` 必填；`nodes/actions/activities` 的短名称自动转换为 `plugin-name/name`。
- 插件安装顺序稳定；能力重名立即报错，不静默覆盖。
- Program/Snapshot 只保存能力字符串和纯数据参数，不保存处理函数。
- 缺失 Program 所需插件时，Runtime 在启动前返回明确诊断。
- `nodes` 和 `actions` 必须同步、确定且不执行外部副作用；异步或非确定性工作只能进入 `activities`。
- `activities` 只能返回纯 JSON 结果，不能直接修改 RuntimeState；结果由后续 action 写入状态。
- 第一版不提供复杂生命周期。后续确有资源释放需求时再加入可选 `setup()`。

## 10. 宿主适配

### Browser

- `@advjs/client` 创建 runtime，并把只读 `RuntimeState` 暴露为 Vue 响应式视图。
- 对话框、选择、背景、BGM、立绘和 Pixi 系统订阅 Effects，不直接修改剧情游标。
- 浏览器存储适配器保存同一 `RuntimeSnapshot`，缩略图和备注作为槽位元数据存放在快照之外。
- 删除旧 `new Function` 执行路径和旧 `CurStateType` 存档。

### CLI

- `adv play` 使用同一 `createAdvRuntime()`，文本格式化只是订阅者。
- 文件系统仅存在于 Node storage/project loader adapter。
- CLI 与浏览器对同一 Program 和操作序列输出相同的状态、选择与跳转结果。

## 11. 编辑、调试与诊断

每个实现阶段同步增加可观察能力，不把工具升级推迟到最后：

- Parser Playground 增加 Markdown AST / RuntimeProgram 双视图和目标解析诊断。
- Studio Flow 与 Markdown 编辑器均通过同一 Compiler 生成预览 Program。
- Studio Play Inspector 展示当前位置、变量、舞台状态、已选分支、checkpoint 和 pending activity。
- CLI 增加 Program/链接诊断和可选执行 trace，复用与 Studio 相同的诊断数据结构。
- `adv check` 增加重复节点、无效跳转、非法表达式、未知 action/activity 和缺失插件检查。
- 调试信息使用稳定错误码、严重级别、源码文件和位置，便于编辑器定位。

运行时不再静默跳过未知节点、未知动作或失败跳转。活动异常进入结构化 `error` 状态，并允许宿主展示重试或回退操作。

## 12. Demo 验收场景

仓鼠故事 Demo 作为跨端一致性验收工程，集中展示：

- Markdown 对话、旁白、场景、背景、BGM、立绘、镜头指令和选择。
- 同章节目标和跨章节目标。
- `observationCount`、`starMatched`、`civilizationLevel` 等变量。
- 基于变量的条件文本与可见选项。
- 选择前自动 checkpoint、手动存档、读档与回退。
- 浏览器端自动播放、跳过已读、历史记录、进度与 CG 解锁；CLI 输出对应的已读、进度和舞台纯数据。
- 复用现有分支图与覆盖率分析，验证新 Program 的路径和诊断能力。
- `star-map/compare` 轻量活动：在浏览器显示可点击比对，在 CLI 提供等价的结构化输入流程。
- `civilization/initialize` 轻量活动：收集少量参数并写回纯数据结果。
- 插件缺失、目标错误和表达式错误的编辑器/CLI 诊断。

Demo 不引入战斗、完整证物管理、复杂好感度路线锁或 DDLC 式元叙事。它们所需的通用基础由变量、条件、动作、节点和活动接口覆盖。

内容许可和素材来源继续由 `demo/starter/LICENSE.content.md` 与 `demo/starter/ASSETS.md` 独立管理；来源未确认的素材应在正式 Demo 中替换。

## 13. 迭代边界

实施严格按依赖顺序拆分：

1. 建立纯数据协议、Compiler/linker 与跨宿主一致性测试夹具。
2. 用新 runtime 替换 CLI 和浏览器双执行器。
3. 完成 Markdown `choice.target`、稳定地址和可靠章节跳转。
4. 完整实现 Snapshot、槽位存储、checkpoint 和回退。
5. 加入 variables、受限 conditions 和内置 actions，删除 `new Function`。
6. 加入简洁插件 API 与节点/动作/活动注册表。
7. 实现星图比对、文明初始化和仓鼠故事演示。
8. 完成 Studio、Parser Playground、CLI 调试、迁移文档和公开 API 文档。

编辑器、诊断、测试和文档不作为独立的末尾补丁：每一阶段都必须同时补齐对应能力，最后一阶段只做整体验收与旧代码清理。

## 14. 测试与完成标准

### 测试层次

- Parser：选择链接、目标语法、源码位置。
- Compiler/linker：Markdown/Flow 生成等价 Program、精确地址解析、诊断。
- Core：确定性推进、条件、动作、插件冲突、活动挂起/恢复。
- Snapshot：JSON 往返、Program hash 校验、完整状态恢复、跨章节回退。
- Conformance：浏览器内存宿主与 Node 内存宿主执行同一命令序列，Snapshot 和 Effects 完全一致。
- Client/CLI：各自只测试渲染、输入和 storage adapter，不重复测试剧情语义。
- E2E：仓鼠 Demo 覆盖选择、跨章、活动、存档、读档和回退。

### 完成标准

- 仓库中不存在运行剧情用的 `new Function` 或 `eval`。
- 浏览器与 CLI 不再维护独立的剧情推进和跳转逻辑。
- 所有 RuntimeSnapshot 均可直接 JSON 序列化并恢复完整状态。
- 所有章节/节点跳转在编译期精确解析；无模糊运行时兜底。
- 节点、动作和活动可以通过普通对象插件扩展。
- Parser Playground、Studio 和 CLI 能展示同一份 Program 与诊断。
- 新 Demo 在浏览器与 CLI 的一致性夹具和 E2E 中通过。
- 公开文档包含创作语法、Runtime API、Plugin API、存档格式、迁移指南和调试指南。

## 15. 迁移与发布

这是一次明确的破坏性升级：

- 新 Runtime/Snapshot 数据结构使用独立 schema 版本。
- 旧浏览器存档不自动升级；可提供一次性的最佳努力迁移工具，但不进入核心执行路径。
- `AdvPlayEngine`、旧客户端导航/逻辑 composable 和旧记录类型在消费者迁移后删除。
- 每个阶段保持仓库可构建、可测试；公开发布在浏览器、CLI、Studio 和 Demo 全部迁移完成后进行。
