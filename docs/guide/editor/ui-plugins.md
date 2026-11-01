# 编辑器 UI 插件

UI 插件用于给桌面编辑器增加面板和操作。适合项目诊断、创作资料、资源工具等可以独立启停的功能：插件提供内容，编辑器统一提供标签、工具栏、布局恢复和 AGUI 外观。

这与游戏运行时的[插件与活动](../runtime/plugins-and-activities)是两个入口。游戏交互仍使用 `defineAdvPlugin()`；编辑器扩展使用 `defineEditorPlugin()`。当前实现面向 `editor/core`，不自动影响移动端 Studio 或游戏主题。

## 查看面板

1. 启动桌面编辑器，点击顶部拼图图标 **管理插件**，或底部 **插件** 标签。
2. **创作上下文** 位于右侧，提供创作资料阅读、刷新和复制给 AI。
3. **诊断** 位于底部，展示当前项目的编译错误、警告和源文件位置；点击 **重新检查** 刷新项目。
4. 在插件列表中停用可选插件，对应标签和命令会移除；重新启用后可点击 **打开面板**。

核心编辑器为必需项，不能停用。可选插件的启动或视图加载失败不会阻止其他插件；失败面板可以重试。启动耗时过长时可点击 **取消启用**，迟到的启动结果不会重新注册面板。只有命令而没有视图的插件不显示“打开面板”。未打开项目时，项目操作禁用并显示空态。

标签选中状态与插件启停偏好保存在当前浏览器中。重置布局恢复分栏和默认标签，不改变启停偏好。已停用或暂时缺失的活动视图会回退到区域内可用视图，其记录保留到再次启用。

项目快照的 `root` 是编译器解析后的项目相对内容根目录（项目目录本身用空字符串表示），`counts` 来自同一编译结果。上下文面板按该根目录读取六份创作资料文档；「复制给 AI」不会扩展到角色原始文件或自定义私有字段。

## 外观与创作工作台

在 **编辑 → 偏好设置 → 主题 → 主题预设** 中选择跟随系统、亮色或暗色；语言设置位于「界面」。插件继承宿主的 AGUI token；主题同时应用到面板、弹窗和菜单，无需插件单独维护配色。

主区域的 **AI 工作台** 展示当前项目的计数、章节进度和人物摘要，通过 SDK 项目快照读取数据，切换或关闭项目会更新内容。它与右侧创作上下文复用刷新、复制命令的实现。章节进度来自 `adv/chapters/README.md` 的 ✅ / 📝 / ⏳ 标记，人物摘要来自 `adv/characters/README.md` 的人物、文件、身份、简介表格；缺少索引时显示空态，实际文件计数仍显示。

## 新增插件

使用 `@advjs/editor-sdk` 声明插件。首版采用**随编辑器构建的可信包**；不是把任意脚本地址交给浏览器运行。

```ts
import { defineEditorPlugin } from '@advjs/editor-sdk'

export default defineEditorPlugin({
  id: 'my-team.notes',
  version: '0.1.0',
  apiVersion: 1,
  title: { 'zh-CN': '项目笔记', 'en': 'Project notes' },
  requires: ['project.read', 'project.refresh'],
  views: [{
    id: 'notes',
    region: 'inspector',
    title: { 'zh-CN': '笔记', 'en': 'Notes' },
    icon: 'ri:book-open-line',
    order: 30,
    load: () => import('./NotesView.vue'),
  }],
  commands: [{
    id: 'refresh',
    title: { 'zh-CN': '刷新', 'en': 'Refresh' },
    enabled: ctx => ctx.project.current.value !== null,
    run: ctx => ctx.project.refresh(),
  }],
  actions: [{
    location: { view: 'notes', area: 'title' },
    command: 'refresh',
    icon: 'ri:refresh-line',
  }],
})
```

视图使用公开上下文，不导入编辑器内部 store，也不依赖 Nuxt 自动导入：

