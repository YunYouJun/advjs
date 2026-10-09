# 游戏 UI 设计规范

本页定义 ADV.JS 面向玩家的界面契约，适用于 `packages/client/`、`themes/*` 及项目覆盖组件。总分层见 [ADV.JS 设计体系](./design-system)。Editor、Studio 内嵌预览的游戏内容也遵循本页；预览外部的创作控件遵循各自的工具规范。

## 设计目标

阅读与选择优先。对话、选项、菜单、历史、存读档和设置保持可辨识的角色、可预测的操作与明确反馈。作品主题可改变字体、配色、材质、插画和动画，不强制采用 AGUI 的灰色外壳或 Studio 的紫金配色。

字号、行长和点击区域按最终显示尺寸验收。`AdvContainer` 可能缩放整个舞台，设计稿中的像素值不等于屏幕上的实际大小；移动端需检查真实阅读和触控体验。剧情动效与用户的减少动态效果偏好保持兼容。

默认对白正文在常规逻辑画布中为 22px，姓名为 20px，正文行高为 1.5 倍；桌面头像约为正文的四倍，窄布局头像缩小并与姓名并排。阅读设置提供小／中／大／超大四档，常规字号为 20／22／30／36px，保留玩家已保存的档位选择。阅读样式统一按游戏画布宽度收紧，800px 及以上使用所选字号，400px 及以下减小 2px，中间连续变化；默认正文范围为 20–22px，姓名保持正文的 10/11。设置中的示例使用同一阅读样式。固定舞台继续按项目配置整体缩放，逻辑字号不等于最终屏幕像素。

编辑器内嵌、独立预览和正式游戏使用同一客户端组件与样式，不给预览单独放大或缩小文字。断点、对白留白与人物列按游戏画布计算，不按外部编辑器窗口计算；相同画布尺寸、项目配置和玩家字号档位下，排版应一致。默认对白遮罩使用不平铺的渐变，不添加整块投影，避免在小数像素边缘出现横向接缝；作品仍可通过对话 token 自定义外观。

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

## 默认首页

默认首页把 Logo、标题和菜单放在同一个自适应容器中：标题 30px、菜单文字 18px，标题区与菜单默认间隔 36px；按钮等宽、至少 44px 高，使用无衬线字体。常规画布在右侧垂直居中，600px 以下居中排列，Logo 从 64px 收紧为 48px，内容区域底部避让旋转按钮；高度不足时允许滚动，长标题和按钮文字允许换行。尺寸按游戏舞台缩放补偿，预览、独立窗口与导出游戏使用相同规则。

默认首页使用局部深色模式，避免明亮宿主中黑色封面上的标题失去对比；`ThemeConfig.ui.colorScheme` 和玩家的模式选择仍可覆盖它，不改变宿主模式。运行时优先读取独立 `theme.config.*`，缺省字段继承原有 `adv.config.*` 中的 `themeConfig`。

菜单复用原来的运行时动作，悬停、按下和键盘焦点沿用共用玩家控件反馈。整组使用 180ms 纯淡入，减少动态为 80ms，关闭或系统减少动态时直接显示；没有逐项等待或滑入。旋转入口留在游戏容器的未缩放控件层，使用共用按钮与提示。

默认主题消费以下 `ThemeConfig.ui.tokens` 扩展；仅影响游戏内容：`--adv-theme-start-title-gap`（36px）、`--adv-theme-start-title-size`（30px）、`--adv-theme-start-title-color`（正文颜色）、`--adv-theme-start-menu-size`（18px）、`--adv-theme-start-menu-color`（正文颜色）。原有菜单底面、悬停颜色与 Logo token 继续生效。布局覆盖使用项目 `pages/start.vue`，按钮覆盖使用 `components/start/StartMenu.vue`，外观配置可使用 `theme.config.json` 或既有可执行配置。标题页的 `AdvContainer` 同时接收运行时画布配置与局部主题配置。

## 公共 token

精确名单由 `packages/types/src/config/theme.ts` 的 `gameUiTokenNames` 定义；CSS 默认值仍由实际样式和组件持有。

