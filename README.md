# ADV.JS

[![ADV.JS CI](https://github.com/YunYouJun/advjs/workflows/ADV.JS%20CI/badge.svg)](https://github.com/YunYouJun/advjs/actions)

- Preview: [advjs.org](https://advjs.org)

面向未来与前端的 ADV 文字冒险游戏引擎。基于 Vue3 + Vite + TypeScript。Deving...

> 像写小说一样制作 ADV，愿能在未来的冒险中，与你相遇。
> [进度（咕咕咕）一览](https://www.yunyoujun.cn/posts/make-an-avg-engine/)

## docs | 文档

还很简易，日后再整理。

## MonoRepo

目前使用 monorepo 的方式进行管理。

计划的施工模块。

### [@advjs/create-app](./packages/create-app) 脚手架

生成基础的 ADV 项目脚手架

### [@advjs/parser](./packages/parser) | 剧本解析器

目标是使用 markdown 及扩展语法进行脚本的编写。

计划从 marked 迁移至 markdown-it

### [@advjs/editor](./packages/editor) 编辑器

可在线编辑脚本的编辑器。

### [@advjs/vscode](./packages/vscode) VSCode 插件

实现 VS Code 中对 `.adv.md` 文件的语法高亮与提示。
