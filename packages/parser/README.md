# @advjs/parser

ADV 剧本文本解析器

> A parser for [advjs](https://github.com/YunYouJun/advjs).

More info see [Parser | ADV.JS](https://advjs.org/dev/parser).

## 语法高亮

`@advjs/parser/syntaxes/adv.tmLanguage.json` 是 AdvScript（`.adv.md`）的 TextMate 语法，语言名 `adv`，别名 `advscript`，scopeName 为 `text.adv`。它嵌入 Markdown 与 YAML，可用于 Shiki、`@shikijs/monaco` 或 VS Code 扩展。

```ts
import advGrammar from '@advjs/parser/syntaxes/adv.tmLanguage.json'
import { createHighlighter } from 'shiki'

const highlighter = await createHighlighter({
  themes: ['github-dark'],
  langs: ['markdown', 'yaml', advGrammar],
})
```
