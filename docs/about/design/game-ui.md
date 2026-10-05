# 游戏 UI 设计规范

本页定义 ADV.JS 面向玩家的界面契约，适用于 `packages/client/`、`themes/*` 及项目覆盖组件。总分层见 [ADV.JS 设计体系](./design-system)。Editor、Studio 内嵌预览的游戏内容也遵循本页；预览外部的创作控件遵循各自的工具规范。

## 设计目标

阅读与选择优先。对话、选项、菜单、历史、存读档和设置保持可辨识的角色、可预测的操作与明确反馈。作品主题可改变字体、配色、材质、插画和动画，不强制采用 AGUI 的灰色外壳或 Studio 的紫金配色。

字号、行长和点击区域按最终显示尺寸验收。`AdvContainer` 可能缩放整个舞台，设计稿中的像素值不等于屏幕上的实际大小；移动端需检查真实阅读和触控体验。剧情动效与用户的减少动态效果偏好保持兼容。

## 职责分层

| 层         | 职责                                   | 入口                                 |
| ---------- | -------------------------------------- | ------------------------------------ |
| 行为与状态 | 剧情推进、选择、存档、设置和运行时状态 | `packages/core/`、`packages/client/` |
| 默认界面   | 对话框、选项、游戏容器与菜单行为       | `packages/client/components/`        |
| 主题       | 视觉 token、布局、组件覆盖与专属配置   | `themes/*`、项目中的组件和样式       |
| 创作宿主   | 提供项目、预览上下文与外部工具栏       | Editor / Studio                      |

主题复用现有运行时动作，不复制一套剧情或存档状态。复杂外观可覆盖组件；单纯换色优先使用 token。默认主题、Pominis、starter 的 `ThemeConfig` 都继承共享接口。

## 配置主题

在项目 `theme.config.ts` 中配置：

```ts
import { defineThemeConfig } from 'advjs'

export default defineThemeConfig({
  ui: {
    colorScheme: 'dark',
    tokens: {
      '--adv-c-primary': '#b58748',
      '--adv-c-focus': '#f0bd73',
      '--adv-dialog-bg': 'rgba(24, 20, 16, 0.92)',
      '--adv-dialog-color': '#fff7e8',
      '--adv-dialog-name-color': '#f0bd73',
      '--adv-choice-bg': '#282018',
      '--adv-choice-hover-bg': '#453522',
      '--adv-choice-color': '#fff7e8',
      '--adv-choice-border': '#b58748',
      '--adv-choice-radius': '6px',
      '--adv-theme-paper-texture': 'none',
    },
  },
})
```

`ui` 可省略，原有主题继续工作。`colorScheme` 省略时继承宿主已有模式；显式值只作用于游戏容器。token 值为 CSS 字符串，需包含适用单位。配置优先于主题 CSS 的普通声明，删除配置后恢复 CSS 默认值；不使用 `!important` 与配置争夺优先级。

`defineThemeConfig<MyThemeConfig>()` 可约束主题专属字段：

```ts
import type { ThemeConfig } from '@advjs/types'
import { defineThemeConfig } from 'advjs'

interface MyThemeConfig extends ThemeConfig {
  audio?: { volume: number }
  paper?: { grain: boolean }
}

export default defineThemeConfig<MyThemeConfig>({
  audio: { volume: 0.5 },
  paper: { grain: true },
  ui: { colorScheme: 'light' },
})
```

共享接口保留 `unknown` 扩展字段，具体主题声明所需类型；`defineThemeConfig` 是 TypeScript 辅助函数，不是任意外部配置的运行时 schema 校验器。运行时样式映射会忽略非字符串值、未知 token 和其他体系的属性。

## 公共 token

精确名单由 `packages/types/src/config/theme.ts` 的 `gameUiTokenNames` 定义；CSS 默认值仍由实际样式和组件持有。

