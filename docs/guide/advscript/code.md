---
outline: deep
---

# 代码块

::: tip
代码块是 ADV.JS 的特色。

用户可以在 Markdown 的代码块中直接插入 `JavaScript/TypeScript` 脚本，并通过 `$adv` 控制上下文。
:::

代码块是用户插入脚本逻辑的方案。

其中可主要分为以下两种：

- 一种为插入特定类型 AdvNode 节点
  - 使用 `JSON/YAML` 快速插入内置的 `advnode` 节点
- `JavaScript/TypeScript` 代码块，可使用任意 JS/TS 语法
  - 可通过 `$adv` 控制上下文

## AdvNode

`AdvNode` 是内置的节点类型。

其中包括以下类型：

- camera
- background
- ...

可以通过代码块（语言设置为 `JSON` / `YAML`）进行插入。

譬如 `JSON`：

````md
```json
{
  "type": "tachie",
  "enter": [
    {
      "name": "小云"
    }
  ]
}
```
````

或 `YAML`：

````md
```yaml
type: background
url: /img/bg/stacked-steps-haikei.svg
```
````

### 镜头 Camera

> 镜头位置变换

````md
```json
{
  "type": "camera",
  "target": {
    "x": 1,
    "y": 3,
    "z": 0
  },
  "beta": 1
}
```
````

### 背景 Background

插入背景：

```yaml
type: background
url: /img/bg/stacked-steps-haikei.svg
```

### 立绘 Tachie

```ts
export interface Tachie extends Node {
  type: 'tachie'
  enter: {
    name: string
    status: string
  }[]
  exit: string[]
}
```

立绘进入：

```json
{
  "type": "tachie",
  "enter": [
    {
      "name": "小云"
    }
  ]
}
```

立绘退出：

```json
{
  "type": "tachie",
  "exit": ["小云"]
}
```

## 直接使用 JS/TS

> `$adv` 是全局的上下文，可以调用内置的函数与配置。

插入 TypeScript 脚本：

````md
```ts
$adv.nav.next()
```
````

插入的脚本将会被封装为一个函数，并在游戏进行到对应节点时执行。

```ts
console.log($adv.config.title)
```
