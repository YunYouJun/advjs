# 开发

介绍开发过程中的相关内容。如果您想要参与开发，也许这会对你有所帮助。

## 参考

### [slidev](https://github.com/slidevjs/slidev)

我发现 Slidev 的使用方式和我设想的方案有所接近，我希望扩展 Markdown 语法使得用户能够通过 Markdown 来快速实现自己的剧本展示。

而用户如果有着更高的定制需求，则完全可以插入 Vue 组件来实现任意程度的扩展。

项目本身可通过 npm 包发布，提供默认的主题，并允许用户以布局/API 的形式进行 UI 的自定义。

### [Doki Doki Literature Club! | 心跳文学部](https://zh.wikipedia.org/wiki/%E5%BF%83%E8%B7%B3%E6%96%87%E5%AD%B8%E9%83%A8%EF%BC%81)

心跳文学部也是我喜欢的一部作品，同时其使用 [renpy](https://www.renpy.org/)，也是个人制作游戏的一个典范。

一些 UI 逻辑和设计流程主要参考了它。

## FAQ

### Fetch or axios

面向未来，不如直接试试 [Fetch API](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API)？

关于是否使用 fetch，此前有一个比较著名的帖子。[传统 Ajax 已死，Fetch 永生](https://github.com/camsong/blog/issues/2)。

实际上，文中的观点现在来看，已有些过时，因为他与 fetch 进行对比的是原生的 XHR 及其在 jQuery 中的用法。
文中提出的问题其实在 [axios](https://github.com/axios/axios) 的封装下与 `async/await` 的流行后，已经不再是问题。

当然，毫无疑问，fetch 这一原生 API 要更为轻量，缺点则是其缺乏进一步封装处理的 API（比如错误处理拦截等等），无法像 axios 那样简单易用。（ES 兼容问题，则非本项目打算考虑的。）

而让我自行封装使用，自然没有这个信心能一直维护下去。

后来我发现了 [umi-request](https://github.com/umijs/umi-request) 这个库，为 [ant-design-pro](https://github.com/ant-design/ant-design-pro/) 所集成，它基于 fetch 进行封装，能够独立使用。

不过我又发现了 [ohmyfetch](https://github.com/unjs/ohmyfetch)（作者也是 Nuxt.js 作者），相比纯 js 写就的 umi-request，ohmyfetch 由 TypeScript 构建，有着更好的类型提示。

考虑到项目本身基于 Vue 而非 React，使用了 TypeScript，而我是 Nuxt 用户而非 Umi/Ant Design 用户，我更倾向于使用 ohmyfetch。

并基于此来实现实时的相关资源请求。

### 为什么不用 GitHub Pages

目前已经有了很多第三方静态站点托管平台。

- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [Pages | Cloudflare](https://pages.cloudflare.com/)

本项目我使用 monorepo 的方式进行组织，这意味着项目中日后可能会有相互独立的站点。
GitHub Pages 固然方便，但相对它们也有一些缺点。

- 单个项目的 GitHub Pages 往往只能托管在一个 gh-pages 分支上
- 且需要自定义 CNAME 其他灵活性相对不如第三方托管站点
- 且 gh-pages 分支也会触发 vercel 等的自动构建，最后显示一个红 ❌

故我决定移除 gh-pages 分支，仅采用第三方托管平台。
