# 项目结构

ADV.JS 将可移植的游戏内容、可信的 Web 宿主、可复现素材流程和本地工具状态分层存放。同一份 `adv/` 内容可以被 Studio、CLI 和 Vite 游戏读取，而不会要求 Studio 执行项目中的任意 TypeScript。

## 推荐结构

```text
my-game/
├── adv.config.json              # 项目标识与内容根目录
├── adv.config.ts                # 可选：可信 CLI/Vite 宿主配置
├── package.json                 # Web 工程元信息与依赖
│
├── adv/                         # 可移植的游戏内容
│   ├── index.adv.json           # 章节与入口索引
│   ├── settings/
│   │   └── game.json            # Studio 可读取的纯 JSON 设置
│   ├── assets.json              # 唯一资源目录根：内联 assets 或 includes
│   ├── cos-release.json         # 生成的精确 COS 发布计划
│   ├── assets/                  # 本地媒体与可选资源分片
│   │   ├── characters.json
│   │   ├── backgrounds.json
│   │   ├── cg.json
│   │   └── audio.json
│   │
│   ├── world.md                 # 世界观、规则与叙事基调
│   ├── outline.md               # 故事大纲与分支结构
│   ├── glossary.md              # 可选：项目术语表
│   ├── chapters/                # `.adv.md` 剧本
│   ├── characters/              # `.character.md` 角色卡
│   ├── scenes/                  # 场景描述与生成提示
│   ├── locations/               # 可选：世界观地点
│   └── audio/                   # 音频描述卡或项目内音频
│
├── pages/                       # 可选：覆盖开始页等主题页面
├── layouts/                     # 可选：项目专属布局
├── components/                  # 可选：项目专属组件
├── styles/                      # 可选：项目级样式
├── public/                      # 应用壳静态文件
│   └── favicon.svg
│
├── scripts/                     # 可复现的素材生成与校准脚本
├── temp/                        # 忽略：原图、QA 与待发布包
├── .adv/                        # 忽略或按需提交：工具状态
│   └── editor/
└── README.md
```

小型项目可以省略未使用的目录，并把资源直接内联到 `adv/assets.json`。正式发布不要求把图片和音频复制到 `public/`；带内容哈希的成品由构建后的扁平资源目录映射到公共对象存储。

## 分层模型

| 层级         | 主要文件或目录                            | 消费者                   | 是否执行代码 |
| ------------ | ----------------------------------------- | ------------------------ | ------------ |
| 项目标识     | `adv.config.json`                         | Studio、编辑器、CLI      | 否           |
| 可移植内容   | `adv/`、`adv/settings/game.json`          | Studio、CLI、正式游戏    | 否           |
| 可信宿主     | `adv.config.ts`、`pages/`、`components/`  | CLI/Vite 构建            | 是           |
| 素材与发布   | `adv/assets.json`、`adv/cos-release.json` | 素材脚本、宿主、发布工具 | 否           |
| 本地工作状态 | `temp/`、`.adv/`                          | 素材工具、编辑器         | 不进入游戏   |

这层边界解决两个常见问题：Studio 可以安全打开导入的项目；正式游戏仍可以使用插件、主题和 Vue 页面等可信代码能力。

## 配置文件职责

### `adv.config.json`

`adv.config.json` 是项目识别锚点，位于项目根目录，声明内容格式和内容根目录。Studio、编辑器和 CLI 可以在不执行代码的前提下读取它。

```json
{
  "format": "adv-md",
  "root": "./adv"
}
```

它不保存玩家设置、剧情变量或素材 URL。

### `adv/settings/game.json`

`adv/settings/game.json` 保存需要在 Studio 与正式游戏之间共享的纯数据，例如标题、初始变量、跨周目键、画廊展示数据和必需插件版本。

