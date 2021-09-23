# 开发规范

## 版本号

遵循 [语义化版本](https://semver.org/lang/zh-CN/)

## FAQ

### Fetch or axios

面向未来，不如直接试试 [fetch](https://cn.vuejs.org/v2/cookbook/using-axios-to-consume-apis.html#Fetch-API)。

> 当然最后可能还是回到封装兼容完善的 [axios](https://github.com/axios/axios) 上来。

- [ohmyfetch](https://github.com/unjs/ohmyfetch)

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
