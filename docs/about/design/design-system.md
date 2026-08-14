# ADV.JS 设计系统

> 「紫幕金章」—— 以深紫为底色书写冒险，以金色点亮每一个创作灵感。

ADV.JS Design System 是 ADV.JS 全平台的统一视觉语言，横跨 **Studio**（移动端 App）和 **Editor**（桌面端编辑器）两大产品形态。

## 设计哲学

### 品牌定位

ADV.JS 是一个**文字冒险游戏创作平台**，它的用户既是创作者也是玩家。

平台通过两个产品形态服务不同场景：

| 产品       | 目录           | 技术栈                     | 平台策略         | 核心场景                               |
| ---------- | -------------- | -------------------------- | ---------------- | -------------------------------------- |
| **Studio** | `apps/studio/` | Ionic Vue + Capacitor      | **Mobile-First** | 快速创作、角色对话、体验试玩、随时随地 |
| **Editor** | `editor/core/` | Nuxt 4 + AGUI + Splitpanes | **PC-First**     | 专业编辑、多面板布局、流程图、代码编辑 |

### 双产品架构

```
┌─────────────────────────────────────────────────────────────┐
│  Studio (Mobile-First)                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  手机/平板上的完整创作体验                               │ │
│  │  角色管理 · AI 对话 · 快速编辑 · 游戏试玩 · 分享导出    │ │
│  │                                                        │ │
│  │  Ionic Vue · 底部 Tab 导航 · IonModal Sheet            │ │
│  │  触控优先 · 44px 触控目标 · Safe Area 适配             │ │
│  │  S-Components (SButton, SInput, SSelect)               │ │
│  │  Design Token: --adv-*                                 │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Editor (PC-First)                                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  桌面端的专业创作工作站                                  │ │
│  │  多面板 Splitpanes · Monaco 代码编辑 · Vue Flow 流程图  │ │
│  │  角色编辑器 · 场景预览 · 资源管理器 · 控制台            │ │
│  │                                                        │ │
│  │  Nuxt 4 · 顶部 Menubar + Toolbar · 键鼠操作            │ │
│  │  AGUI 组件库 (AGUIPanel, AGUILayout, AGUIMenubar...)   │ │
│  │  Design Token: --agui-* + --adv-*                      │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  共享层                                                     │
│  @advjs/core · @advjs/parser · @advjs/types                │
│  品牌色 · 渐变 · 动效缓动 · 语义色 · 游戏渲染引擎          │
└─────────────────────────────────────────────────────────────┘
```

### Studio vs Editor 设计差异

| 维度         | Studio (Mobile-First)                          | Editor (PC-First)                                        |
| ------------ | ---------------------------------------------- | -------------------------------------------------------- |
| **导航**     | 底部 Tab Bar (Mobile) / 左侧 Sidebar (Desktop) | 顶部 Menubar + Toolbar                                   |
| **布局**     | 单栏流式 → 桌面端增强 Sidebar                  | 多面板 Splitpanes (Hierarchy, Scene, Inspector, Project) |
| **面板**     | IonModal Sheet / Push 页面                     | 内联 Splitpanes，可拖拽调整大小                          |
| **色调**     | 亮/暗切换，品牌色点缀                          | 默认暗色，类 IDE 沉浸感                                  |
| **信息密度** | 适中——卡片式布局、大触控区域                   | 高——树形列表、属性面板、控制台                           |
| **正文字号** | 15px (`--adv-font-body`)                       | `small` (浏览器默认约 13px)                              |
| **交互**     | 触控：滑动、长按、Sheet                        | 键鼠：拖拽、右键菜单、快捷键                             |
| **组件库**   | S-Components + Ionic                           | AGUI + reka-ui                                           |
| **CSS 方案** | CSS 变量 (`--adv-*`) + Scoped CSS              | UnoCSS (presetWind4 + presetAdv) + AGUI SCSS             |
| **图标**     | Ionicons                                       | Carbon + RI + MDI + EP + Twemoji                         |

### 三大原则

| 原则             | 含义           | Studio 体现                | Editor 体现                    |
| ---------------- | -------------- | -------------------------- | ------------------------------ |
| **叙事优先**     | UI 服务于故事  | 全屏游戏预览、沉浸式对话   | 场景面板最大化、游戏预览内嵌   |
| **沉浸而不喧宾** | 氛围感不抢内容 | 品牌色点缀、内容区域最大化 | 暗色 IDE 背景、面板边界克制    |
| **创作者友好**   | 降低创作门槛   | 44px 触控目标、单手操作    | 键盘快捷键、拖拽面板、右键菜单 |

### 设计气质：Epic Craft（史诗匠艺）

融合两种看似矛盾的气质：

