# Editor 内容创建验收

日期：2026-10-09。状态：工作区实现与本地验收通过。范围为 Web Editor 和 macOS 原生「故事 → 创建 → 世界观／场景／章节」。验收合同见[实施计划](../plans/2026-10-09-editor-content-creation)，使用方式见[剧本编辑器](../guide/editor/script#创建世界观场景与章节)。

## 实现与行为

- 三个入口共用核心插件命令、创建状态和 AGUI 表单。原生菜单只增加有限动作，调用同一命令；没有增加原生文件系统、任意脚本或公共插件写入接口。
- 创建遵循编译后的内容根目录；世界观已存在时打开原文件。标识符、标题、保留名称、重复 ID、大小写等效路径与嵌套章节 ID 均经过检查。模板使用安全的 YAML／Markdown 文本转义。
- 显式 JSON 章节列表追加新章节，保留原列表、入口和未知字段。自动发现项目在需要时固定原入口；中文文件名或目录产生的推断 ID 会先固定映射，避免新文件排序改变已有章节与跳转。
- 加载器通过 `virtualFiles` 标明可执行配置的 JSON 投影及静态分析合并内容；创建规划器拒绝修改这些投影。编辑器文件列表包含虚拟路径，因此不能仅凭列表判断配置可写。
- 写入使用 ProjectWorkspace 的预期内容检查；浏览器契约验证了成功编译、外部冲突拒绝、第二文件失败后的回滚与重试。没有把该接口宣称为通用跨文件原子事务。
- 未保存源码、角色表单草稿和文件加载状态阻止创建及跳转。写入成功但打开失败时只重试打开；切换项目后的迟到结果不能操作新项目。成功后打开源码，从角色路由创建也会回到主工作区。

## 环境与检查

macOS arm64，Node.js 24.18.0，pnpm 11.20.0，Playwright Chromium，Electron 44.4.5。浏览器和原生用例使用独立临时项目与应用数据，清理后不保留测试创作内容。

| 检查                                                | 结果      |
| --------------------------------------------------- | --------- |
| 规划器、生命周期、加载器、插件与文件 workspace 单测 | 99 项通过 |
| 原生菜单有限命令、中英文及空项目禁用单测            | 4 项通过  |
| Chromium 内容创建与作者工具回归                     | 7 项通过  |
| Electron 原生创建与角色草稿保护                     | 1 项通过  |
| 全仓与 Editor 类型检查                              | 通过      |
| Editor 构建与完整桌面构建                           | 通过      |
| 修改范围 ESLint 与空白检查                          | 通过      |
| 文档检查与构建                                      | 通过      |

```bash
pnpm exec vitest run tests/unit/editor/editor-content-creation.test.ts tests/unit/editor/editor-content-creation-lifecycle.test.ts tests/unit/runtime/runtime-project-loader.test.ts tests/unit/editor/editor-ui-plugins.test.ts tests/unit/editor/editor-file-workspace.test.ts tests/unit/editor/editor-workspace.test.ts tests/unit/desktop/desktop-menu.test.ts
pnpm typecheck
pnpm --filter @advjs/editor typecheck
pnpm --filter @advjs/editor build
pnpm desktop:build
pnpm exec playwright test tests/e2e/editor-content-creation.spec.ts tests/e2e/editor-authoring-tools.spec.ts --project=chromium
pnpm -C apps/desktop exec playwright test test/content-creation.spec.ts --reporter=list
pnpm docs:check
pnpm docs:build
```

本次 Chromium 实际使用仓库外临时配置，仅运行上述两个 suite，由各用例创建桥接服务；根命令还会启动默认 E2E 服务。配置、检查日志和浏览器截图位于 `/Users/yunyou/.codex/desktop-advjs-artifacts-20261009/content-creation/`；Electron 截图位于 `apps/desktop/test-results/`。

已查看 1440px 正常窗口与 320px 视口下的亮暗对话框，以及英文键盘操作截图。名称、帮助文本和路径可换行，无横向溢出；Enter 创建和 Escape 取消通过。窄视口菜单使用键盘进入子菜单，避免跨越翻转子菜单时触发悬停关闭；宽窗口鼠标入口也经过英文用例验证。

## 验证边界

本次未提交、打包发行或更新已安装的桌面应用；原生验收运行仓库构建后的 Electron 应用。未运行 Firefox／WebKit、Windows／Linux 或整套发行门禁。

音乐创建、统一 AudioEngine 与 AI 配音仍按[音频计划](../plans/2026-08-12-audio-system-implementation)推进。本次不改写可执行配置源码，也不生成场景背景或自动补齐资源。
