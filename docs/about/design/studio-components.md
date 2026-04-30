# Studio 组件规范

Studio 的组件体系分为三层：

1. **Ionic 基础层** — `IonPage`、`IonHeader`、`IonContent`、`IonItem` 等，提供跨平台原生体验
2. **S-Components 自建层** — `SButton`、`SInput`、`SSelect` 等，基于 Design Token 的品牌化组件
3. **业务组件层** — 角色卡片、聊天气泡、场景编辑器等领域特定组件

本文档聚焦**第 2 层**的设计规范。

---

## 设计 Token 落地

所有自建组件**必须**使用 `--adv-*` CSS 变量，禁止硬编码色值：

```css
/* ✅ 正确 */
background: var(--adv-surface-card);
color: var(--adv-text-primary);
border-radius: var(--adv-radius-sm);

/* ❌ 错误 */
background: #ffffff;
color: #111827;
border-radius: 8px;
```

### Ionic 变量桥接

Ionic 组件使用 `--ion-color-*` 变量，需要在 `variables.css` 中与 `--adv-*` 保持同步：

```css
:root {
  --ion-color-primary: #7c3aed; /* = --adv-color-primary */
  --ion-color-primary-rgb: 124, 58, 237; /* = --adv-color-primary-rgb */
  --ion-color-primary-shade: #6d28d9; /* = --adv-color-primary-shade */
  --ion-color-primary-tint: #8b5cf6; /* = --adv-color-primary-tint */
}
```

---

## SButton 按钮

### 变体 (Variant)

| Variant   | 样式                                | 使用场景                       |
| --------- | ----------------------------------- | ------------------------------ |
| `primary` | 品牌渐变背景 + 白色文字 + glow 阴影 | 主操作（创建、保存、开始游戏） |
| `outline` | 透明背景 + 品牌色边框/文字          | 次要操作（取消、返回）         |
| `ghost`   | 透明背景 + 灰色文字                 | 低优先级操作（更多选项）       |
| `danger`  | 红色背景 + 白色文字                 | 破坏性操作（删除）             |

### 尺寸 (Size)

| Size | 高度 | 内边距   | 字号 | 场景                 |
| ---- | ---- | -------- | ---- | -------------------- |
| `sm` | 32px | `0 8px`  | 13px | 工具栏、紧凑列表     |
| `md` | 40px | `0 16px` | 15px | 默认按钮             |
| `lg` | 48px | `0 24px` | 17px | 页面主操作、模态确认 |

### 交互状态

| 状态     | Primary 效果                            | Outline 效果      |
| -------- | --------------------------------------- | ----------------- |
| Default  | 渐变背景 + subtle 阴影                  | 透明 + 品牌色边框 |
| Hover    | 亮度 +5% + medium 阴影 + glow 扩大      | 品牌色 6% 背景    |
| Active   | `scale(0.97)`                           | `scale(0.97)`     |
| Disabled | `opacity: 0.45` + `cursor: not-allowed` | 同左              |
| Loading  | spinner 动画 + disabled 状态            | 同左              |

### 代码参考

```vue
<SButton variant="primary" size="md">
创建项目
</SButton>

<SButton variant="outline">
取消
</SButton>

<SButton variant="danger" size="sm">
删除角色
</SButton>

<SButton variant="ghost" :loading="true">
加载中
</SButton>
```

---

## SInput 输入框

### 尺寸

与 SButton 保持一致的高度阶梯（sm: 32px, md: 40px, lg: 48px）。

### 状态

| 状态                   | 表现                                                |
| ---------------------- | --------------------------------------------------- |
| Default                | subtle 边框 + card 背景                             |
| Focus                  | 品牌色边框 + `0 0 0 3px rgba(primary, 0.12)` 聚焦环 |
| Disabled               | `opacity: 0.45` + `pointer-events: none`            |
| With Value + Clearable | 右侧显示 `×` 清除按钮                               |

### Slots

- `prefix` — 前置内容（搜索图标、货币符号等）
- `suffix` — 后置内容（单位、密码可见切换等）

### 代码参考

```vue
<SInput v-model="name" placeholder="角色名称" clearable />

<SInput v-model="search" size="sm">
  <template #prefix><ion-icon :icon="searchOutline" /></template>
</SInput>
```

---

## SSelect 选择器