| 类别     | token                                                                                                                                                                                          | 默认消费位置                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 基础颜色 | `--adv-c-primary`、`--adv-c-primary-light`、`--adv-c-text`、`--adv-c-text-1/2/3`、`--adv-c-bg`、`--adv-c-bg-alt`                                                                               | 游戏控件、菜单、内容表面       |
| 排版     | `--adv-font-family`、`--adv-font-serif`                                                                                                                                                        | 游戏容器正文、主题衬线文字     |
| 焦点     | `--adv-c-focus`                                                                                                                                                                                | 游戏容器内可聚焦控件的可见轮廓 |
| 对话     | `--adv-dialog-bg`、`--adv-dialog-color`、`--adv-dialog-name-color`、`--adv-dialog-text-shadow`                                                                                                 | `AdvDialogBox`                 |
| 选项     | `--adv-choice-bg`、`--adv-choice-hover-bg`、`--adv-choice-color`、`--adv-choice-border`、`--adv-choice-radius`                                                                                 | `AdvChoice`                    |
| 弹层     | `--adv-modal-opacity`、`--adv-modal-bg-color`、`--adv-modal-motion-duration`                                                                                                                   | `AdvModal`                     |
| 存档     | `--adv-save-border-color`、`--adv-save-card-bg`、`--adv-save-card-radius`、`--adv-save-card-shadow`、`--adv-save-card-shadow-hover`、`--adv-save-control-radius`、`--adv-save-motion-duration` | 默认主题存档控件               |
| 主题扩展 | `--adv-theme-*`                                                                                                                                                                                | 主题自己提供消费样式           |

默认对话和选项的回退值保持原有外观。新增公共 token 时，必须同时提供真实消费点和文档，不能只扩大配置表。主题扩展变量无内置视觉效果，需由主题组件引用。

## 容器与样式隔离

`AdvGame` 自动把运行上下文中的 `themeConfig` 传给 `AdvContainer`。独立容器也可显式传入 `:theme="config"`；省略时使用已有 `themeConfigSymbol` 注入。容器也会把解析后的主题配置注入子组件，`useThemeConfig()` 因而读取当前实例的主题与扩展字段。`useGameUiTheme()` 提供响应式 `style`、`colorScheme` 与 `config`，供自定义游戏容器复用。

```vue
<script setup lang="ts">
import type { ThemeConfig } from '@advjs/types'
import AdvContainer from '@advjs/client/components/internals/AdvContainer.vue'

const theme: ThemeConfig = {
  ui: { colorScheme: 'light', tokens: { '--adv-c-primary': '#6b4d32' } },
}
</script>

<template>
  <AdvContainer :theme="theme">
    <!-- 自定义游戏内容 -->
  </AdvContainer>
</template>
```

容器标记为 `data-adv-ui="game"`。主题 CSS 使用 `.adv-*` 组件选择器或此作用域；不通过 `body`、裸 `button`、全局 `.dark` 重置宿主。历史 `:root` 游戏 token 保留兼容，嵌入场景优先使用容器配置或容器选择器。

逻辑画布提供名为 `adv-game` 的尺寸查询容器。默认对话框在画布宽度不超过 800px 时纵向排列姓名与正文，因此响应式游戏嵌入窄面板也能正确换行；容器查询按逻辑尺寸判断，固定尺寸舞台不会仅因缩放而触发此规则，同时保留已有的窄浏览器视口适配。

同一文档内的 CSS 仍可跨选择器影响内容。`AdvContainer` 提供局部主题配置与默认焦点样式，不提供 Shadow DOM 沙箱。自定义弹层应留在容器内；Teleport 到 `body` 会丢失局部 token，需显式建立带相同主题的目标范围或使用独立文档。

## 局部明暗模式与偏好

`AdvContainer` 和不缩放内容的 `AdvThemeScope` 提供局部颜色模式。默认主题的标题页、普通页面、菜单使用同一契约；菜单调用 `useGameColorMode()` 的 `toggle()`，不会修改宿主的 `html.dark`。未配置模式时先继承宿主，玩家选择后覆盖 `themeConfig.ui.colorScheme`；`reset()` 清除玩家选择并恢复配置或继承。

```vue
<script setup lang="ts">
import { useGameColorMode } from '@advjs/client'

// 必须在 AdvContainer / AdvThemeScope 的子组件中调用。
const { isDark, toggle, reset } = useGameColorMode()
</script>

<template>
  <button type="button" :aria-pressed="isDark" @click="toggle">
    深色模式
  </button>
  <button type="button" @click="reset">
    跟随主题
  </button>
</template>
```

独立游戏在启动时提供 `gameColorModeStorageKey`，以部署 `BASE_URL` 为键保存到 localStorage，切换标题/游戏路由与刷新后保持选择。同源同部署路径共用偏好；需要区分多个游戏时，由宿主为容器设置稳定的 `colorModeStorageKey`。此 prop 是实例创建时的配置，切换项目身份时应重新挂载容器。

