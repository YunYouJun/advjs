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

| 字段            | 类型                         | 必填 | 说明                     |
| --------------- | ---------------------------- | ---- | ------------------------ |
| `id`            | `string`                     | ✅   | 唯一标识，需与文件名一致 |
| `name`          | `string`                     | ✅   | 角色姓名                 |
| `avatar`        | `string`                     |      | 头像图片路径             |
| `actor`         | `string`                     |      | 演员                     |
| `cv`            | `string`                     |      | 声优                     |
| `aliases`       | `string[]`                   |      | 别名列表                 |
| `tags`          | `string[]`                   |      | 角色标签                 |
| `faction`       | `string`                     |      | 阵营/组织                |
| `tachies`       | `Record<string, AdvTachie>`  |      | 立绘，key 为立绘名称     |
| `relationships` | `AdvCharacterRelationship[]` |      | 角色关系                 |

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

使用「Copy for AI」按钮可以导出为 AI 友好的纯净 markdown（去掉 tachies/avatar 等视觉字段）：

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
