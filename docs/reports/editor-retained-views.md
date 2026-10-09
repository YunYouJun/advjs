# Editor 保留视图生命周期验证

日期：2026-10-08。状态：工作区实现与本地回归通过。范围为 [UI 插件实施计划 M3](../plans/2026-10-05-editor-ui-plugins#M3：区域宿主与内置视图适配) 中的游戏／流程图实例保留、隐藏恢复和资源清理。

## 实现与验证结果

- 保留视图首次选中才加载，切换标签保持实例与局部状态并更新 `visible`；普通视图仍卸载。插件停用与区域销毁释放保留实例，组件测试覆盖加载次数、状态保留、可见性和最终卸载。
- 浏览器预览立即建立文件时间戳基线，隐藏时停止轮询，返回时立即检查。修改、新增、删除和初始空目录均可识别；隐藏、切换项目及卸载后的旧请求不写回。扫描不重叠，权限错误保留最后有效基线，关闭项目清除提示。文件句柄竞态使用模拟 File System Access API 的单测验证。
- 预览日志转发使用 Consola reporter，视图销毁时移除并恢复日志级别。连续重挂载不重复转发，也不替换全局日志函数。
- Vue Flow 渲染实例由视图作用域创建与释放，Pinia 仅保存图数据。切换标签保留缩放／平移，隐藏时移除小地图；布局取景等待新节点尺寸就绪，隐藏或销毁后不执行迟到的取景操作。
- Chromium 在真实 Editor 生产页面中执行三轮游戏／流程图切换，以 DOM 标记和变换值确认实例与视口保持。隐藏时调整主面板到 320px，再返回执行垂直布局，节点实际可见且无横向溢出；亮色模式执行水平布局。离开工作区后，流程图关联的 ResizeObserver 观察目标为零；返回后产生新的 Vue Flow 标识，布局操作仍可用。项目无编译诊断，页面无运行错误或框架错误层。
- Electron 原生呈现单测覆盖同一玩家跨内嵌／独立窗口保留、隐藏静音、返回恢复、关闭独立窗口回到 Editor、幂等释放及宿主监听清理。既有 Electron 实时预览综合流程通过，覆盖保存更新、编译错误恢复、移动同一玩家及停止服务。

## 环境与检查

macOS arm64，Node.js 24.18.0，pnpm 11.20.0，Electron 44.4.5。浏览器使用 Playwright Chromium，桌面回归使用开发宿主与当前 Editor 构建；测试项目均位于系统临时目录。

| 检查                                   | 结果                |
| -------------------------------------- | ------------------- |
| 保留视图、轮询、日志与原生呈现专项单测 | 3 个文件、32 项通过 |
| 全仓与 Editor 类型检查                 | 通过                |
| 修改范围 ESLint 与 Git 空白检查        | 通过                |
| Editor 生产构建                        | 通过                |
| Chromium 保留视图端到端                | 1 项通过            |
| Electron 实时预览端到端                | 1 项通过            |
| 文档检查与构建                         | 通过                |

```bash
pnpm exec vitest run tests/unit/editor/editor-preview-lifecycle.test.ts tests/unit/editor/editor-ui-plugins.test.ts tests/unit/desktop/desktop-preview-presentation.test.ts
pnpm typecheck
pnpm --filter @advjs/editor typecheck
pnpm --filter @advjs/editor build
pnpm exec playwright test tests/e2e/editor-retained-views.spec.ts --project=chromium
pnpm -C apps/desktop exec playwright test test/live-preview.spec.ts --reporter=list
pnpm docs:check
pnpm docs:build
```

本次 Chromium 使用仓库外的临时 Playwright 配置，只启动保留视图用例，由用例自行创建本地项目桥接服务；上方根命令也会启动仓库默认 E2E 服务。测试源文件位于 `tests/e2e/editor-retained-views.spec.ts`。截图、构建／单测日志及本次临时配置保存于 `/Users/yunyou/.codex/desktop-advjs-artifacts-20261008/retained-views/`。已查看正常／320px 暗色流程图、亮色工作区与原生预览截图。

## 验证边界

本轮未重新打包或更新已安装的桌面应用，未执行 Windows／Linux、Firefox／WebKit 或整套发行回归。浏览器文件句柄的权限与迟到请求场景由单测覆盖；原生保存与服务清理由真实 Electron 流程覆盖。流程图仍使用既有示例图数据，本轮不增加项目剧情到流程图的映射。
