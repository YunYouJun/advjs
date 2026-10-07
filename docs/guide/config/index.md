# 基础配置

::: tip
文档正在编写中……

您可以先参考 [advjs/packages/types/src/config.ts](https://github.com/YunYouJun/advjs/blob/main/packages/types/src/config.ts)。
:::

在项目目录下创建 `adv.config.ts`。

```ts
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  // DOM 叙事游戏推荐：窄屏时让场景与 UI 重排，而不是缩小整张 16:9 画布。
  viewportFit: 'responsive',
  gameConfig: {
    title: 'Your Game',
    characters: [
      {
        name: '小云',
        actor: '小云',
        avatar: 'https://fastly.jsdelivr.net/gh/YunYouJun/yun/images/meme/yun-good-alpha-compressed.png',
        tachies: {
          default: {
            src: 'https://fastly.jsdelivr.net/gh/YunYouJun/yun/images/yun-alpha-compressed.webp',
            style: {
              transform: 'scale(1) translateY(5%)'
            }
          }
        }
      }
    ]
  }
})
```

## 视口适配

`viewportFit` 决定运行时舞台如何使用浏览器空间：

- `contain`（默认）保持 `canvasWidth` 与 `aspectRatio` 定义的固定坐标系；画面完整显示，比例不一致时留黑边。适合依赖固定坐标的 Canvas、2D/3D 场景。
- `responsive` 让 DOM 舞台使用可用视口尺寸。背景仍以 `cover` 填充，立绘、HUD、对话框和互动组件可通过媒体查询重排；这是文字冒险和视觉小说的推荐配置。

采用 `responsive` 时，不要把 UI 位置写死为 1920×1080 像素坐标。优先使用 `clamp()`、百分比、视口单位和 `max-width`，并至少验收桌面横屏与手机竖屏。系统的减少动态效果偏好仍独立生效。

```md
@小云
你好呀！
```

## Vue DevTools

`devtools.vue` 控制开发预览中的 Vue DevTools 浮动入口，默认关闭。设为 `true` 开启，设为 `false` 或省略则关闭；修改后重启开发服务器。桌面编辑器可通过「游戏」工具栏直接控制实时预览，无需修改此配置。生产构建不注入该入口，托管玩家预览默认关闭，详见 [调试工具接入](../runtime/devtools#开发环境接入)。

```ts
export default defineAdvConfig({
  devtools: {
    vue: false,
  },
})
```