嵌入预览默认只保存实例内的状态；`:color-mode-storage-key="false"` 可显式禁用继承来的持久化配置。两个实例不会互相同步玩家的切换。存储不可用时仍可在当前实例中切换。旧 `isDark` / `toggleDark` 保留为已弃用的宿主 API；导入 client 本身不再触发全局模式写入，显式调用旧 API 仍会修改宿主。

## 按钮与游戏弹层

默认 `AdvIconButton` 与开始菜单使用原生 `button type="button"`；图标操作通过 `title`（或显式 `aria-label`）命名。链接直接承担导航语义，不在链接里嵌套按钮。禁用图标按钮不会播放点击音效或触发操作。

`AdvModal` 基于 Reka Dialog，使用 `v-model:open` 控制显示，`header` 或 `label` 提供名称。内容留在当前游戏容器中，支持焦点进入、Tab 循环、Escape 关闭和返回打开前的元素。关闭时先更新 `open` 再发出 `close` 通知；旧调用方不要再在 `@close` 中反转同一状态，改为只使用 `v-model:open`，或幂等地设为 `false`。

## 交互契约与验收

- 对话能稳定推进，选择后走向对应分支，换肤不改变剧情状态或存档兼容性。
- 操作使用原生语义；仅图标按钮要有名称，Tab 顺序合理，焦点可见，模态关闭后返回合理位置。
- 对话正文与姓名在复杂背景下仍可读；颜色之外也提供状态提示。
- 验证默认主题与一个自定义主题、亮暗两种模式、正常尺寸和窄容器；检查长中文、英文标签与换行。
- 验证同屏 AGUI 控件不随游戏换肤，两个游戏容器互不修改样式，移除配置和卸载后无全局残留。
- 验证设置、存读档、历史和减少动态效果；局部 token 测试不能代替实际交互验收。

当前公共契约已覆盖容器、对话、选项及已有弹层/存档 token。历史组件仍有硬编码、图标名称和焦点管理的迁移工作；新增与改动组件按本规范验收，不宣称所有历史游戏界面已完成无障碍或移动端改造。

## 回归检查

在依赖已安装的工作区执行：

```bash
pnpm prepare:workspace unit
pnpm exec tsc -p tests/tsconfig.game-theme.json --noEmit
pnpm exec vitest run tests/unit/game-ui-theme.test.ts tests/unit/agui-controls.test.ts
```

CI 的 unit 作业在构建测试依赖后执行同一类型契约检查，再运行全部单测。类型检查覆盖旧主题接口、自定义字段推断、非法模式和混入工具 token；DOM 单测覆盖局部应用、响应式更新、默认恢复和相邻游戏隔离。两者不代替浏览器中的控件与样式验收。

## 历史界面迁移进度

| 顺序 | 范围             | 当前状态                                                                                                                                                                         |
| ---- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 局部明暗与偏好   | 已接入容器、标题页和菜单；独立游戏持久化，嵌入实例隔离。                                                                                                                         |
| 2    | 图标按钮与弹层   | 默认按钮、开始菜单、标题导航与游戏弹层已迁移；具备名称、禁用语义和焦点管理。                                                                                                     |
| 3    | 历史颜色与作用域 | 默认布局、设置页签、文字按钮和标题美术已使用局部 token；Pominis 标题渐变保留美术方向并使用局部扩展 token。各主题剩余滑块、进度条、全局 reset 等仍需逐组件审计。                  |
| 4    | 回归覆盖         | 单元覆盖模式隔离、持久化、存储异常、按钮和弹层；`tests/e2e/game-ui.spec.ts` 覆盖独立游戏刷新、路由和焦点流程。Editor / Studio 完整宿主场景与所有存档分支仍需持续扩展浏览器回归。 |

回归入口：`pnpm vitest run tests/unit/game-ui-theme.test.ts tests/unit/game-ui-interactions.test.ts tests/unit/agui-controls.test.ts`、`pnpm e2e tests/e2e/game-ui.spec.ts --project=chromium`。设计体系统一不要求移除主题的插画、渐变和剧情表现；这些应由游戏主题消费局部扩展 token，不能改变编辑器外壳。
