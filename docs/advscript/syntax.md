# 语法

参考 Fountain 的语法扩展，针对中文与文字冒险游戏进行更多语法定义。

::: tip

剧本文件基于 Markdown 编写，因此可使用 `adv.md` 作为后缀。

Front Matter 用户配置剧本文件内容。

用户可以在 `adv.config.ts` 中配置游戏。

- 每个游戏剧本应当有且仅有一个主入口文件，可在入口文件中配置其由那些子剧本组成。

:::

## 注释

相比 Fountain 使用 `[[]]` 进行注释，AdvScript 支持使用 `<!-- -->` 来对剧本进行注释。

## 场景

使用 `【】` 来包括场景，`，`进行分割。

顺序为，`地点`、`时间`、`内外景(可选)`。

如：

```md
【门口，夜】
```

## 参考

- [正则表达式 | MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_Expressions)
