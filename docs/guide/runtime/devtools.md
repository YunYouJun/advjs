# ADV.JS DevTools

`@advjs/devtools` 基于 [Devframe](https://devfra.me) 提供开发环境调试面板。运行 `adv` 后，通过页面右下角的「ADV.JS DevTools」按钮打开，或直接访问同源的 `/__advjs_devtools/`。在宽度不超过 600px 的窄屏上，入口停靠在右侧中部，避开顶部工具栏与底部存读档操作。

## 调试内容

- 运行时：状态、章节与节点地址、变量、舞台、当前节点，以及最近 100 条剧情追踪。
- 资源：章节、人物、场景、BGM 和 CG 的逻辑 ID 与名称，支持筛选。
- 诊断：当前客户端编译诊断与运行时错误。

每个游戏标签页独立显示为一个会话；关闭游戏页面后移除对应会话。尚未打开游戏时，面板显示等待运行时。资源清单展示声明内容，加载和引用错误由诊断视图报告。

运行时视图分为运行概览、状态数据和剧情追踪。宽面板中，状态与追踪并排显示并分别滚动；窄面板自动纵向排列。变量、当前节点和追踪记录可折叠，摘要显示变量数量、节点类型以及追踪的起止地址。资源页将筛选与列表分区，诊断页分别展示运行时错误和编译诊断。

面板使用 AGUI token，并在独立 iframe 中渲染；亮暗切换不会修改游戏主题。关闭面板保留连接与当前视图，按 Escape 返回游戏。工具栏的「导出」保存当前会话的 JSON 调试报告；该报告用于排查问题，不是游戏存档。

变量、舞台、当前节点和展开的追踪记录支持 JSON 语法高亮，使用宿主共享的 [Devframe Shiki service](https://devfra.me/add-ons/services/shiki)。高亮颜色跟随面板主题，折叠内容按需处理；加载中、服务不可用或单段内容超过 32,768 个字符时保留纯文本。

持续调试或双屏使用时，点击工具栏右侧的「在独立窗口打开」图标。新窗口沿用当前会话、视图和主题，继续实时读取开发服务器；游戏内浮层自动收起。关闭独立窗口后，可再次通过游戏中的调试入口打开浮层。浏览器可能根据设置将窗口呈现为标签页；弹窗被拦截时，面板会提供「在新标签页打开」链接。

## 开发环境接入

ADV.JS CLI 的开发服务器默认启用 ADV.JS DevTools，不自动注入 Vue DevTools，避免其浮动条遮住对白或存档分页。托管玩家预览通过 `AdvServerOptions.devtools: false` 关闭内置调试界面。内置调试插件仅在 `serve` 模式运行，游戏生产构建不注入调试启动脚本或面板资源。

需要 Vue 组件、Pinia 或路由调试时，在游戏项目的 `adv.config.ts` 中开启 Vue DevTools，无需额外安装插件：

```ts
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  devtools: {
    vue: true,
  },
})
```

将 `devtools.vue` 设为 `false` 或省略即可关闭，默认关闭。修改后重启游戏开发服务器生效。该开关仅影响开发模式；即使设为 `true`，生产构建和设置了 `AdvServerOptions.devtools: false` 的托管玩家预览也不会注入 Vue DevTools。宿主可通过 `devtools: { adv: false, vue: true }` 明确开启 Vue 调试并保持 ADV.JS 面板关闭。它只控制 ADV.JS 自动接入的 Vue 插件，项目自行在 `vite.config.ts` 注册的插件仍由项目控制。

桌面编辑器在「游戏」工具栏提供 **Vue DevTools** 开关，默认关闭，选择保存为编辑器偏好。切换会自动重新运行当前实时预览并重置游戏进度，不改写项目配置。构建预览下禁用此开关，导出仍不包含调试工具。

桌面编辑器的「开发者工具」菜单仍可打开浏览器调试工具；它与游戏内的 Vue DevTools 插件入口分别控制。

独立 Vite 宿主可显式安装插件：

```ts
import AdvDevTools from '@advjs/devtools'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [AdvDevTools()],
})
```

可通过 `base` 更改调试路径，通过 `project` 提供宿主项目摘要：

```ts
AdvDevTools({
  base: '/debug/adv/',
  project: { root: process.cwd(), title: '我的游戏' },
})
```

游戏运行时从 `@advjs/client` 的 `setupAdvContext` 接入。宿主通过自己的 Vue 实例订阅变化，调试启动脚本将 JSON 快照发送到 Vite HMR 通道，面板通过 Devframe RPC 读取。仅投影所需字段，不发送完整配置；最多保留 20 个在线会话，单个快照限制为 512 KiB，会话不持久化。

默认 RPC 只读，保留 Devframe 的回环来源限制，适用于本机开发；浏览器以 `localhost` 或 `127.0.0.1` 访问。面板不提供状态修改、任意脚本执行或项目写入。

## Devframe Hub 定义

可移植定义从独立子路径导出：

```ts
import { createAdvDevToolsDevframe } from '@advjs/devtools/devframe'

const frame = createAdvDevToolsDevframe(() => ({
  project: { root: process.cwd(), title: '我的游戏' },
  sessions: [],
}))
```

将 `frame` 交给 Hub 的 `devframes` 列表即可挂载同一个面板。`getReport` 回调由宿主提供当前会话；未提供时仅显示项目目录与等待运行时状态。Vite 插件已包含游戏快照传输，单独使用定义的其他宿主需要自行供应会话报告。此定义声明 `capabilities.build: false`，不生成包含运行状态的静态快照。

定义通过 `services` 声明 Shiki 服务，Hub 可以和其他插件共享同一实例。浏览器只读取高亮 token，不打包 Shiki 引擎、语法或主题。

## 验证

运行 `pnpm demo`，打开游戏和 DevTools，然后推进一句剧情。运行时地址与追踪应更新；资源页可按 ID 筛选，诊断页展示编译或运行时问题。打开第二个游戏标签页会新增会话，关闭该页后会话移除。

展开变量或追踪记录，键、字符串、数字及布尔／空值应使用不同语法色。切换主题后颜色应跟随变化。点击独立窗口入口，再推进游戏，窗口内的节点地址与追踪应继续更新。

连接失败时，检查开发服务器是否仍运行，以及访问域名是否为回环地址，再点击「重新连接」。修改 DevTools 源码后先运行 `pnpm devtools:build`，再重启游戏开发服务器。
