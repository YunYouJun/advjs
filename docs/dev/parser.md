# Parser

在边定义 AdvScript 的语法过程中，我们需要一个所见即所得 Parser 页面来提高开发效率。

## 实现

AdvScript 是参照 Fountain 语法进行设计，并基于 Markdown 语法规则的类文本脚本。

因此我打算复用已有的 Markdown 解析器。

### Markdown 解析器

- [markdown-it](https://github.com/markdown-it/markdown-it)
- [marked](https://github.com/markedjs/marked)
- [remark](https://github.com/remarkjs/remark)

当前以后不少的 Markdown 解析器，起初我选定的是 Star 最多的 marked，并实现了一个版本。

但是最终决定使用 markdown-it 实现，主要原因是其自身支持各类插件，作为基于 markdown 解析的 adv 语法，使用插件的形式或许更为优雅。

此外 Vuepress/Vitepress 这一类与 Vue/Vite 生态联系紧密的静态网站生成器也使用其实现。
