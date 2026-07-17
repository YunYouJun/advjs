---
outline: deep
---

# 扩展语法

ADV.JS 使用 JSON/YAML 代码块声明舞台效果、变量动作、条件和插件活动。故事内容中的 JavaScript/TypeScript 不会执行，以保证浏览器、CLI、Studio、存档和回退具有相同语义。

## 舞台节点

背景：

````md
```yaml
type: background
name: observatory
```
````

`name` 优先匹配 `gameConfig.scenes` 中的场景 ID；也可以用 `url` 直接提供图片地址。

立绘进入与退出：

````md
```yaml
type: tachie
enter:
  - name: 小云
    status: smile
exit:
  - 旁白
```
````

BGM：

````md
```yaml
type: bgm
name: observatory
```
````

`name` 会从公共 BGM 曲库解析；项目自带音频可改用 `src: /audio/observatory.wav`。以 `/`、`./`、`../` 或协议开头的地址会保持原样，不再追加 CDN 前缀和 `.mp3`。

宿主把这些纯数据操作转换为背景、音频、Pixi 或其他展示效果；它们不直接改变剧情游标。

## 剧情逻辑

请使用声明式能力：

- [Variables、Conditions 与 Actions](/guide/runtime/conditions-and-actions)
- [稳定节点与精确跳转](/guide/runtime/navigation-and-saves#稳定节点与精确跳转)
- [插件与活动](/guide/runtime/plugins-and-activities)

直接 JS/TS 代码块会产生 `ADV_RUNTIME_EXECUTABLE_SCRIPT`，选择内的可执行脚本会产生 `ADV_RUNTIME_EXECUTABLE_CHOICE_ACTION`。这是有意的安全和可重放边界，不会回退到 `new Function`。
