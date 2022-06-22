# AdvScript

基于剧本的可读性 Adv 脚本语言

> 参考 Markdown 与 [Fountain](https://fountain.advjs.org/) 设计

AdvScript 的语法基于 Markdown，它会被解析器预解析为语法树。

- [@advjs/parser](https://github.com/YunYouJun/advjs/tree/main/packages/parser): AdvScript 核心解析器
- [@advjs/plugin-vite](https://github.com/YunYouJun/advjs/tree/main/packages/plugin-vite): AdvScript Vite 解析插件（基于 @advjs/parser）
  - 通过 `@advjs/plugin-vite` 进行打包，允许以 `.adv.md` 或 `.adv` 为结尾的文件名称。
- [@advjs/editor](https://github.com/YunYouJun/advjs/tree/main/packages/editor): 一个可在线预览编辑的解析器
  - 你可以在 [ADV.JS Editor](https://editor.advjs.org/) 中预览它的解析效果。

## 约定

- 使用 `UTF-8` 作为编码
- 使用 `LF` 换行，而非 Windows 的 `CRLF`
- 文件后缀名为 `.adv.md`，例如：`start.adv.md`，`.adv` 使其可被识别为本引擎脚本，`.md` 使其可被普通的 Markdown 编辑器解析并预览。

### 推荐

- 建议使用 [VS Code](https://code.visualstudio.com/) 编辑器

### 类型

| 类型      | 说明     |
| --------- | -------- |
| paragraph | 段落     |
| narration | 旁白叙述 |
