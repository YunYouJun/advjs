# Editor 剧本插入与模型预览验证

日期：2026-10-08。状态：工作区实现与本地回归通过。范围为「创建对白／选项」空菜单处理和独立模型预览页；使用方法见 [剧本编辑器](../guide/editor/script) 与 [模型预览](../guide/editor/basic#模型预览)。

## 实现与验收

- 对白／选项通过内置核心插件注册命令，Web 菜单与文件面板操作共用启用条件。没有可编辑章节、文件正在加载或 Monaco 尚未就绪时禁用。编辑器销毁后解除绑定，等待中的插入也不会操作已销毁实例。
- 插入使用 Monaco 编辑记录，在光标或选区处生成独立 Markdown 块，选中角色名或首个选项文字，保留草稿及原文件换行格式。菜单关闭后焦点回到源码；从阅读模式或游戏标签执行菜单操作，会返回当前剧本源码。模板仍需作者填写角色与选项逻辑。
- Chromium 真实页面验证新增草稿、对白插入、撤销与重做，以及从隐藏的阅读视图通过菜单插入选项后立即撤销。磁盘内容在点击保存前保持原样，保存后与草稿一致；切换到普通 Markdown 文件后命令禁用。
- 模型页延迟注册 `model-viewer`，支持显式格式和扩展名推断。GLB 只渲染模型；glTF 同时提供只读 JSON。查询值由路由解码一次，保留模型 URL 内已有的编码与签名参数。
- 模型与源码分别显示加载／错误状态，支持重试。针对 model-viewer 4 的失败缓存，重试只清除当前源地址的缓存；上游空模型在清理时没有可释放的场景，不影响重新请求。源码请求在地址变化或作用域销毁时取消，旧导入、响应与模型事件不更新新状态。
- Chromium 使用临时生成的真实三角形 GLB／glTF 验证渲染、503 失败后的成功重试、编码 URL 保持、GLB 每次尝试只有一个模型请求、glTF 源码、空文件与不支持的格式。正常宽度双栏、320px 上下布局和亮色模式均已查看截图，无面板横向溢出；刷新后仍可加载模型和源码。

## 环境与检查

macOS arm64，Node.js 24.18.0，pnpm 11.20.0，Playwright Chromium，Electron 44.4.5。每个新增浏览器用例使用独立临时项目与本地桥接服务，避免保存的模板影响另一用例。

| 检查                         | 结果                |
| ---------------------------- | ------------------- |
| 作者工具、插件与资源面板单测 | 3 个文件、41 项通过 |
| Chromium 新增作者工具用例    | 2 项通过            |
| Chromium 保留视图回归        | 1 项通过            |
| Electron 实时预览回归        | 1 项通过            |
| 全仓与 Editor 类型检查       | 通过                |
| 修改范围 ESLint、空白检查    | 通过                |
| Editor 生产构建              | 通过                |
| 文档检查与构建               | 通过                |

```bash
pnpm exec vitest run tests/unit/editor/editor-authoring-tools.test.ts tests/unit/editor/editor-ui-plugins.test.ts tests/unit/editor/editor-resource-panels.test.ts
pnpm typecheck
pnpm --filter @advjs/editor typecheck
pnpm --filter @advjs/editor build
pnpm exec playwright test tests/e2e/editor-authoring-tools.spec.ts tests/e2e/editor-retained-views.spec.ts --project=chromium
pnpm -C apps/desktop exec playwright test test/live-preview.spec.ts --reporter=list
pnpm docs:check
pnpm docs:build
```

本次浏览器回归使用仓库外的临时 Playwright 配置，仅运行上述三个用例，由用例创建桥接服务。上方根命令也会启动仓库默认 E2E 服务。截图、配置和检查日志保存在 `/Users/yunyou/.codex/desktop-advjs-artifacts-20261008/authoring-tools/`。

## 验证边界

模型入口为独立 `/preview` 页面，本轮没有增加项目文件树中模型资源的加载适配，也没有实现章节／场景／世界观创建。浏览器手势与外部纹理服务的跨域设置未逐项测试，实际渲染使用本地生成模型；请求竞态、HTTP／JSON 错误和渲染器注册失败由单测覆盖。

本轮未提交改动、重新打包或更新已安装的桌面应用；未运行 Firefox／WebKit、Windows／Linux 或整套发行回归。
