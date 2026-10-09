# 轻量运行时与 Web 游戏嵌入

已有 Web 游戏可以只用 ADV.JS 执行对白、选择、条件和宿主活动，继续使用自己的场景、UI、输入和存档。以下示例覆盖构建时编译 `.adv.md`、SDK 按需打包、多剧本编排与加载，以及可复制的任务对白适配器。

## 选择接入范围

| 方式           | 导入入口                   | 适用场景                                            |
| -------------- | -------------------------- | --------------------------------------------------- |
| 轻量运行时     | `@advjs/core/runtime`      | 已有游戏执行预编译的 `RuntimeProgram`，自行渲染对白 |
| 构建时编译     | `@advjs/core/compiler`     | Node 构建脚本把 Markdown / Flow 转成 JSON           |
| 根入口         | `@advjs/core`              | 同时需要编译、运行时和 Core 的其他能力              |
| 完整游戏客户端 | `advjs` 与 `@advjs/client` | 使用 ADV.JS 页面、主题、舞台、资源和存档 UI         |

“精简版”指同一 Core 包的轻量子入口，目前没有单独的 `@advjs/lite` 包。`runtime` 共用既有状态机，依赖闭包不包含 Markdown 解析器、资源加载、存储驱动、Vue 或默认主题；仍包含条件、插件、舞台数据与快照等运行能力。`@advjs/types` 提供共享 JSON 类型。

子入口减少浏览器导入的代码，不改变 Core 的安装依赖清单：安装整个包仍会下载其声明的解析器等依赖。把编译器移到构建阶段、使用 ESM 和动态导入，才能保持玩家端的轻量边界。仅设置 `maxCheckpoints: 0` 或 `maxTraceEntries: 0` 是关闭历史记录，不是进一步裁剪所有对应代码。

宿主适配器没有框架要求。Vue / React 可以渲染 DOM 对话框，Phaser / PixiJS 可以渲染游戏内文本，Three.js 可以把对白作为场景上的覆盖层。引擎只接收 JSON 和剧情命令；各框架的具体输入、焦点和渲染行为需要在宿主中验证。

## 按需导入与 SDK 打包

ESM 命名导入允许消费端打包器 tree shaking；动态 `import()` 决定何时下载和执行模块。两者分别解决产物裁剪与首次加载的问题。浏览器从 `@advjs/core/runtime` 获取执行 API，编译脚本从 `@advjs/core/compiler` 获取编译 API，类型使用 `import type`。

如果宿主需要把剧情能力包装成自己的 SDK，可保留以下异步入口：

```ts
import type { AdvRuntimeOptions } from '@advjs/core/runtime'
import type { RuntimeProgram } from '@advjs/types'

export async function createStoryRuntime(program: RuntimeProgram, options: Omit<AdvRuntimeOptions, 'program'> = {}) {
  const { createAdvRuntime } = await import('@advjs/core/runtime')
  return createAdvRuntime({ maxCheckpoints: 0, maxTraceEntries: 0, ...options, program })
}
```

宿主通过 `options.plugins` 注册剧本要求的插件。SDK 发布 ESM，并由最终游戏打包时，可以把 `@advjs/core/runtime` 标为 external，声明经过验证的 Core 依赖版本，让消费端保留动态导入和共享同一份运行时；编译器只用于构建。需要自包含 SDK 时，也可以直接打包运行时，但应保留代码分块，检查重复依赖。合并为单文件、把动态导入内联或提前预加载，都会改变首次加载行为。

`createStoryRuntime()` 是宿主示例函数，不是新增的 Core API。命名导入不保证状态机内部每个功能都能独立裁剪；按子入口选择依赖边界，再用实际产物和浏览器网络请求确认结果。

## 包版本与本地联调

`runtime` / `compiler` 子入口已在当前工作区实现。工作区的版本号不能证明同名 npm 版本包含这些改动；正式安装前检查目标发行物的 `exports`，并固定已经验证的 Core / Types 版本。本文不承诺某个尚未验证的 npm 版本已经发布。

本地联调可以使用以下相邻目录：

```text
workspace/
├── advjs/
└── my-web-game/
```

先在 `advjs/` 构建依赖：

```bash
pnpm install
pnpm types:build
pnpm parser:build
pnpm core:build
```

再在 `my-web-game/` 安装本地链接：