| 类别     | token                                                                                                                                                                                                                                      | 默认消费位置                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 基础颜色 | `--adv-c-primary`、`--adv-c-primary-light`、`--adv-c-text`、`--adv-c-text-1/2/3`、`--adv-c-bg`、`--adv-c-bg-alt`                                                                                                                           | 游戏控件、菜单、内容表面       |
| 排版     | `--adv-font-family`、`--adv-font-serif`                                                                                                                                                                                                    | 游戏容器正文、主题衬线文字     |
| 焦点     | `--adv-c-focus`                                                                                                                                                                                                                            | 游戏容器内可聚焦控件的可见轮廓 |
| 操作栏   | `--adv-control-color`、`--adv-control-hover-bg`、`--adv-control-hover-border`、`--adv-control-active-bg`、`--adv-control-active-color`、`--adv-control-radius`                                                                             | 顶部图标、底部文字和快速存读档 |
| 操作提示 | `--adv-tooltip-bg`、`--adv-tooltip-border`                                                                                                                                                                                                 | `GameControlHint`              |
| 对话     | `--adv-dialog-bg`、`--adv-dialog-color`、`--adv-dialog-name-color`、`--adv-dialog-text-shadow`                                                                                                                                             | `AdvDialogBox`                 |
| 选项     | `--adv-choice-bg`、`--adv-choice-hover-bg`、`--adv-choice-color`、`--adv-choice-border`、`--adv-choice-radius`                                                                                                                             | `AdvChoice`                    |
| 结束画面 | `--adv-end-bg`、`--adv-end-color`、`--adv-end-font-family`、`--adv-end-font-size`、`--adv-end-font-weight`、`--adv-end-letter-spacing`、`--adv-end-text-shadow`、`--adv-end-padding`、`--adv-end-align-items`、`--adv-end-justify-content` | `AdvEnd`                       |
| 弹层     | `--adv-modal-opacity`、`--adv-modal-bg-color`、`--adv-modal-motion-duration`                                                                                                                                                               | `AdvModal`                     |
| 存档     | `--adv-save-border-color`、`--adv-save-card-bg`、`--adv-save-card-radius`、`--adv-save-card-shadow`、`--adv-save-card-shadow-hover`、`--adv-save-control-radius`、`--adv-save-motion-duration`                                             | 默认主题存档控件               |
| 主题扩展 | `--adv-theme-*`                                                                                                                                                                                                                            | 主题自己提供消费样式           |

默认对话和选项的回退值保持原有外观。新增公共 token 时，必须同时提供真实消费点和文档，不能只扩大配置表。主题扩展变量无内置视觉效果，需由主题组件引用。

操作栏默认文字继承所在控件颜色，顶部图标为白色；文字按钮悬停底色为白色 10% 透明度，按下为白色 18%，顶部图标则用深灰 48%／65% 底面，以保持明亮插画上的对比。悬停边线均为当前文字颜色 20%，开启底色为主色 14%。开启文字沿用主色，并带短下划线；圆角为 4px，按舞台缩放补偿。`--adv-control-active-bg` 同时覆盖按下与开启底色。操作提示底色沿用 `--adv-c-bg-alt`，边线为 `--adv-c-text` 的 16%；标题沿用 `--adv-c-text`，说明沿用 `--adv-c-text-2`。两处共用颜色 token，作品可以只配置操作栏与提示的局部 token。

## 自定义结束画面

结束画面使用当前游戏容器的主题，编辑器预览与正式游戏采用同一组件。在 `theme.config.ts` 中配置结束文字与外观：

```ts
import { defineThemeConfig } from 'advjs'

export default defineThemeConfig({
  ui: {
    end: { text: '故事完\n感谢游玩' },
    tokens: {
      '--adv-end-bg': 'linear-gradient(180deg, #18202a, #080c12)',
      '--adv-end-color': '#efce8d',
      '--adv-end-font-family': '"Songti SC", serif',
      '--adv-end-font-size': 'clamp(2rem, 6cqw, 5rem)',
      '--adv-end-font-weight': '500',
      '--adv-end-letter-spacing': '0.15em',
      '--adv-end-text-shadow': '0 2px 12px #000',
      '--adv-end-padding': '2rem',
      '--adv-end-align-items': 'center',
      '--adv-end-justify-content': 'center',
    },
  },
})
```

默认文字为 `- END -`；`ui.end.text` 是纯文本，支持换行，空字符串只保留结束背景。默认背景为黑色 60% 透明度，文字为白色，字体继承游戏字体，字号为 `clamp(2rem, 8cqw, 6rem)`，字重 700，正常字距、无阴影、四周留白 1.5rem，横纵居中。`cqw` 随逻辑游戏画布宽度变化；固定画布仍整体缩放。长文字自动换行，超出高度时可滚动。

任意布局、插画、片尾字幕和按钮可在项目或主题中提供 `components/AdvEnd.vue`，它会覆盖内置结束组件。覆盖组件仍由 `ended` 状态控制显示，应把样式限定在游戏范围内，并复用运行时导航与存档动作。

直接嵌入 `AdvGame` 的宿主也可以通过 `end` 插槽替换整个结束画面；插槽仅在游戏结束时挂载，需要提供一个根元素并自行设置覆盖舞台的布局。若保留内置背景和排版，可复用 `AdvEnd` 的默认插槽，插槽参数 `text` 是解析后的结束文字，组件的 `text` prop 优先于主题配置：

