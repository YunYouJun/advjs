# Studio 原生设计规范（iPhone／iPad）

本页定义 SwiftUI 原生 Studio（`apps/studio-ios`）的界面规则。总分层见 [ADV.JS 设计体系](./design-system)；Web／PWA 版 Studio 的 Ionic 实现遵循 [Studio 设计规范](./studio-design) 与 [Studio 组件规范](./studio-components)；App 内的游戏试玩画面遵循 [游戏 UI 规范](./game-ui)。实施范围与验收见[原生 App 实施计划](/plans/2026-10-21-studio-native-ios)。

## 与 Web 版 Studio 的关系

两个 Studio 共享产品语言，不共享控件外观：

| 共享                                                                 | 各自独立                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 功能清单、术语（中英文用词与 `apps/studio/src/i18n/locales` 一致）   | 控件：原生端只用 SwiftUI 与系统组件，不模仿 Ionic 卡片、按钮或页签           |
| 品牌色值（深紫 `#7c3aed`、冒险金 `#f59e0b`）及其语义                 | 字体、字号、间距、圆角、材质与动效：原生端完全跟随系统                       |
| 项目格式与引擎（`@advjs/parser`、`@advjs/core/project`，见设计规格） | 布局：iPhone 用标签栏，iPad 用三栏 `NavigationSplitView`，Web 用移动优先页面 |

不要把 Web 版的渐变、阴影、自绘卡片移植到原生端；也不要把原生端的系统行为反向要求 Web 版实现。

## 系统组件优先

- 导航：iPhone 用 `TabView`（`Tab` API），iPad 常规宽度用 `NavigationSplitView`（项目 → 分区 → 内容）。窄窗口（分屏、台前调度小窗）回到标签栏布局。
- 列表与表单：`List`、`Form`、`LabeledContent`、`Picker`、`swipeActions`、`contextMenu`；破坏性操作用 `role: .destructive`，永久删除前用 `confirmationDialog`。
- 空状态与错误：`ContentUnavailableView`，给出下一步操作；错误信息说明原因和办法，不显示原始异常。
- 系统集成：导入用 `fileImporter`，导出用分享面板与 `fileMover`，隐私政策用 `SFSafariViewController`，语言跳转系统「设置」中本 App 的页面。
- 不自绘系统已有的控件（开关、分段控件、搜索框、工具栏、菜单）。新组件放在 `StudioUI` 包，先确认系统组件无法满足。

## 品牌表达

品牌只通过颜色与资产体现：

- **强调色**：Asset Catalog 的 `AccentColor`（浅色 `#7c3aed`，深色 `#a78bfa`）是全 App 的 tint；代码中用 `StudioTheme.purple`。
- **冒险金**：`StudioTheme.gold`（浅色 `#d97706`，深色 `#fbbf24`）只用于标记、星标与「需要注意」的状态，不用于正文和大面积背景。
- **语义色**：成功、危险使用 `StudioTheme.success`、`StudioTheme.danger`；状态同时用图标或文字表达，不只靠颜色。
- **图标与插画**：App 图标沿用 Studio 品牌图标；空状态使用 SF Symbols，品牌插画只在首次使用等少数场景出现。

## 文字、动态字体与本地化

- 只用系统文字样式（`.body`、`.headline`、`.caption` 等），不写死字号；所有布局在辅助功能字号下可滚动、不截断关键信息。
- 用户可见字符串写在 String Catalog（`StudioApp/Localizable.xcstrings`），源语言英文，提供简体中文；键使用英文原文，术语与 Web 版语言包一致。
- 语言跟随系统的「App 语言」设置，App 内「我的 → 语言」直接打开系统设置中本 App 的页面，不在 App 内另设切换。
- 日期、时间、数字、文件大小一律用 `FormatStyle`（如 `.relative`、`.number`、`.byteCount`），跟随用户地区，不手工拼接格式。

## 动效与触感反馈

- 使用系统默认转场与 `withAnimation`；列表增删、状态切换用系统动画，不添加装饰性动画。开启「减弱动态效果」时不出现位移动画。
- 触感反馈只用于有意义的确认、选择和错误（如完成导入、删除、冲突），使用 `sensoryFeedback`，不为普通点击添加。

## 数据安全的交互约定

- 删除项目进入「最近删除」，保留 30 天，删除后立即提供「撤销」；永久删除需要二次确认。原地打开的项目只从列表移除，不触碰其文件。
- 编辑内容先保存为本机草稿；保存失败不得显示成功。其他 App 修改了正在编辑的文件时，保留双方内容，由作者选择「保留我的」「使用对方的」或「两者都保留」。
- 只有用户主动操作才写入项目文件；App 自己的偏好、草稿、列表索引存放在本机，可清除，不影响项目。

## 可访问性

- 每个交互元素都有名称；纯图标按钮必须提供 `Label` 或 `accessibilityLabel`。
- 组合信息的行（如项目行）使用 `accessibilityElement(children: .combine)`，读出名称、描述和修改时间。
- 自动化测试使用 `accessibilityIdentifier`，标识不参与朗读，不替代可读名称。
- 支持深色模式、增强对比度、粗体文本；颜色对比满足 WCAG AA。

## 验收

- 界面改动需在 iPhone 与 iPad 模拟器（浅色、深色各一张）截图，iPad 另含窄窗口；中英文各走查一次。
- 新增字符串必须补齐简体中文，`xcodebuild -exportLocalizations` 不应出现未翻译项。
- 现有界面中的不一致不能作为新实现的先例。
