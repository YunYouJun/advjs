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

## 本地人物配音试听

本地项目声明 `authoring.voice.library` 后，人物详情按供应商筛选已登记的音色版本，提供原生短句试听和显式选用。供应商列表来自该人物音色库的 `implementations`，切换列表只改变待审音色，不调用合成服务。播放读取已校验的本地原生 audio 缓存；替换已有选择要勾选确认，库的外部更改会拒绝旧版本保存。

音频需要手动播放。切换候选、供应商、音色版本、人物或项目，以及关闭面板，都会停止试听并释放音频。损坏的音频显示播放失败提示；缺失缓存需要先通过原生资源准备流程处理。打开时焦点落在关闭按钮；`Escape` 取消当前未保存选择并关闭面板，焦点回到入口。配置、CLI 与供应商边界见[作者语音模块](../authoring-voice)。

## 视觉设定与对白头像

角色源文件可以添加可选的 `visual` 和 `avatars` 字段；旧角色卡无需迁移：

```yaml
avatar: art/hero/default.webp
avatars:
  thoughtful:
    src: art/hero/thoughtful.webp
    label: 凝神思索
visual:
  version: design-v1
  references:
    - path: art/hero/reference.webp
      description: 正面与侧面
  fixedTraits:
    - 棕色短发
  allowedChanges:
    - 姿势和光照
```

`visual.references` 使用相对于项目根目录的路径，不接受 URL、父目录跳转或编码路径。视觉设定是创作元数据；导出 AI 视觉说明时会列出参考路径，仍需实际打开并附上图片。角色表单保存会保留这些字段，新增或编辑结构化视觉设定可使用源文件编辑器。

剧本 `@Hero(thoughtful)` 选择对应的头像，普通 `@Hero` 使用默认头像。未配置的神态回退到 `avatar`（或 `avatars.default`）；图片加载失败会尝试默认头像，全部失败后隐藏头像并保留姓名。神态不会从上一句继承。

本地预览通过项目资源桥接读取头像；缺失的可选头像不会阻止预览。静态导出会将本地头像和神态图打包为带内容哈希的资源。标准 Markdown 项目与游戏配置数据的玩家投影保留角色姓名、别名、头像、立绘与演员/声优署名，排除创作背景、结构化私密属性、视觉说明和生成提示词；原始项目文件不受影响。

旧版直接导入的 `.character.ts` / `.scene.ts` 模块仍由 Vite 编译，尚不具备相同的创作元数据过滤边界。不要在这些直接发布的模块或其导入依赖中存放私密设定；需要隔离创作设定时使用标准 Markdown 项目。该限制也适用于开发服务器，不能依赖打包压缩删除私密字段。
