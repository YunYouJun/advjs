# AdvScript

基于剧本的可读性 Adv 脚本语言

> 参考 Markdown 与 [Fountain](https://fountain.advjs.org/) 设计

::: tip

- [剧本标记语言 Fountain 中文手册](https://fountain.advjs.org/)：[Fountain](https://fountain.advjs.org) - 好莱坞事实剧本格式之一
- [@advjs/parser](https://github.com/YunYouJun/advjs/tree/main/packages/parser): AdvScript 核心解析器
  - 你可以在 [Playground | ADV.JS Parser](https://parser.advjs.org/) 中实时预览 AdvScript/Markdown 被解析的语法树形态

:::

AdvScript 的语法基于 Markdown，它会被解析器预解析为语法树。

## 约定

- 使用 `UTF-8` 作为编码
- 使用 `LF` 换行，而非 Windows 的 `CRLF`
- 文件后缀名为 `.adv.md`，例如：`start.adv.md`，`.adv` 使其可被识别为本引擎脚本，`.md` 使其可被普通的 Markdown 编辑器解析并预览。

### 推荐

- 建议使用 [VS Code](https://code.visualstudio.com/) 编辑器