```vue
<script setup lang="ts">
import { useEditorPluginContext } from '@advjs/editor-sdk'
import { computed } from 'vue'

const ctx = useEditorPluginContext()
const notes = computed(() => ctx.project.current.value?.files['adv/notes.md'] ?? '')
</script>

<template>
  <div class="project-notes">
    {{ notes || '暂无笔记' }}
  </div>
</template>

<style scoped>
.project-notes {
  padding: 8px 12px;
  color: var(--agui-c-text-1);
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
```

仓库中的完整示例是 `examples/editor-plugin-diagnostics/`。它作为独立 workspace 包加入默认 catalog，只通过 SDK 读取项目诊断，编辑器模板没有诊断插件专用分支。

### 构建与安装

1. 插件包导出入口，依赖 `@advjs/editor-sdk` 和 Vue；使用控件时通过 `@advjs/gui/components/...` 显式导入。
2. 将插件包加入 `editor/core/package.json` 的构建依赖。
3. 在 `editor/core/app/extensions/catalog.ts` 显式导入并增加 `{ plugin, source: 'bundled' }`。
4. 使用 pnpm 安装依赖并重新构建编辑器。

```bash
pnpm install
# 新检出的仓库先准备编辑器依赖的包产物
pnpm build:advjs
pnpm --filter @advjs/gui build:node
pnpm --filter @advjs/editor-sdk build
pnpm --filter @advjs/plugin-cos build
pnpm --filter @advjs/editor build
pnpm --filter @advjs/editor typecheck
```

开发插件可以把 `.ts` / `.vue` 源码作为包导出，由编辑器 Vite 构建处理；Vue 应由宿主提供，避免插件私自打包第二份运行时。AGUI 主题样式由宿主加载，插件只引入自己的 scoped 样式。动态拼接的 UnoCSS 类名不能保证进入构建，公共插件优先使用 scoped CSS 与语义 token。

#### 外部可信插件的构建入口

维护者也可以在构建时设置 `ADVJS_EDITOR_PLUGIN_ENTRIES`，其值为现有本地模块**绝对路径的 JSON 数组**。每个模块默认导出 `defineEditorPlugin()` 声明；构建插件将它们加入同一 catalog，因此面板、启停、延迟加载、错误处理与标签保留使用原 SDK。输入必须来自可信的本机构建配置，不能从项目 JSON、查询参数或远程 URL 接收。默认不设置时 catalog 保持原样，也不加载任何游戏业务代码。

外部源码预编译后须把 Vue、`@advjs/editor-sdk` 和宿主 GUI 控件保留为 external，确保共享同一 Vue 及 SDK 注入身份；插件自身运行时与业务格式可以独立固定。插件代码与 scoped CSS 可导出为本地入口，所有执行代码在 Editor 构建期间打包。`ADVJS_EDITOR_BUILD_DIR` 与 `ADVJS_EDITOR_OUTPUT_DIR` 可将中间文件和产物放到集成方的忽略缓存，不覆盖默认 `.nuxt` / `.output` / 发布包。预编译 Editor 不会在启动后根据这些路径安装插件。

游戏自有格式可通过插件注入受控文档端口，例如 `read(signal)`、`validate(document, signal)`、`save(document, expectedRevision, signal)`。该端口属于游戏宿主，不扩展 `ctx.project` 为任意文件写入，不把磁盘句柄或 bridge 凭据传给视图。保存须由游戏原有校验、版本冲突与备份流程处理；取消客户端请求不代表服务端已经提交的写入可以撤销。

外部工作台绑定的文件与 Editor 标准 ADV 项目可能不同，应在面板明确显示绑定范围；切换标准项目不能静默切换业务写入目标。隐藏的保留面板必须停止自身全局快捷键，卸载时移除监听、取消请求并处理未保存草稿。内存草稿恢复与玩家存档分别管理，插件停用后的会话草稿保留策略须由插件说明。

