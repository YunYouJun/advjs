# 角色管理

编辑器内置了角色管理功能，支持角色的创建、编辑、删除和搜索。角色数据以 `.character.md` 文件形式存储在本地项目目录中，Git 友好、AI 原生可读。

## 快速开始

### 访问角色管理

有两种方式进入角色管理页面：

1. **菜单栏**: `View` → `Characters`
2. **直接访问**: 在编辑器地址栏输入 `/characters`

### 配置角色目录

首次使用时需要配置角色文件目录路径：

1. 在角色管理页面，输入角色文件所在的目录路径
2. 点击 `Connect` 连接

例如：`./demo/flow/adv/characters` 或 `/absolute/path/to/adv/characters`

## `.character.md` 文件格式

角色数据以 Markdown 文件形式存储，每个角色一个文件，文件名格式为 `{id}.character.md`。

### 文件结构

```markdown
---
# YAML Frontmatter - 结构化字段
id: taki
name: 立花瀧
avatar: /img/characters/taki.png
cv: 神木隆之介
aliases:
  - Taki Tachibana
tags:
  - 主角
  - 男性
faction: 東京
tachies:
  default:
    src: /img/your-name/characters/taki.png
    class:
      - h-full
relationships:
  - targetId: mitsuha
    type: 恋人
    description: 跨越时空的羁绊
---

## 外貌

17 岁少年，短发凌乱的黑发...

## 性格

务实而坚定...

## 背景

瀧是住在东京的高中生...

## 理念

执着于寻找失去的记忆

## 说话风格

直接、略带急躁...
```

### Frontmatter 字段说明

| 字段            | 类型                                 | 必填 | 说明                                                        |
| --------------- | ------------------------------------ | ---- | ----------------------------------------------------------- |
| `id`            | `string`                             | ✅   | 唯一标识，需与文件名一致                                    |
| `name`          | `string`                             | ✅   | 角色姓名                                                    |
| `visual`        | `AdvCharacterVisual`                 |      | 造型版本、参考图和一致性约束                                |
| `imagePrompt`   | `string`                             |      | 补充图像生成描述                                            |
| `avatar`        | `string`                             |      | 头像图片路径                                                |
| `avatars`       | `Record<string, AdvCharacterAvatar>` |      | 以对白状态为键的头像差分，每项含 `src` 和可选显示名 `label` |
| `actor`         | `string`                             |      | 演员                                                        |
| `cv`            | `string`                             |      | 声优                                                        |
| `aliases`       | `string[]`                           |      | 别名列表                                                    |
| `tags`          | `string[]`                           |      | 角色标签                                                    |
| `faction`       | `string`                             |      | 阵营/组织                                                   |
| `tachies`       | `Record<string, AdvTachie>`          |      | 立绘，key 为立绘名称                                        |
| `relationships` | `AdvCharacterRelationship[]`         |      | 角色关系                                                    |

### 对白神态头像

`avatar` 保留为默认头像；`avatars` 将预制神态与人物卡关联。通过已有的角色状态语法选择，状态只属于当前对白，不延续到后续未标注的台词：

```yaml
avatar: adv/assets/avatars/hero.webp
avatars:
  thoughtful:
    src: adv/assets/avatars/hero-thoughtful.webp
    label: 凝神思索
  resolved:
    src: adv/assets/avatars/hero-resolved.webp
    label: 坚定决断
```

```md
@Hero(thoughtful)
让我再算一遍。

@Hero
我听着。
```

角色详情显示神态名称、状态 ID 和图片预览；本地桥接解析项目相对路径，发行构建打包所用图片。项目的 `showCharacterAvatar` 同步给 Editor 预览播放器。存档恢复对白节点后，头像随对应状态恢复。未提供或未知的状态回退至 `avatar`（或 `avatars.default`）；图片加载失败时再尝试默认头像，两者均失败时保留姓名。旧人物卡无需迁移。Flow 对话可使用可选 `status` 字段；AI 导出提供可用状态与名称，图片路径仍从人物卡和资源清单读取。

### 统一视觉设定

```yaml
visual:
  version: workshop-v1
  references:
    - path: adv/assets/references/craftsman-v1.png
      description: 单人人设卡，同一人物的全身、正脸与侧脸
  fixedTraits:
    - 方脸、短络腮须、宽肩，保持参考图面部比例
    - 赭褐粗布工作衣与深色腰带
  allowedChanges:
    - 表情、姿势、镜头角度与光照
    - 与当前剧情相符的尘土和劳动污迹
imagePrompt: Naturalistic historical game illustration, worn linen, soft daylight
```