```bash
pnpm add @advjs/core@link:../advjs/packages/core @advjs/types@link:../advjs/packages/types
```

pnpm workspace 内的应用应按其 `package.json` 位置调整路径。检查解析结果：

```bash
node --input-type=module -e "await import('@advjs/core/runtime'); await import('@advjs/core/compiler'); console.log('ADV.JS entries ready')"
```

本地链接依赖另一份 checkout，不能直接交给独立 CI。正式发行使用固定包版本和锁文件；CI 不依赖开发者的绝对路径。联调时先构建 ADV.JS，再启动宿主或浏览器测试，避免链接包重建触发 Vite 重载。

## 编译与运行分开

把下面三个参考文件复制到宿主的 `narrative/` 目录。它们是宿主适配器示例，不是需要安装的新 SDK。JSON 产物由编译脚本生成，修改剧本后重新生成；生产构建先编译或检查产物是否过期。

```text
narrative/
├── quest.adv.md
├── compile.mjs
├── quest.program.json
└── session.ts
```

剧本包含稳定选项 ID、显式分支锚点、条件、宿主接单活动与终止节点：

<<< ../../examples/web-game/quest.adv.md

构建脚本使用独立编译入口，不进入浏览器模块图。`warning` 仍需要审阅；静态分析不能证明真实游戏或服务器会接受活动请求：

<<< ../../examples/web-game/compile.mjs

在宿主根目录执行：

```bash
node narrative/compile.mjs
```

## 多份剧本的编排与加载

### 多章节共享一个剧情

需要共享变量、选择历史和存档的剧本，编译进同一个 Program。每份文件明确指定章节 ID，`chapters` 数组的第一章决定初始入口；文件名和文件读取顺序不会自动建立章节关系。

下面的街口剧本通过 `[过去交谈](keeper)` 进入守门人章节。精确跳转可写为 `keeper#leave`，其中 `leave` 是该章显式锚点；跨章目标会在编译时校验：

<<< ../../examples/web-game/entry.adv.md

把它和已有的 `quest.adv.md` 放在同一目录，使用这个构建脚本：

<<< ../../examples/web-game/compile-chapters.mjs

```bash
node narrative/compile-chapters.mjs
```

产物是 `town.program.json`，可传给后文相同的 `createEmbeddedSession()`。`runtime.choose()` 执行选项编排，`runtime.go('keeper#leave')` 可由明确的宿主交互触发；导航细节见[运行时导航与存档](./navigation-and-saves)。章节结束需要显式跳转才能进入另一章，不能依赖文件拼接。

一个 Program 的章节目前随 JSON 一起加载，Core 没有增量追加或自动下载章节的接口。需要按 NPC 或地区分包时，使用独立 Program。

### 独立 NPC 会话按需加载

分别编译独立会话，用宿主白名单选择加载器。以下参考目录只缓存 Program 数据，合并同一剧本的并发加载；失败后允许重试，不共享运行中的 Runtime：

<<< ../../examples/web-game/catalog.ts

复制 `catalog.ts` 后，下面的声明加载前两种方式生成的 JSON；动态导入路径使用字面量，方便 Vite 等打包器识别分块：

```ts
import type { RuntimeProgram } from '@advjs/types'
import { createProgramCatalog } from './narrative/catalog'

const stories = createProgramCatalog({
  keeper: () => import('./narrative/quest.program.json').then(module => module.default as RuntimeProgram),
  town: () => import('./narrative/town.program.json').then(module => module.default as RuntimeProgram),
})

// 首次交谈时读取数据，再为当前会话创建独立运行时。
const program = await stories.load('keeper')
const { createEmbeddedSession } = await import('./narrative/session')
```

`stories` 是宿主目录示例，不是 Core 自动扫描 `.adv.md` 的 API。浏览器读取预编译 JSON；文件系统读取与 Markdown 编译留在构建脚本。缓存的 Program 按不可变数据使用，每次交谈创建独立会话，存档按玩家、NPC 与 Program ID 隔离，再由 `restore()` 校验 hash。

宿主负责只打开一个玩家对白、切换时关闭旧会话、取消迟到的加载，以及按需预取。跨 Program 需要宿主结束当前会话并打开下一份，`go()` 只在当前 Program 内跳转。任务、关系等公共数据通过宿主变量镜像和活动结果同步，不合并不同 Program 的快照。

## 对接游戏规则与对白 UI

