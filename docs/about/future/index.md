# 设想

::: info 前言

出于兴趣使然，我开启了这个项目。
同样，我也不希望它最终成为一个孤芳自赏的项目，而是一个真正让人觉得有趣、愿意尝试，并且最终能够帮助大家得到自己想要的效果的工具。

但另一方面，出于时间精力，我没有办法保证自己始终有时间投入其上，使其成为一个稳定、生产可用的项目。
我只得扪心自问，并兀自猜想其到那一腔热血冷却的时候，它可以成长为什么样。
而我是否在此期间又与其他的冒险故事相逢，再次将那腔热血激荡。

但姑且容我在此进行一番畅想。

:::

一些初期的想法：[ADV 游戏引擎计划 | 云游君的小站](https://www.yunyoujun.cn/posts/make-an-avg-engine/)

后续我希望它的子模块生态也逐渐完善。

## NPM 模块

- advjs: 核心模块（包含必要的 CLI / 辅助工具 / 解析模块）
  - @advjs/core: 核心函数
  - @advjs/parser: 剧本解析器
  - @advjs/client: 默认视图内容
  - @advjs/types: 类型定义
- create-adv 模版脚手架 CLI
- ADV.JS 插件
  - @advjs/plugin-babylon: Babylon 插件
  - @advjs/plugin-live2d: Live2D 插件
- ADV.JS 主题
  - @advjs/theme-default: 默认主题

## 插件

- @advjs/vscode: VSCode 插件（ADV 语法高亮与提示）
- @advjs/unocss: 自定义的 CSS Presets

## 编辑器

- @advjs/vrm: VRM 模型在线编辑器
- @advjs/editor: Tauri 打包的客户端编辑器

## 其他

- @advjs/benchmarks: Benchmarks 性能对比实验
- @advjs/examples: 示例
