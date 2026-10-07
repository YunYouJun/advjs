# @advjs/devtools

基于 [Devframe](https://devfra.me) 的 ADV.JS 开发调试工具。默认接入 `adv` 开发服务器，面板包含运行时状态、变量、舞台、当前节点、最近 100 条剧情追踪、资源清单和编译／运行时诊断。

JSON 视图通过宿主共享的 Devframe Shiki service 高亮，使用 AGUI 语法色。面板可从游戏内浮层弹出为独立窗口，并保留会话、视图、主题与实时连接。

使用方式、独立 Vite 接入和 Devframe Hub 定义见[DevTools 指南](../../docs/guide/runtime/devtools.md)。

## 开发

```bash
pnpm devtools:build
pnpm -C packages/devtools typecheck
pnpm exec vitest run tests/unit/devtools*.test.ts
```

构建先用 unbuild 生成 Node 入口和类型，再用 Vite 生成 `dist/client` 中的面板及开发环境启动脚本。发布包包含完整静态资源，不依赖源码目录。
