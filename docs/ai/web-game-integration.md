# Web 游戏的 AI 接入

AI 可以帮助现有 Web 游戏接入 ADV.JS、创作和检查剧本；也可以在玩家交谈时，通过宿主活动生成 NPC 回答。前者是开发工作流，后者需要游戏自己的模型服务。两者共用 `.adv.md`、`RuntimeProgram` 与活动协议，运行时方案见[轻量嵌入指南](/guide/runtime/embedding)。

## 选择 AI 的职责

| 用途                 | 接入方式                                                          | 运行游戏是否需要模型 |
| -------------------- | ----------------------------------------------------------------- | -------------------- |
| Agent 编写适配器     | 读取宿主代码、公开 API 与接入契约，修改可审阅文件                 | 否                   |
| AI 创作固定对白      | 生成 `.adv.md`，构建时编译，检查分支                              | 否                   |
| Agent 用工具检查内容 | 标准 ADV.JS 内容目录配合 CLI、Skills 或 MCP                       | 否                   |
| 实时 NPC 对话        | `npc-ai/reply` 活动 → 宿主后端 → 校验 JSON → `completeActivity()` | 是                   |

轻量 Core 不包含推理服务、模型密钥管理或统一聊天后端。下文的 `/api/npc-reply` 是示例宿主协议，需要游戏后端实现；不是 ADV.JS 已提供的 HTTP 接口，也不是接入时必须采用的模型供应商。

## 给 Agent 的接入契约

把宿主边界放在仓库文档里，供 Codex、Claude Code、Cursor 或其他能够读写项目文件的 Agent 使用。无需先安装 MCP，普通文件访问也能完成轻量接入。建议提供：

- 已有框架、对白 UI 组件、输入释放、手柄与焦点约定。
- 只读游戏状态镜像，允许的活动名、输入字段和真实业务返回值。
- 内容与产物目录、稳定节点 / 选项 ID、编译命令和宿主验证命令。
- 多剧本的 Program 分组、章节 ID、首章入口、加载白名单与独立会话存档键。
- 存档字段大小、剧本版本变化、异步取消与业务幂等规则。

下面是与嵌入示例对应的宿主契约，可保存为 `narrative/integration-contract.json`。它供 Agent 理解项目，不是 ADV.JS 自动读取的新配置格式：

```json
{
  "contractVersion": 1,
  "runtimeImport": "@advjs/core/runtime",
  "compilerImport": "@advjs/core/compiler",
  "contentRoot": "narrative",
  "compileCommand": "node narrative/compile.mjs",
  "plugin": { "name": "game-bridge", "version": "1.0.0" },
  "world": { "game.hasQuest": "boolean, refreshed from host" },
  "activities": {
    "game-bridge/request": {
      "input": { "operation": "accept-quest", "questId": "town-delivery" },
      "result": { "ok": "boolean", "world": { "hasQuest": "boolean" } },
      "authority": "host.acceptQuest",
      "rollback": "unsupported"
    }
  }
}
```

可直接交给 Agent 的提示词：

```text
在当前 Web 游戏中接入 ADV.JS 轻量对白。

先读取仓库约定、现有 UI / 输入 / 存档 / 任务代码及 narrative/integration-contract.json。
检查当前依赖是否真正导出 @advjs/core/runtime 和 @advjs/core/compiler；
不要把工作区版本号当作已发布版本，不擅自替换框架或重写业务系统。

构建时把 .adv.md 编译为 JSON，首次交谈时动态导入运行时与宿主适配器。
为节点和选项提供稳定 ID，每个独立分支显式结束。
共享剧情编译成多章节 Program，按 NPC 分包的会话使用显式加载白名单和独立存档。
构建前校验跨章链接，检查首次加载与并发加载行为，不假设 Core 会自动扫描或下载章节。
只使用契约声明的变量、条件与活动；接单、背包、奖励由宿主规则决定。
保留旧存档兼容性，处理连续确认、导入取消、剧本 hash 改变和活动恢复。
沿用已有 UI 组件与 token，交谈时释放驾驶输入，支持键盘、手机和手柄。

完成可审阅的代码、剧本和接入说明，运行编译及宿主已有相关验证命令。
报告真实通过项、失败项与未验证范围，把结果保留为本地可审阅的改动。
```

如果任务只要求写剧本，保留后两段中的稳定 ID、契约与编译约束即可。修改 `.adv.md` 后必须重新编译；不要让模型直接手改 Program 的语义 hash 或生成未经校验的 Runtime 快照。

## CLI、Skills 与 MCP

需要角色卡、世界观和章节工具时采用[标准内容结构](/guide/project-structure)，从[Skills](/ai/skills/)与 [MCP](/ai/mcp)的安装入口选择当前已验证的发行物。在内容项目根目录执行：

```bash
adv context
adv check --json
```

`adv context` 提供创作上下文，`adv check` 检查该内容项目。MCP 服务器按其启动工作目录绑定项目；在 Agent 首次调用时核对返回的项目根目录。不要因为编辑器当前打开某个游戏，就假设已运行的 MCP 已切换到同一目录。

