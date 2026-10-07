# Slider 封装验收

日期：2026-10-08。状态：已验证。范围：游戏 `AdvSlider`、编辑器 `AGUISlider`，以及打包后的 Editor 游戏设置页。

两套组件均使用 Reka UI 的 `SliderRoot`、`SliderTrack`、`SliderRange` 与 `SliderThumb`，在组件内部将数组模型转换为原有的单数值 `v-model`。`input` 事件与数字输入框接口保留。外部标签、描述与 ID 关联到可聚焦的滑块按钮，禁用状态同时覆盖滑块与数字输入。

样式分别遵循[游戏 UI 契约](/about/design/game-ui)和 [AGUI 设计规范](/agui/design)。编辑器控件高 24px，游戏设置控件高 36px；游戏颜色和圆角使用游戏主题变量。默认主题与 Pominis 共用游戏 Slider 样式。滑块使用 `overflow` 对齐并在布局中预留半个滑块的边距，保证指针拖动与端点位置一致。

## 验证结果

- 15 个相关单元测试通过：单数值事件、受控值更新、标签描述、方向键与 Home/End、数字边界、空值恢复，以及禁用时阻止更新。
- 6 个 Chromium 浏览器测试通过：两套 Slider 的真实点击与拖动、数字输入同步、1000px 与 320px 布局、亮暗模式及游戏主题隔离，以及原有游戏界面回归。
- 1 个打包后 Electron 测试通过：真实内嵌游戏预览中的键盘操作、数字输入与跨页签状态保留；320px 面板没有横向溢出，四个页签和顶部工具保持可见。
- 相关 Vue 组件类型检查、定向 ESLint 与差异空白检查通过。
- 桌面包已重新构建，游戏运行时源文件和编辑器编译产物均包含新的 Reka Slider。
- 已备份并更新本机安装的 Editor，重新打开已保存项目并在实际音频设置页确认新滑块与数字输入框；项目配置文件校验值保持不变。

单元测试中的 `ResizeObserver` 替身只用于 jsdom。浏览器与 Electron 测试使用真实布局和原生观察器。

## 复现命令

```bash
pnpm exec vitest run tests/unit/slider-controls.test.ts tests/unit/game-settings-controls.test.ts tests/unit/agui-controls.test.ts
pnpm exec playwright test game-ui.spec.ts sliders.spec.ts --project=chromium
pnpm desktop:package
ADVJS_DESKTOP_EXECUTABLE="$PWD/apps/desktop/out/ADV.JS Editor-darwin-arm64/ADV.JS Editor.app/Contents/MacOS/advjs-editor" pnpm exec playwright test --config apps/desktop/playwright.config.ts game-settings.spec.ts
```

以上打包路径适用于 macOS arm64；其他平台使用相应产物。设置页布局的验收记录见[游戏设置页预览验收](./game-settings-preview)。