基于 [reka-ui](https://reka-ui.com/) 的 `Select` 原语封装，保证完全的可访问性。

### 触发器样式

与 SInput 保持视觉一致（相同的边框、圆角、尺寸阶梯），右侧带有旋转箭头图标。

### 下拉面板

| 属性     | 值                                           |
| -------- | -------------------------------------------- |
| 定位     | `position="popper"` + `side-offset: 4px`     |
| 宽度     | 与触发器等宽 (`--reka-select-trigger-width`) |
| 最大高度 | 280px（可滚动）                              |
| 动画     | 150ms 淡入 + 微上移                          |
| 圆角     | `--adv-radius-sm` (8px)                      |
| 阴影     | `0 8px 30px` 深阴影                          |

### 选项状态

| 状态                    | 表现                                |
| ----------------------- | ----------------------------------- |
| Default                 | 透明背景                            |
| Highlighted (键盘/鼠标) | 品牌色 8% 背景 + 品牌色文字         |
| Checked                 | `font-weight: 600` + 品牌色勾选图标 |
| Disabled                | `opacity: 0.4`                      |

### 代码参考

```vue
<SSelect
  v-model="language"
  :options="[
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ]"
  placeholder="选择语言"
/>
```

---

## SFormField 表单字段

表单字段的容器组件，提供统一的 label + error/hint 布局。

### Props

| Prop    | 类型     | 说明             |
| ------- | -------- | ---------------- |
| `label` | `string` | 字段标签         |
| `error` | `string` | 错误提示（红色） |
| `hint`  | `string` | 帮助文本（灰色） |

### 代码参考

```vue
<SFormField label="角色名称" error="名称不能为空">
  <SInput v-model="name" />
</SFormField>
```

---

## NavItem / NavGroup 导航组件

### NavItem

列表导航项，遵循 iOS 设置页的交互模式：

| 元素        | 说明                                  |
| ----------- | ------------------------------------- |
| 左侧图标    | 32px 圆角方形背景 + ionicon           |
| 标题 + 描述 | 主文本 + 灰色副文本                   |
| 右侧        | 可选 badge（数字/文本）+ chevron 箭头 |
| 交互        | 点击整行触发，最小高度 44px           |

### NavGroup

`NavItem` 的分组容器，添加圆角边框和分割线。

---

## 布局组件

### LayoutPage

基于 Ionic 的页面布局容器：

```
┌─────────────────────────┐
│  IonHeader (IonToolbar)  │  ← 标题栏
├─────────────────────────┤
│                         │
│  IonContent             │  ← 可滚动内容区
│  (slot: default)        │
│                         │
├─────────────────────────┤
│  IonFooter (optional)   │  ← 底部操作栏
└─────────────────────────┘
```

### Props

| Prop         | 类型      | 说明                       |
| ------------ | --------- | -------------------------- |
| `title`      | `string`  | 页面标题                   |
| `showBack`   | `boolean` | 显示返回按钮               |
| `fullscreen` | `boolean` | 内容是否延伸到 header 下方 |

---

## 共享样式模式

### Empty State 空状态

当列表或页面无数据时的统一展示：

```
      ┌────────┐
      │ 💫 Icon │  ← 88px 圆角方形 + gradient-surface 背景 + glow
      └────────┘
     标题（20px Bold）
  描述文本（15px 灰色，max-width: 300px）
```

CSS 类：`.empty-state` > `.empty-state__illustration` + `.empty-state__title` + `.empty-state__description`

---

## 组件开发规范

### 命名

- 自建组件以 `S` 前缀命名（`SButton`、`SInput`、`SSelect`），区别于 Ionic 的 `Ion` 前缀
- 文件名与组件名一致：`SButton.vue`

### 样式

- 使用 `<style scoped>` 隔离样式
- Portal 类组件（如 SSelect 下拉）的 teleport 部分使用 `<style>`（非 scoped）
- BEM-like 命名：`.s-button`、`.s-button--primary`、`.s-button__spinner`

### 尺寸一致性

所有表单类组件遵循统一高度阶梯：

| Size | Height       |
| ---- | ------------ |
| `sm` | 32px         |
| `md` | 40px（默认） |
| `lg` | 48px         |

### 可访问性

- 所有交互元素支持键盘导航
- Focus 状态使用 `3px` 品牌色聚焦环
- 触控目标最小 44px × 44px
- 使用语义 HTML 元素（`<button>`、`<input>`、原生 ARIA）
- reka-ui 原语自动处理 ARIA 属性

### 暗色模式

- 通过 `:root.dark` 类切换，不使用 `@media (prefers-color-scheme)`
- 所有颜色通过 CSS 变量引用，暗色模式下自动切换
- 阴影在暗色模式下加深
- Glow 效果在暗色模式下增强（更明显的品牌色光晕）

---

## 相关文档

- [设计系统总览](/about/design/design-system) — 色彩、排版、间距等 Token 定义
- [AGUI 组件库](/agui/) — 编辑器侧的 GUI 组件库
- [Studio 技术架构](/guide/studio/architecture) — 应用整体架构