只有 `narrative/*.adv.md` 的轻量嵌入项目不必伪装成完整 ADV.JS 游戏：使用自己的编译脚本和宿主任务测试即可。若另建标准 `adv/` 内容目录，明确它与宿主构建的映射；CLI / MCP 的内容检查不能证明游戏任务、输入或焦点正确。

## 在玩家交谈时请求 AI

下面的脚本需要 `requiredPlugins: { 'npc-ai': '1.0.0' }`，可以作为单独的 NPC 回答 Program 编译。活动输入使用已知角色和话题；玩家文本、只读游戏状态与请求 ID 由宿主补入：

````md
```yaml
type: activity
use: npc-ai/reply
input:
  characterId: keeper
  topic: town
```

```yaml
type: end
```
````

使用与[嵌入指南](/guide/runtime/embedding)相同的 `compileMarkdownProgram()`，更换章节内容与插件依赖即可。宿主注册以下参考插件，并在 `waiting-activity` 时调用 `completeNpcReply()`。网络在宿主执行，插件节点和完成处理器保持同步 JSON 状态转移：

<<< ../examples/web-game/npc-ai.ts

把参考文件复制为宿主的 `narrative/npc-ai.ts`。以下片段中的 `program` 是编译后的 AI 回答 Program，`request` 是宿主已保存的 `NpcRequest`，`signal` 来自本轮交谈的 `AbortController`：

```ts
const { createAdvRuntime } = await import('@advjs/core/runtime')
const { npcAi, completeNpcReply, fetchNpcReply } = await import('./narrative/npc-ai')
const runtime = createAdvRuntime({
  program,
  plugins: [npcAi()],
  maxCheckpoints: 0,
  maxTraceEntries: 0,
})
await runtime.start()
// 调用网络前，先由宿主把 request 与 runtime.snapshot() 一起保存。
const reply = await completeNpcReply(runtime, request, fetchNpcReply, signal)
// reply 存在时交给宿主 UI；runtime.snapshot() 交给宿主存档。
```

这是新一轮交谈的接入位置；读档时恢复已有快照，不能先丢弃旧状态再无条件生成新一轮。

游戏后端接收 `NpcRequest`，使用角色公开设定和允许玩家知晓的当前状态构造提示词，再调用选定的模型。模型凭证留在后端。后端应校验玩家身份、角色 / 话题范围与文本长度，并按玩家与 `requestId` 缓存已经完成的回答。返回协议为：

```json
{
  "requestId": "host-generated-turn-id",
  "text": "沿着主路走，第二个路口就是集市。"
}
```

示例只接收匹配请求 ID、长度不超过 600 的纯文本回答；额外字段不进入运行时。任务、交易、奖励与战斗结果不由这个回答接口决定。如果需要 AI 提议动作，另行定义有限的动作 schema，交给宿主校验和执行，并把真实结果返回剧情。

## 请求生命周期与存档

宿主为每轮新交谈生成请求 ID，例如 `crypto.randomUUID()`，将 ID、请求内容和等待活动的快照一起保存。重试或读档恢复同一轮时复用这个 ID；新一轮才生成新 ID。`pendingActivity.id` 是剧情活动身份，不是跨存档、用户和会话全局唯一的计费请求 ID。

参考插件声明 `activityRollback: { reply: 'supported' }`，前提是后端支持上述缓存与请求 ID 复用；否则应声明 `unsupported`，并让宿主在等待快照无法恢复时重新开始或显示作者对白。关闭 checkpoint 不会绕过待处理活动的恢复限制。

每个会话同一时间只发起一个请求。宿主保存 `AbortController`，关闭、读档或开始新一轮前调用 `abort()`；迟到回复不能推进新的会话。参考 transport 设有 8 秒超时，网络失败或回复无效时提交作者写好的本地兜底文本；主动离开则保留待处理状态，不提交兜底。

`completeActivity()` 后的 `state.variables.npcReply` 保存已经展示的文本与来源，读档直接恢复文本，不重新生成答案。Core 不自动把变量插值到所有 Markdown 对白：宿主从 `npcReply` 取文本，更新自己的对话气泡或聊天记录，按纯文本渲染。流式 token 可以先显示在宿主临时 UI，最终校验后只提交一次完整结果；快照保存的是最终结果。

MCP 导出的完整创作上下文可能包含未揭晓剧情。实时 NPC 请求使用后端维护的角色公开上下文与玩家可知状态，不直接发送 `adv context --full` 的全部输出。离线 AI 创作的上下文和玩家运行时的上下文应分别维护。

## 验证

离线接入验证编译错误、稳定 ID、条件分支和宿主业务结果；AI 活动使用可控 transport 验证成功、超时兜底、无效回复、重复确认、关闭后的迟到回复，以及读档复用原请求 ID。模型服务、身份认证、缓存和实际浏览器网络需在具体宿主中另外验证。

参考代码在本地使用当前编译器与运行时验证，不附带可上线的推理后端，也未验证任何特定模型供应商。任务对白的浏览器实证与体积记录见[集成报告](/reports/2026-10-08-headless-game-integration)。
