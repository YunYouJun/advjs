# Editor 人物头像验证记录

日期：2026-10-07。状态：源码修复和本地验证完成。范围：桌面 Editor 的人物列表、缩略图视图与人物属性检查器。

人物头像现在通过项目资源接口读取，游戏配置中的 `/img/...` 映射到项目的 `public/img/...`。列表和检查器共用 `CharacterAvatar`，采用 28×28px 的头像框并按原比例完整显示；缩略图视图保留 80px 高的预览区。缺图或解码失败显示占位图标，切换角色、更新资源和卸载时处理过期读取与临时 URL 回收。

## 环境与交互

- macOS、本地 Electron 开发宿主，Node.js 24.18.0、pnpm 11.20.0。
- Editor 本地生产构建，动态地址 `http://127.0.0.1:<port>/`，页面标题为 `ADV.JS Editor`。
- Browser 插件不可用（Browser plugin not available），使用仓库已有 Playwright/Electron 测试。
- 1440×900、100% 缩放；左侧人物和右侧检查器分别固定为 320px 检查窄面板，覆盖亮暗主题以及长中文、英文名称。
- 从临时项目打开「人物」，通过 Enter 选中角色，确认列表与检查器加载本地 WebP；切换缩略图和列表，刷新切换亮色主题，外部修改头像为缺失路径后恢复原路径。
- 测试仅使用临时项目和独立应用数据；未改动用户项目。

## 验证结果

| 检查             | 结果与证据                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| 页面身份         | 本地地址、页面标题和 Editor 布局均符合预期                                                     |
| 非空页面         | 人物列表、属性面板和实际本地图片正常渲染                                                       |
| 框架错误覆盖层   | 无 Vite 错误覆盖层                                                                             |
| 控制台与运行错误 | 正常图片流程没有 console error，全流程没有 pageerror；主动使用缺失路径时的资源请求失败属于预期 |
| 图片尺寸与加载   | 两处头像均为 28×28，真实图片 `naturalWidth > 0`，资源地址为 Blob URL，`object-fit: contain`    |
| 缩略图模式       | 图片高度为 80px，保持完整比例且不超出预览区                                                    |
| 截图与窄布局     | 正常和 320px 面板、亮暗主题均已截图；长名称无横向溢出                                          |
| 交互与恢复       | Enter 选中、视图切换、刷新、缺失资源占位及恢复图片均通过                                       |
| 单元测试         | 2 个文件、19 项通过，覆盖路径映射、异步读取竞争、资源刷新、失败占位和 URL 生命周期             |
| 构建与 lint      | 本地 Editor 构建与变更文件 ESLint 均通过                                                       |

截图由测试写入 `apps/desktop/test-results/panels-desktop-character-a-e35f4-nsistent-compact-dimensions/`：`avatars-dark-desktop.png`、`avatars-dark-narrow.png`、`avatars-light-desktop.png`、`avatars-light-narrow.png`。`avatars-summary.png` 与 `avatars-narrow-summary.png` 展示两处头像的顶部区域。这些是本地测试产物，重新运行 Playwright 时会被更新。

## 复现命令

```bash
ADVJS_EDITOR_MODE=local pnpm -C editor/core build
pnpm exec vitest run tests/unit/editor-resource-panels.test.ts tests/unit/editor-file-workspace.test.ts
pnpm -C apps/desktop exec playwright test --config playwright.config.ts panels.spec.ts --grep 'character avatars'
```

变更文件已运行 ESLint，包含头像组件、人物卡片与详情、项目资源映射、单元测试和桌面测试。

## 验证边界

本次完成源码与 Editor 构建验证，未重新打包或替换 `/Applications/ADV.JS Editor.app`。已安装客户端需要更新桌面包才能获得修改。

未运行全仓库测试、200% 缩放、其他操作系统或远程媒体实机测试；独立 URL 与调用方持有的 Blob URL 由单元测试覆盖。立绘导入表单与游戏预览不属于本次头像修复范围。
