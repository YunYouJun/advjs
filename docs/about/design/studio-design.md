# Studio 设计规范

本页定义创作工具体系中 Studio 的品牌表达、移动布局与视觉 token。总分层见 [ADV.JS 设计体系](./design-system)，共享控件见 [Studio 组件规范](./studio-components)。桌面编辑器遵循 [AGUI 规范](/agui/design)；Studio 内的游戏画面遵循 [游戏 UI 规范](./game-ui)。

“紫幕金章”是 Studio 与品牌展示的视觉方向，游戏作品可采用自己的美术风格。下列值是设计基线，实现以 `apps/studio/src/theme/variables.css` 和 S-Components 为准，不能据此宣称历史页面已全部迁移。

## 色彩系统

### 品牌色 — 深紫 (Royal Purple)

品牌的核心色，代表**冒险、想象力、创造的魔力**。

| Token                        | 值             | 用途                     |
| ---------------------------- | -------------- | ------------------------ |
| `--adv-color-primary`        | `#7c3aed`      | 主按钮、重要操作、选中态 |
| `--adv-color-primary-shade`  | `#6d28d9`      | hover / pressed 态       |
| `--adv-color-primary-tint`   | `#8b5cf6`      | 次要强调、图标着色       |
| `--adv-color-primary-light`  | `#a78bfa`      | 轻量标签、背景点缀       |
| `--adv-color-primary-subtle` | `#ede9fe`      | 浅色模式下的背景色块     |
| `--adv-color-primary-rgb`    | `124, 58, 237` | 用于 rgba() 透明度变体   |

### 强调色 — 冒险金 (Adventure Gold)

辅助色，代表**发现、奖励、灵感的火花**。用于需要引起注意的高亮和特殊状态。

| Token                       | 值             | 用途                       |
| --------------------------- | -------------- | -------------------------- |
| `--adv-color-accent`        | `#f59e0b`      | 重要提示、新功能标记、星标 |
| `--adv-color-accent-shade`  | `#d97706`      | hover / pressed            |
| `--adv-color-accent-tint`   | `#fbbf24`      | 浅色变体                   |
| `--adv-color-accent-subtle` | `#fef3c7`      | 浅色模式下的背景           |
| `--adv-color-accent-rgb`    | `245, 158, 11` | rgba() 变体                |

### 语义色

| Token                 | 值        | 用途                   |
| --------------------- | --------- | ---------------------- |
| `--adv-color-success` | `#10b981` | 保存成功、完成状态     |
| `--adv-color-warning` | `#f59e0b` | 警告（复用金色）       |
| `--adv-color-danger`  | `#ef4444` | 删除、错误、破坏性操作 |
| `--adv-color-info`    | `#6366f1` | 信息提示、帮助文本     |

### 渐变

| Token                    | 值                                                                      | 用途               |
| ------------------------ | ----------------------------------------------------------------------- | ------------------ |
| `--adv-gradient-primary` | `linear-gradient(135deg, #7c3aed, #8b5cf6, #a78bfa)`                    | 主按钮、品牌元素   |
| `--adv-gradient-warm`    | `linear-gradient(135deg, #7c3aed, #8b5cf6, #a855f7)`                    | 温暖氛围渐变       |
| `--adv-gradient-epic`    | `linear-gradient(135deg, #7c3aed, #6d28d9, #4c1d95)`                    | 深沉史诗背景       |
| `--adv-gradient-gold`    | `linear-gradient(135deg, #f59e0b, #fbbf24)`                             | 金色高亮、成就徽章 |
| `--adv-gradient-surface` | `linear-gradient(135deg, rgba(124,58,237,0.08), rgba(139,92,246,0.04))` | 卡片微渐变背景     |

### 中性色 · 表面 (Surface)

#### 浅色模式 (Light)

| Token                    | 值                    | 用途             |
| ------------------------ | --------------------- | ---------------- |
| `--adv-surface-page`     | `#fafafa`             | 页面底色         |
| `--adv-surface-card`     | `#ffffff`             | 卡片、弹窗背景   |
| `--adv-surface-elevated` | `#f5f5f5`             | 悬浮层、下拉菜单 |
| `--adv-text-primary`     | `#111827`             | 标题、正文       |
| `--adv-text-secondary`   | `#6b7280`             | 辅助说明         |
| `--adv-text-tertiary`    | `#9ca3af`             | 占位符、禁用文本 |
| `--adv-border-subtle`    | `rgba(0, 0, 0, 0.06)` | 分割线、边框     |

#### 暗色模式 (Dark)

| Token                    | 值                          | 用途                 |
| ------------------------ | --------------------------- | -------------------- |
| `--adv-surface-page`     | `#0f0f1a`                   | 页面底色（深邃夜空） |
| `--adv-surface-card`     | `#1e1e2e`                   | 卡片背景             |
| `--adv-surface-elevated` | `#2a2a3e`                   | 悬浮层               |
| `--adv-text-primary`     | `#f3f4f6`                   | 标题、正文           |
| `--adv-text-secondary`   | `#9ca3af`                   | 辅助说明             |
| `--adv-text-tertiary`    | `#6b7280`                   | 占位符               |
| `--adv-border-subtle`    | `rgba(255, 255, 255, 0.08)` | 分割线               |