```json
{
  "title": "我的文字冒险",
  "description": "一段可以在 Studio 中试玩的故事",
  "variables": {
    "chapterCompleted": false
  },
  "progression": {
    "id": "my-game",
    "version": 1,
    "keys": ["chapterCompleted"]
  },
  "requiredPlugins": {
    "star-map": "1.0.0"
  }
}
```

Studio 不执行 `adv.config.ts`，所以跨宿主共享的数据不能只存在于 TypeScript 中。由素材清单派生的画廊 URL 应由工具同步到该文件，不应形成第二份人工维护的事实源。

### `adv.config.ts`

`adv.config.ts` 是可信 CLI/Vite 项目的组装层。它负责导入主题和插件、注册项目组件，并把纯数据配置与素材清单转换成运行时 `gameConfig`。以下是省略章节和角色字段的素材组装片段：

```ts
import { createAdvAssetCatalog } from '@advjs/core'
import { defineAdvConfig } from 'advjs'
import artManifest from './adv/assets.json'
import gameSettings from './adv/settings/game.json'

const assets = createAdvAssetCatalog(artManifest)
const cover = (await assets.resolve('background/title')).src

export default defineAdvConfig({
  gameConfig: {
    ...gameSettings,
    cover,
    // chapters、characters、scenes 与 bgm 继续由内容和清单组装
  },
})
```

不要在 `adv.config.ts` 和多个内容卡中重复手写同一组带哈希 URL。

### 配置优先级

| 文件                     | 权威职责                                    | 维护方式             |
| ------------------------ | ------------------------------------------- | -------------------- |
| `adv.config.json`        | 项目格式与内容根目录                        | 人工维护             |
| `adv/settings/game.json` | Studio 可读取的可移植游戏数据               | 人工或 Studio 维护   |
| `adv.config.ts`          | 可信宿主的插件、主题和运行时组装            | 人工维护             |
| `adv/assets.json`        | 唯一素材根、Profile、逻辑 ID 或分片入口     | Studio、人工或工具   |
| `adv/cos-release.json`   | 一次发布的对象、HTTP 元数据和 manifest 顺序 | 发布流程生成，不手改 |

## 游戏内容目录

### `adv/index.adv.json`

内容入口定义章节、节点或其他可移植索引。Studio 原生项目以它为主要入口；CLI/Vite 项目也可以在 `adv.config.ts` 中显式组装位于 `public/` 的章节，但应避免维护两套章节事实。

### `adv/chapters/`

每个 `.adv.md` 文件承担一个章节或场景。可链接节点使用稳定 ID，跨章节跳转不依赖显示标题或文件排序。具体语法参见 [AdvScript](/guide/advscript/)。

### `adv/world.md`、`outline.md` 与 `glossary.md`

- `world.md` 定义时代、规则、美术和叙事原则；
- `outline.md` 定义幕、章节、分支与结局；
- `glossary.md` 记录必须保持一致的项目术语。

这些文件服务于创作和 AI 上下文，引擎运行时不直接读取。格式参见 [AI 创作文件格式规范](/ai/formats)。

### `adv/characters/`

每个角色使用一个 `.character.md` 文件。YAML frontmatter 保存稳定 ID、名称、别名、关系和生成字段；正文描述外貌、性格、背景和说话方式。

```md
---
id: aria
name: 艾莉亚
aliases:
  - 银星旅者
tags:
  - 主角
---

## 外貌

银发碧眼，身着旅行者斗篷。

## 说话风格

语句简短，描述星空时会使用航海隐喻。
```

角色卡记录创作事实；正式立绘 URL 由 `adv/assets.json` 和宿主配置组装。

### `adv/scenes/` 与 `adv/locations/`

场景是可切换的视觉单元，地点是世界观中的地理实体。一个地点可以关联清晨、夜晚或灾变后的多个场景。

```md
---
id: school-rooftop
name: 学校天台
imagePrompt: >-
  Wide visual novel background, school rooftop at sunset,
  warm light, no characters, 16:9
tags:
  - 学校
  - 户外
---

## 氛围

海风越过围栏，城市噪声被拉成遥远的底色。
```

