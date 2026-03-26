# 设计风格

AGUI 是 ADV.JS 编辑器的 GUI 组件库，其设计风格参考了 [Blender](https://www.blender.org/) 与 [Unity](https://unity.com/) 等专业编辑器的 UI 范式，追求**紧凑、高信息密度、暗色优先**的编辑器体验。

## 设计原则

### 编辑器优先

AGUI 不是通用 UI 库，而是为**编辑器场景**量身定制的组件体系。与常见的网页 UI 库不同，AGUI 的设计目标是：

- **紧凑**：小字号（12-13px）、低行高、小圆角（2-3px），减少视觉噪音，让用户聚焦于内容
- **高密度**：控件高度以 20px 为基线，面板间距紧密，最大化内容区域
- **克制**：装饰极少，无多余阴影和动效，信息传达优先

### 暗色优先

编辑器的主要使用场景是长时间创作，暗色模式是默认模式。AGUI 以 `.dark` 为主要适配目标，亮色模式作为补充。

### 无障碍与可访问性

底层采用 [Reka UI](https://reka-ui.com/) 作为无头（headless）组件基础，确保所有交互组件（Dialog、Dropdown、Switch、Tabs 等）具备完善的 ARIA 语义和键盘导航支持。

## 技术架构

### Reka UI + AGUI 样式层

AGUI 的组件分为两类：

| 类型             | 说明                                  | 示例                                                   |
| ---------------- | ------------------------------------- | ------------------------------------------------------ |
| **Reka UI 封装** | 基于 Reka UI 无头组件，叠加 AGUI 样式 | Dialog、DropdownMenu、Switch、Tabs、Accordion、Menubar |
| **自建组件**     | 直接基于 Vue 构建的编辑器特有组件     | Button、Input、Slider、ColorPicker、Tree、Explorer     |

这种分层架构确保：

- 交互行为和可访问性由 Reka UI 保障
- 视觉风格由 AGUI 统一控制
- 编辑器特有的组件（如 Properties Panel、Assets Explorer）可自由定制

### 关于 TDesign

TDesign 已被完全移除。编辑器中原先使用的 TDesign 组件已全部替换为基于 Reka UI 封装的 AGUI 组件，统一了视觉风格并减少了外部依赖。

## 色彩体系

AGUI 通过 CSS 自定义属性（`--agui-c-*`）定义完整的色彩系统。

### 主色

| Token                  | 值                   | 用途                |
| ---------------------- | -------------------- | ------------------- |
| `--agui-c-blue`        | `#3b8eed`            | 主色调，焦点/激活态 |
| `--agui-c-blue-light`  | `#549ced`            | 悬停态              |
| `--agui-c-blue-darker` | `#255489`            | 暗色下激活态        |
| `--agui-c-focus`       | `var(--agui-c-blue)` | 焦点环              |

### 中性色（暗色模式）

| Token                     | 值                       | 用途          |
| ------------------------- | ------------------------ | ------------- |
| `--agui-c-bg`             | `#1a1a1a`                | 主背景        |
| `--agui-c-bg-soft`        | `#242424`                | 次级背景      |
| `--agui-c-bg-panel`       | `rgba(56,56,56,1)`       | 面板背景      |
| `--agui-c-bg-panel-title` | `rgba(70,70,70,1)`       | 面板标题栏    |
| `--agui-c-border`         | `rgba(84,84,84,1)`       | 边框          |
| `--agui-c-text-1`         | `rgba(255,255,255,0.8)`  | 主文本        |
| `--agui-c-text-2`         | `rgba(235,235,235,0.6)`  | 次级文本      |
| `--agui-c-text-3`         | `rgba(235,235,235,0.38)` | 禁用/占位文本 |

### 中性色（亮色模式）

| Token               | 值                    | 用途     |
| ------------------- | --------------------- | -------- |
| `--agui-c-bg`       | `#ffffff`             | 主背景   |
| `--agui-c-bg-panel` | `rgba(255,255,255,1)` | 面板背景 |
| `--agui-c-border`   | `rgba(36,36,36,1)`    | 边框     |
| `--agui-c-text-1`   | `rgba(60,60,60,0.8)`  | 主文本   |

## 组件风格规范

### 尺寸基线

```
控件高度:    20px（Input / Button / Select）
字号:       12-13px
最小字号:    9px（mini 尺寸）
圆角:       2-3px（控件），4-6px（弹层/卡片）
```

### Button

```scss
.agui-button {
  padding: 0 6px;
  font-size: 12px;
  border-radius: 2px;
  background: rgba(88, 88, 88, 1);
  color: #e6e6e6;
  box-shadow: 0 1px 1px rgba(black, 0.3);

  &:hover {
    background: rgba(100, 100, 100, 1);
  }
  &:active {
    background-color: #4772b3;
  }
}
```

- 支持 `data-location` 属性实现按钮组拼接（LEFT / RIGHT / ALONE）
- 支持 `mini` / `large` 尺寸变体

### Input

```scss
.agui-input {
  height: 20px;
  font-size: 13px;
  border-radius: 3px;
  background-color: rgba(42, 42, 42, 1);
  border: 1px solid var(--agui-c-border);

  &:focus {
    border-color: var(--agui-c-active);
  }
}
```

### 弹层（Dropdown / Context Menu）

```scss
// 毛玻璃效果
background-color: rgba(22, 23, 24, 0.5);
backdrop-filter: blur(20px);
border-radius: 6px;
box-shadow:
  0px 10px 38px -10px rgba(22, 23, 24, 0.35),
  0px 10px 20px -15px rgba(22, 23, 24, 0.8);
```

- 菜单项高度 25px，字号 12px
- 高亮态使用 `--agui-c-active`（蓝色系）

### 动画

- 手风琴/面板展开：`200ms cubic-bezier(0.87, 0, 0.13, 1)`
- 弹层入场：`400ms cubic-bezier(0.16, 1, 0.3, 1)`
- 边框过渡：`200ms ease-in-out`
- 分割条悬停：`400ms opacity`

## 布局

编辑器布局基于 [Splitpanes](https://antoniandre.github.io/splitpanes/) 实现可拖拽分栏，风格参照 Blender 的区域化布局：

```
分割条宽度:    3px
分割条颜色:    black（--agui-layout-splitter-color）
面板动画:     禁用（transition: none），避免拖拽时的布局抖动
```

## 滚动条

自定义滚动条样式以融入编辑器暗色主题：

```
宽度: 10px
轨道: #333
滑块: #888，圆角 4px
悬停: #555
```

## 图标

使用 [@iconify/vue](https://iconify.design/) 提供图标支持，内置图标集：

- `radix-icons` — 与 Reka UI 生态一致的图标风格
- `vscode-icons` — 用于文件类型识别（Assets Explorer）

## 开发指南

### 新增组件的推荐方式

1. 优先查找 [Reka UI](https://reka-ui.com/) 是否提供对应的无头组件
2. 若有，基于 Reka UI 封装，仅编写 AGUI 样式层
3. 若无，直接基于 Vue 构建，遵循以下约定：
   - 组件名以 `AGUI` 前缀命名（如 `AGUIButton`）
   - 使用 `--agui-*` CSS 变量而非硬编码颜色
   - 控件尺寸以 20px 高度为基线
   - 同时适配亮色 / 暗色模式

### 样式编写约定

- 组件级样式使用 SCSS，放在对应组件目录下
- 全局 token 定义在 `client/styles/css-vars.scss`
- 工具类使用 UnoCSS（Tailwind 语法兼容）
- BEM 命名**不强制**，但类名需以 `agui-` 为前缀或使用组件内作用域
