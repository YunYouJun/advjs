# adv-theme

`adv-theme` 让 AI Agent 根据故事设定为游戏设计玩家界面主题：读取剧情简介，选择最轻的实现层，写入配置，通过 `adv check` 校验，再截图检查并迭代。贴图、标题插画和背景等图片需求交给 [`adv-art`](https://github.com/YunYouJun/advjs/blob/main/skills/adv-art/SKILL.md)。

它属于可选 Skill，按需安装：

```bash
adv agent install --client claude-code --skills adv-theme
```

## 命令与工具

| 用途                                       | CLI                                                                 | MCP                                |
| ------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------- |
| 剧情简介                                   | `adv context`                                                       | `adv://project/overview`           |
| token 契约、对比度配对、预设与当前主题状态 | `adv context --theme`                                               | `adv://theme`（JSON）              |
| 从预设开始                                 | `adv theme init --preset <id> [--force]`                            | —                                  |
| 校验                                       | `adv check --json`（`ADV_THEME_*` 诊断）                            | `adv_validate`                     |
| 截图                                       | `adv theme screenshot [--viewport name=宽x高] [--url <开发服务器>]` | `adv_theme_screenshot`（返回图片） |

截图需要在项目中安装 Playwright 与 Chromium：`npm i -D playwright && npx playwright install chromium`。未传 `--url` 时，命令会自行启动与桌面端预览相同的项目播放器。

## 三个实现层

| 层          | 适用                         | 位置                                                                                                  |
| ----------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| L1 token    | 颜色、字体、圆角、阴影、动效 | `theme.config.ts` 的 `ui.tokens`，以及由项目样式读取的 `--adv-theme-*`                                |
| L2 项目覆盖 | 单个作品的结构差异           | 项目内 `pages/start.vue`、`components/start/StartMenu.vue`、`components/AdvEnd.vue`、`styles/index.*` |
| L3 主题包   | 多个作品共享的外观           | 从 `themes/theme-starter` 复制的主题包                                                                |

只换外观时停留在 L1；只有需要不同结构时才进入 L2 或 L3。所有样式限定在 `[data-adv-ui="game"]` 内，保留可见焦点，遵守减少动态偏好，并检查长文本与窄画布。规范见 [游戏 UI 设计规范](/about/design/game-ui)。

## 预设

| 预设           | 配色 | 适合                           |
| -------------- | ---- | ------------------------------ |
| `neon-noir`    | 深色 | 赛博朋克、侦探、黑色电影、惊悚 |
| `paper-ink`    | 浅色 | 历史、文学、古典推理、武侠     |
| `after-school` | 浅色 | 日常、校园、恋爱、轻喜剧       |

预设只是起点。Skill 要求按故事修改强调色、角色名颜色、对话框底面、选项形状与字体，不能原样交付。

## 校验

`adv check` 会读取 `adv.config` 中的 `themeConfig` 与 `theme.config.*`（后者优先），并给出稳定诊断码：

| 诊断码                                                     | 含义                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `ADV_THEME_UNKNOWN_TOKEN`                                  | token 不在契约中，也不是 `--adv-theme-*`；运行时会忽略它，诊断会给出最接近的名称 |
| `ADV_THEME_MISSING_UNIT`                                   | 长度、阴影或时长缺少单位（长度只有 0 可省略）                                    |
| `ADV_THEME_INVALID_TOKEN_VALUE`                            | 非字符串、空值、含 `;`、花括号或 `!important`                                    |
| `ADV_THEME_INVALID_COLOR`                                  | 颜色 token 的值不是颜色                                                          |
| `ADV_THEME_INVALID_COLOR_SCHEME`                           | `colorScheme` 不是 `light` 或 `dark`                                             |
| `ADV_THEME_LOW_CONTRAST`                                   | 已声明的配对低于 WCAG 2.2 AA：正文 4.5:1，大字与焦点 3:1                         |
| `ADV_THEME_CONTRAST_UNVERIFIED`                            | 配对无法计算（如 `oklch()` 或图片），需靠截图确认                                |
| `ADV_THEME_CONFIG_LOAD_FAILED`、`ADV_THEME_INVALID_CONFIG` | 配置无法加载或结构错误                                                           |

对比度只检查项目声明过（直接或经 `var()` 间接影响）的配对。半透明底面会分别叠加在深色与浅色场景上计算：两种场景都不达标为错误，只有一种不达标为 `uncertain` 警告。未指定 `colorScheme` 时，浅色与深色两套默认值都会参与计算。

## 截图

`adv theme screenshot` 默认在 1280×720 与 390×844 两个视口、开启减少动态的条件下截取：

`1-title`、`2-dialogue`、`3-choice`、`4-backlog`、`5-save`、`6-long-dialogue`、`7-long-choice`

文件写入 `.adv/theme-screenshots/<视口>/`，`report.json` 记录未能到达的状态（例如剧情还没有选项）与控制台错误。Skill 要求逐张查看并按清单写下问题后再修改。
