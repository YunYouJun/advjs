# 自定义开始界面

ADV.JS 的主题会提供默认开始页，但游戏项目可以在根目录创建 `pages/start.vue` 覆盖它。适合需要独立标题构图、品牌字体、角色封面或自定义菜单层级的作品。

## 最小示例

```vue
<script setup lang="ts">
import { useAdvStartActions, useGameConfig } from '@advjs/client'

const game = useGameConfig()
const actions = useAdvStartActions()
</script>

<template>
  <main class="game-start">
    <h1>{{ game.title }}</h1>
    <button type="button" @click="actions.startGame">
      开始游戏
    </button>
    <button type="button" @click="actions.openLoadGame">
      读取存档
    </button>
    <button type="button" @click="actions.openSettings">
      设置
    </button>

    <AdvGameModals />
  </main>
</template>

<route lang="yaml">
meta:
  layout: fullscreen
</route>
```

`useAdvStartActions()` 提供主题无关的开始页动作：

- `startGame()`：进入默认入口；`startGame({ chapterId, nodeId })` 可启动指定章节/节点；
- `openLoadGame()`：打开读档界面；
- `openFlowChart()`：进入流程图；
- `openSettings()`：打开设置；
- `openHelp()`：进入帮助页。

使用读档或设置动作时需要保留 `<AdvGameModals />`，否则状态会更新但弹窗没有挂载点。

通关后入口可以这样指向二周目：

```ts
actions.startGame({ chapterId: 'echo', nodeId: 'simulation-start' })
```

项目还可创建 `components/AdvSettingsPanel.vue` 覆盖默认设置界面，通过 `useAdvSettingsControls()` 读写动态效果、字号、速度、全屏与横屏状态。

## 项目级样式

在项目根目录创建 `styles/index.scss` 或 `styles/index.css`。它会在客户端与主题样式之后加载，可用于统一开始页、对话框、选择项和 HUD 的视觉语言。

```scss
:root {
  --game-accent: #f6c96b;
}

.game-start {
  min-height: 100%;
  background: #070a12;
  color: white;
}
```

项目也可以用同样的约定覆盖其他页面，或在 `layouts/` 下提供项目专属布局。页面必须保留键盘焦点样式，并针对窄屏和 `prefers-reduced-motion` 提供降级方案。
