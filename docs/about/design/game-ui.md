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

`AdvGame` 自动把运行上下文中的 `themeConfig` 传给 `AdvContainer`。独立容器也可显式传入 `:theme="config"`；省略时使用已有 `themeConfigSymbol` 注入。`useGameUiTheme()` 提供响应式 `style` 与 `colorScheme`，供自定义游戏容器复用。

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

## 历史界面迁移顺序

统一契约与核心组件接入可以独立交付。迁移完整主题时，按下面的依赖关系补齐，不把现有行为误认为新契约已经覆盖：

| 顺序 | 入口                                                                                                  | 需要迁移的行为与验收条件                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `packages/client/composables/dark.ts`、`components/menu/RightTools.vue`、默认主题 `layouts/start.vue` | 旧 `isDark` / `toggleDark` 仍操作全局模式。先迁移游戏内亮暗状态的读写，再让标题背景和菜单消费同一局部状态；切换游戏模式后宿主和相邻游戏保持不变，并明确独立游戏的偏好持久化方式。 |
| 2    | `themes/theme-default/components/ui/AdvIconButton.vue`、`packages/client/components/ui/AdvModal.vue`  | 图标按钮仍使用可点击 `div`，弹层缺少完整的焦点管理。一起补原生按钮、可访问名称、对话框语义、焦点进入/约束/返回与 Escape 关闭；检查按钮调用处，避免嵌套交互元素。                  |
| 3    | 默认主题 `components/ui/AdvTextButton.vue`、`layouts/*`、游戏菜单与各主题 `styles/*`                  | 把编译期颜色、宿主 `dark:` 变体和全局样式逐步迁入游戏 token 与容器作用域；保留各主题的美术风格，核对省略 `ui` 时的兼容外观。                                                      |
| 4    | Starter、Editor 游戏预览、Studio `GamePlayer.vue`                                                     | 将手动验收覆盖的亮暗交叉、320px、键盘操作扩展为浏览器回归，并覆盖设置、存读档、历史和关闭弹层返回焦点。                                                                           |

第一项完成前，不应声称旧游戏菜单的亮暗切换已与宿主完全隔离；当前隔离保证针对 `ThemeConfig.ui` 的容器配置应用。
