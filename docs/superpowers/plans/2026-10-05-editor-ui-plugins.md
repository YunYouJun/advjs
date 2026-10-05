# 编辑器 UI 插件机制实施计划

日期：2026-10-05

状态：首版已实施；使用方式见 [UI 插件文档](../../guide/editor/ui-plugins.md)。

## 2026-10-05 实施记录

已落地 SDK、可释放注册表、四区域视图宿主、共享命令状态、插件管理、创作上下文迁移和独立诊断包。顶部“管理插件”与底部“插件”标签可打开管理面板；右侧“创作上下文”和底部“诊断”是实际插件视图。

实施后的范围调整：

- 诊断插件已作为可停用的默认内置包，便于直接使用和验证，无需切换测试 catalog。
- 首版布局只保存每个区域的选中视图；显示/隐藏由插件启停控制。手动排列、单个视图隐藏和额外的打开视图菜单留待真实使用需求，现有标签栏可横向滚动。
- 顶层贡献统一放入“扩展操作”菜单，避免插件按钮不断挤占顶栏。
- SDK 的项目快照为只读 Ref：使用 `ctx.project.current.value`。
- AI 工作台与创作上下文都通过 SDK 读取项目；旧 `useProjectContextStore` 暂保留兼容，本轮不再有生产视图依赖它。
- 属性面板不再隐式渲染创作上下文，保证停用插件后不会在另一个入口继续显示。

提交前完善：管理面板支持取消仍在进行的插件激活，无视图插件不显示无效的“打开面板”操作；切换项目立即释放旧命令状态，旧任务的完成不会覆盖新命令。内置扩展与随附插件分别显示来源。

验证记录：SDK 和编辑器生产构建通过；28 项相关单测覆盖注册、回滚、迟到激活、命令去重、跨项目命令状态、取消激活、偏好恢复、剪贴板失败、渲染错误、缓存卸载、语言切换、项目快照及两种 workspace。真实 Chromium 页面检查了插件列表、诊断结果、停用回退、刷新后的偏好恢复、无项目空态、中文/英文、键盘菜单与窄面板。

提交快照另行导出到干净目录，使用冻结锁文件离线安装，通过依赖构建、SDK 构建、编辑器生产构建和同一组 28 项回归测试，确认不依赖工作区其他未提交改动。新检出仓库的依赖准备及 Nuxt 配置生成步骤已加入使用文档。

首版遗留问题已在下面的同日修复中跟进。未新增专门的 Playwright E2E suite；浏览器验收使用真实 Chromium 页面。未完成整个游戏播放流程或所有历史组件的回归测试。

### 同日跟进：PixiJS 与 UI 风格

- 编辑器地图代码使用 PixiJS v8，但包未声明直接依赖，实际解析到 `pixi-painter` 带来的 v7.3.3。给 `editor/core` 添加 `pixi.js: catalog:frontend`，明确解析 v8.19.0；保留 v8 API，10 个类型错误消除。
- 欢迎页、AI 工作台、预览操作与流程图工具栏采用共享控件、紧凑行和语义颜色。工作台改读 SDK 快照，修复空内容和跨项目残留风险；流程图布局操作改用已存在的 store 方法。
- 输入框、文本框、开关、下拉框、菜单与弹窗统一到共享 token。移除菜单对全局按钮的 reset，修复输入属性透传、开关标签关联与弹窗说明关联；菜单操作使用 Reka 的 select 事件以支持键盘。
- 新增界面主题偏好，主题作用于页面根部，确保 Portal 外观一致；保留暗色默认值。预览文件检查在隐藏标签时暂停。
- 验证：34 项相关单测、编辑器 typecheck、生产构建和改动文件 ESLint。真实 Chromium 检查了欢迎页、工作台、上下文、插件管理的亮暗色，主题下拉框键盘操作、弹窗焦点返回、刷新、流程图布局，以及约 320px 面板和浏览器 200% 缩放。测试使用临时项目，未修改用户创作文件。最终提交快照另行导出，以冻结锁文件离线安装并构建依赖（包括 COS 插件类型产物），再次通过相同的 34 项单测、typecheck 和生产构建，确认不依赖其他未提交改动。
- 限制：截图覆盖本轮迁移面板，其他历史属性/人物/音频组件尚需逐步迁移。PixiJS 地图原型的运行验收见下。

