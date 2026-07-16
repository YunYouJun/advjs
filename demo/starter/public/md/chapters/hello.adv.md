---
title: 你好，ADV.JS
---

【演示室，清晨，内景】 {#start}

```yaml
type: background
url: /img/room.svg
```

> 这段旁白直接来自一个 `.adv.md` 文件。

@向导
欢迎来到 ADV.JS。对话、选择和状态都可以用 Markdown 描述。

- [看看语法](#syntax)
- [直接开始](#finish)

## 语法提示 {#syntax}

> 标题可以作为稳定锚点，Markdown 链接负责跳转。

- [继续](#finish)

## 完成 {#finish}

```yaml
type: actions
actions:
  - type: variables/set
    key: greeted
    value: true
```

```yaml
type: when
condition: greeted
```

@向导
最小项目已经跑通。现在可以从这里开始写你的故事。
