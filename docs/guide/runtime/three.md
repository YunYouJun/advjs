# Three.js 与游戏地图

`@advjs/plugin-three` 提供通用 Three.js 渲染基础。城池、势力、行军、战斗和回合属于具体游戏，可在游戏项目中实现，或提取成单独的 Runtime 插件。仓库内的示例只演示通用渲染；具体游戏插件由游戏项目维护并从自己的配置加载。

## 职责与接入

| 层       | 所属位置                    | 职责                                       |
| -------- | --------------------------- | ------------------------------------------ |
| 通用渲染 | `@advjs/plugin-three`       | 画布、相机、缩放、拾取、渲染调度和资源释放 |
| 游戏规则 | 游戏项目或独立 Runtime 插件 | 地图数据、选择结果、势力、行军和回合       |
| 创作工具 | Editor 插件                 | 地图编辑、属性面板和命令                   |

Three.js 包是浏览器渲染适配层，通过 Vue 组件或 `createThreeViewport()` 使用。它本身不提供可放进 `adv.config.ts` 的 `plugins` 数组的 Runtime 工厂，也不会自动出现在 Editor 插件列表中。游戏插件通过[插件与活动接口](./plugins-and-activities)注册自己的节点和交互。

仓库内启动示例：

```bash
pnpm install
pnpm -C plugins/plugin-three build
pnpm -C examples/three-map dev
```

消费端需要 Vue 3、Three.js，以及 TypeScript 项目中的 `@types/three`；当前工作区验证版本为 `three@0.183.2`。组件源码需要支持 Vue SFC 的构建器。安装依赖不会让所有游戏默认加载 Three.js。

## 创建场景

```vue
<script setup lang="ts">
import type { ThreeSceneSetup } from '@advjs/plugin-three'
import AdvThreeCanvas from '@advjs/plugin-three/client/AdvThreeCanvas.vue'
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three'

const setup: ThreeSceneSetup = ({ scene }) => {
  const object = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: '#4488bb' }),
  )
  scene.add(object)
}
</script>

<template>
  <div style="height: 360px">
    <AdvThreeCanvas label="方块场景" :setup="setup" />
  </div>
</template>
```

组件必须有非零宽高。默认创建透视相机；`options.camera` 可以传入透视或正交相机，正交相机在容器尺寸变化时保持纵向范围。`options.controls: true` 启用 OrbitControls，可在 `setup` 中限制旋转、平移或缩放。

| 接口               | 用途                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `label`            | 画布的可访问名称                                                  |
| `setup(viewport)`  | 同步创建场景，可返回清理函数；更换函数或 `options` 引用会重建场景 |
| `active`           | 暂停或恢复画布；KeepAlive 停用时也会暂停                          |
| `ready`            | 获取初始化完成的 viewport                                         |
| `pick`             | 点击时返回最近的可见对象交点，拖动不会触发选择                    |
| `error` 事件和插槽 | 报告初始化、渲染或上下文丢失；插槽提供 `error` 和 `retry`         |

viewport 提供 `scene`、`camera`、`renderer`、可选的 `controls`，以及 `invalidate()`、`resize()`、`setActive()`、`pick()`、`dispose()` 和 `signal`。非 Vue 宿主也可以直接使用 `createThreeViewport(canvas, options)`，并在卸载时调用 `dispose()`。

默认按需渲染：修改场景后调用 `invalidate()`，同一帧中的多次请求会合并。动画使用 `continuous: true` 与 `onFrame(viewport, deltaSeconds)`。页面隐藏、画布停用、零尺寸或 WebGL 上下文丢失时暂停，恢复后的首帧间隔为零，避免动画突然跳跃。默认设备像素比上限为 2；可显式设置正的有限 `pixelRatio`。拾取使用画布实际显示边界，支持缩放后的容器。

## 实体绑定与自动取景

`createThreeEntityRegistry()` 将稳定的游戏 ID 关联到临时场景对象。一个实体可以注册多个对象根；命中模型的子网格时会向上查找最近的已注册祖先。绑定不修改 `userData`，因此导入的模型和游戏状态可以分别维护。

```ts
import { createThreeEntityRegistry, frameThreeObjects } from '@advjs/plugin-three'

const entities = createThreeEntityRegistry()
const unbind = entities.register('capital', cityModel)
const id = entities.resolve(viewport.pick(clientX, clientY, entities.getObjects()))
frameThreeObjects(viewport, entities.getObjects(), { padding: 1.2 })

// 场景切换时移除绑定；几何体与材质仍按原来的资源归属规则释放。
unbind()
entities.clear()
```

代码片段中的 `cityModel`、`viewport` 和点击坐标由宿主提供。`register()` 返回取消绑定函数；每个对象根只能有一个绑定。`getObjects(id?)` 返回所有或指定实体的对象根，`resolve()` 返回 ID 或 `undefined`，`clear()` 释放引用而不销毁对象。

将 `options.pickObjects` 设置成 `() => entities.getObjects()`，画布会只在这些对象上拾取，避免地面、路线和装饰遮挡实体选择。显式传给 `viewport.pick()` 的对象列表优先于该选项。

