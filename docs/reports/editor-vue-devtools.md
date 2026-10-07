# 编辑器 Vue DevTools 开关验证

状态：2026-10-08，macOS arm64 开发宿主验证通过；现有安装版未重新打包或替换。

「游戏」工具栏提供 Vue DevTools 开关，默认关闭。选择保存于编辑器偏好，不改写项目配置；切换会重新运行当前实时预览并重置游戏进度。构建预览下禁用，生产构建不包含调试工具。编辑器只显式开启 Vue 调试，ADV.JS 运行时面板继续关闭。

## 验证

- 引擎、Editor 生产构建与桌面宿主构建通过；修改范围 ESLint 和差异空白检查通过。
- 11 项相关单元／Vite 集成测试通过，覆盖默认开关、宿主覆盖项目配置、各工具独立控制、生产构建排除和预览显示参数。
- `apps/desktop/test/vue-devtools.spec.ts` 的真实桌面流程通过：默认无浮动条，开启后入口和 iframe 面板可用，关闭后移除插件入口，重启应用恢复选择，空格键切换，构建模式禁用，以及项目配置保持原内容。
- 正常宽度与 320px 面板截图检查通过；开关与既有工具栏共用 AGUI，窄面板换行且无横向溢出。截图由上述用例生成，分别为 `vue-devtools-wide.png` 和 `vue-devtools-narrow.png`。

复验：`pnpm -C apps/desktop exec playwright test --config playwright.config.ts vue-devtools.spec.ts --workers=1`。需先构建引擎、Editor 与桌面宿主。

全量 Editor 应用类型检查未通过，共 120 项错误，主要涉及已有文件句柄声明和空值检查；本次新增开关的组件、composable 与宿主接口声明没有类型错误。桌面宿主自身的类型检查通过。Windows、Linux 与打包安装版尚未验证。
