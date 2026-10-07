# 仓鼠旗舰 Demo 与创作调试体验设计

状态：已由用户确认，进入实施准备

日期：2026-07-17

## 1. 背景

ADV.JS 已完成统一 `RuntimeProgram`、确定性 Runtime、声明式条件与动作、插件活动、跨章节导航、完整快照、CLI trace、Parser Playground 诊断和 Studio 试玩接入。当前 `demo/starter` 又承担入门模板，又承载《仓鼠》《仓生》改编内容，出现两个直接问题：

- 新用户复制 starter 时会同时继承专有剧情、互动插件、素材授权和较重配置；
- 仓鼠内容只有两个短场景，尚不足以作为“尽可能展示 ADV.JS 能力”的旗舰作品与跨宿主验收工程。

工具侧也存在可观察性断层：编译器已经产生带源码位置的诊断，Runtime 也有 Program、Snapshot、Effects 与 checkpoint，但 Studio 主要展示原始 AST 预览，试玩 Inspector 和浏览器 DevTools 仍只是 JSON `<pre>`。此外，`AdvActivity.vue` 硬编码了 `star-map/compare` 与 `civilization/initialize` 的专用 UI，插件能力尚未真正拥有自己的客户端呈现。

本设计把目录分层、旗舰剧情和创作调试体验作为一个垂直切片实施。仓鼠 Demo 既是作品，也是推动缺失能力落地的验收项目。

## 2. 已确认决策

1. `demo/` 可以同时包含最小 Demo 与完整 Demo；不强制所有 Demo 体量一致。
2. `demo/starter` 恢复为最小、可复制、可独立运行的入门工程。
3. 新建 `demo/hamster`，承载基于《仓鼠》《仓生》再创作的旗舰 Demo。
4. `examples/` 继续用于单项能力和最小代码片段；只有某项能力需要脱离完整项目讲解时，才从旗舰 Demo 提取 example。
5. 现有统一运行时是本轮基线，不重新实现第二套剧情执行器。

## 3. 目标

### 3.1 产品目标

- 提供一个 15–20 分钟、可重复游玩、至少三个结局的完整中文互动短篇。
- 让玩家在自然剧情中体验 ADV.JS 的对话、旁白、场景、立绘、音频、选择、条件、变量、跨章节导航、互动活动、存档、读档、回退、已读与历史能力。
- 让创作者可以在 Studio 或开发模式中看见同一份 RuntimeProgram、结构化诊断、当前运行状态和最近执行轨迹。
- 让互动插件拥有自己的客户端 UI，Core Client 不再知道具体插件名称。
- 形成可复制的最小 starter、可研究的完整 hamster、可检索的文档和可自动回归的测试矩阵。

### 3.2 工程目标

- 浏览器、Studio 与 CLI 继续执行同一 Program/Snapshot 语义。
- 新增的调试数据保持纯 JSON，可复制、导出和用于问题报告。
- Studio 和浏览器 DevTools 复用展示组件或无框架数据投影，不各自维护不同含义的 Inspector。
- 所有新增 Vue 组件使用 Vue 3 Composition API、`<script setup lang="ts">`、显式 props/emits 和小组件边界。

## 4. 非目标

- 不把本轮扩展成通用战斗、背包、任务、证物或成就系统。
- 不实现完整可视化剧情编辑器重写；Flow 专项能力继续由 `demo/flow` 与 `@advjs/flow` 承担。
- 不引入第二套日志/事件溯源内核；执行轨迹是有上限的调试投影，不进入游戏存档语义。
- 不把插件 UI 组件或 Vue 对象写入 RuntimeProgram/RuntimeSnapshot。
- 不逐字搬运两篇原作。剧情采用重新编排和新写交互对白，并保留来源、改编说明与内容许可证。
- 不为展示能力而加入与剧情无关的开关、页面或小游戏。

## 5. 目录与项目职责

