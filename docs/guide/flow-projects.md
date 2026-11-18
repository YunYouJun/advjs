# 原生 Flow 文件项目

Flow 章节可以保存为版本化 JSON，经过标准项目编译器生成 RuntimeProgram v2。Node 的 `adv check`／`adv build`、Editor 与 Studio 的 `compileProject` 使用同一条编译和目标链接链路；运行时不执行章节中的 JavaScript 或 TypeScript。

## 目录与入口

```text
adv.config.json
adv/
  settings/game.json
  chapters/intro.chapter.json
  characters/hero.character.md
  scenes/room.md
  assets.json
  audio/voice-ledger.json
  audio/mixer.json
```

`adv.config.json` 指定项目格式和内容根：

```json
{
  "id": "flow-example",
  "format": "flow",
  "root": "adv",
  "theme": "default"
}
```

`adv/settings/game.json` 可以明确章节顺序、入口章节和剧情源语言：

```json
{
  "title": "Flow Example",
  "locale": "zh-CN",
  "entryChapterId": "intro",
  "chapters": [
    { "id": "intro", "sources": ["chapters/intro.chapter.json"] }
  ]
}
```

一个文件章节只接受一个 `.chapter.json` 来源，声明的 `id` 必须与文件中的 `id` 一致。路径必须位于项目内，不接受绝对路径、反斜杠或 `..`。也可以在 `game.json` 的 `chapters` 中直接声明相同的 JSON 章节对象；不声明章节列表时，编译器按路径顺序发现内容根的 `chapters/**/*.chapter.json`，使用文件内的 ID，不按文件名猜测身份。

默认入口为第一个章节的 `startNodeId`，未指定节点入口时为章节的第一个节点。`entryChapterId` 可以放在游戏配置或项目配置中，游戏配置优先。章节、节点及选项的 ID 使用字母、数字、点、短横线与下划线，不得以下划线开头。

## 章节与节点

以下章节需要原生角色卡中存在 `hero`。选项在当前章节内选择两个明确目标；旁白使用固定的 `narrator` 身份，不创建虚构角色。

```json
{
  "schemaVersion": 1,
  "id": "intro",
  "title": "初见",
  "startNodeId": "hello",
  "nodes": [
    {
      "id": "hello",
      "type": "dialogues",
      "dialogues": [
        {
          "speakerId": "hero",
          "text": "你好。",
          "lineId": "line_019d137e-7abc-7000-8000-000000000001"
        }
      ]
    },
    {
      "id": "choose",
      "type": "choices",
      "choices": [
        { "id": "stay", "text": "留下", "target": "narration" },
        { "id": "leave", "text": "离开", "target": "end" }
      ]
    },
    {
      "id": "narration",
      "type": "narration",
      "text": "故事开始了。",
      "lineId": "line_019d137e-7abc-7000-8000-000000000002"
    },
    { "id": "end", "type": "end" }
  ]
}
```

| 节点类型     | 运行字段与行为                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `start`      | 起点锚点；使用 `next` 或顺序后继。                                                                                                                     |
| `dialogues`  | `dialogues` 数组中的每项包含 `text`、可选 `speakerId` 和 `lineId`；未声明说话人时使用旁白。旧字段 `speaker` 可读取，但新文件应使用稳定的 `speakerId`。 |
| `narration`  | `text`、可选 `lineId`；固定使用 `narrator`。                                                                                                           |
| `choices`    | 非空 `choices` 数组，每项包含唯一 `id`、`text`、`target` 和可选字符串 `when`；条件由已有 RuntimeExpression 解析器处理，不执行代码。                    |
| `background` | `name` 引用已声明的场景，可选 `src`；场景自己的 `assetId` 从原生目录解析。                                                                             |
| `tachie`     | `name` 引用角色，`action` 为 `enter` 或 `exit`；`status` 默认为 `default`，可选 `enter`／`exit` 为名称或名称数组。                                     |
| `audio`      | `operations` 使用原生 `bgm`、`ambience`、`sfx` 协议，最多 64 项。                                                                                      |
| `end`        | 终止当前运行。                                                                                                                                         |