### 同日跟进：六边形地图运行验收

`app/utils/map/hexagonal/` 是未接入编辑器路由或插件 catalog 的实验原型，不能把它视为已发布的地图编辑面板。此次用仓库的四种地块素材和真实模块，在仓库外临时页面中执行浏览器验收，没有新增产品入口。

修复滚轮缩放变成负数、缩放后命中坐标偏移、越界拖放异常、重复拖放留下失效地块、重绘叠加旧 Sprite、容器改变时画布变形，以及反复初始化覆盖素材别名的问题。每次初始化持有独立的地块状态，返回 `{ app, tilesMap, destroy }`；调用方在卸载时执行 `destroy()`，它会断开 ResizeObserver、解除缩放监听并释放渲染器，保留共享纹理缓存。异步初始化期间卸载的调用方，需在初始化完成后立即销毁结果。

Chrome / PixiJS 8.19.0 / WebGL 验证了：800×500 和 320×500 容器、2 倍像素密度、四种素材加载、点击放置与替换、双地块重复拖动与越界回退、0.25–4 倍缩放及缩放后的落点、销毁与重新挂载。最终生产构建页面无相关运行错误或警告。回归测试位于 `editor/core/tests/hex-map.test.ts`，覆盖缩放边界与锚点、放置替换、拖放状态、实例隔离和资源清理；单测不代替 GPU 浏览器验收。

```bash
pnpm exec vitest run editor/core/tests/hex-map.test.ts
pnpm --filter @advjs/editor typecheck
```

