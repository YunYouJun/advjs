# @advjs/parser

> A parser for @advjs.

ADV 剧本文本解析器

## 相关

### 约定

- 使用 UTF-8 作为编码
- 使用 LF 换行，而非 Windows 的 CRLF

### 推荐

- 建议使用 [VS Code](https://code.visualstudio.com/) 编辑器

## 语法

目前的实现打算参照 [Liber 语言文档](https://doc.librian.net/site/%E9%80%B2%E9%9A%8E/Liber%E8%AA%9E%E8%A8%80%E6%96%87%E6%AA%94.html)。

但我后期可能更希望其与 Markdown 文本相似并兼容。
即只要遵照 Markdown 语法编写，便可快速生成视觉小说。（略微类似于 [reveal.js](https://github.com/hakimel/reveal.js) 根据 Markdown 生成演示文档的想法。）

### 细则

```md
我：米娜桑，哦哈呦！
小云：新的一天也要加油鸭！
```

```json
{
  "type": "xxx"
}
```

### 类型

| 类型      | 说明     |
| --------- | -------- |
| paragraph | 段落     |
| narration | 旁白叙述 |

### Q&A

#### 旁白使用 `blockquote` 语法

旁白使用 `blockquote` 语法以避免旁白中存在特殊字符如 `:`/`：`，被当作对话解析。