- **史诗感 (Epic)** — 紫色的神秘与金色的辉煌，如翻开一本古老的冒险之书
- **匠艺感 (Craft)** — 干净的排版与精确的间距，如专业创作工具的克制与优雅

Studio 偏向 **Epic**（品牌感更强、氛围更浓），Editor 偏向 **Craft**（效率更高、信息更密）

---

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

### Editor 图标

- **主图标库**：[Carbon Icons](https://carbondesignsystem.com/guidelines/icons/library/) + [Remix Icon](https://remixicon.com/)（通过 UnoCSS `presetIcons`）
- **补充图标**：Element Plus Icons (ep)、MDI、Twemoji（表情）、SVG Spinners（加载）

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

Studio 和 Editor 采用**完全不同**的平台策略：

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

### Editor — PC-First (桌面优先)

> 桌面端是**完整工作站**，不强求移动端适配。

#### 布局架构

```
┌───────────────────────────────────────────────────────────┐
│  AGUIMenubar (菜单栏: File / Edit / View / Tools / Help)  │
├───────────────────────────────────────────────────────────┤
│  AGUIToolbar (工具栏: 快捷操作按钮)                        │
├──────────┬────────────────────────┬───────────────────────┤
│ Hierarchy│      Scene             │     Inspector         │
│  (25%)   │      (45%)             │      (30%)            │
│          │  ┌──────────────────┐  │                       │
│ StoryLine│  │ Game Preview     │  │  属性面板             │
│ Characters│ │ Character Editor │  │  Context View         │
│ FileTree │  │ Flow Editor      │  │  File Inspector       │
│          │  │ Audio Panel      │  │                       │
│          │  └──────────────────┘  │                       │
│          ├────────────────────────┤                       │
│          │      Project           │                       │
│          │  Assets Explorer       │                       │
│          │  Console               │                       │
└──────────┴────────────────────────┴───────────────────────┘
     ↑ Splitpanes 可拖拽分割，比例 localStorage 持久化
```

#### 设计特征

| 维度         | 规范                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| **默认主题** | 暗色模式（类 IDE），通过 `@nuxtjs/color-mode` 管理，class 前缀 `editor-`      |
| **正文字号** | `font-size: small`（浏览器默认约 13px），更高信息密度                         |
| **面板管理** | `AGUILayout` + `Splitpanes`，支持嵌套 horizontal/vertical 分割                |
| **代码编辑** | Monaco Editor（`vs-dark` 主题），通过 `nuxt-monaco-editor` 集成               |
| **流程图**   | `@vue-flow` 节点编辑器 + `@dagrejs/dagre` 自动布局                            |
| **组件库**   | AGUI 组件库（`AGUIPanel`, `AGUITabs`, `AGUIButton`, `AGUIInput` 等 45+ 引用） |
| **CSS 方案** | UnoCSS (`presetWind4` + `presetAdv`) + AGUI SCSS 变量 (`--agui-*`)            |
| **交互模式** | 键鼠为主——拖拽面板、右键上下文菜单、键盘快捷键                                |

#### CSS 变量层级

Editor 的样式变量来自三层，按优先级覆盖：

```
--agui-*          ← AGUI 组件库基础变量（背景、边框、面板）
  └─ --adv-*      ← ADV.JS 共享变量（品牌色、渐变、语义色）
      └─ --adv-editor-*  ← Editor 专属变量（编辑器品牌色等）
```

### 共享设计基础

Studio 和 Editor 虽然平台策略不同，但共享以下设计基础：

| 共享层   | 内容                                     |
| -------- | ---------------------------------------- |
| 品牌色   | `#7c3aed` (Primary) + `#f59e0b` (Accent) |
| 语义色   | Success / Warning / Danger / Info        |
| 渐变     | `--adv-gradient-primary/warm/epic/gold`  |
| 动效缓动 | `--adv-ease-default/in/out/bounce`       |
| 游戏渲染 | `@advjs/core` + `@advjs/client` 主题组件 |
| 解析引擎 | `@advjs/parser` AdvScript 解析           |
| 类型定义 | `@advjs/types` 共享数据结构              |

---

## 代码现状审计与改进路线

> 基于 2026-04 对 `apps/studio/src/` 和 `editor/core/` 的全面审查。

### Studio 现状评估

| 维度                   | 状态    | 说明                                                  |
| ---------------------- | ------- | ----------------------------------------------------- |
| Design Token 定义      | ✅ 良好 | `variables.css` 定义了完整的 `--adv-*` 变量体系       |
| Token 使用覆盖率       | ⚠️ 中等 | S-Components 使用率高，但业务页面大量硬编码           |
| 硬编码颜色             | ❌ 严重 | ~200 处硬编码 `#hex` / `rgba()`，集中在聊天和角色页面 |
| 硬编码字号             | ❌ 严重 | ~390 处硬编码 `font-size: Npx`，排版不统一            |
| JS 响应式覆盖          | ⚠️ 不足 | 37 个页面中仅 5 个使用了 `useResponsive()`            |
| 安全区域 (bottom)      | ✅ 良好 | 全局 + 关键页面已覆盖                                 |
| 触控反馈               | ✅ 良好 | 54+ 处 `-webkit-tap-highlight-color: transparent`     |
| touch-action           | ❌ 缺失 | 0 处使用，画布组件可能有手势冲突                      |
| prefers-reduced-motion | ✅ 良好 | 4 个 CSS 文件已覆盖                                   |

### Editor 现状评估

| 维度          | 状态      | 说明                                                               |
| ------------- | --------- | ------------------------------------------------------------------ |
| 面板布局      | ✅ 良好   | Splitpanes 可拖拽、比例持久化、嵌套布局完整                        |
| AGUI 组件使用 | ✅ 良好   | 45+ 处引用，组件化程度高                                           |
| 暗色模式      | ✅ 良好   | 默认暗色，`@nuxtjs/color-mode` 管理                                |
| CSS 变量体系  | ⚠️ 双轨   | `--agui-*` 和 `--adv-*` 两套体系共存，部分交叉                     |
| 移动端适配    | ❌ 无     | 纯桌面端应用，无响应式（合理，PC-First 定位）                      |
| 品牌色统一    | ⚠️ 待更新 | Editor 品牌色 `--adv-editor-xxx: #0078e7` 与 Studio 的紫色系不一致 |

### 重点问题

#### 1. 硬编码颜色热点 (Studio)

| 文件                                  | 硬编码数 | 主要问题色                        |
| ------------------------------------- | :------: | --------------------------------- |
| `styles/group-chat.css`               |    52    | 角色分色 `--0` ~ `--5` 全部硬编码 |
| `styles/player-character.css`         |    35    | 属性/技能颜色硬编码               |
| `views/CharacterChatPage.vue`         |    33    | `#8b5cf6`、`#94a3b8` 等           |
| `components/ProjectSettingsModal.vue` |    29    | 品牌色和灰色                      |

#### 2. 排版不统一 (Studio)

建议补充 icon 尺寸 Token：

```css
--adv-font-icon-sm: 18px; /* 小图标 */
--adv-font-icon-md: 24px; /* 中等图标 */
--adv-font-icon-lg: 36px; /* 大图标 */
--adv-font-icon-xl: 48px; /* 特大图标（空状态等） */
```

#### 3. 桌面端内容拉伸 (Studio)

37 个页面中 32 个**无桌面适配**，在宽屏上内容过度拉伸。建议添加 `max-width` 约束：

```css
/* 设置/个人等非多面板页面 */
.settings-page ion-content {
  --padding-start: max(16px, calc((100% - 640px) / 2));
  --padding-end: max(16px, calc((100% - 640px) / 2));
}
```

#### 4. 双品牌色不统一 (跨产品)

Studio 使用 `#6366f1`（Indigo），Editor 使用 `#0078e7`（蓝色），两者与设计系统定义的 `#7c3aed`（深紫）均不一致。

### 改进路线

#### P0 — 品牌色统一

1. Studio `variables.css`：`--ion-color-primary` 从 `#6366f1` → `#7c3aed`
2. Editor `css-vars.scss`：`--adv-editor-xxx` 从 `#0078e7` → 与品牌色对齐
3. PWA `theme_color` 统一

#### P1 — Studio Token 覆盖率

1. 为角色分色系统创建 `--adv-character-color-*` Token
2. 全局搜索替换 `#8b5cf6` → `var(--adv-color-primary-tint)`
3. 全局搜索替换 `#94a3b8` → `var(--adv-text-tertiary)`

#### P2 — Studio 排版规范化

1. 补充 icon 尺寸 Token
2. 逐页替换硬编码 `font-size`
3. 优先处理：`CharacterChatPage`、`ProjectSharePage`

#### P3 — Studio 移动端增强

1. 更多页面接入 `useResponsive()`
2. 为画布组件添加 `touch-action` 声明
3. 纯内容页面添加 `max-width` 约束

---

## 相关文档

- [UI 设计](/about/design/ui) — 渲染引擎与主题架构
- [Studio 技术架构](/guide/studio/architecture) — 应用架构与技术栈
- [Studio 组件规范](/about/design/studio-components) — 组件库详细规范
- [AGUI 设计风格](/agui/design) — 编辑器 GUI 组件库设计