此结论只覆盖原型已有能力；没有地图保存/加载、撤销、寻路、正式面板集成或移动触控的验收结论。其事件处理参照 [PixiJS v8 Events](https://pixijs.com/8.x/guides/components/events)。

## 目标与首版范围

让 ADV.JS 桌面编辑器通过注册插件增加面板、命令和工具栏操作，新增功能无需修改主页面里的条件分支。编辑器统一提供面板外壳、交互状态和 AGUI 视觉规范，插件负责业务内容。

首版面向随编辑器构建的受信任插件，支持启用、禁用、故障恢复与开发时重新加载。首先迁移“创作上下文”，再用独立的诊断示例验证接口。保持现有游戏预览、文件编辑、人物、音频和流程图功能可用。

本计划针对 `editor/core`；移动端 `apps/studio` 和 VRM 编辑器后续按需要接入。游戏运行时活动插件继续使用现有协议。

| 首版支持                             | 后续有具体需求时增加                     |
| ------------------------------------ | ---------------------------------------- |
| 四个既有区域内注册标签视图           | 任意拖放、浮动窗口、跨窗口布局           |
| 命令、顶层工具栏操作、视图标题操作   | 自定义菜单位置、快捷键、上下文菜单       |
| 插件列表、启停、错误状态与重试       | 插件市场、下载更新、远程动态安装         |
| 项目只读快照、刷新、剪贴板和宿主提示 | 项目写入、选区属性扩展、AI proposal 接入 |
| AGUI 控件、语义 token、中英文本地化  | 可安装的主题包及受限 token 覆盖          |

“支持主题”不等于允许每个插件重写全局 CSS。首版插件继承 [AGUI 设计规范](../../agui/design.md)，未来主题能力也由宿主统一应用。

## 现状与实现落点

| 当前代码                                                                                 | 现状与计划                                                                       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `editor/core/app/pages/index.vue`                                                        | 通过 `hierarchy`、`scene`、`project`、`right` 四个槽固定装配面板；改为区域宿主。 |
| `editor/core/app/components/panel/Panel*.vue`                                            | 标签和组件在模板中固定定义；逐步改为注册信息驱动。                               |
| `editor/core/app/stores/useAppStore.ts`                                                  | `agui:layout` 保存分割树；保留几何布局，另存视图状态。                           |
| `editor/core/app/components/layout/EditorToolbar.vue`                                    | “Manage Plugins” 为 WIP 弹窗；接入插件管理界面和命令分发。                       |
| `packages/gui/client/components/layout/AGUILayout.vue`                                   | 已提供递归分割布局；保持为通用组件，不加入插件或项目逻辑。                       |
| `editor/core/app/workspaces/project.ts`                                                  | 已有 browser/local 两种项目实现；通过宿主 Adapter 为插件提供只读接口。           |
| `editor/core/app/composables/useProjectContextPanel.ts`                                  | 直接依赖内部 store；迁移时改为使用插件上下文。                                   |
| `packages/core/src/runtime/registry.ts`、`packages/client/runtime/activity-renderers.ts` | 负责游戏运行时和活动 UI，不承载编辑器扩展。                                      |

已有 [Activity Renderers and Studio Plugin Foundation](2026-07-17-activity-renderers-and-studio-plugins.md) 处理的是游戏活动渲染，本计划增加独立的编辑器扩展层。

## 架构决策

```text
内置扩展 / 显式引入的包插件
             ↓
@advjs/editor-sdk：插件声明、视图与命令类型、上下文注入
             ↓
Editor 扩展宿主：注册表、生命周期、命令分发、布局恢复
       ↙                          ↘
项目 / 剪贴板 / 提示 Adapter        区域宿主 + AGUI 外壳
       ↓                          ↓
已有 workspace / store             插件 Vue 内容组件
```

1. 新增小型 `packages/editor-sdk` Module，包名 `@advjs/editor-sdk`。提供插件作者使用的 Interface；不依赖 Nuxt、Pinia 或编辑器内部路径。现有 `@advjs/editor` 以应用和 CLI 产物发布，不将整套应用变成 SDK。
2. 注册表与调度实现放在 `editor/core/app/extensions/`。避免与 Nuxt 自动扫描的 `app/plugins/` 混用，也不将编辑器业务放入 `@advjs/gui`。
3. 宿主服务作为 Seam，用 Adapter 连接现有项目 workspace、store 和浏览器 API。插件不接收目录句柄、桥接 session token 或可变 store。
4. SDK 不复制运行时插件、活动 renderer 和 Agent capability 注册表。同一个插件包以后可以分别导出 `/runtime`、`/editor` 入口，但两种入口独立装配。
5. 首版使用显式静态 catalog，由 Vite 编译插件及其 SFC。项目中的 JSON、`adv.config.ts` 或 Markdown 不决定编辑器执行哪些 UI 模块。
6. 首版插件与宿主处于同一 JavaScript 环境。服务声明用于兼容检查和约束 API，不构成恶意代码沙箱；不承诺同源 Vue 插件之间的安全隔离。

## 插件 Interface 草案

以下为实施时的接口示意；以 `packages/editor-sdk/src/index.ts` 和使用文档中的实际类型为准。

```ts
import { defineEditorPlugin } from '@advjs/editor-sdk'

export default defineEditorPlugin({
  id: 'advjs.context',
  version: '0.1.0',
  apiVersion: 1,
  title: { 'zh-CN': '创作上下文', 'en': 'Writing context' },
  requires: ['project.read', 'project.refresh', 'clipboard.write'],
  views: [{
    id: 'context',
    region: 'inspector',
    title: { 'zh-CN': '创作上下文', 'en': 'Writing context' },
    icon: 'ri:earth-line',
    order: 20,
    retention: 'unmount',
    load: () => import('./ProjectContextView.vue'),
  }],
  commands: [{
    id: 'refresh',
    title: { 'zh-CN': '刷新', 'en': 'Refresh' },
    enabled: ctx => ctx.project.current.value !== null,
    run: ctx => ctx.project.refresh(),
  }],
  actions: [{
    location: { view: 'context', area: 'title' },
    command: 'refresh',
    icon: 'ri:refresh-line',
  }],
})
```

- `defineEditorPlugin()` 提供类型推导和普通对象声明；宿主仍需在注册时校验元数据。
- `id` 全局唯一，插件内视图和命令使用短 ID；宿主生成 `advjs.context/context`、`advjs.context/refresh` 等完整 ID。重复 ID 拒绝注册，不允许覆盖已存在的扩展。
- `region` 为 `navigation | main | bottom | inspector`，分别映射当前 `hierarchy | scene | project | right`。分割树节点名属于宿主，不进入插件 API。
- `order` 仅控制所属区域的默认顺序；相同顺序按完整 ID 稳定排序，不能依赖异步加载完成顺序。
- 首版 `apiVersion` 只接受 `1`，不兼容插件显示原因且不激活。插件自身版本与接口版本分开记录。
- 插件组件通过 `useEditorPluginContext()` 获得按插件作用域注入的服务；不得导入 `~/stores`、宿主文件或依赖 Nuxt 自动导入。通过包入口显式导入 Vue 和 AGUI。
- 标题使用宿主支持的 locale 字典：当前语言 → 英文 → 插件 ID；切换语言时更新标签，不依赖标题作为 Vue key。复杂内容使用插件自己的消息字典与宿主 locale。
- 图标使用宿主已打包图标集合中的标识，由统一图标组件解析；不能假定包内动态 `i-*` 字符串一定会被 UnoCSS 扫描到。未知图标有占位回退。
- 可选 `activate(ctx)` 用于订阅等资源初始化，返回清理函数；纯视图插件不必实现。此方法之外不允许模块导入阶段启动监听或定时器。

### 宿主服务

只加入样例实际使用的服务，避免预先构建通用事件总线或任意命令 RPC。

| 服务                          | 首版约定                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `project.current`             | 只读视图：项目会话 ID、revision、名称、文本文件、诊断与章节/人物/场景摘要。无项目时为 `null`。不暴露 `previewConfig`、文件句柄和凭据。 |
| `project.subscribe(listener)` | 成功切换、刷新、提交以及关闭项目时通知；返回清理函数，并归属当前插件生命周期。                                                         |
| `project.refresh()`           | 调用既有项目刷新流程，失败返回结构化错误；workspace 变更后丢弃旧会话结果。                                                             |
| `clipboard.writeText(text)`   | 在用户触发的命令内调用，保留拒绝访问时的明确反馈；不申请后台读取能力。                                                                 |
| `notifications`               | 使用宿主已有提示组件展示成功和失败；避免插件自己绘制另一套反馈。                                                                       |
| `locale`                      | 宿主当前语言的只读响应式值。                                                                                                           |

将 `EditorProjectModel` 投影为 SDK DTO，运行时禁止插件改写共享对象；不能只依赖 TypeScript `readonly`。`requires` 中声明但宿主不可用的必要服务会阻止激活，并在管理界面展示原因。平台拒绝一次剪贴板请求属于操作失败，不代表整个插件不兼容。

项目写入留到有真实编辑插件时增加：接入已有 `commitProject` / `ProjectSourcePatch` 校验与冲突语义，不另建直接写文件通道。Agent 插件沿用现有 proposal 审阅机制。

### 生命周期、错误与状态

- 激活流程为“校验 → 暂存注册信息 → 执行 activate → 发布贡献”。失败时释放暂存资源，不能留下半个插件。异步激活具有代次标记；禁用后返回的旧结果不能重新注册。
- 每个插件的启动失败独立记录，其他插件继续加载。插件管理入口属于宿主，不能因可选插件故障消失。
- 视图 loader 失败和 Vue 渲染错误由各自边界转成紧凑的错误视图，提供重试、禁用入口。异步命令由宿主捕获错误、维护 loading/disabled；同一命令执行期间禁止重复提交。
- 这只覆盖合作式插件的生命周期和错误处理；死循环或任意全局 CSS 副作用无法靠 Vue 错误边界隔离。
- 默认切换标签卸载内容；重资源视图可声明 `retention: 'keep-alive'`，首次打开才加载，隐藏时向视图提供 `visible` 状态以暂停渲染。禁用插件时必须卸载缓存并释放订阅。
- 禁用顺序：使命令失效并取消宿主支持的待处理任务 → 卸载视图 → 清理资源 → 移除贡献 → 修复当前标签和焦点。迟到结果不能覆盖当前 UI；失败清理不阻止其他资源释放。
- HMR、应用卸载重复调用同一销毁流程；资源释放幂等。插件重新启用不会重复注册监听。

### 布局与视觉约束

- `AGUILayout` 继续管理分割尺寸；新增 `EditorRegionHost` 根据注册表渲染标签，`EditorViewHost` 管理加载、错误、标题操作与内容边界。
- `agui:layout` 保留原格式。新增带 schema version 的 `advjs:editor:ui:v1` 保存各区域 active view、顺序和显示状态，值均为 JSON ID，禁止存入 Vue 组件或函数。
- 启用状态使用独立的 `advjs:editor:plugins:v1`。重置布局恢复尺寸和可用视图的默认排列，不重置插件启停偏好。
- 首次迁移将 `cur-scene-tab` 映射为内置视图完整 ID；非法值回退到游戏预览。旧 `PanelHierarchy` 的标签 key 与内容 value 不一致，也在迁移时统一为同一 ID。
- 恢复状态时，缺失或已禁用视图不渲染活动标签，但保留其排列记录，便于重新启用；当前活动视图失效则选择区域内首个可用视图。空区域显示宿主空态及恢复入口。
- 面板标题、标签、按钮尺寸和操作反馈由宿主提供，业务内容使用 AGUI 与 `--agui-*` token。插件 scoped CSS 只排版自身内容，不重置 `button`、`body` 或宿主选择器。
- 工具栏操作引用命令 ID，启用状态与执行反馈只有一个来源；区域“打开视图”菜单由宿主自动生成，首版不提供任意 DOM 注入。

## 分阶段实施

### M1：SDK 与可测试的注册表

**新增：** `packages/editor-sdk/{package.json,build.config.ts,src/}`、`editor/core/app/extensions/{registry,types}.ts`、`tests/unit/editor-ui-registry.test.ts`。

- [x] 定义插件、视图、命令、服务 DTO 与生命周期类型；SDK 用 unbuild 构建，Vue 使用 peer dependency，按仓库 catalog 规范配置依赖。
- [x] 实现身份与引用校验、稳定排序、服务兼容检查、激活回滚及可释放的注册表。
- [x] 将包接入 workspace、根 TypeScript / Vite 实际使用的别名和编辑器依赖；确认 SDK 不引入 Nuxt 或 Node 模块。
- [x] 验收：重复 ID、缺失命令引用、版本不兼容、激活失败、迟到激活结果、重复销毁都具有确定行为；一个插件失败不影响另一插件。

### M2：宿主服务与应用启动

**新增：** `editor/core/app/extensions/{host,services,catalog}.ts`、`tests/unit/editor-ui-host.test.ts`。

**修改：** `editor/core/app/app.vue`、项目状态通知所需的 `useProjectStore.ts` 接口。

- [x] 用现有 browser/local workspace 实现项目服务，统一项目会话与 revision；成功更新后发布新的只读快照。
- [x] 封装剪贴板、提示和 locale；为每个插件建立资源作用域及上下文注入。
- [x] 明确创建顺序：Pinia 与宿主服务就绪 → 创建扩展宿主 → 激活 catalog → 渲染区域；应用卸载与 HMR 销毁宿主。
- [x] 验收：两种 workspace 使用同一套 Interface 契约测试；切换项目后旧任务不更新新项目，禁用后订阅归零，快照不存在凭据和句柄。

### M3：区域宿主与内置视图适配

**新增：** `EditorRegionHost.vue`、`EditorViewHost.vue`、`extensions/layout-state.ts`、`extensions/builtin/`。

**修改：** `pages/index.vue`、`Panel*.vue`、`useAppStore.ts`，必要时完善 AGUI Tabs / Toolbar 的受控值、禁用及 busy API。

- [x] 将现有内容组件注册为内置视图，保持四个区域和初始布局。过渡期内部适配器可调用旧 store，公共插件 API 不暴露这些 store。
- [ ] 游戏预览和流程图显式配置保留实例策略，人物等原有按需视图维持卸载行为；验证隐藏/恢复后画布尺寸和资源释放。
- [x] 实现首版选中视图的版本化状态恢复、旧值迁移、禁用回退、重置布局和稳定焦点管理；手动排列与单视图隐藏按页首记录延期。
- [x] 验收：新增测试视图只修改 catalog；主页面与区域组件不增加插件特例。原有各视图仍可切换，刷新后恢复选中项，缺失插件不出现白屏。

### M4：迁移创作上下文并验证独立插件

**修改：** `ProjectContextView.vue`、`useProjectContextPanel.ts`；按迁移结果清理无调用的上下文 store 代码。

**新增：** 内置 `advjs.context` 声明、`examples/editor-plugin-diagnostics/` 及专用开发/测试 catalog。

- [x] 将读取世界观、大纲、章节、人物、场景和术语表的逻辑改为读取服务快照中的文本；保留原目录兼容规则、计数定义、Markdown 安全渲染及空/错误态。
- [x] 将刷新与复制接入命令和宿主标题操作；面板内复用状态，避免同一动作有两套 loading 和错误处理。
- [x] 独立诊断插件只依赖 SDK、Vue 和 AGUI，通过项目快照显示诊断并注册刷新命令；示例显式导入控件及样式，不借用 Nuxt 自动导入。
- [x] 独立诊断示例通过 workspace 构建依赖加入显式 catalog 并完成生产构建；按页首范围调整，默认启用且可停用。
- [x] 验收：插件包不导入 `editor/core` 私有模块；接入仅需依赖和 catalog 声明，新增插件视图无需修改编辑器模板。迁移前后的上下文行为测试均通过。

### M5：插件管理与交付文档

**新增：** 紧凑的插件管理界面、`docs/guide/editor/ui-plugins.md`。

**修改：** `EditorToolbar.vue`、编辑器语言文件、文档导航及 `editor/AGENTS.md`。

- [x] 替换 WIP 按钮，展示名称、版本、启用状态、来源和错误；支持禁用、重新启用和重试。宿主核心功能标记为必需，不能被停用。
- [x] 顶层插件操作由同一命令分发器渲染，并遵循宿主宽度限制和溢出菜单策略。
- [x] 写清显式构建安装方式：添加包依赖 → catalog 导入 → 重新构建编辑器。预编译 `adv-editor` 不会因游戏项目安装了 npm 包就自动加载 UI 插件。
- [x] 记录 SDK 示例、兼容规则、资源清理、目录边界、图标/样式打包、视觉验收要求。更新 AGENTS：新增可扩展功能优先贡献视图/命令，公共插件不得绕过 SDK 引用内部 store。
- [x] 验收：用户能找到插件并完成启停；停用正在显示的插件后焦点和布局可用，再启用恢复视图，无重复命令或订阅。

M1 → M2 → M3 → M4 → M5 顺序落地；每步保持编辑器可用。不要先批量搬动现有组件再补契约。M4 是首版架构是否成立的关键验收，不能仅通过给旧面板套一层注册对象完成。

## 验证与完成条件

以下为原计划的完整验收范围；本轮实际完成项目与仍未执行项目以页首实施记录为准。

- 注册表与宿主单测覆盖生命周期、错误回滚、项目切换、命令去重和快照只读性。
- Vue 组件测试覆盖异步加载、渲染失败、活动标签回退、locale 切换、保留视图最终卸载。
- `tests/e2e/editor-ui-plugins.spec.ts` 复用本地桥接测试搭建方式；验证真实构建中的独立插件加载、插件启停、刷新恢复和重置布局。配套 browser workspace 契约测试保证两种来源行为一致。
- 在正常桌面与约 320px 窄面板检查中文/英文、暗色/亮色、键盘导航和错误状态；保存截图，检查隐藏画布恢复和工具栏溢出。
- 运行新增 Vitest 测试、已有 `tests/unit/editor-context.test.ts`、SDK 构建、编辑器构建、针对改动文件的 ESLint、编辑器 typecheck 和对应 Playwright 测试。Node 使用仓库要求的 `>=24.15.0`，包管理使用 pnpm。
- 上一轮验证曾遇到 `eventemitter3` 开发入口问题和 PixiJS 地图工具类型错误；实施开始先复查现状，区分既有问题与新回归。完整编辑器浏览器验收未完成时，不把孤立组件截图当作整体验收通过。

完成后，应能通过一个独立插件包增加诊断面板与刷新动作，启停和布局恢复均可靠；“创作上下文”使用同一套公开 Interface，界面与相邻 AGUI 面板保持一致。