`frameThreeObjects()` 根据对象和子对象的世界包围盒，调整正交相机缩放或透视相机距离，并同步控制器目标、裁剪范围和渲染请求。它保持相机朝向；空列表不会修改相机。`padding` 必须是大于等于 1 的有限数，默认 1.2。包围盒包含隐藏子对象；调用方应传入需要展示的对象根。设置了控制器缩放或距离限制时，应确保其范围允许完整取景。包围盒计算采用 [Three.js 的世界变换规则](https://threejs.org/docs/pages/Box3.html)。

`options.onResize(viewport)` 在画布非零逻辑尺寸改变、投影矩阵更新后调用，可重新取景。首次回调发生在场景 `setup` 之前，此时对象列表可能为空。渲染示例在初始化和尺寸变化后取景，也提供“显示全部对象”按钮；正常选择和拖动不会重建场景。

## 资源与恢复

默认场景由 viewport 持有，销毁时会去重释放场景中的 geometry、material 和 texture。传入 `options.scene` 时场景由调用方持有，viewport 不释放其资源；可以在明确拥有资源时调用 `disposeThreeResources(scene)`。共享到其他场景的资源、额外的 render target、ImageBitmap 和外部订阅仍由调用方管理。Three.js 的资源释放规则见[官方说明](https://threejs.org/manual/pages/cleanup.html)。

异步加载应检查 `viewport.signal.aborted`：销毁后到达的资源需要立即释放，不能再加入旧场景。成功加入场景后调用 `invalidate()`。`setup` 返回的清理函数适合移除监听器或取消外部任务。

上下文恢复后会重新请求渲染。创建失败时可通过错误插槽的 `retry()` 重建画布。场景、Mesh、Texture、相机和 DOM 引用都不能写入 Runtime 状态；存档只保存 JSON 数据。

## 地图与剧情连接

`examples/three-map` 只展示方块、实体绑定、拾取和自动取景，不注册游戏活动。城池数据、势力、路线、活动组件及结果处理器应放在游戏自己的 `plugins/strategy-map/`，由项目配置显式注册：

```ts
// adv.config.ts
import { strategyMap } from './plugins/strategy-map'

export default {
  plugins: [strategyMap()],
}
```

这里的 `strategyMap()` 是游戏实现的 Runtime 工厂，按照[插件与活动接口](./plugins-and-activities)定义。它通过 `client.module` 指向项目根目录相对的工厂入口，通过 `client.activities` 指向活动组件。例如工厂位于 `plugins/strategy-map/index.ts`，组件位于 `plugins/strategy-map/client/MapActivity.vue`：

```ts
import { defineAdvPlugin } from '@advjs/core'

export function strategyMap() {
  return defineAdvPlugin({
    name: 'strategy-map',
    version: '1.0.0',
    client: {
      module: './plugins/strategy-map/index.ts',
      export: 'strategyMap',
      activities: {
        select: { module: './plugins/strategy-map/client/MapActivity.vue' },
      },
    },
    // Add the game's nodes and activity result handlers here.
  })
}
```

构建器为这个项目生成工厂与 renderer 注册，宿主按 `pendingActivity.type` 选择组件。其他项目没有注册该工厂时不会加载它的地图。独立原型可以用 `defineAsyncComponent()` 组合现有 `createActivityRendererRegistry()` 按需加载地图并验证交互，无需另一套活动协议。

游戏定义自己的活动名，例如 `strategy-map/select`，脚本通过 `type: activity` 和 `use: strategy-map/select` 请求活动。完成结果只传 `{ cityId: 'capital' }` 这样的 JSON；游戏处理器校验 ID，将确认结果写到自己的状态命名空间，例如 `state.variables.strategyMap`。恢复待处理活动时，从存档中的 JSON 输入重建地图；尚未确认的 UI 选择属于临时状态。

标准活动宿主在互动期间显示地图。需要常驻战略地图时，游戏可用自定义页面或 `AdvGame` 的 `scene` 插槽承载，但目前没有自动注册常驻地图层的 Runtime 插件接口；宿主还需协调地图与 `.adv-ui` 的输入和 HUD 层级。

创作端的地图编辑器应使用 Editor SDK 的视图与命令接口。公开的项目服务目前提供读取和刷新；地图写入需要进一步设计项目服务，不能把示例的运行时存档当成编辑器项目写入接口。

交互地图应提供城池列表等键盘操作入口。通用示例在 WebGL 不可用时仍允许通过对象列表选择；游戏活动也应保留可完成操作的替代入口。

## 后续扩展边界

下一步可以先在游戏层验证以下能力，再依据多个游戏的实际复用需求提取公共模块：

- 地图图结构与寻路：稳定的节点、边、通行代价和确定性的最短路；保持纯 TypeScript，供浏览器、CLI 和模拟测试共用。
- 战略命令：把行军、回合推进和战斗结果通过 Runtime 动作或活动处理器提交；渲染层显示结果，存档保存规则状态与 ID。
- 资产加载：组合现有资产目录和异步模型加载，统一处理中止、延迟到达资源与资源归属。

常驻地图与 HUD 的输入协调需要先验证具体游戏宿主。地图编辑和项目写入则属于 Editor 服务设计；这些边界不应由一个 Three.js 画布组件承担。

## 验证

```bash
pnpm -C plugins/plugin-three build
pnpm -C examples/three-map build
pnpm exec vitest run plugins/plugin-three/test
pnpm exec vue-tsc --noEmit -p plugins/plugin-three/tsconfig.json
pnpm exec vue-tsc --noEmit -p examples/three-map/tsconfig.json
```

单元测试使用模拟 renderer 验证生命周期、拾取、实体绑定和自动取景；游戏层单独验证规则与状态恢复。真实 WebGL 渲染与布局还需要浏览器检查。