```vue
<script setup lang="ts">
import AdvEnd from '@advjs/client/components/adv/AdvEnd.vue'
import AdvGame from '@advjs/client/components/game/AdvGame.vue'
</script>

<template>
  <AdvGame>
    <template #end>
      <AdvEnd v-slot="{ text }" class="story-end">
        <h2>{{ text }}</h2>
        <p class="story-end__note">
          每一个选择，都留下了回声。
        </p>
      </AdvEnd>
    </template>
  </AdvGame>
</template>

<style scoped>
.story-end {
  text-align: left;
}
.story-end__note {
  font-size: 1rem;
}
</style>
```

内置组件提供 `.adv-end`、`.adv-end__content`、`.adv-end__text` 样式钩子。项目 CSS 可进一步调整布局；主题专属参数使用 `--adv-theme-*`。结束样式不会改变旁白、活动遮罩或相邻编辑器控件。

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

逻辑画布提供名为 `adv-game` 的尺寸查询容器。默认对话框有头像时采用人物区与正文两列；无头像、关闭头像或图片加载失败时，将姓名放到正文上方，取消空的人物列。姓名字号为阅读字号的 10/11，使用半粗体，随玩家字体设置同步变化；没有说话人时不保留空姓名区域。

画布宽度不超过 800px 时，头像缩小并与姓名并排，正文置于下一行，因此响应式游戏嵌入窄面板也能正确换行；容器查询按逻辑尺寸判断，固定尺寸舞台不会仅因缩放而触发此规则。仅不支持尺寸查询容器的浏览器使用视口断点回退。

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

默认选项整组使用 160ms 的纯透明度淡入，80ms 淡出，不位移、不逐项延迟，进入动画期间即可选择。玩家选择减少动态效果时淡入缩短为 80ms；关闭动态效果或系统要求减少动态效果时直接显示。实时／构建预览与正式游戏共用此规则。

游戏操作按阅读职责分布：顶部为立绘、旋转、音乐、全屏、画廊和设置等显示工具，底部文字栏为回看、自动、快进、快速／手动存读档和隐藏界面。顶部工具位于不缩放的游戏容器中，保持实际点击尺寸；底栏为对白预留测量后的空间，窄容器按组换行，不能挤压或遮住正文。

底栏支持常驻、自动收起、保持收起，偏好保存到玩家设置；旧设置缺失时默认常驻。收起不隐藏对白，并保留展开入口与播放停止状态。提示留在当前游戏容器内，键盘焦点和提示打开时不自动收起；点击控件、按 Space 激活聚焦按钮均不能同时推进剧情。

顶部图标、底部文字与快速存读档共用悬停、按下和开启状态规则：悬停显示浅底面与细边线，开启增加短下划线，只有键盘焦点显示独立外框，状态变化不改变按钮尺寸。状态过渡为 120ms，减少动态时为 80ms，关闭或系统减少动态时取消过渡。操作提示在鼠标悬停或键盘聚焦时立即显示，不设置停留等待；采用 100ms 纯淡入，减少动态时为 80ms，关闭或系统减少动态时直接显示。提示最长 240px，标题 13px 半粗体、说明 12px／1.5 倍行高、4px 圆角和中性细边框，避免用整圈主色描边吸引阅读注意力。说明尽量简短，并保留覆盖进度等必要影响；提示在窄画面内避让边缘，Escape 可关闭。

默认 `AdvIconButton` 与开始菜单使用原生 `button type="button"`；图标操作通过 `title`（或显式 `aria-label`）命名。链接直接承担导航语义，不在链接里嵌套按钮。禁用图标按钮不会播放点击音效或触发操作。

`AdvModal` 基于 Reka Dialog，使用 `v-model:open` 控制显示，`header` 或 `label` 提供名称。内容留在当前游戏容器中，支持焦点进入、Tab 循环、Escape 关闭和返回打开前的元素。关闭时先更新 `open` 再发出 `close` 通知；旧调用方不要再在 `@close` 中反转同一状态，改为只使用 `v-model:open`，或幂等地设为 `false`。

默认弹层标题使用游戏正文字体、600 字重和 20–28px 最终显示字号，关闭按钮保持 36px 点击区域。存读档每页保留六个手动槽位，按逻辑画布宽度布局：960px 及以上为三列两行，600–959px 为两列三行，更窄时为单列。卡片行高随可用高度分配，常规画布完整显示一页；窄屏或高度不足时保留滚动，不能通过裁切存档或过度缩小文字消除滚动条。标题、卡片文字和分页控件按舞台缩放补偿，不依赖宿主的根字号或窗口断点。

