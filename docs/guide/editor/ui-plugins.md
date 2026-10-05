# 编辑器 UI 插件

UI 插件用于给桌面编辑器增加面板和操作。适合项目诊断、创作资料、资源工具等可以独立启停的功能：插件提供内容，编辑器统一提供标签、工具栏、布局恢复和 AGUI 外观。

这与游戏运行时的[插件与活动](../runtime/plugins-and-activities.md)是两个入口。游戏交互仍使用 `defineAdvPlugin()`；编辑器扩展使用 `defineEditorPlugin()`。当前实现面向 `editor/core`，不自动影响移动端 Studio 或游戏主题。

## 查看面板

1. 启动桌面编辑器，点击顶部拼图图标 **管理插件**，或底部 **插件** 标签。
2. **创作上下文** 位于右侧，提供创作资料阅读、刷新和复制给 AI。
3. **诊断** 位于底部，展示当前项目的编译错误、警告和源文件位置；点击 **重新检查** 刷新项目。
4. 在插件列表中停用可选插件，对应标签和命令会移除；重新启用后可点击 **打开面板**。

核心编辑器为必需项，不能停用。可选插件的启动或视图加载失败不会阻止其他插件；失败面板可以重试。启动耗时过长时可点击 **取消启用**，迟到的启动结果不会重新注册面板。只有命令而没有视图的插件不显示“打开面板”。未打开项目时，项目操作禁用并显示空态。

标签选中状态与插件启停偏好保存在当前浏览器中。重置布局恢复分栏和默认标签，不改变启停偏好。已停用或暂时缺失的活动视图会回退到区域内可用视图，其记录保留到再次启用。

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
pnpm --filter @advjs/editor build
```

开发插件可以把 `.ts` / `.vue` 源码作为包导出，由编辑器 Vite 构建处理；Vue 应由宿主提供，避免插件私自打包第二份运行时。AGUI 主题样式由宿主加载，插件只引入自己的 scoped 样式。动态拼接的 UnoCSS 类名不能保证进入构建，公共插件优先使用 scoped CSS 与语义 token。

预编译的 `adv-editor` 不会因为游戏项目安装了 npm 包而自动加载 UI 插件。当前没有远程安装、更新市场、任意 DOM 注入或不可信代码沙箱。

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

目前只提供项目读取与刷新，项目写入未来将复用现有 source patch 校验和冲突处理。游戏运行时、Agent proposal、项目存储仍由各自模块负责。

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

## 样式与验证

遵循 [AGUI 设计规范](../../agui/design.md)：紧凑的中性控件、共享 token、可见键盘焦点，不用大统计卡片和饱和色按钮给插件另造一套视觉风格。面板内容不覆盖 `body`、宿主标签或全局 `button` 样式。

新增插件至少验证：有项目/无项目、加载与执行失败、启停后资源释放、切换项目、刷新后的标签恢复，以及中文/英文、正常宽度/约 320px、键盘操作。注册表和面板行为测试位于 `tests/unit/editor-ui-plugins.test.ts`。

完成上面的构建后，可运行相关回归测试：

```bash
pnpm exec vitest run tests/unit/editor-ui-plugins.test.ts tests/unit/editor-context.test.ts tests/unit/editor-workspace.test.ts tests/unit/editor-feature-boundaries.test.ts
```

Vue 组件测试需要 Nuxt 生成的 `editor/core/.nuxt/tsconfig.json`。已有依赖产物但尚未构建编辑器时，可先执行 `pnpm --filter @advjs/editor exec nuxt prepare`；不要手写或提交 `.nuxt` 中的生成文件。