可复用背景不得包含前景人物；场景卡保存描述和提示词，最终图片仍由素材清单管理。

### `adv/audio/`

`adv/audio/` 保存 Studio 可编辑的音频描述卡；二进制音频位于 `adv/assets/audio/`，由资源目录管理。描述卡只使用稳定 `assetId`，正式 BGM 与 SFX 的本地路径、对象键和哈希在资源目录中登记。

```md
---
name: summer-day
assetId: bgm/summer-day
duration: 24
tags:
  - 日常
  - 循环
---
```

旧项目中的 `src` 仍可读取，但新项目不要在描述卡中重复保存路径或 URL。

## 素材与发布

### `adv/assets.json`

素材清单是逻辑素材的唯一根入口。每项至少包含稳定 `id`、语义 `kind`、媒体 `type`；进入发布阶段后由工具补充对象键、完整 SHA-256、字节数、尺寸或时长、许可和来源。绝对 URL 由 Profile 解析，不在每项重复保存。

剧情、场景调度和 UI 使用 `background/summer-room`、`character/aria/default`、`cg/finale` 等逻辑 ID；宿主再从清单解析实际 URL。

大型项目仍使用 `adv/assets.json` 作为唯一根，但将 `assets` 替换为指向 `adv/assets/*.json` 的 `includes`。Studio 与构建器在内存中合并分片，扁平结果只进入构建或发布目录。完整 Schema、Profile、Bundle 和兼容规则参见[资源目录协议](./assets/catalog)。

### `adv/cos-release.json`

发布计划精确列出本次需要上传的物理对象、HTTP 元数据和顺序。同一张 CG 的原图与缩略图是两个对象，因此发布对象数可以多于逻辑素材数。稳定 manifest 必须最后上传。

完整目录、缓存、CORS 和发布验收参见 [COS 素材发布规范](./assets/cos)。

### `ASSETS.md`

项目根目录的 `ASSETS.md` 面向人类记录来源、作者、许可、生成方式和最后核验日期。它不重复列出每个对象的哈希；机器可验证字段保留在资源目录条目或构建 manifest 中。

## Web 宿主与本地状态

### `pages/`、`layouts/`、`components/` 与 `styles/`

这些目录用于项目级界面覆盖。`pages/start.vue` 可以替换默认开始页，`components/` 可以覆盖设置或活动组件，`styles/index.scss` 在主题样式之后加载。

开始页应通过 `useAdvStartActions()` 进入章节、打开读档或设置。完整示例参见 [自定义开始界面](./customization/start-screen)。

### `public/`

`public/` 中的文件会原样随 Web 应用部署，适合 favicon、PWA 图标和 Open Graph 图片。正式立绘、背景、CG 与 BGM 不应同时复制到 `public/` 和 COS。

### `scripts/` 与 `temp/`

可复现的生成、抠图、音频归一化、清单生成和审计脚本放在 `scripts/`。原图、QA contact sheet、WAV 中间文件和待发布包写入被 Git 忽略的 `temp/{game-id}-art/`。

### `.adv/`

`.adv/` 保存编辑器布局、缓存和其他工具状态，不属于游戏运行时内容。默认加入 `.gitignore`；团队确需共享的编辑器设置可以按文件选择性提交。

## 最小结构

便携的单章节项目至少需要：

```text
my-game/
├── adv.config.json
└── adv/
    ├── index.adv.json
    └── chapters/
        └── start.adv.md
```

需要构建为定制 Web 游戏时，再增加 `package.json`、`adv.config.ts` 和界面覆盖目录。

## 参考

- [文档写作指南](/contributing/writing-guide)
- [COS 素材发布规范](./assets/cos)
- [资源目录协议](./assets/catalog)
- [角色管理](./editor/character)
- [Studio 技术架构](./studio/architecture)