设置页的标签、选项和侧边菜单默认使用 16px 最终显示字号，页签为 18px；按钮、输入与开关采用同一控件尺度，间距使用局部字体单位。舞台缩放时补偿控件尺寸，不跟随宿主的 `rem` 字号放大；玩家选择的对白字号只改变阅读正文与预览样例。设置按「对白、画面、音频、语音」四个页签组织：对白包含播放速度、字体、显示模式与操作栏，画面包含横屏、全屏与动态效果，音频包含音效、音乐开关与音量，语音保留语音合成选项。切换页签不重置表单选择或局部控件状态；页签支持方向键、Home 和 End 导航，隐藏内容不进入键盘焦点顺序。

设置页按实际预览容器布局：600px 以下把侧边菜单移到底部，并将顶部工具组与四个页签分成两行，440px 以下将标签与控件分行；页签和操作菜单保持可见，长内容在自己的区域滚动。亮暗模式与语言入口组成具名工具组，宽布局放在页签右侧，窄布局放在独立顶行，和导航动作分开排列；关闭入口保留独立空间。正常 1200×720 画布完整显示默认对白设置，较矮的预览允许内容滚动，不缩小文字或裁掉控件。开关可用键盘激活，音量滑条与数值输入同步，选择器使用已有选项回调。菜单与表单沿用游戏主题主色、焦点颜色和 `--adv-control-radius`，弹层覆盖未缩放的系统控件，避免图标叠在菜单上。

默认存档卡片与分页圆角继承 `--adv-control-radius`（4px），细边框由当前文字颜色的 16% 生成，默认无投影；卡片悬停边框沿用游戏主色。作品可继续通过 `--adv-save-*` 覆盖卡片与分页外观，圆角值按最终显示尺寸使用。无缩略图时显示占位图标。手动存档使用保存图标，读档使用文件夹上箭头，快速存读档使用保存／恢复图标；菜单入口和弹层标题保留文字，图标不重复提供无障碍名称。

默认与 Pominis 主题共用游戏 Slider 几何样式，由 Reka UI 提供拖动与键盘行为；组件保留单个数值的 `v-model`、`input` 事件与数值输入。轨道、填充与滑块使用游戏正文色、主色与 `--adv-control-radius`；尺寸使用局部字体单位，在设置页保持 36px 操作区、4px 轨道与 16px 滑块，舞台缩放时由所在表单补偿。方向键按步长调节，Home / End 到达边界，PageUp / PageDown 按十个步长调节。数值编辑保留有效小数，限制在 min / max 范围内，空草稿失焦时恢复当前值；禁用阻止两种输入方式。可访问名称与说明作用于滑块和数值输入，不依赖浏览器默认的 range 外观，不使用 AGUI 样式。

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
pnpm exec vitest run tests/unit/client/game-ui-theme.test.ts tests/unit/client/game-end.test.ts tests/unit/gui/agui-controls.test.ts
```

CI 的 unit 作业在构建测试依赖后执行同一类型契约检查，再运行全部单测。类型检查覆盖旧主题接口、自定义字段推断、非法模式和混入工具 token；DOM 单测覆盖局部应用、响应式更新、默认恢复和相邻游戏隔离。两者不代替浏览器中的控件与样式验收。

## 历史界面迁移进度

| 顺序 | 范围             | 当前状态                                                                                                                                                                         |
| ---- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 局部明暗与偏好   | 已接入容器、标题页和菜单；独立游戏持久化，嵌入实例隔离。                                                                                                                         |
| 2    | 图标按钮与弹层   | 默认按钮、开始菜单、标题导航与游戏弹层已迁移；具备名称、禁用语义和焦点管理。                                                                                                     |
| 3    | 历史颜色与作用域 | 默认布局、设置页签、文字按钮和标题美术已使用局部 token；Pominis 标题渐变保留美术方向并使用局部扩展 token。各主题剩余滑块、进度条、全局 reset 等仍需逐组件审计。                  |
| 4    | 回归覆盖         | 单元覆盖模式隔离、持久化、存储异常、按钮和弹层；`tests/e2e/game-ui.spec.ts` 覆盖独立游戏刷新、路由和焦点流程。Editor / Studio 完整宿主场景与所有存档分支仍需持续扩展浏览器回归。 |

回归入口：`pnpm vitest run tests/unit/client/game-ui-theme.test.ts tests/unit/client/game-ui-interactions.test.ts tests/unit/gui/agui-controls.test.ts`、`pnpm e2e tests/e2e/game-ui.spec.ts --project=chromium`。设计体系统一不要求移除主题的插画、渐变和剧情表现；这些应由游戏主题消费局部扩展 token，不能改变编辑器外壳。
