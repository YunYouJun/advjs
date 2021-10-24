# 语法

本项目最终目标是用户可以通过像写剧本、写小说一样的形式来快速完成 ADV 游戏的创作。

因此起初打算设计一套基于 Markdown 解析的剧本格式。

不过有趣的是，在后来我发现了 [fountain](https://fountain.io/)。
它的理念与我期待的形式十分相似，基于 Markdown 的语法扩展，使用纯文本解析。

而它本身也是编剧软件中的事实标准之一，这意味着我们不需要也不应当重新探索一套新的标准。
当然，fountain 本身是为了写剧本而创立的，这与视觉小说的剧本接近，但为了构建程序我们必然也需要基于此扩展一些额外语法。

此部分我打算直接使用 Markdown 本身的 <code>\`\`\`</code> 来包裹需要扩展的内置脚本语法。

我建立了一个 Fountain 的中文站点。用来翻译 Fountain 官网的语法及相关介绍、资源等。

> [fountain-cn](https://github.com/advjs/fountain-cn)

当然，对于交互式视觉小说来说，面向剧本的 Fountain 必然无法覆盖全部的情景，因此我们仍然需要对其进行一部分扩展。

即：

`Fountain` + `中文兼容语法` + `Markdown 的代码块（实现扩展交互语法）` + `front matter（文件头部配置语法）` = `AdvScript`

我们希望你学习 AdvScript 语法的同时，获得的编写经验也是可迁移的。

其中覆盖的 Fountain 语法即便你不打算使用 ADV.JS 来开发你的游戏，但对于写剧本来说，仍然是值得学习的。

## 其他参考资源

- [奥斯卡剧本资源](https://www.oscars.org/nicholl/screenwriting-resources)
- [injuben](https://github.com/injuben/injuben)
- [剧本标准格式（1）——纠结的格式选择](https://zhuanlan.zhihu.com/p/22457667)

## Fountain

> <https://fountain.io/faq>

借此机会了解一下 Fountain。大部分内容参考自官网，但缺少中文翻译。
我会在此简要介绍。

### Fountain 相关链接

- [betterfountain](https://github.com/piersdeseilligny/betterfountain)
- fountain 示例
  - [Big Fish](https://fountain.io/_downloads/Big-Fish.fountain)
  - [小城之春](../../packages/parser/examples/小城之春.fountain)

### Fountain FAQ

## 对比

- [Final Draft](https://www.finaldraft.com/): 好莱坞业界标准，软件售价昂贵