除 `end` 外，未指定 `next` 的节点按数组顺序连接。显式 `next: null` 表示断开后继，不能再按数组顺序跳到下一节点。`next` 和选项 `target` 可以是当前章节内的节点 ID，也可以是 `chapter-id#node-id` 或 `{ "chapterId": "chapter-id", "nodeId": "node-id" }`。目标必须确实存在；旧字段 `target` 不能代替节点级的 `next`。

对白组的第一句保留组节点 ID，后续句子展开为 `group-id.dialog-2`、`group-id.dialog-3`。`lineId` 是独立的持久身份，不能随着排列、翻译或重新生成音频而改变；所有章节内的 `lineId` 必须全局唯一，并使用 `line_<uuidv7>`。

文件限制为 10 MiB，每章最多 10,000 个节点，每个对白组最多 10,000 句，每个选项节点最多 256 项，单句文本最多 1 MiB。未知节点、无效结构、重复身份、错误入口与悬空目标会产生带来源路径的诊断，并阻止生成可播放 Program。

## 音频与配音绑定

音频节点只引用原生 Asset Catalog 中的稳定 ID。下面的 ID 必须预先登记为对应的 `bgm`、`ambience` 与 `sfx` 资源；路径、URL 和供应商信息不写进剧情操作。

```json
{
  "id": "room-audio",
  "type": "audio",
  "operations": [
    { "type": "bgm", "action": "set", "asset": "audio_019d137e-7abc-7000-8000-000000000001", "loop": true, "gain": 0.3 },
    { "type": "ambience", "action": "set", "slot": "weather", "asset": "audio_019d137e-7abc-7000-8000-000000000002", "loop": true },
    { "type": "sfx", "action": "play", "asset": "audio_019d137e-7abc-7000-8000-000000000003" }
  ]
}
```

清除持续音轨使用 `bgm`／`ambience` 的 `action: "clear"`，不携带 `asset`。淡入淡出、环境槽位和音量的完整规范见[音频管理](/guide/audio)。资源不存在、用途不匹配、被拒绝的场景资源或旧 URL 音频字段会阻断编译。

对白与旁白通过相同的 `adv/audio/voice-ledger.json`、精确语言标签和 `selectedTake` 绑定音频。源语言由 `game.locale` 指定，默认为 `zh-CN`；源语言生成与过期检查使用当前节点文本，其他语言使用已登记的翻译文本。显式 `spokenText` 优先于发音词典。旧 take 保持不可变，修改文本、词典或 Profile 不会自动替换已选音频。只有已选 take 会进入运行产物；未选历史、克隆授权文档和参考音频不公开。生成与审核流程见[作者语音](/guide/authoring-voice)。

普通标准项目构建也只复制游戏明确引用的图片、角色、音频和图标，不自动复制整个 `public/`。音色样本、未选 take、参考音频及未声明的其他文件留在作者项目中。需要发布的资源应通过原生目录或游戏配置声明；`favicon` 可以明确引用本地图片，未配置时使用内置图标。

## 使用已发布的 Opus／AAC

完成音频发布后，普通 Flow 项目可以显式使用公开 Asset Catalog 构建。指定发布结果的 `manifestUrl` 和 `revision`；后者是完整目录文件字节的 SHA-256，不是项目源文件修订号。

```bash
adv build --audio-manifest "https://media.example.com/project/manifests/assets.HASH.json" \
  --audio-manifest-sha256 "PUBLISHED_MANIFEST_SHA256"
```

目录也可以是本地 JSON 文件，但同样必须提供准确哈希。构建会核对原生资源的 ID、用途、master 哈希以及对白已选 take，再将其传输位置替换为经过处理的 Opus／AAC 变体。它不会在构建时调用 TTS 或转码。Chromium 优先使用 Opus；WebKit 对流式音轨使用 AAC，以保证音量和多轨混音经过 AudioEngine。

该模式仅打包明确引用的图片等项目资源，不整体复制 `public/`；原始 WAV、未选配音历史、参考音频和授权资料应留在作者项目与私有宿主存储中。源 Asset Catalog 和剧情 JSON 保持原样，之后可以继续按原生协议编辑、审核和生成。

