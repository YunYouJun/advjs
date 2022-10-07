# FAQ

## Fetch or axios

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

## 为什么不用 GitHub Pages

目前已经有了很多第三方静态站点托管平台。

- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [Pages | Cloudflare](https://pages.cloudflare.com/)

本项目我使用 monorepo 的方式进行组织，这意味着项目中日后可能会有相互独立的站点。
GitHub Pages 固然方便，但相对它们也有一些缺点。

- 单个项目的 GitHub Pages 往往只能托管在一个 gh-pages 分支上
- 且需要自定义 CNAME 其他灵活性相对不如第三方托管站点
- CDN 速度慢于 Vercel/Netlify/Cloudflare

故我决定移除 gh-pages 分支，仅采用第三方托管平台。

- 首页（文档）：托管与 Vercel（托管于 Netlify 站点国内用户无法访问）
- demo 托管于 Cloudflare Pages：尚未支持 monorepo 部署，一个站点只能一个 Pages

## tsup@5

> Now, has upgraded to tsup@6.

Lock tsup@5 to fix esm build shim.

## build:demo error

```bash
/@advjs/drama.adv.md?vue&type=script&setup=true&lang.ts:1:8: ERROR: Expected ">" but found "setup"
```

- Env `dev` is work. (`pnpm run demo`)
- Build works when vite@2.

Seems to be related with <https://github.com/vuejs/core/issues/5830>.