运行时只提出请求。宿主 `acceptQuest()` 检查玩家状态、任务是否已接、距离与可交互条件，再返回真实结果；地图导航、奖励和任务完成继续归游戏自己的系统负责。剧本变量是游戏状态的镜像，不是奖励或背包的权威数据。

参考适配器采用同步游戏操作，只保存活动完成后的稳定快照，并禁止剧情回退。错误交由调用方展示；结束或失败后，调用 `close()` 释放宿主冻结状态：

<<< ../../examples/web-game/session.ts

宿主在首次交谈时动态导入适配器和产物。下面的 `host` 实现 `GameHost`，`saved` 是宿主存档中可选的剧情快照；这段展示接入位置，不提供特定游戏的 UI：

```ts
const [{ createEmbeddedSession }, { default: program }] = await Promise.all([
  import('./narrative/session'),
  import('./narrative/quest.program.json'),
])
const session = createEmbeddedSession(program as RuntimeProgram, host, saved)
await session.start()

// UI 的“继续”、选项和“关闭”分别调用以下方法。
await session.next()
await session.choose('accept')
session.close()
```

调用处通过 `import type { RuntimeProgram } from '@advjs/types'` 获取类型。不要把示例里的三个命令连续执行为真实用户流程；只在对应输入发生时调用。动态导入开始前显示加载态，重复确认应被拦截；导入未完成就关闭时，用会话序号丢弃迟到的结果，避免重新打开已关闭的对白。

直接实例化 `createAdvRuntime({ plugins })` 的宿主无需插件 `client` 描述。只有使用 ADV.JS Client / Vite 插件自动重建插件工厂和活动 renderer 时，才需要对应的静态 `client` 配置。完整协议见[插件与活动](./plugins-and-activities)。

## 输入、存档与活动恢复

宿主 `freeze(true)` 应释放已按住的驾驶输入，冻结需要暂停的世界与任务计时，阻止场景快捷键穿透；对白导航、手柄轮询和关闭操作继续运行。DOM 对白框应管理模态焦点，关闭时恢复 NPC 交互入口；触屏按住控件卸载时必须释放输入。Core 不提供这些宿主行为。

把快照作为原游戏存档的可选字段，保持旧存档可读。恢复前限制字段大小并检查数据结构，`runtime.restore()` 继续校验 schema、Program ID、语义 hash 和游标。示例会在剧本不兼容时从头交谈，用当前 `game` 镜像刷新条件，并通过 `restarted` 告知宿主显示更新提示；城市、任务和背包进度不随之重置。

`maxCheckpoints: 0` / `maxTraceEntries: 0` 适用于不需要剧情回退与诊断记录的接入；开发时可以保留有上限的 trace。示例里的 `activityRollback: 'unsupported'` 不能代替业务幂等性：Runtime 会拒绝恢复到该活动的等待状态，示例因此重新交谈；`acceptQuest()` 仍必须拒绝重复接单。声明为 `supported` 的活动恢复等待状态时会重新发出请求，异步网络操作需要额外的请求 ID、取消与恢复策略，见 [AI 接入](../../ai/web-game-integration)。

不要每帧重建 Runtime 或编译 Markdown。NPC 交互开始时创建会话，剧情命令后更新展示和存档，离开时释放订阅与输入。需要舞台效果时消费 `subscribe()` 的 effects；不要默认把每个效果直接变成任意宿主函数调用。

## 验证

至少验证未交谈时不下载剧情运行时、成功 / 失败分支、已接任务的条件过滤、读档不重复业务操作、关闭时释放输入与恢复焦点，以及剧本更新后的快照重启。多剧本还需验证跨章链接、独立会话状态隔离、并发加载去重与失败重试。浏览器构建检查 `runtime` 的静态依赖闭包，编译器与完整 Client 不应进入该闭包。

当前实证是 `dayun-kicker` 的 Vue / Three.js 接入：桌面、320 × 568 手机与标准手柄流程均已验证；该剧本与运行时块约 8 KiB gzip。这个数值包含该消费端的 tree shaking 和压缩设置，不是任何宿主都能获得的固定 SDK 大小。版本、命令与验证边界见[集成报告](/reports/2026-10-08-headless-game-integration)。

AI 辅助接入、上下文契约和运行时 NPC 对话见 [Web 游戏的 AI 接入](../../ai/web-game-integration)。