公开媒体所在的 COS 或 CDN 必须允许播放器 Origin 的 `GET`／`HEAD` 跨域请求，使 Web Audio 可以读取媒体并执行混音。不同协议、域名或端口均属于跨域；使用 CDN 加速域名时还需要在 CDN 响应侧配置相应跨域头，不能只修改 COS 规则。部署时按实际播放器来源设置，参考[腾讯云跨域访问说明](https://cloud.tencent.com/document/product/436/56652)。本地端到端测试服务的宽松 CORS 只用于隔离验证，不会修改真实存储桶配置。

## 结构化写回与兼容边界

共享 `readFlowAudioTarget(content, nodeId)` 与 `patchFlowAudioOperations(content, target, operations, catalog)` 只编辑明确存在的原生音频节点；保存前比较冻结的节点内容，发生冲突时要求重新读取。节点内的未知作者字段保留，节点数组之外的源文件字节保留。宿主还须通过 `ProjectWorkspace` 或对应文件端口执行项目级 CAS。

`applyProjectPatches` 支持 `.chapter.json` 的 `title`、`description`、`nodes` 和 `startNodeId` 字段，不以结构化补丁修改章节身份或版本。作者字段、图像提示词及编辑器布局可以留在源 JSON 中，播放器投影只保留已支持的运行字段。

原生 Flow 文件不接受 `fountain` 与 Markdown 混用，不解释 Vue Flow 的 `edges`，也不把旧 `.chapter.ts` 当作第二个剧情来源。迁移时将运行节点保存为 JSON，把编辑器边和旧字段明确保留为作者元数据；原始模块可以保留作历史参考。

## Editor 与 Studio 可视化编辑

Editor 打开 `.chapter.json` 时使用原生 Flow 编辑器；Studio 在章节页发现相同 JSON 章节，宽屏显示节点图，窄屏提供可操作的节点列表。两端复用 `@advjs/core` 的纯编辑命令、历史和序列化协议，并以同一 Compiler 校验草稿。Markdown 的流程图仍是其源码投影，保存格式不会隐式转换。

编辑器支持上述八种节点、对白组与稳定行 ID、选项和 `when` 条件、同章／跨章目标、入口、场景、角色演出及共享音频操作。新对白生成新的 UUIDv7 行 ID，修改文本和移动节点保留原 ID。未知作者元数据和合法旧字段在写回时保留，玩家产物只保留运行字段。

节点图按实际卡片尺寸避让重叠，并为分支、回连和自环预留连线路径。默认以可读比例定位选中节点；「全图概览」用于查看拓扑，「定位选中」和「100%」返回细节。窄屏会堆叠属性面板，但不会因窗口宽度改变剧情布局。

叙事、分支、场景／角色、音频使用克制的分类色，同时保留图标与类型文字；选中状态使用独立外框，无效目标使用错误提示。完整选项文字保留在节点与属性面板，连线上显示对应序号，条件分支带「条件」标记。

打开图时的避让只是显示投影，不会自动改写源文件。「自动排版」明确更新所有节点的位置，可一次撤销并随保存写回；它不改变节点数组、入口、连线或稳定身份。

图上拖动只修改节点 `position: { x, y }`；调整数组顺序是另一项操作。运行边由 `next`、选项 `target` 或省略 `next` 时的顺序后继派生，不能从屏幕位置猜测。连接修改原生目标，断开普通后继写入 `next: null`；选项必须有明确目标，未完成选项草稿会产生诊断。

撤销／重做保存编辑命令历史；保存使用宿主文件端口比较原始源文件 revision。外部修改时保留当前草稿，作者可以载入最新文件重新编辑，不能用旧草稿静默覆盖。删除被入口、连线或其他章节引用的节点前先列出引用并阻断删除；先明确改入口或重新连接后再删除。

Editor 的「载入项目版本」在有未保存修改时先确认；取消、关闭弹窗或按 Esc 都保留草稿和撤销历史。尚未保存的新章节可以用「放弃新章节」取消，不创建或删除项目文件。读取期间暂时禁用编辑与保存，切换章节后忽略旧读取结果。

切换工作区标签保留当前项目的未保存草稿和历史；项目、账号或文件系统切换时清理旧范围状态。格式不同但语义相同的 JSON 不产生虚假修改提示，布局和数组顺序变化仍须保存。

Studio 的发现、重载、预览和项目导出使用同一 JSON 章节与入口，不再把 Flow 包装成 Markdown。保存后运行 `adv check`／`adv build` 或在工作区预览；它们使用原生资源、角色、场景及配音账本，不需要导出另一份剧情图。

新建章节时，共享服务把 JSON 文件和 `game.json` 中的显式章节来源一起提交；自动发现项目也保留原入口，新增文件的排序不会改变开场。两个文件的原始版本与已有编译输入一并检查，章节 ID、文件冲突或配置变化时保留草稿并拒绝写入。

## 验证

在项目目录运行：

```bash
adv check --json
adv build
```

仓库内的原生示例：

```bash
pnpm --dir demo/flow exec adv check --json
pnpm --dir demo/flow build
```

`demo/flow` 保留原稿对白、说话人及旧模块，以原生 JSON 为明确入口；缺失的原图片地址保留在作者元数据中，实际示例使用本地原创 SVG 占位图与测试音调。示例没有真实演员配音，也不以占位素材代表原影视资产。

### AI 单章节提案与人工微调

原生 Flow 使用同一份章节 JSON、稳定节点／行 ID 和编译器。AI 通过现有 CLI 或 MCP 读取一个已有章节及其版本，生成有界编辑命令；不需要另建模型服务，也不依赖编辑器调用外部模型。

- CLI：`adv flow read --path adv/chapters/intro.chapter.json --json` 读取章节、文件 revision 和可跨宿主比较的创作源 projectRevision；`adv flow plan --request '<提案 JSON>' --json` 只做差异与校验，不写文件。
- MCP：`adv_flow_read` 与 `adv_flow_plan` 提供相同的只读接口。提案使用 `schemaVersion: 1`、`path`、`expectedRevision`、`projectRevision` 和 `commands`。对白更新／删除按稳定 `lineId` 定位，不使用会随排列改变的行下标。
- Editor：打开对应章节的「AI 修改提案」，粘贴请求，先「比较与校验」。差异与诊断由当前工作区重新计算，不信任外部提供的校验结果。无错误后「载入未保存草稿」，节点定位、属性编辑、撤销和保存沿用普通 Flow 编辑流程。
- 已有人工草稿时先保存或明确放弃，提案不会静默覆盖。载入是一个可撤销操作，不等于保存；比较后或载入后当前工作区已读取的项目文件改变，都会拒绝旧版本应用或保存并保留草稿。
- 浏览器 Editor 可使用「试玩选中草稿」运行未保存内容，并返回 Flow 继续微调。桌面版仍须先保存，再使用隔离的游戏预览，不将未保存项目内容载入有桌面权限的窗口。

首版只接收一个已有原生章节的命令提案，不创建任意文件、不直接执行 AI 输出、不自动保存。测试中的提案是确定性的合成样例，不代表调用了外部模型。

提案的 projectRevision 按共享创作源范围计算，排除宿主额外收集的 README、package.json 和二进制占位内容；文件 revision 仍比较章节的精确字节。接受提案时另保留当前工作区完整快照版本，保存继续使用宿主 CAS。草稿试玩的存档仅留在当前试玩会话，不写入正式存档、解锁进度或画廊记录。

提案中的 `commands` 示例（保留读取结果的三个路径／版本字段，再使用实际节点和行 ID）：

```json
[
  { "type": "update-dialogue", "nodeId": "greeting", "lineId": "line_019d137e-7abc-7000-8000-000000000001", "patch": { "text": "微调后的对白" } },
  { "type": "connect", "nodeId": "branch", "choiceId": "continue", "target": "ending" }
]
```

试玩选中节点是定位预览：使用项目初始变量并重建可推导的持久场景状态，不重放到达该节点前的脚本动作或一次性音效。后续对白和选择由真实运行时执行；完整路径验收仍应从游戏入口试玩。

## 嵌入其他游戏的创作工具

`@advjs/core/authoring` 是不包含 Vue、音频、文件系统及运行时实例的纯数据入口，复用 Editor / Studio 已有的 Flow 编辑协议。该入口由本地源码提供；使用已发布包前，先确认安装版本包含此导出。

```ts
import { applyFlowEdit, flowEditGraph, layoutFlowGraph, parseFlowDocument } from '@advjs/core/authoring'

const document = parseFlowDocument(sourceText)
const draft = applyFlowEdit(document, {
  type: 'update-dialogue',
  nodeId: 'greeting',
  index: 0,
  patch: { text: '修改后的对白' },
})
const graph = flowEditGraph(draft)
const layout = layoutFlowGraph(draft)
```

`parseFlowDocument` 允许保留未知作者元数据和待修复字段，不能替代 Compiler 及宿主的语义校验。命令保留稳定节点与行身份；布局返回独立坐标，不改变节点数组顺序。显式 `next: null` 表示断开，不会落到下一个数组节点。跨章连线保留在图中，默认布局只遍历当前文档。

游戏自有 JSON 可以通过适配器投影为 `FlowEditDocument`，在修改后还原原格式。宿主须显式映射条件、结束语义和自定义节点，并验证投影往返不会丢失内容。创作文档版本不等于 RuntimeProgram 版本；这里不会自动升级旧运行程序或玩家存档。自定义游戏命令继续使用[运行时插件与活动](/guide/runtime/plugins-and-activities)；桌面工具面板使用[Editor UI 插件](/guide/editor/ui-plugins)。

### 内存预览操作会话

`createPreviewSession(adapter)` 为游戏预览提供有界操作历史、状态差异轨迹、失败恢复和 `back()`。适配器提供 `reset()`、`apply(command)`、`inspect()` 与 `describe(command)`；游戏自行持有对白运行时、变量、世界状态及临时计时器。创建会话前须将适配器初始化到与 `reset()` 相同的状态。

```ts
import { createPreviewSession } from '@advjs/core/authoring'

let state = { counter: 0 }
const preview = createPreviewSession<number>({
  reset: () => { state = { counter: 0 } },
  apply: (amount) => { state.counter += amount },
  inspect: () => state,
  describe: amount => ({ label: `增加 ${amount}` }),
})
await preview.dispatch(2)
await preview.back()
```

默认最多 2000 次成功输入，轨迹保留最近 200 条；通过 `maxInputs` / `maxTraceEntries` 显式调整。输入、检查结果和轨迹均复制后保存。失败操作及回退通过重置并重放先前输入恢复完整宿主状态；重放失败后会话拒绝继续操作，需要创建新会话。并发操作被拒绝。

适配器必须只操作独立内存，且重放结果确定。随机数、外部返回值和时间增量应放入输入或固定种子，不应在 `apply` 中读取真实时钟、写正式存档、发奖或调用有外部副作用的服务。会话不会自动隔离这些副作用，也不是正式游戏的存档迁移器。

### 可复用 Vue 创作控件

`@advjs/gui/authoring` 提供不注入主题的 Vue 3.5 创作控件，供 Editor、Studio 或外部项目工具按需导入。入口发布源 `.vue` / TypeScript 文件，消费方需要启用 Vue SFC 编译；不经过 GUI 根入口或加载默认主题。`@advjs/gui/authoring/condition` 单独导出纯文本解析辅助函数，不加载 Vue 控件。

| 控件                    | 受控输入与事件                                              | 宿主职责                                                                  |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `AdvFlowCanvas`         | 展示节点、边和尺寸；`selected` / `select`                   | 投影源数据、提供节点内容和标签；通过 `node` / `toolbar` slot 复用宿主控件 |
| `AdvConditionInspector` | `value`、可保留的 `draft`、语言适配器；`change` / `invalid` | 提供纯解析和语义校验、变量参考、中文或英文提示；保存前独立校验            |
| `AdvDiagnosticsPanel`   | 诊断、分页尺寸、禁用状态；`navigate`                        | 跳转文件或节点；通过 `diagnostic` / `pagination` slot 保留宿主外观        |

画布提供指针捕获与释放、滚轮平移、组合键缩放、方向键平移、Home 定位和总览；布局和镜头只留在视图内，不写源文件。边的 SVG marker 使用 Vue `useId()`；多个独立 Vue 应用共用文档时，各应用设置不同的 `app.config.idPrefix`。

条件适配器提供 `format(value)`、`parse(text)`，可选 `validate(value)`、`references` 和 `examples`。JSON 语言可使用 `createJsonConditionAdapter()`；ADV 表达式字符串可以在适配器里调用 `parseRuntimeExpression()` 后原样返回字符串。控件不执行表达式，也不自动在两种语言间转换。语法未完成时仅发送 `invalid(text)`，不覆盖源值；语法有效的值通过 `change(value)` 作为可修复草稿送回宿主，语义错误依然显示，宿主负责阻止保存和预览。传入 `draft` 可跨选择保留尚未完成的输入；清除可选字段返回 `undefined`。

诊断默认每页 80 项，可逐页查看全部问题；替换诊断集合或改变数量会回到第一页。`navigate` 保留诊断的原字段，包括宿主附带的定位信息。它不读取文件、调用平台服务或持久化偏好。

样式只包含画布几何和必要的内容布局。Editor 的按钮、焦点、字号和颜色仍使用 AGUI，Studio 使用自身规范，外部工具通过 scoped 样式和 slot 连接自己的 token。不要把有皮肤的控件或游戏依赖放入这个入口。当前 Editor 的项目诊断面板已使用同一分页与导航实现；其既有图编辑器仍保留原实现。

### 宿主适配的剧情预览

`useAuthoringPreview(sourceRef, invalidRef, adapter)` 管理预览创建、串行输入、回退、草稿过期及错误状态。`adapter.revision(source)` 返回内容标识，`adapter.create(source)` 创建隔离的内存宿主并提供 `inspect()`、`dispatch(command)`、`back()`；可返回 Promise。宿主自行复制源配置，不可持有或修改实时草稿。创建前捕获版本，创建过程中发生编辑也会使结果过期。校验失败、过期或忙碌时禁止输入，失败重跑保留旧会话，卸载后忽略未完成结果。该 composable 不接触文件、浏览器存储或游戏存档。

```ts
import { useAuthoringPreview } from '@advjs/gui/authoring'

const preview = useAuthoringPreview(draft, invalid, {
  revision: source => JSON.stringify(source),
  create: source => createMyInMemoryHost(structuredClone(source)),
})
await preview.start()
await preview.dispatch({ type: 'choose', id: 'continue' })
await preview.back()
```

| 控件                   | 数据及事件                                                            | 宿主职责                                                                                                       |
| ---------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `AdvPreviewPlayer`     | `PreviewDialogue`、`disabled`；`choose` / `next` / `close` / `locate` | 运行真实对白、计算分支和可继续状态；通过 `button`、`empty`、`footer` slot 注入控件与世界操作                   |
| `AdvVariableInspector` | `PreviewVariableGroup[]`；`change(id, value)`                         | 映射宿主状态与变量声明到控件，按 ID 路由回业务命令，重新计算只读事实；提供 `boolean` / `select` / `unset` slot |
| `AdvPreviewTrace`      | `PreviewTraceItem[]`、步数、`PreviewCursor[]`；`locate(cursor)`       | 提供输入记录、状态差异与稳定节点地址；通过 `cursor` slot 定制定位按钮                                          |

变量控件支持布尔、字符串、有限数值、枚举、取消可选值与只读分组；取消返回 `undefined`，与 `false`、`0`、空字符串和枚举中的 `null` 分开。空数值或越界数值保留为控件错误，不发送业务命令；宿主仍须独立校验。枚举通过选项身份映射，不执行输入文本。轨迹默认显示最新 200 条，展示上限与宿主的完整重放历史相互独立；游标保持宿主 ID，不发明新的运行地址。

这些控件不创建第二套剧情执行器，不理解配送、地点、清场或通关。业务宿主继续复用自己的编译器、运行时、插件和规则；同一 UI 可消费不同运行时版本。布局、提示、主题和保存功能由消费方组合。本批为源码集成，正式发布包是否包含这些接口须按实际版本检查。
