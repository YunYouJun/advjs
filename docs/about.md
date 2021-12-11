# 关于

这里将会是 ADV.JS 的使用文档。

但除了使用说明外，我也会记录一些我的设计方案以及我为什么这么做的原因。

如果您有任何更好的提案，欢迎前往 [Discussions](https://github.com/YunYouJun/advjs/discussions) 发起讨论。
如果您发现了目前的一些设计缺陷或有一些希望增加的功能，欢迎发起 [Issues](https://github.com/YunYouJun/advjs/issues)。

> 愿能在未来的冒险时间中与你相遇

## Why ADV.JS?

More info [https://www.yunyoujun.cn/posts/make-an-avg-engine/](https://www.yunyoujun.cn/posts/make-an-avg-engine/).

## Why not ...?

### [Ink](https://github.com/inkle/ink)

ink 是一种开源脚本语言，用于编写交互式叙述。
看起来这和我们想要的内容非常相似，且可用于开发文字冒险游戏。

但它的语法是嵌套的，且本身与剧本格式相差甚远。
我们希望能有一种更贴近 Markdown 的语法，更平易近人。

ink 的许多逻辑语法，完全可直接使用 JS/TS 实现，且更为友好，降低学习成本。
