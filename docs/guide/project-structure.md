# 项目结构

ADV.JS 游戏工程遵循约定优于配置的原则，参考游戏引擎工程（如 Unity、Godot）的目录分层实践，将不同职责的文件归入对应目录。

## 推荐结构

```
my-game/
├── adv.config.json              # 工程配置（编辑器识别锚点，root 指向 adv/）
├── package.json                 # 项目元信息（名称、版本、依赖）
│
├── public/                      # 静态资源（直接serve，不经构建处理）
│   └── favicon.svg              # 游戏图标
│
├── adv/                         # 游戏内容根目录
│   ├── index.adv.json           # 游戏入口（章节、剧情索引）
│   │
│   ├── world.md                 # 世界观圣经（设定、规则、基调、美术风格）
│   ├── outline.md               # 故事大纲（幕、章、情节节点、分支结构）
│   ├── glossary.md              # 术语表（可选，大型世界观项目）
│   │
│   ├── chapters/                # 剧本脚本（按章节拆分）
│   │   ├── README.md            # AI 上下文摘要 — 各章概要和创作状态
│   │   ├── chapter_01.adv.md   # 第一章
│   │   ├── chapter_02.adv.md   # 第二章
│   │   └── ...
│   │
│   ├── characters/              # 角色卡片库
│   │   ├── README.md            # AI 上下文摘要 — 角色关系图谱概览
│   │   ├── aria.character.md
│   │   └── kai.character.md
│   │
│   ├── scenes/                  # 场景定义
│   │   ├── README.md            # AI 上下文摘要 — 场景总览
│   │   └── school.md            # 场景描述文件
│   │
│   ├── bgm/                     # 背景音乐（引用路径）
│   │
│   ├── assets/                  # 素材资源（立绘、背景、音效、UI 等）
│   │   ├── backgrounds/         # 场景背景图
│   │   ├── tachies/             # 角色立绘
│   │   ├── sfx/                 # 音效
│   │   └── ui/                  # UI 素材
│   │
│   └── settings/                # 游戏运行时设置
│       └── game.json            # 全局参数（文字速度、音量等）
│
├── .adv/                        # ADV.JS 专属目录（可加入 .gitignore）
│   ├── editor/                  # 编辑器配置（布局、偏好等）
│   └── temp/                    # 临时文件（自动生成，勿手动修改）
│
└── README.md                    # 项目说明
```

## 目录说明

### `adv.config.json`

**工程级**配置，编辑器识别项目类型的锚点文件，必须位于根目录。编辑器启动时通过 `getFileHandle('adv.config.json')` 直接在根目录查找。通过 `root` 字段指定游戏内容目录（默认为 `adv/`）。

```json
{
  "format": "adv-md",
  "root": "./adv"
}
```

> **为什么不放进 `adv/settings/`？**
> `adv.config.json` 是编辑器的"项目识别凭证"，类比 Unity 的 `.uproject` 或 Godot 的 `project.godot`，必须在根目录。`settings/` 下的文件是游戏运行时参数，两者职责层次不同。

### `package.json`

项目元信息，记录游戏名称、版本号、作者等，也可声明依赖的扩展包。

```json
{
  "name": "my-adventure",
  "version": "0.1.0",
  "description": "我的文字冒险游戏"
}
```

### `public/`

静态资源目录，文件会被直接 serve，不经过构建处理，路径保持不变。常用于放置游戏图标、Open Graph 图片等。

- `favicon.svg` — 游戏图标，显示在浏览器标签页

### `adv/`

游戏内容根目录，存放所有剧情脚本、角色数据、场景定义和运行时设置。与工程配置（`adv.config.json`、`package.json`）分离，保持根目录整洁。

类比：Unity 的 `Assets/`、Next.js 的 `src/`、Nuxt 的 `app/`。

### `adv/index.adv.json`

游戏入口文件，定义章节列表和起始节点。编辑器以此为主入口加载项目。

### `adv/chapters/`

存放所有 `.adv.md` 剧本脚本，按章节或场景拆分。适合多人协作和 AI 辅助生成，每个文件保持单一职责。

### `adv/world.md`

**世界观圣经**，定义整个游戏的基础设定：时代背景、主要地点、核心规则、美术风格和叙事原则。AI 创作任何内容前应先读取此文件了解世界观基调。

### `adv/outline.md`

