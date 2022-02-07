# Parser

在边定义 AdvScript 的语法过程中，我们需要一个所见即所得 Parser 页面来提高开发效率。

## 实现

AdvScript 是参照 Fountain 语法进行设计，并基于 Markdown 语法规则的类文本脚本。

因此我打算复用已有的 Markdown 解析器。

### Markdown 解析器

当前有着不少的 Markdown 解析器。

- [marked](https://github.com/markedjs/marked): 起初我选定的是 Star 最多的 marked，并实现了一个简易版本。marked 算是老牌的 Markdown 解析器，中间有过一段时间维护不是很活跃，2020-2022 年似乎又重新活跃起来。它为构建速度而生，但缺乏插件机制。
- [markdown-it](https://github.com/markdown-it/markdown-it): 自身支持各类插件，此外 Vuepress/Vitepress 这一类与 Vue/Vite 生态联系紧密的静态网站生成器也使用其实现。可是当我尝试 markdown-it 时，发现其语法树相比 marked 是拍平的结构，这自然有其道理。但是对于我来说，它的语法树变的更加长，且有许多冗余信息，不易理解。我更想要像 marked 类似的层级结构。
- [remark](https://github.com/remarkjs/remark): 相比前两者算是晚辈，但意外地在包下载量上超过了前两者。它的子包分的很细，譬如它单独抽取了 [remark-parse](https://github.com/remarkjs/remark/tree/main/packages/remark-parse) 包作为 remark 解析语法树的部分。并且有一个专门规定 Markdown AST 的仓库 [mdast](https://github.com/syntax-tree/mdast)。可以利用插件对 Markdown 在语法树的过程中进行改造，这正是我想要的。

[markdown-it vs marked vs remark-parse | npm trends](https://www.npmtrends.com/markdown-it-vs-marked-vs-remark-parse)

## 思路

剧本内容从大到小分为 `Act（表演）` `Sequence（序列）` `Scene（场景）` `Dialog（会话）`。

`Dialog` 中包括 `Character（人物）` 与 `Words（所说的话）`。
