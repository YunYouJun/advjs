# 运行时导航与存档

ADV.JS 会先把 Markdown 或 Flow 编译成纯数据 `RuntimeProgram`，再由浏览器、CLI 和 Studio 共用的 `createAdvRuntime()` 执行。宿主只负责输入、渲染和存储，不再各自解释章节跳转。

## 稳定节点与精确跳转

可被链接的标题或场景使用 `{#node-id}` 声明稳定 ID：

```text
【天文台，夜，内景】 {#observatory}

## 比对结果 {#compare-result}
```

选择使用普通 Markdown 链接：

```text
- 留在当前场景
- [观察星图](#observatory)
- [进入第二章](chapter-2)
- [直接查看结果](chapter-2#compare-result)
```

| 目标                 | 含义               |
| -------------------- | ------------------ |
| 无链接               | 按剧本顺序继续     |
| `#node-id`           | 当前章节的稳定节点 |
| `chapter-id`         | 目标章节入口       |
| `chapter-id#node-id` | 目标章节的稳定节点 |

目标在编译阶段解析为 `{ chapterId, nodeId }`。未知章节、未知节点、重复 ID、空 fragment 和多个 `#` 都会阻止 Program 生成；运行时不会按标题或文件名模糊匹配。

## Runtime API

```ts
import { createAdvRuntime } from '@advjs/core'

const runtime = createAdvRuntime({
  program,
  initialVariables: { observationCount: 0 },
  plugins,
})

await runtime.start()
await runtime.next()
await runtime.choose('choice-1')
await runtime.go('chapter-2#compare-result')

const snapshot = runtime.snapshot()
runtime.back()
runtime.forward()
runtime.restore(snapshot)
```

`runtime.state` 和 `runtime.current` 对外是克隆后的只读数据。`subscribe()` 可消费舞台、活动、恢复和回退等 Effects，但订阅者不应修改剧情游标。

## Snapshot 与 checkpoint

`RuntimeSnapshot` 是完整 JSON 快照，包含：

- Program 的 `id` 和语义 `hash`；
- 当前游标、变量、舞台、选择历史、已读节点和待处理活动；
- 有上限的完整状态 checkpoint；
- schema 版本和创建时间。

在离开可见内容、应用选择、执行显式跳转和完成活动前，Runtime 会建立 checkpoint。`back()` 恢复最近一个 checkpoint；连续相同状态会折叠，默认最多保存 100 个。

`back()` 后的当前会话会保留 redo 状态。此时 `next()` 优先恢复下一份历史状态，显式 `forward()` 也可完成同样操作；恢复到时间线前端后，`next()` 才继续执行新剧情。回退后执行新的选择、跳转或活动结果会清空 redo 并形成新分支。redo 不写入存档，`restore()` 后为空。

`go()` 是正式剧情命令：它保留当前变量和舞台，再把游标移到精确地址。Studio 的任意节点预览不是 `go()`；它通过 `derivePresentationState(program, target, variables)` 从源码顺序推导隔离的演出态，不执行 action、选择、插件活动或持久化副作用。

恢复前会校验 schema、Program ID、Program hash、JSON 数据和所有游标。剧本执行语义改变后，旧快照会以 `ADV_RUNTIME_SNAPSHOT_MISMATCH` 被拒绝，而不是在错误节点继续执行。

若快照处于 `waiting-activity`，恢复会重新发出 `activity.request` Effect，宿主可重新呈现互动界面。

## Storage adapter

存储不属于状态转移核心。浏览器和 Node 实现同一个接口：

```ts
interface RuntimeSaveRecord {
  id: string
  snapshot: RuntimeSnapshot
  metadata?: JsonObject
  updatedAt: number
}

interface RuntimeStorage {
  list: () => Promise<RuntimeSaveRecord[]>
  get: (id: string) => Promise<RuntimeSaveRecord | undefined>
  set: (record: RuntimeSaveRecord) => Promise<void>
  remove: (id: string) => Promise<void>
}
```

截图、备注和槽位名放在 `metadata`，不进入执行快照。Core 提供 clone-safe 内存实现，浏览器使用本地存储适配器，CLI 使用原子写入的 JSON 文件适配器。

## 浏览器存档槽位

浏览器客户端在 `RuntimeStorage` 之上使用统一的 `GameSaveController`，手动、快速和自动存档保存的都是同一种 `RuntimeSnapshot`：

| 类型     | 默认数量 | 写入方式                                     |
| -------- | -------: | -------------------------------------------- |
| 手动存档 |       60 | 玩家在存档菜单中选择槽位，可保存备注和缩略图 |
| 快速存档 |        1 | 游戏界面的快速存档按钮覆盖该槽位             |
| 自动存档 |        5 | 写满后覆盖最旧的自动槽位                     |

自动存档只在适合恢复的稳定位置创建：开始或显式跳转、进入新章节、等待选择、等待或完成互动活动，以及剧情结束。`restore()`、`back()` 和 `forward()` 不会反向制造新自动存档。

```ts
import {
  createGameSaveController,
  createManualSaveSlot,
  QUICK_SAVE_SLOT,
} from '@advjs/client'

const saves = createGameSaveController({ storage })

await saves.save(createManualSaveSlot(1), runtime.snapshot(), {
  memo: '进入分支前',
})
await saves.save(QUICK_SAVE_SLOT, runtime.snapshot())
await saves.autoSave(runtime.snapshot())
```

存储命名空间由宿主提供稳定游戏 ID；因此 `play` 加载不同的 `pominisId` 时会使用彼此隔离的槽位。未指定命名空间的普通项目继续使用默认槽位。槽位到具体 storage key 的编码属于客户端实现细节，不应由主题或游戏脚本自行拼接。

CLI 的保存、恢复和回退命令见 [CLI](/guide/cli#adv-play)。
