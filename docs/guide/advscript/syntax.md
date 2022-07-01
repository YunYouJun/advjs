---
outline: deep
---

# 语法

参考 Fountain 的语法扩展，针对中文与文字冒险游戏进行更多语法定义。

::: tip

剧本文件基于 Markdown 编写，因此可使用 `adv.md` 作为后缀。

Front Matter 用户配置剧本文件内容。

用户可以在 `adv.config.ts` 中配置游戏。

- 每个游戏剧本应当有且仅有一个主入口文件，可在入口文件中配置其由那些子剧本组成。

:::

`@advjs/parser` 将根据对应语法解析为语法树中的节点。

```ts
export type Child = Unknown | Paragraph | Narration | Character | Words | Text | SceneInfo | Dialog | Choice | Code
```

## 段落 Paragraph

```md
嘿嘿嘿

哈哈哈
```

段落下包括 `Text` 与 `Dialog` 类型。

```ts
export interface Paragraph extends Node {
  type: 'paragraph'
  children: (Text | Dialog)[]
}
```

## 文本 Text

普通文本

```ts
export interface Text {
  type: 'text'
  value: string
}
```

## 对话 Dialog

对话可解析为人物和相应的对话。

```ts
export interface Dialog extends Node {
  type: 'dialog'
  character: Character
  children: Text[]
}
```

譬如:

```md
小云：你好呀！
```

将被解析为：

```json
{
  "type": "dialog",
  "character": {
    "type": "character",
    "name": "小云",
    "status": ""
  },
  "children": [
    {
      "type": "text",
      "value": "你好呀！"
    }
  ]
}
```

## 人物 Character

- `name`: 人物姓名
- `status`: 状态，根据状态调整立绘

```ts
export interface Character extends Node {
  type: 'character'
  name: string
  /**
   * status of character to adjust tachie
   * @default '' as 'default'
   */
  status?: string
}
```

## 旁白 Narration

```md
> 我是一段可爱的旁白～
```

## 注释 Comment

相比 Fountain 使用 `[[]]` 进行注释，AdvScript 支持使用 `<!-- -->` 来对剧本进行注释。

```md
<!-- 注释内容 -->
```

## 场景 Scene

使用 `【】` 来包括场景，`，`进行分割。

顺序为，`地点`、`时间`、`内外景(可选)`。

如：

```md
【门口，夜】
```

解析为：

```json
{
  "type": "scene",
  "place": "门口",
  "time": "夜",
  "inOrOut": ""
}
```

## 选项 Choice

```md
- [ ] 好的！
- [ ] 抱歉……
```

```json
{
  "type": "choice",
  "options": [
    {
      "text": "好的！"
    },
    {
      "text": "抱歉……"
    }
  ]
}
```

想要执行操作？

````md
- [ ] 好的！

  ```ts
  $adv.nav.next()
  ```

- [ ] 抱歉……

  ```ts
  // ...
  ```
````

## 代码块 Code

代码块被用于实现扩展逻辑，更多内容请参见[「代码块」](/guide/advscript/code)。