预编译的 `adv-editor` 不会因为游戏项目安装了 npm 包而自动加载 UI 插件。当前没有远程安装、更新市场、任意 DOM 注入或不可信代码沙箱。

底部「插件」面板同时提供[官方供应商目录](./plugins)，首批展示 Breeze、Qwen MLX 和 OpenAI TTS 的源码接入、平台要求与显式状态检测。它们是 Node 作者侧供应商，复用通用音频界面，不作为 UI 插件动态注入；目录不下载或执行远程代码，也不代表 npm 已发布。

## 接口约定

| 声明                           | 行为                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `id` / `version`               | 插件 ID 全局唯一，ID 使用小写字母、数字、点和连字符。                                      |
| `apiVersion: 1`                | 当前宿主接口版本；不兼容时不激活并显示原因。                                               |
| `views[].id` / `commands[].id` | 插件内短 ID，只使用小写字母、数字和连字符；生成 `插件ID/短ID`，重复项不覆盖旧项。          |
| `region`                       | `navigation` 左上、`main` 主编辑区、`bottom` 底部、`inspector` 右侧。                      |
| `order`                        | 区域内默认顺序，数值越小越靠前；同值按完整 ID 排序。                                       |
| `title`                        | locale 字典，回退顺序为当前语言、英文、ID。                                                |
| `load()`                       | 返回含默认导出 Vue 组件的模块；第一次打开时加载，失败可重试。                              |
| `retention`                    | 默认切换标签卸载；`keep-alive` 保留已访问实例，并收到 `visible` prop。插件停用时仍会卸载。 |
| `actions[].location`           | 视图标题操作 `{ view, area: 'title' }`，或 `editor.toolbar`。                              |
| `requires`                     | 所需宿主服务的兼容声明，不是同源 JavaScript 的安全权限沙箱。                               |

图标名称映射在 `editor/core/app/extensions/icons.ts`，支持现有 Remix 图标集合中的常用项，未知名称显示通用面板图标。添加图标时在宿主清单声明字面量类名，保证生产构建包含图标。

### 项目与命令

`ctx.project.current` 是只读 Ref，值为 `null` 或冻结的项目快照，包含 `sessionId`、`revision`、`name`、文本 `files`、编译 `diagnostics` 和实体 `counts`。不包含文件句柄、local bridge token 或整个内部 store。

- `ctx.project.refresh()` 重新读取并编译项目，失败抛出错误；宿主命令栏负责 loading、禁止重复提交和错误反馈。
- `ctx.project.subscribe(listener)` 订阅新快照，返回取消订阅函数；插件停用时也会释放。
- `ctx.clipboard.writeText(text)` 用于用户触发的复制操作；浏览器拒绝访问时命令显示错误。
- `ctx.notifications.info(text)` 使用编辑器统一提示。
- `ctx.locale` 是宿主语言的只读 Ref。

命令的 `enabled(ctx)` 必须是无副作用判断。异步任务应检查 `ctx.signal`；插件被停用时 signal 会中止。宿主不能撤销已经发生的浏览器或网络副作用，因此外部任务自身也应支持取消。

同一项目会话内重复执行命令会被拦截。切换或关闭项目后，宿主释放旧命令的 busy/error 状态，旧任务完成时不会覆盖新会话的执行状态。插件在异步任务后发布自身结果或通知前，也应比较启动时与当前的 `sessionId`；切换项目不会销毁整个插件，不能只用插件级 `signal` 判断项目是否仍然相同。

标准项目接口仍只提供读取与刷新；游戏自有格式通过受控文档端口保存。游戏运行时、Agent proposal、项目存储仍由各自模块负责。

### 生命周期

```ts
import type { EditorPluginContext } from '@advjs/editor-sdk'

export function activate(ctx: EditorPluginContext) {
  const stop = ctx.project.subscribe((project) => {
    // Update plugin-owned derived state.
  })
  return stop
}
```