所有角色、编辑器和 AI 工具共用 `AdvCharacterVisual` 与 `CharacterVisualSchema`。`version` 必填且非空，其他三个字段可省略。字段拼写错误、空特征和不安全路径会产生诊断。旧卡不需要添加 `visual`。

参考图 `path` 相对于项目根目录（`adv.config.json` 所在目录），不是人物卡所在目录。禁止绝对路径、URL 和 `../`。`description` 指定多人图中的人物或视角；一张图可被多个人物卡引用。参考图无需登记为游戏背景。

推荐每个人物优先绑定独立的人设卡，包含全身、面部视角与配色；人物详情更易查看，给 AI 附图时也更容易确定身份。多人总览保留作体格、比例与画风对照。既有共用总览仍受支持，无需更换协议；多人镜头按人物分别附图。

在文件树打开人物卡即可查看「视觉设定」，点「编辑源码」修改并保存；人物详情也复用相同面板。图片缺失时会保留路径及错误提示。头像、立绘仍使用 `avatar`、`tachies`，避免把整张设定总览当作游戏精灵图。

「复制视觉约束」使用 `exportCharacterVisualForAI`。生成前必须打开并实际附上参考图片，复制路径不会自动附图。改变固定特征时建立新的造型版本，并保留旧图及其版本记录。

### Body Sections 说明

Markdown body 部分按 `## 标题` 分段，每个 section 映射到一个描述性字段。支持中英文标题：

| Markdown Section                  | 字段          | 说明     |
| --------------------------------- | ------------- | -------- |
| `## 外貌` / `## Appearance`       | `appearance`  | 外貌特征 |
| `## 性格` / `## Personality`      | `personality` | 性格描述 |
| `## 背景` / `## Background`       | `background`  | 人物背景 |
| `## 理念` / `## Concept`          | `concept`     | 核心理念 |
| `## 说话风格` / `## Speech Style` | `speechStyle` | 语气风格 |

### AI 导出格式

使用「Copy for AI」按钮可以导出为 AI 友好的纯净 markdown（去掉运行时 tachies/avatar，保留 visual 视觉身份与 imagePrompt）：

```markdown
# 立花瀧

- **别名**: Taki Tachibana
- **阵营**: 東京
- **标签**: 主角, 男性, 高中生
- **声优**: 神木隆之介

## 外貌

17 岁少年，短发凌乱的黑发...

## 性格

务实而坚定...

## 关系

- **三叶** (恋人): 跨越时空的羁绊
```

## 角色 CRUD

### 创建角色

1. 点击页面右上角的 `New Character` 按钮
2. 填写角色信息（ID 和名称为必填）
3. 点击 `Create` 保存

角色将以 `.character.md` 文件形式写入配置的目录。

### 浏览与搜索

- 支持 **网格视图** 和 **列表视图** 切换
- 使用搜索框可按名称、ID、性格、阵营、标签、别名过滤角色

### 编辑角色

1. 点击角色卡片进入详情页
2. 点击 `Edit` 按钮切换到编辑模式
3. 修改信息后点击 `Save` 保存

### 立绘管理

在角色详情页下方，可以管理角色立绘（Tachie）：

- **添加**: 输入立绘名称（如 `normal`、`angry`、`smile`）和图片 URL
- **删除**: 点击立绘旁的删除按钮

### 角色关系

在角色详情页下方，可以编辑角色关系：

- **添加**: 输入目标角色 ID、关系类型（如 `恋人`、`宿敌`）和描述
- **删除**: 点击关系旁的删除按钮

## 与剧本配合

在 `.adv.md` 剧本中使用角色：

```md
@立花瀧
你好呀！今天天气真不错～
```

也可以在 `adv.config.ts` 中配置角色（TypeScript 格式，与 `.character.md` 共享相同的 `AdvCharacter` 类型）：

```ts
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  gameConfig: {
    characters: [
      {
        id: 'yun',
        name: '小云',
        personality: '开朗活泼',
        speechStyle: '喜欢用语气词',
        tags: ['主角', '学生'],
      }
    ]
  }
})
```

## 飞书同步（可选）

飞书多维表格可作为可选的数据同步目标。可通过 Import/Export 按钮在本地文件和飞书之间同步角色数据。

::: tip 环境变量
通过环境变量配置飞书连接：

```bash
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BITABLE_APP_TOKEN=your_bitable_token
```

:::

## 更多信息

关于角色管理系统的设计方案和技术细节，请参见[设计方案 - 角色管理系统](/about/design/character)。
