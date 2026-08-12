# 文档写作指南

本指南是 ADV.JS 手写公共文档的格式与内容契约。目标是让读者、维护者、搜索引擎和 AI 工具看到同一套稳定结构，同时让关键规则可以由 CI 自动验证。

## 适用范围

以下目录遵循本指南：

- `docs/guide/`：面向游戏作者的产品指南；
- `docs/ai/`：AI 创作工作流与格式说明；
- `docs/contributing/`：贡献者文档；
- 手写的组件、插件与生态说明。

自动生成的 API 文档、变更日志、归档计划和第三方原文不要求机械迁移；生成器或上游格式优先。

## 上游基础

ADV.JS 文档以 [CommonMark](https://spec.commonmark.org/current/) 作为基础 Markdown 语法，以 [VitePress Markdown 扩展](https://vitepress.dev/guide/markdown) 提供容器、代码组和文件片段引用，并参考 [markdownlint 规则](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md) 选择可自动执行的格式约束。

规则采用以下优先级：

1. 内容和技术事实正确；
2. 示例可以复制、运行或明确标注为伪代码；
3. 页面结构与术语一致；
4. 排版偏好。

若规则影响 VitePress 扩展或降低示例可读性，应在检查器中做窄范围例外，不在页面中散布大段禁用注释。

## 页面结构

面向具体操作的指南遵循以下最小结构：

```md
# 页面标题

用一段话说明读者将在本页完成什么、适用什么场景。

## 核心主题

先说明行为和边界，再给出可运行示例。

## 验证

说明如何确认配置生效，以及常见失败表现。
```

概念总览、API 参考和索引页可以不设置独立的“验证”章节，但必须明确边界，并在正文中给出可执行的下一步或权威参考。具体要求如下：

- 每个文件恰好一个一级标题，且它是正文的第一个标题；
- 标题使用 ATX 形式，即 `#`、`##`、`###`，不跳级；
- 标题描述内容，不使用“其他”“更多”等脱离上下文的词；
- 开头先给结论或读者目标，不用“本文将会……”填充篇幅；
- 一个章节只承担一个主题，超过三级标题时优先拆页；
- 步骤有顺序依赖时使用有序列表，没有顺序时使用无序列表。

## Frontmatter

站点级默认值写在 `.vitepress/config/`，不要在每页重复。`outline: deep` 已由主题全局配置，普通指南无需 frontmatter。

仅在页面需要覆盖站点默认值时添加 YAML frontmatter，例如搜索摘要或特殊布局：

```yaml
---
description: 使用 ADV.JS 场景转场、立绘调度和 CG 画廊
outline: [2, 4]
---
```

Frontmatter 必须位于文件第一行，并使用合法 YAML。不要用它代替正文一级标题。

## 语言与术语

- 产品名统一写作 **ADV.JS**；包名、命令和代码标识保持原样，例如 `advjs`、`@advjs/core`；
- 脚本语言写作 **AdvScript**；PC/本地优先的专业创作工具写作 **Editor** 或 `@advjs/editor`，移动端优先的托管 AI SaaS 写作 **Studio** 或 `@advjs/studio`；
- 引擎概念首次出现时使用“中文（类型名）”或“类型名 + 中文说明”，后文保持一种写法；
- `Runtime`、`Effect`、`Snapshot` 等公开类型名保留英文和大小写；泛指运行时、效果或快照时使用中文；
- `CG`、`BGM`、`COS` 使用大写；`spritesheet` 使用小写；
- “用户”指使用 ADV.JS 制作游戏的开发者，“玩家”指运行游戏成品的人；
- 使用中文全角标点，代码、路径、命令和字段名放在反引号中。

避免使用“显然”“简单地”“只需”等替读者判断难度的表达。说明限制时同时给出可执行的处理方式。

## 代码与命令示例

围栏代码块必须声明语言。目录树、日志和非结构化输出使用 `text`，不要使用无语言代码块。

````md
```bash
pnpm docs:check
```

```text
adv/
└── settings/game.json
```
````

示例还应满足：

- 优先展示项目当前推荐 API，兼容旧写法时明确标注；
- TypeScript 使用 `ts`，Vue 单文件组件使用 `vue`，AdvScript 指令使用 `yaml`；
- 同一能力存在多种配置方式时使用 VitePress `code-group`，并解释选择条件；
- 长示例优先通过 `<<<` 引入可测试的真实文件片段，避免复制后逐渐失真；
- 命令默认不带 `$` 提示符，便于复制；
- 省略内容使用明确注释，不用无法解析的任意占位符伪装成完整配置；
- 示例出现实验性、浏览器专属或破坏性操作时，在代码块之前标明边界。

## 链接、图片与无障碍

- 站内链接使用 VitePress 的无扩展名路径，例如 `[项目结构](/guide/project-structure)`；
- 同目录链接使用相对路径，例如 `[角色管理](./editor/character)`；
- 不手写 `.html` 或 `.md` 后缀，不链接构建产物；
- 链接文字说明目标，不使用孤立的“点击这里”；
- 图片必须提供表达用途的替代文本；纯装饰图片使用空替代文本，并在组件层设置正确语义；
- 不只依赖颜色传递状态，表格中的图标同时提供文字；
- 外部规范和 API 优先链接其官方、版本稳定的页面。

## VitePress 扩展

提示容器按语义使用：

- `info`：补充背景或中性说明；
- `tip`：可选的改进建议；
- `warning`：兼容性、数据迁移或容易踩坑的行为；
- `danger`：可能造成数据丢失、凭证泄露或线上故障的操作；
- `details`：不影响主流程的长说明。

同一段内容不要同时使用粗体标题、引用和容器制造多重强调。组件与 Vue 表达式只在 Markdown 无法清晰表达交互时使用，并保证服务端渲染安全。

## 配置文件职责

文档提到工程配置时，以这张表为准：

| 文件                     | 权威职责                                     | 维护方式               |
| ------------------------ | -------------------------------------------- | ---------------------- |
| `adv.config.json`        | 声明项目格式与内容根目录，供工具识别         | 人工维护               |
| `adv/settings/game.json` | Studio 可安全读取的可移植游戏数据            | 人工或 Studio 维护     |
| `adv.config.ts`          | 在可信 CLI/Vite 项目中组装插件、主题和运行时 | 人工维护，可导入纯数据 |
| `adv/assets.json`        | 唯一资源根；内联条目或引用 `assets/` 分片    | Studio、人工或工具维护 |
| `adv/assets/*.json`      | 可选资源分片，只保存条目数组                 | Studio、人工或工具维护 |
| `adv/cos-release.json`   | 一次发布的精确对象、HTTP 元数据与顺序        | 发布流程生成，不手改   |
| `manifests/assets.json`  | 公开部署的稳定素材清单                       | 最后上传               |

`adv.config.ts` 可以导入 `adv/settings/game.json` 和 `adv/assets.json`，但不要在多个文件手写同一组素材 URL。Studio 不执行任意 TypeScript，因此需要跨 Studio 和正式游戏共享的数据必须保留在纯 JSON 中。游戏语义归 `settings/game.json`，资源身份与位置归 asset catalog，两者通过 `assetId` 关联。

## 素材文档

剧情和配置引用稳定逻辑 ID；本地路径和带内容哈希的 COS URL 只能由 asset catalog 的 Profile 解析生成。公共文档使用以下形式描述资源：

```text
background/summer-room
cg/star-in-hand
bgm/summer-day
```

不要把具体路径或哈希 URL 复制到 settings、角色卡或场景说明中。Schema 与分片规则统一引用[资源目录协议](/guide/assets/catalog)；发布目录、缓存、CORS、manifest-last 和完整性要求统一引用 [COS 素材发布规范](/guide/assets/cos)。

人类可读的来源与许可写入项目 `ASSETS.md`；机器可验证的 SHA-256、字节数、尺寸、生成版本和许可标识写入资源条目及构建 manifest。两者职责互补，不重复维护对象列表。

## 自动检查

提交文档前运行：

```bash
pnpm docs:check
pnpm docs:build
```

`docs:check` 当前检查 `docs/guide/` 和本指南，覆盖：

- 单一一级标题与连续标题层级；
- 围栏代码块语言；
- 冗余的全局 `outline: deep` frontmatter；
- 站内链接不带 `.md` 或 `.html`；
- 图片替代文本；
- 教程中不出现具体的哈希 COS URL；
- 资源文档只使用单一 `adv/assets.json` 根，且分片路径位于 `assets/` 下。

检查器只执行低歧义规则。事实正确性、示例可运行性、术语是否自然以及页面之间是否重复，仍由审阅者和 `docs:build` 负责。

## 提交前清单

- 页面开头是否直接说明结果或目标；
- 是否只有一个一级标题且标题不跳级；
- 所有代码块是否声明正确语言；
- 示例是否与当前类型、CLI 和目录结构一致；
- 是否明确区分 Studio 纯数据和可信 TypeScript 配置；
- 素材是否通过逻辑 ID 和 manifest 引用；
- 链接文字、图片替代文本和警告语义是否完整；
- 是否通过 `pnpm docs:check` 与 `pnpm docs:build`。