`activate()` 成功后才发布面板和命令，失败会释放已登记资源。其他资源使用 `ctx.onDispose(cleanup)` 登记；异步激活完成前被停用，也不会重新出现视图。

视图级资源应在 Vue `onUnmounted()` 中清理，插件级资源使用 activation 清理函数。保留的重资源视图通过 `visible` prop 暂停自身绘制或轮询。不要在模块导入时创建监听、定时器或写入项目。每次重新启用都会建立新的插件上下文。

`retention: 'keep-alive'` 在第一次选中后保留挂载的视图，通过显示状态切换标签，并不使用 Vue `<KeepAlive>`；`onActivated()` / `onDeactivated()` 不会随标签切换执行。监听 `visible` 来暂停后台工作，异步请求还应丢弃隐藏、卸载或切换项目之前的结果。插件停用、工作区路由离开或宿主销毁时，视图仍会卸载并释放资源。

内置游戏和流程图采用保留策略，人物预览等普通视图继续按需卸载。浏览器游戏预览隐藏时停止文件轮询，返回时立即检查章节新增、修改和删除；桌面内嵌玩家隐藏时静音，独立玩家窗口继续运行。流程图切换标签保留缩放和平移，隐藏时卸载小地图；渲染实例属于视图，图数据由 store 保存，重新进入工作区会创建新的渲染实例。

## 样式与验证

遵循 [AGUI 设计规范](../../agui/design)：紧凑的中性控件、共享 token、可见键盘焦点，不用大统计卡片和饱和色按钮给插件另造一套视觉风格。面板内容不覆盖 `body`、宿主标签或全局 `button` 样式。

新增插件至少验证：有项目/无项目、加载与执行失败、启停后资源释放、切换项目、刷新后的标签恢复，以及中文/英文、正常宽度/约 320px、键盘操作。注册表和面板行为测试位于 `tests/unit/editor/editor-ui-plugins.test.ts`。

完成上面的构建后，可运行相关回归测试：

```bash
pnpm exec vitest run tests/unit/gui/agui-controls.test.ts tests/unit/editor/editor-ui-plugins.test.ts tests/unit/editor/editor-context.test.ts tests/unit/editor/editor-workspace.test.ts tests/unit/editor/editor-feature-boundaries.test.ts
```

干净检出执行编辑器 typecheck 时，也需要上面的 COS 插件产物：编辑器间接引用的 CLI 类型会解析该包。

Vue 组件测试需要 Nuxt 生成的 `editor/core/.nuxt/tsconfig.json`。已有依赖产物但尚未构建编辑器时，可先执行 `pnpm --filter @advjs/editor exec nuxt prepare`；不要手写或提交 `.nuxt` 中的生成文件。

## 游戏预览的样式归属

插件面板及工具栏遵循 [AGUI 规范](/agui/design)。面板嵌入的游戏内容遵循 [游戏 UI 契约](/about/design/game-ui)，通过 `AdvContainer` 和局部 `ThemeConfig.ui` 配置主题；不得用游戏 token 改变外部编辑器控件。两者的分工见 [统一设计体系](/about/design/design-system)。

### 原生菜单与插件文档

API v1 增加可选服务 `documents.register`；插件须在 `requires` 中声明。视图通过 `ctx.documents.register(id, { dirty, save })` 登记只读布尔 Ref 和异步保存回调，返回取消登记函数；也会随插件生命周期释放。宿主会为文档 ID 加上插件前缀，拒绝重复登记。此接口不接收任意文件路径或游戏存档，只登记草稿与持久保存结果。

Electron 将插件文档、内置表单和当前源码的未保存状态合并，统一更新标题标记、状态栏、原生保存菜单与关闭 / 重载 / 退出保护。没有标准 ADV 项目时，插件草稿仍可启用原生保存。标签隐藏不取消登记，切换标准项目不清空插件草稿。`save()` 只有在真实写入完成、没有更新的修改时才能返回 `true`；校验错误、冲突、繁忙或取消返回 `false`，异常同样阻止继续。重复保存请求共享同一次操作。