```text
demo/
├── starter/                 # 最小、完整、可复制的入门工程
└── hamster/                 # 仓鼠旗舰 Demo 与跨端验收工程
    ├── adv.config.ts
    ├── README.md
    ├── ASSETS.md
    ├── LICENSE.content.md
    ├── public/
    │   ├── audio/
    │   ├── img/
    │   └── md/chapters/
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

### 5.1 `demo/starter`

starter 保留“一眼能读完”的最小配置：一个章节、一个场景、一个角色、一组选择和一个稳定锚点。它不依赖互动插件，不携带仓鼠内容许可，不包含自定义调试实现。它必须支持 `dev`、普通 build 和 single-file build，并在 README 中解释从哪里开始修改。

根命令 `pnpm demo` 继续启动 starter，避免改变已有入门习惯。

### 5.2 `demo/hamster`

hamster 是独立 workspace 包，拥有自己的脚本、部署配置、素材与内容许可。根目录增加明确的 `demo:hamster` 与 `build:demo:hamster` 命令。仓鼠相关单元测试和 E2E 测试以 `hamster` 命名，不再借用 `starter`。

`demo/README.md` 将 Demo 按“入门模板、旗舰作品、专项集成”说明，而不是暗示所有项目都是模板。

## 6. 剧情设计

### 6.1 改编原则

改编参考 YunYouJun 的[《仓鼠》](https://www.yunyoujun.cn/posts/hamster)与[《仓生（普通仓鼠）》](https://www.yunyoujun.cn/posts/the-common-hamster)，保留视野的边界、模拟世界、仰望星空、普通生命的文明跃迁、创造者与被创造者、文明最终面对自身等核心母题。玩家不是被动阅读原文，而是以“观测者”的决定改变实验条件，并在后续看见选择的长期结果。

原作页面、作者、许可证和改编范围写入 `ASSETS.md` 与 `LICENSE.content.md`。正文优先新写和概括，只在确有必要时使用短句，并明确归属。

### 6.2 四章结构

#### 第一章：笼外星光

观测室中的“观测者”与“读书人”讨论仓鼠看不见的世界。玩家选择观察方式，积累 `curiosity`、`empathy` 或 `control` 倾向；星图中出现无法解释的偏差。

展示能力：场景、背景、立绘状态、对话、旁白、BGM、同章选择、变量动作、条件文本和稳定锚点。

#### 第二章：世界终焉

观测者揭示世界是一轮模拟，并试图预测文明终点。玩家通过星图比对活动寻找偏差，可以接受提示、继续校准或带着不完整结果前进。失败不是死路，而是改变后续可用信息。

展示能力：`star-map/compare` 插件 UI、活动等待/完成、checkpoint、回退、条件选择、同章循环和跨章精确跳转。

#### 第三章：普通仓生

模拟重启，普通仓鼠获得跨代记忆。玩家为新文明选择名称与一项核心原则，并在资源、记忆和自由之间作出两轮决策。文明状态通过结构化变量持续累积，而不是用隐藏的脚本执行。

展示能力：`civilization/initialize` 插件 UI、嵌套 JSON 变量、`set`/`increment`/`push` 动作、条件分支、舞台切换、存档与读档。

#### 第四章：黯淡星空

仓鼠文明发现模拟边界并与创造者对话。结局由此前累积状态决定，不提供脱离前文的最后一题选结局。

至少包含：

- **《仍然仰望》**：好奇与共情占优，双方共同保留星空和不确定性；
- **《无尽转轮》**：控制与效率占优，文明延续但重复创造者的笼子；
- **《普通仓鼠》**：条件相对平衡，承认有限视野，在没有全知答案的情况下继续生活。

展示能力：跨章回指、路线条件、条件旁白、结局汇合、已读/历史记录和重新开始。

### 6.3 状态模型

初始变量保持少而可解释：

```ts
const initialVariables = {
  curiosity: 0,
  empathy: 0,
  control: 0,
  observationCount: 0,
  starMatched: false,
  starMatchScore: 0,
  civilization: null,
  civilizationLevel: 0,
  memories: [],
  ending: '',
}
```

所有路线条件可由文档和 Inspector 解释。不得加入只为强行锁结局而存在、玩家行为无法推断的神秘数值。

## 7. 能力展示矩阵

| 能力                         | starter         | hamster                | 自动验收            |
| ---------------------------- | --------------- | ---------------------- | ------------------- |
| Markdown 对话、旁白、场景    | 最小示例        | 四章完整使用           | Parser/Runtime 测试 |
| 稳定锚点与精确跳转           | 一个同章目标    | 同章、跨章、循环、汇合 | link 测试与路径测试 |
| 变量、条件、声明式动作       | 一个计数动作    | 路线状态与结局条件     | Runtime 分支测试    |
| 背景、立绘、BGM、舞台状态    | 最小背景        | 多场景与状态变化       | Client/E2E          |
| 插件活动                     | 无              | 星图比对、文明初始化   | 插件与 E2E          |
| 存档、读档、checkpoint、回退 | 保持引擎默认 UI | 纳入游玩路径           | Studio/浏览器 E2E   |
| 自动、跳过已读、历史         | 保持引擎默认 UI | 纳入验收脚本           | 浏览器 E2E          |
| Program 与诊断               | 可编译          | 作为完整工程示范       | `adv check`/Studio  |
| Runtime Inspector 与 trace   | 开发模式可见    | 文档与问题报告示范     | 组件/集成测试       |
| 普通 build / single-file     | 均通过          | 均通过或明确记录限制   | 构建烟测            |

“展示”必须同时满足剧本中真实使用、文档能找到、测试可验证三项；仅在配置中出现不算完成。

## 8. 插件活动 UI

### 8.1 当前问题

`@advjs/client` 的 `AdvActivity.vue` 直接判断 `star-map/compare` 与 `civilization/initialize`。这使 Core Client 每新增一个插件就要修改，和插件注册表的边界冲突。

### 8.2 设计

客户端增加轻量 `activity renderer registry`：

- Runtime 插件仍只负责确定性的 node/action/activity 状态变化；
- 客户端插件可以额外声明按完整 activity type 命名的异步 Vue renderer；
- renderer 接收只读 `pendingActivity`，通过 `complete(result)` 提交纯 JSON；
- renderer loader 和 Vue 组件只存在于浏览器模块，不进入 Program、Snapshot 或 Node CLI；
- 重名 renderer 在初始化时产生明确错误；
- 未注册 renderer 时，开发环境显示通用 JSON 调试表单，生产环境显示可理解的“不支持此互动”错误和回退入口。

`star-map` 和 `civilization` 的专用表单迁入 `@advjs/plugin-interactions`，`AdvActivity.vue` 只负责遮罩、加载、错误边界与动态 renderer 容器。

组件边界：

- `AdvActivity.vue`：读取 pending activity、解析 renderer、管理加载与错误；
- `StarMapActivity.vue`：只负责星图比对输入，emit JSON 结果；
- `CivilizationActivity.vue`：只负责文明初始化表单，emit JSON 结果；
- `GenericActivityDebug.vue`：仅开发环境的 JSON fallback。

## 9. Studio 编辑与运行调试

### 9.1 编辑时诊断

Studio 为 `.adv.md` 编辑提供同一编译链路的三种视图：

1. **内容预览**：保留现有对话、旁白、场景和选择预览；
2. **RuntimeProgram**：只读显示当前项目编译出的规范节点、地址与条件树；
3. **诊断**：显示 severity、稳定错误码、消息、文件、行和列。

诊断条目可定位到当前 Monaco 文件的行列。编译采用 300–500ms debounce，并使用递增请求版本丢弃迟到结果。编辑中的语法错误只更新诊断，不破坏上一次可玩的 Program。

项目级链接和插件诊断必须使用项目配置与所有章节；单文件 AST 预览不能伪装成完整项目校验。无法加载项目上下文时，UI 明确标注“仅语法预览”。

### 9.2 试玩 Inspector

Studio 试玩和浏览器开发模式使用相同数据模型，替换原始 JSON `<pre>`。Inspector 分为：

- **概览**：地址、状态、当前节点、Program id/hash、checkpoint 数；
- **变量**：树状展示变量，并突出最近一步发生变化的路径；
- **舞台**：背景、BGM、立绘状态；
- **分支/活动**：可见选择、已选择记录、pending activity 与输入；
- **轨迹**：最近 200 条命令、地址、状态、Effects 与变量差异。

第一版 Inspector 只读。调试动作复用正式 Runtime API：下一步、回退、跳到显式节点、重启、复制快照、复制问题报告。不会通过 Vue DevTools 或对象引用直接改写 RuntimeState。

### 9.3 共享 trace 数据

CLI 现有 `RuntimeCliTrace` 提升为宿主无关的纯数据 trace contract，至少包含递增 sequence、command、from/to address、status、effects 和变量差异。CLI JSON Lines、Studio Inspector 与浏览器 DevTools 复用该结构；各宿主可以添加展示元数据，但不得改变命令含义。首版不记录墙钟时间，以便相同命令序列产生可比较的确定性轨迹。

trace 使用固定上限的内存环形列表，不写入 `RuntimeSnapshot`。问题报告导出时包含 Program id/hash、当前 Snapshot、最近 trace 和编译诊断，并排除素材文件与故事源码。Snapshot 与变量差异可能包含作者写入变量的业务数据，因此复制或下载前必须明确提示用户检查报告内容，不宣称能够自动识别所有隐私字段。

### 9.4 Vue 组件边界

- `RuntimeInspectorPanel.vue`：组合各 Inspector section，不持有 Runtime；
- `RuntimeOverview.vue`、`RuntimeVariables.vue`、`RuntimeTrace.vue`：纯 props 展示；
- `useRuntimeInspector()`：从 Snapshot/Program/current node 投影只读模型；
- `useRuntimeTrace()`：记录有上限的 trace 并生成变量 diff；
- `RuntimeDiagnosticsPanel.vue`：展示诊断并 emit `select-location`；
- route/page 组件只负责布局、Runtime 连接和事件转发。

## 10. 错误处理

- 编译失败：保留稳定错误码和源码位置；不启动无 Program 的新会话。
- 插件缺失或版本不匹配：在启动前失败，并在 Studio 显示所需与已安装版本。
- activity renderer 缺失：Runtime 保持 `waiting-activity`，生产 UI 提供回退，不伪造完成结果。
- activity renderer 抛错或返回非 JSON：显示错误，允许重试或回退；Runtime 状态不被部分提交。
- 快照 hash 不匹配：拒绝恢复并解释原因，不静默清空当前状态。
- 诊断异步竞态：只接受最后一次请求结果。
- 媒体加载失败：剧情仍可推进，舞台显示可识别占位，控制台/Inspector 记录 presentation warning。

## 11. 文档

文档同时服务“复制 starter”“研究 hamster”“调试自己的项目”三种路径：

- 更新 `demo/README.md`，解释入门、旗舰和专项 Demo；
- 为两个 Demo 分别编写 README、运行命令和目录导览；
- hamster README 提供能力索引、四章结构、Studio 打开方式、CLI 检查/trace 命令和内容许可入口；
- 新增或更新创作调试指南，覆盖 Program、诊断、Inspector、trace、问题报告和 activity renderer；
- 更新 AdvScript 选择/动作旧示例，移除仍推荐 `$adv.$nav` 与可执行 TS 代码块的过期内容；
- 文档站导航加入 Runtime/调试相关入口，并从功能页链接到仓鼠 Demo。

文档代码必须由测试夹具或实际 Demo 截取，避免再次与实现分叉。

## 12. 测试策略

### 12.1 内容与运行时

- 编译 starter 与 hamster 全部章节，要求无 error diagnostics；
- 对稳定锚点、跨章链接、条件和所有结局路径做表驱动测试；
- 验证每个章节入口与三个结局均可达，禁止意外死路；
- 同一命令序列在 Runtime、CLI host 和 Client host 得到一致 Snapshot。

### 12.2 插件 UI

- renderer 注册、命名空间、冲突和 fallback 单元测试；
- 两个 activity 组件验证输入、JSON 输出、错误与重试；
- Core plugin 测试继续只验证纯数据状态变化，不依赖 Vue。

### 12.3 Studio 与 DevTools

- Inspector 投影、变量 diff、trace 上限和问题报告序列化测试；
- 诊断定位和迟到请求丢弃测试；
- Vue 组件测试覆盖空状态、错误、waiting activity 和 trace 展示。

### 12.4 E2E 与构建

- starter：启动、推进、选择、结束；
- hamster：星图活动、跨章、文明初始化、至少两条路线、存档/恢复、回退；
- Studio：打开 hamster、看到诊断、试玩、Inspector 跟随状态更新；
- 构建 starter 与 hamster；对 single-file 不支持的资源或插件若存在限制，必须由测试和文档明确。

## 13. 实施顺序

1. 先以测试驱动补齐插件 activity renderer registry、Studio 经典目录发现与可信插件加载，解除旗舰 Demo 的运行阻塞。
2. 建立目录和测试身份：复制现有仓鼠内容到 `demo/hamster`，恢复最小 starter，修正脚本与文档入口。
3. 扩展四章剧情、状态模型、素材和结局路径，并同步增加运行时路径测试。
4. 建立共享 trace contract、Inspector 数据投影和可复用 Vue 面板。
5. 把诊断、Program 与 Inspector 接入 Studio 编辑/试玩和浏览器 DevTools。
6. 清理过期文档、补齐 Demo 指南、许可与素材清单。
7. 运行 focused tests、unit、typecheck、build、E2E，并用 `adv check` 与 CLI trace 做最终跨宿主验收。

每一步保持 starter 和已有专项 Demo 可运行；不在剧情写完后才补工具与测试。

## 14. 完成标准

- `pnpm demo` 启动中性的最小 starter，`pnpm demo:hamster` 启动完整仓鼠作品。
- starter 不依赖 `@advjs/plugin-interactions`，也不包含仓鼠专有素材与许可。
- hamster 至少四章、三个可达结局、两个插件活动，游玩时间约 15–20 分钟。
- Core Client 不再包含 `star-map/compare` 或 `civilization/initialize` 的专用 UI 分支。
- Studio 编辑器能显示项目级 RuntimeProgram 与带位置诊断。
- Studio 试玩和浏览器开发模式具备结构化 Inspector 与最近执行轨迹。
- CLI、Studio 与浏览器 trace 使用同一数据结构；Runtime/Snapshot 仍为纯 JSON。
- 仓鼠全部目标、条件、动作和插件依赖通过 `adv check`。
- starter/hamster 的单元、组件、构建和关键 E2E 测试通过。
- README、创作语法、插件活动、运行时调试和许可证文档与实际实现一致。

## 15. 风险与控制

- **范围膨胀**：只实现仓鼠垂直切片实际需要的通用能力；战斗、物品和大型可视化编辑器另立规格。
- **剧情掩盖技术问题**：能力矩阵要求每项能力同时有剧本使用、文档和测试。
- **插件与 Client 循环依赖**：renderer contract 放在 Client 的公开类型层，插件仅单向依赖该 contract；动态 renderer 不进入 Core。
- **调试器改变游戏状态**：第一版只读，所有导航动作调用正式 Runtime API。
- **内容许可混淆**：代码和非软件内容分开许可，每个资源逐项记录来源与状态。
- **E2E 体量过大**：单元测试穷举路径，E2E 只覆盖关键代表路线与宿主集成。