**故事大纲**，以多幕结构描述故事骨架：各章概要、关键事件、分支点、创作状态和结局分支。AI 扩写新章节时以此为结构参考。

### `adv/glossary.md`（可选）

**术语表**，大型世界观项目使用，确保 AI 创作时术语一致。表格包含术语、定义和备注（如「不要使用」的变体写法）。

### `adv/*/README.md` — AI 上下文摘要

每个子目录（`chapters/`、`characters/`、`scenes/`）都包含一个 `README.md`，作为 AI 高效扫描的入口。README 在 GitHub 上自动渲染，也方便人类浏览。引擎运行时不读取这些文件。

类似于 `CLAUDE.md` 对代码仓库的作用，但在游戏内容层面分层存在。

### `adv/scenes/`

**场景描述文件**，每个场景一个 `.md` 文件。使用 YAML frontmatter 定义 `id`、`name`、`imagePrompt`（AI 图片生成提示词）和 `tags`。正文描述场景的视觉细节、氛围和出现章节。

场景通过 `【场景名，时间，内外】` 语法在剧本中引用，`adv check` 会检查引用一致性。

> 详细格式规范参见 [AI 创作文件格式规范](/ai/formats)。

### `adv/characters/`

**角色卡片库**，每个角色对应一个 `.character.md` 文件。

文件格式为 **YAML frontmatter + Markdown 正文**：

- frontmatter 定义结构化属性（ID、名称、标签、立绘路径、角色关系等），供编辑器和运行时解析
- 正文用自然语言描述角色外貌、性格、背景，便于 AI 理解和续写

```md
---
id: aria
name: 艾莉亚
avatar: /adv/characters/aria.png
tags:
  - 主角
  - 女性
tachies:
  default:
    src: /adv/characters/aria.png
relationships:
  - targetId: kai
    type: 伙伴
---

## 外貌

银发碧眼，身着旅行者的斗篷……

## 性格

好奇心旺盛，勇于探索未知……
```

将角色卡片平铺在 `adv/characters/` 下的好处：

- 与脚本分离，角色数据可独立复用于多个剧情
- 方便批量导入/导出，或在项目间共享角色库
- AI 可单独读取此目录生成符合人设的对话

### `adv/assets/`

游戏**素材资源**统一存放目录，包括立绘、背景图、音效、UI 素材等。按资源类型分子目录，便于管理和引用。

| 子目录         | 用途        |
| -------------- | ----------- |
| `backgrounds/` | 场景背景图  |
| `tachies/`     | 角色立绘    |
| `sfx/`         | 音效        |
| `ui/`          | UI 相关素材 |

> 与 `public/` 的区别：`assets/` 中的资源属于游戏内容，会被引擎加载和管理；`public/` 中的文件是工程级静态资源（如 favicon），直接 serve 不经处理。

### `adv/settings/`

存放游戏**运行时**全局参数，如文字速度、音量默认值、起始章节等。

|        | `adv.config.json`             | `adv/settings/game.json`        |
| ------ | ----------------------------- | ------------------------------- |
| 职责   | 工程格式声明，编辑器识别用    | 游戏运行时参数                  |
| 类比   | `.uproject` / `project.godot` | `ProjectSettings/` 内的具体配置 |
| 修改者 | 开发者                        | 开发者 / 可暴露给玩家           |

```json
{
  "title": "我的文字冒险",
  "startChapter": "chapter_1",
  "ui": {
    "textSpeed": 50,
    "autoPlayDelay": 2000
  },
  "audio": {
    "bgmVolume": 0.8,
    "sfxVolume": 1.0
  }
}
```

### `.adv/`

ADV.JS 专属目录，存放与项目内容无关的工具状态，建议加入 `.gitignore`（类比 `.vscode/` 或 `.idea/`）。命名空间设计便于未来扩展。

```
.adv/
├── editor/     # 编辑器布局、偏好设置（可按需提交到 git）
└── temp/       # 自动生成的临时文件，勿手动修改
```

## 最小结构

对于简单的单文件游戏，只需要：

```
my-game/
├── adv.config.json
└── adv/
    └── index.adv.json
```

## 参考

- [Unity 项目结构最佳实践](https://docs.unity3d.com/Manual/cus-layout.html)
- [Godot 项目组织建议](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html)
- [角色管理](./editor/character) — 在编辑器中管理角色卡片