插件有未保存文档时不能停用，先保存或在其工作台明确放弃草稿；停用偏好不会提前写入。文档登记应与视图或插件的真实草稿生命周期一致，不要在隐藏标签时释放，也不要使用已经卸载的保存回调。Electron 关窗走原生「保存并继续 / 取消」流程，已接入的文档不再同时弹浏览器 beforeunload 提示；浏览器独立工具可继续保留原提示。


## 标准项目插件包与 Node 宿主

可信构建可使用 `ADVJS_EDITOR_PLUGIN_PACKAGES`（JSON 数组，每项为绝对本地包目录），无需手写桥接模块。包清单示例：

```json
{
  "name": "@example/advjs-editor-plugin-story",
  "version": "1.0.0",
  "advjs": {
    "editorPlugin": {
      "apiVersion": 1,
      "id": "example.story",
      "entry": "./dist/plugin.mjs",
      "styles": ["./dist/plugin.css"],
      "host": "./dist/host.mjs"
    }
  }
}
```

先构建插件，再构建 Editor。入口和样式必须是包内真实文件，校验 realpath 后拒绝指向包外的符号链接；版本不支持、ID 缺失或重复、文件缺失时构建失败。Node `host` 只声明宿主入口，不由清单加载器执行，也不进入渲染 bundle。已有 `ADVJS_EDITOR_PLUGIN_ENTRIES` 继续兼容。清单与入口内 `defineEditorPlugin` 的 ID / API 版本应一致，宿主注册表仍负责运行时校验。

`@advjs/editor-sdk/node` 提供 `readEditorPluginPackage`、`createEditorProjectHost` 与 `createEditorProjectHostClient`；Vue 根入口不引入 Node。`@advjs/editor-sdk/host-protocol` 仅提供版本 1 协议类型和固定控制路径。Electron 旧 `WorkbenchHost` 名称保留为 SDK 客户端兼容别名。

Node 项目宿主实现 `EditorProjectHostAdapter`：

| 成员 | 职责 |
| --- | --- |
| `id / title / apiPrefix` | 稳定插件身份、界面名称、固定 `/api/name` 前缀 |
| `inspect(path)` | 规范化为真实绝对路径，验证格式与固定输入 / 输出，不执行所选项目代码 |
| `open(repository, lease)` | 创建仅绑定该仓库的有限 HTTP 文档处理器 |
| `validateAccess(repository)` | 验证文件位置仍合法，由 lease 组合会话存活校验 |

`createEditorProjectHost(adapter, initialRoot)` 返回控制处理器、文档处理器、随机控制令牌及 `dispose()`。外层只监听 loopback，关闭前调用 `dispose()` 退役全部会话。Electron 主进程使用固定控制 URL 和令牌创建客户端；renderer 只能经现有受限代理访问文档端口。`info.apiVersion` 为 1；客户端兼容旧宿主未声明版本的响应，明确的未知版本会被拒绝。协议沿用 `info / inspect / open / release`，每个窗口持有不可变仓库绑定与单独令牌，不向视图公开控制凭据。

业务保存处理器必须在读取、编译和最终提交前调用 `lease.validateAccess()`；已释放的会话抛出带 `status: 410` 的错误，不能继续提交。事务、校验、冲突、备份、内容迁移与保存成功的定义由项目宿主管理。SDK 测试使用独立文本适配器验证会话隔离与在途保存退役；项目另外验证真实格式和旧存档兼容。

插件仍是显式可信构建依赖；这里不提供在线市场、动态安装或不可信代码沙箱。调试页面可以注入另一份有限文档端口和展示控件，业务编辑逻辑保持在插件包内。
