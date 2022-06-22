# ADV.JS

[![ADV.JS CI](https://github.com/YunYouJun/advjs/workflows/ADV.JS%20CI/badge.svg)](https://github.com/YunYouJun/advjs/actions)

- Docs: [advjs.org](https://advjs.org)
- Demo(WIP): [demo.advjs.org](https://demo.advjs.org)

面向未来与前端的 ADV 文字冒险游戏引擎。基于 Vue3 + Vite + TypeScript。Deving...

> 像写小说一样制作 ADV，愿能在未来的冒险中，与你相遇。
> [进度（咕咕咕）一览](https://www.yunyoujun.cn/posts/make-an-avg-engine/)

## docs | 文档

[![GitHub deployments](https://img.shields.io/github/deployments/YunYouJun/advjs/Production%20%E2%80%93%20advjs?label=vercel&logo=vercel&logoColor=white)](https://github.com/YunYouJun/advjs/deployments/activity_log?environment=Production+%E2%80%93+advjs)

- [ADV.JS 首页](https://advjs.org)

## MonoRepo

目前使用 monorepo 的方式进行管理。

计划的施工模块。

### [advjs](./packages/advjs) 核心模块

- 状态：开发中
- 包括默认的 UI 样式与解析文本生成演出内容
- Todo: 划分 `@advjs/theme-default` 与 `@advjs/core`

### [create-adv](./packages/create-adv) 脚手架

- 状态：Todo
- 目标：生成基础的 ADV 项目脚手架

### [@advjs/parser](./packages/parser) | 剧本解析器

- 状态：开发中
- 目标：使用 markdown 及扩展语法进行脚本的编写。语法树基于 [unified](https://github.com/unifiedjs/unified) 与 [remark](https://github.com/remarkjs/remark)实现。

### [@advjs/editor](./packages/editor) 编辑器

[![GitHub deployments](https://img.shields.io/github/deployments/YunYouJun/advjs/Production%20%E2%80%93%20advjs-editor?label=vercel&logo=vercel&logoColor=white)](https://github.com/YunYouJun/advjs/deployments/activity_log?environment=Production+%E2%80%93+advjs-editor)

- Demo: <https://editor.advjs.org>
- 目标：可在线编辑脚本的编辑器。（后续会有更多的功能吗？）
- 当前：编辑 Markdown 并在线预览解析的语法树（基于 @advjs/parser）

### [@advjs/vscode](./packages/vscode) VSCode 插件

- 状态：Todo
- 目标：实现 VS Code 中对 `.adv.md` 文件的语法高亮与提示。

### [@advjs/plugin-vite](./packages/plugin-vite) Vite Adv 插件

- 功能：支持 Vite，可预先对 `.adv`, `.adv.md` 结尾的文件进行转译以便预编译。

### [@advjs/vrm](./packages/vrm) VRM 模型在线编辑器

[![Netlify Status](https://api.netlify.com/api/v1/badges/33595ad5-4006-460e-a826-d7fd98a20638/deploy-status)](https://app.netlify.com/sites/gallant-goodall-b4101f/deploys)

- Demo: <https://vrm.advjs.org>
- 功能：可用于 VRM 模型动作、表情的在线编辑

## FAQ

### 为什么我打开示例，却一片空白！

因为 ADV 和广告（advertisement）的缩写很像，而本站点开发的类名都在 `adv` 命名空间下，所以页面会被 AdBlock 之类的广告屏蔽插件给屏蔽掉。

快关闭本页面的广告拦截以正常显示本页面吧！

> 等待

## Thanks

- [vue](https://github.com/vuejs/core)
- [vite](https://github.com/vitejs/vite)
- [slidev](https://github.com/slidevjs/slidev)