### 色彩使用规则

以下规则适用于 Studio 与品牌展示；桌面 Editor 使用 [AGUI 色彩体系](/agui/design#色彩体系)，不使用紫色发光或装饰渐变。

1. **60-30-10 法则** — 60% 中性色（Surface）、30% Primary 点缀、10% Accent 高亮
2. **品牌色不铺满** — Primary 主要用于交互元素（按钮、链接、选中），不做大面积背景
3. **金色要克制** — Accent Gold 仅用于特别需要注意的元素，避免过度使用导致视觉疲劳
4. **暗色模式下紫色发光** — 利用 `box-shadow` 的 glow 效果增强氛围感

---

## 排版系统

### 字体栈

```css
--adv-font-family:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Noto Sans SC',
  sans-serif;

--adv-font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'Consolas', monospace;
```

### 字号阶梯

基于 **iOS HIG** 的阅读性原则，采用 px 固定值确保跨平台一致性：

| Token                 | 值   | 行高 | 用途                   |
| --------------------- | ---- | ---- | ---------------------- |
| `--adv-font-caption`  | 11px | 1.35 | 时间戳、徽章、脚注     |
| `--adv-font-body-sm`  | 13px | 1.45 | 辅助文本、列表二级信息 |
| `--adv-font-body`     | 15px | 1.5  | 正文、输入框           |
| `--adv-font-subtitle` | 17px | 1.4  | 卡片标题、列表项标题   |
| `--adv-font-title`    | 20px | 1.3  | 页面标题               |
| `--adv-font-display`  | 28px | 1.2  | 大标题、空状态         |
| `--adv-font-hero`     | 36px | 1.1  | 着陆页标语、品牌展示   |

### 字重

| 用途     | 字重              |
| -------- | ----------------- |
| 正文     | `400` (Regular)   |
| 强调文本 | `600` (Semibold)  |
| 标题     | `700` (Bold)      |
| 大标题   | `800` (Extrabold) |

### 字距

- 大标题 (`title` 及以上)：`letter-spacing: -0.02em`（更紧凑、有力）
- 小号大写标签 (section header)：`letter-spacing: 0.05em` + `text-transform: uppercase`

---

## 间距系统

基于 **4px 基数** 的倍数系统：

| Token             | 值   | 场景示例             |
| ----------------- | ---- | -------------------- |
| `--adv-space-xs`  | 4px  | 图标与文字间距       |
| `--adv-space-sm`  | 8px  | 紧凑元素间距         |
| `--adv-space-md`  | 16px | 默认内边距、元素间距 |
| `--adv-space-lg`  | 24px | 区块间距             |
| `--adv-space-xl`  | 32px | 大区块分隔           |
| `--adv-space-2xl` | 48px | 页面级间距           |

---

## 圆角系统

| Token               | 值     | 用途                 |
| ------------------- | ------ | -------------------- |
| `--adv-radius-sm`   | 8px    | 按钮、输入框、小卡片 |
| `--adv-radius-md`   | 12px   | 中等卡片、弹窗       |
| `--adv-radius-lg`   | 16px   | 大卡片、底部弹出面板 |
| `--adv-radius-xl`   | 20px   | 模态框、大面板       |
| `--adv-radius-full` | 9999px | 药丸按钮、头像、标签 |

---

## 阴影系统

| Token                   | Light 模式                                                | 用途         |
| ----------------------- | --------------------------------------------------------- | ------------ |
| `--adv-shadow-subtle`   | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)`  | 卡片静息态   |
| `--adv-shadow-medium`   | `0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)` | 悬浮卡片     |
| `--adv-shadow-elevated` | `0 8px 24px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.06)`  | 弹窗、下拉   |
| `--adv-shadow-glow`     | `0 4px 20px rgba(124,58,237,0.25)`                        | 品牌元素光晕 |
| `--adv-shadow-gold`     | `0 4px 16px rgba(245,158,11,0.2)`                         | 金色高亮光晕 |

暗色模式下阴影加深，glow 效果更明显（`opacity * 1.5`）。

---

## 动效系统

### 时长

| Token                   | 值    | 用途                |
| ----------------------- | ----- | ------------------- |
| `--adv-duration-fast`   | 150ms | hover、focus 反馈   |
| `--adv-duration-normal` | 250ms | 展开/折叠、Tab 切换 |
| `--adv-duration-slow`   | 400ms | 页面过渡、模态出入  |

### 缓动

| Token                | 值                                  | 用途                   |
| -------------------- | ----------------------------------- | ---------------------- |
| `--adv-ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)`      | 通用默认               |
| `--adv-ease-in`      | `cubic-bezier(0.4, 0, 1, 1)`        | 退出动画               |
| `--adv-ease-out`     | `cubic-bezier(0, 0, 0.2, 1)`        | 进入动画               |
| `--adv-ease-bounce`  | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 弹性反馈（成就达成等） |

### 交互反馈

- **按钮点击**：`transform: scale(0.97)` + `duration-fast`
- **卡片点击**：`transform: scale(0.98)` + `duration-fast`
- **列表项 hover**：背景色渐现 + `duration-fast`
- **页面切换**：iOS 风格 push/pop，`duration-slow`

---

## 图标系统

### Studio 图标

- **主图标库**：[Ionicons](https://ionic.io/ionicons)（与 Ionic Vue 生态一致）
- **补充图标**：通过 UnoCSS `presetIcons` 引入 [VS Code Icons](https://github.com/vscode-icons/vscode-icons)（文件类型图标）

### 通用规范

- **图标尺寸**：与字体大小匹配，默认 `1.2em`（通过 `scale: 1.2`）
- **图标颜色**：继承文本颜色（`currentColor`），特殊语义使用对应语义色

---

## 层级系统 (Z-index)

| 层级     | Z-index | 元素                     |
| -------- | ------- | ------------------------ |
| Base     | `0`     | 页面内容                 |
| Sticky   | `10`    | 粘性导航栏               |
| Dropdown | `100`   | 下拉菜单、选择器         |
| Overlay  | `1000`  | 遮罩层                   |
| Modal    | `1001`  | 模态框、底部面板         |
| Toast    | `2000`  | 消息提示                 |
| Tooltip  | `9999`  | 工具提示、Select Popover |

---

## 平台适配策略

Studio 的创作界面采用移动优先策略：

### Studio — Mobile-First (移动优先)

> 手机上必须是**完整可用**的，桌面端是**增强体验**。

#### 渐进增强路径

```
Mobile (默认)        →  Tablet (增强)       →  Desktop (完整)
单栏布局              →  可选侧栏             →  多面板 + Sidebar
底部 Tab 导航         →  底部 Tab 导航        →  左侧 Sidebar 导航
Modal 替代面板        →  Sheet 替代面板       →  内联面板
触控交互              →  触控 + 键盘          →  键鼠 + 快捷键
```

#### 断点定义

通过 `useResponsive()` composable 统一管理：

| 名称        | 条件              | 场景                         |
| ----------- | ----------------- | ---------------------------- |
| `isMobile`  | `< 768px`（默认） | 手机竖屏，所有页面的基础布局 |
| `isDesktop` | `≥ 768px`         | 平板横屏 / 桌面端，启用侧栏  |
| `isWide`    | `≥ 1024px`        | 宽屏桌面，启用多面板         |

```ts
// composables/useResponsive.ts
import { useMediaQuery } from '@vueuse/core'

