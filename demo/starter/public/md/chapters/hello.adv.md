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

  ```yaml
  id: show-syntax
  ```

- [直接开始](#finish)

  ```yaml
  id: skip-syntax
  ```

## 语法提示 {#syntax}

> 标题可以作为稳定锚点，Markdown 链接负责跳转。

- [继续](#finish)

  ```yaml
  id: continue-tutorial
  ```

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

> 向导把一本空白笔记放在桌上。窗边却多了一封信，信封写着：请交给今天第一次来到这里的人。

- [寻找房间里的线索](#desk)

  ```yaml
  id: inspect-desk
  ```

- [打开窗边的来信](letter#window)

  ```yaml
  id: open-letter
  ```

## 桌上的笔记 {#desk}

> 笔记的第一页只有一行字：故事不必沿着同一条路走，也不必一次就找到答案。

@向导
可以先读来信，也可以回头看看语法。这里的每一个选择，都通向剧本里一个明确的位置。

- [带着笔记去读信](letter#window)

  ```yaml
  id: carry-notebook
  ```

- [回看语法提示](#syntax)

  ```yaml
  id: revisit-syntax
  ```
