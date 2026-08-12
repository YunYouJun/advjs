# Demo 与 Examples

仓库中的 `examples/` 和 `demo/` 服务于不同目标。

## 三个层级

| 位置           | 适合解决的问题                                     | 稳定性角色                     |
| -------------- | -------------------------------------------------- | ------------------------------ |
| `examples/`    | 某个 API、语法、插件或创作场景怎样单独使用？       | 聚焦样例，可只覆盖一个切面     |
| `demo/starter` | 一份最小 ADV.JS 完整项目需要哪些文件？             | 默认开发服务器与快速浏览器回归 |
| `demo/hamster` | 引擎的多章节、状态、活动、素材和调试能力如何协同？ | 旗舰展示与端到端回归夹具       |

因此，可复制的完整项目放在 `demo/`；只为说明某一能力的短代码或专门场景放在 `examples/`。`demo/starter` 刻意不依赖可选活动插件，`demo/hamster` 则尽可能组合现有稳定能力。

## 运行与构建

在仓库根目录执行：

```bash
pnpm demo
pnpm build:demo

pnpm demo:hamster
pnpm build:demo:hamster
pnpm -C demo/hamster build:singlefile
```

starter 保持一个章节、一名角色和一个本地 SVG 背景。仓鼠 Demo 将来源内容整理为一条无缝的 16 章完整航线，通关后解锁世界内的“回声演算”。它集成稳定选择 ID、条件与动作、跨章导航、双层背景转场、立绘槽位与逐帧动画、8 张 CG 画廊、8 首可循环 BGM、星图与文明互动、自定义标题/设置 UI，以及完整的 Studio 诊断链路。

## Studio 元数据边界

CLI/Vite 在本地受信任项目中加载 `adv.config.ts`，所以配置可以导入 TypeScript 插件。Studio 面向可能来自导入包或浏览器存储的项目，不会执行任意配置代码；它读取 `adv/settings/game.json` 中的纯 JSON 标题、变量、跨周目进度、CG 画廊和必需插件，再仅运行 Studio 明确允许的插件。

仓鼠 Demo 让 `adv.config.ts` 直接导入同一份 `game.json`，避免两套变量和插件版本发生漂移。

## 内容来源

仓鼠故事改编自 YunYouJun 的《[仓鼠](https://www.yunyoujun.cn/posts/hamster)》与《[仓生（普通仓鼠）](https://www.yunyoujun.cn/posts/the-common-hamster)》。故事、生成美术和生成音频的许可与软件 MPL-2.0 许可彼此独立，复用前请阅读 `demo/hamster/LICENSE.content.md` 与 `demo/hamster/ASSETS.md`。