export function useResponsive() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isWide = useMediaQuery('(min-width: 1024px)')
  const isMobile = computed(() => !isDesktop.value)
  return { isMobile, isDesktop, isWide }
}
```

#### 导航切换

| 平台    | 导航方式                       | 实现                        |
| ------- | ------------------------------ | --------------------------- |
| Mobile  | 底部 `IonTabBar`（5 个 Tab）   | `TabsPage.vue` 默认渲染     |
| Desktop | 左侧 72px Sidebar（图标+标签） | `v-if="isDesktop"` 条件渲染 |

#### 面板策略

| 场景       | Mobile                             | Desktop                     |
| ---------- | ---------------------------------- | --------------------------- |
| 文件浏览   | `MobileFileTree` + IonModal 预览   | 左侧资源管理器 + 右侧编辑区 |
| 角色详情   | Push 到新页面                      | 右侧 Inspector 面板         |
| 聊天上下文 | 无侧栏（单列聊天）                 | 左侧上下文 Sidebar          |
| 属性编辑   | 底部 Sheet (`IonModal breakpoint`) | 内联属性面板                |
| 世界地图   | 全屏地图 + 底部角色列表            | 地图 + 左侧 `WorldSidebar`  |

#### 触控适配

```css
/* 触控目标最小 44px（iOS HIG） */
ion-item {
  --min-height: 44px;
}
.s-button--lg {
  height: 48px;
} /* 推荐移动端主操作 */

/* 消除 300ms 延迟 */
-webkit-tap-highlight-color: transparent;

/* 画布/图形组件防止手势冲突 */
.canvas-area {
  touch-action: none;
}
.scrollable-list {
  touch-action: pan-y;
}
```

#### 安全区域

```css
/* 底部安全区（已在 global.css 全局覆盖） */
ion-tab-bar {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
ion-footer ion-toolbar:last-child {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
ion-fab[vertical='bottom'] {
  bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
}
```

#### 移动端设计要点

- **内容优先级分层**：核心内容必须显示 > 辅助信息按需显示 > 扩展功能折叠/隐藏
- **列表与卡片**：全宽卡片、左右 padding 16px、卡片间距 8px、支持 `IonItemSliding` 滑动操作
- **输入体验**：长文本编辑用全屏 Modal、指定 `inputmode` 优化键盘

## 相关文档

- [Studio 技术架构](/guide/studio/architecture)
- [Studio 组件规范](./studio-components)
- [ADV.JS 设计体系](./design-system)
