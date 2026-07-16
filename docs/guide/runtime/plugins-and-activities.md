---
outline: deep
---

# 插件与活动

运行时插件采用接近 Vite/Pinia 的普通对象 API。`defineAdvPlugin()` 只提供类型推导，不创建容器类或隐藏生命周期。

## 定义插件

```ts
import { defineAdvPlugin } from '@advjs/core'

export function starMap(options: { tolerance?: number } = {}) {
  return defineAdvPlugin({
    name: 'star-map',
    version: '1.0.0',

    // 浏览器入口由 Vite 静态导入；相对路径以项目根目录为基准。
    client: {
      module: './runtime-plugins/star-map',
      export: 'starMap',
      options: { ...options },
    },

    actions: {
      mark({ state }, args) {
        state.variables.lastMark = args.value ?? null
      },
    },

    nodes: {
      compare({ activity, node }) {
        activity('compare', {
          tolerance: options.tolerance ?? 0.8,
          ...node.data,
        })
      },
    },

    activities: {
      compare({ state, input }, result) {
        const value = result as { matched?: boolean, score?: number }
        state.variables.starMatched = value.matched === true
        state.variables.starMatchScore = value.score ?? 0
        state.variables.lastTolerance = input.tolerance ?? null
      },
    },
  })
}
```

短名称会注册为 `star-map/mark`、`star-map/compare`。插件名和能力名使用小写字母、数字与连字符；重复插件、重复能力、缺失插件和版本不匹配都会在 Runtime 创建时立即报错。

节点和动作必须同步执行，只能修改 Runtime 提供的 JSON draft。网络、计时器、文件、DOM、音频或复杂 UI 属于宿主活动，不应放入状态转移处理器。

`client` 是浏览器重建插件所需的静态工厂描述，不包含可执行字符串。Vite 会生成普通 `import` 并调用对应工厂，因此闭包不会经过 JSON 序列化，也不需要 `eval` 或 `new Function`。直接调用 `createAdvRuntime({ plugins })` 的 Node/测试场景不要求该字段；发布给浏览器使用的插件应提供它。包插件通常把 `module` 写成包名，本地插件可写相对项目根目录的路径。

## 安装与声明依赖

```ts
export default defineAdvConfig({
  plugins: [starMap({ tolerance: 0.82 })],
  gameConfig: {
    requiredPlugins: {
      'star-map': '1.0.0',
    },
  },
})
```

`requiredPlugins` 会写入 Program。浏览器、CLI 或 Studio 未安装对应版本时会在开始执行前失败；`adv check` 还会静态检查未知节点和动作能力。

## 从 Markdown 请求活动

````md
```yaml
type: activity
use: star-map/compare
input:
  stars: 7
  hint: 对齐最明亮的三颗星
```
````

执行到该节点时：

1. 插件节点调用 `activity()`；
2. Runtime 进入 `waiting-activity`，在 `pendingActivity` 保存纯 JSON 输入并发出 `activity.request`；
3. 浏览器渲染互动 UI，或 CLI 接收结构化 JSON；
4. 宿主调用 `runtime.completeActivity(result)`；
5. 注册的活动完成处理器把纯 JSON 结果写入变量，Runtime 继续到下一节点。

等待活动时，普通 `next()` 会返回 `ADV_RUNTIME_ACTIVITY_PENDING`，因此活动不会被误跳过。活动完成前会建立 checkpoint，`back()` 可以回到待处理状态。

CLI 示例：

```bash
adv play activity '{"matched":true,"score":0.91}' \
  --session-id story-1 --json
```

## 参考互动插件

`@advjs/plugin-interactions` 提供两个小型参考实现：

- `starMap()`：注册 `star-map/compare`，写入 `starMatched` 和 `starMatchScore`；
- `civilization()`：注册 `civilization/initialize`，写入文明对象和 `civilizationLevel`。

它们用于仓鼠 Demo 验证通用活动接口，不把星图或文明规则写入 Core。证物、路线锁、战斗和小游戏也应优先以独立插件组合变量、条件、动作和活动，而不是扩大基础运行时 API。

参考插件已经内置客户端工厂描述，所以使用侧仍只有 `plugins: [starMap(), civilization()]`，不需要额外注册浏览器入口。
