# UI

## 默认主题 theme-default

advjs 将会内置默认主题 `@advjs/theme-defaults`。

用户也可以通过 Vue 自定义自己任意的 UI 主题界面。

## 亮暗模式

提供亮暗模式也是 Feature！

## 适配

等比例 Fit 高/宽，居中。

```html
<AdvContainer></AdvContainer>
```

## 复杂动画

- [pixijs](https://github.com/pixijs/pixijs)

### 3D

相比 Threejs，Adv.JS 决定采用 babylonjs 提供 3D 图形渲染的能力。

因为 Babylon.js 相比 [three.js](https://github.com/mrdoob/three.js/) 的代码要更为优雅，且使用 TypeScript 编写，拥有更好的类型提示。

此外，其背靠微软，有资金人力支持，目标之一便是成为一个游戏渲染引擎。

- [babylonjs](https://babylonjs.com/)
- [babylon.js | GitHub](https://github.com/BabylonJS/Babylon.js)

> [vue-reflectivity-friend-or-foe](https://doc.babylonjs.com/extensions/Babylon.js+ExternalLibraries/BabylonJS_and_Vue/BabylonJS_and_Vue_1#vue-reflectivity-friend-or-foe)
