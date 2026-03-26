# 角色管理系统

角色（Character）是 ADV/视觉小说游戏中最核心的元素之一。一个完善的角色管理系统对于游戏创作的效率和角色一致性至关重要。

## 设计目标

- **集中管理**: 所有角色信息统一管理，避免散落在各处剧本文件中
- **飞书协同**: 以飞书多维表格作为主存储（SSOT），支持团队协作编辑
- **可扩展**: 为未来 AI 辅助角色生成、关系图谱可视化等功能预留字段
- **兼容性**: 参考 SillyTavern Character Card V2 等业界标准，便于后续格式互通

## 整体架构

```
editor/core (Nuxt 4)
├── app/pages/characters/         ← 角色管理页面
├── app/components/character/     ← 角色 UI 组件
├── app/stores/useCharacterStore  ← 完整 CRUD store
├── app/composables/feishu/       ← 飞书数据层封装
└── server/api/feishu/bitable/    ← Nuxt server routes (Node.js)
         ↓
plugins/plugin-feishu             ← @larksuiteoapi/node-sdk
         ↓
飞书多维表格 (SSOT)               ← characters / relationships 表
```

由于 `@larksuiteoapi/node-sdk` 仅支持 Node.js 环境，前端无法直接调用，因此通过 Nuxt server routes 作为代理层，前端使用 `$fetch` 访问 API。

## 角色类型定义

角色类型定义位于 `packages/types/src/game/character.ts`，是整个系统的基础。

### AdvCharacter

```ts
interface AdvCharacter {
  id: string // 唯一标识
  name: string // 姓名
  avatar?: string // 头像
  actor?: string // 演员
  cv?: string // 声优
  alias?: string | string[] // 别名
  tachies?: Record<string, AdvTachie> // 立绘

  // 描述性字段
  appearance?: string // 外貌特征
  background?: string // 人物背景
  concept?: string // 人物理念
  personality?: string // 性格描述
  speechStyle?: string // 语气/说话风格

  // 组织性字段
  tags?: string[] // 角色标签
  faction?: string // 阵营/组织
  relationships?: AdvCharacterRelationship[] // 角色关系

  // 元数据
  createdAt?: string
  updatedAt?: string
  feishuRecordId?: string // 飞书记录 ID（同步用）
}
```

### AdvCharacterRelationship

```ts
interface AdvCharacterRelationship {
  targetId: string // 目标角色 ID
  type: string // 关系类型，如 '恋人', '宿敌', '师徒'
  description?: string // 关系描述
}
```

::: tip 为什么选择扁平化结构？
角色的描述性字段（`personality`、`speechStyle` 等）采用简单字符串类型而非嵌套对象，是为了：

1. 与飞书多维表格的字段直接映射
2. 降低序列化/反序列化的复杂度
3. 便于 AI 直接读取和生成内容
   :::

## 飞书多维表格集成

### 为什么选择飞书多维表格？

- **团队协作**: 游戏创作往往是多人协作，飞书提供实时协同编辑
- **无需自建后端**: 利用飞书 API 即可实现完整的 CRUD，省去搭建和维护数据库的成本
- **丰富的视图**: 表格视图、看板视图、甘特图等，方便不同角色（策划、编剧、美术）使用
- **权限管理**: 复用飞书的权限体系

### 表格 Schema

**characters 表**:

| 字段        | 类型 | 说明             |
| ----------- | ---- | ---------------- |
| id          | 文本 | 角色唯一标识     |
| name        | 文本 | 角色名称         |
| avatar      | 文本 | 头像 URL         |
| personality | 文本 | 性格描述         |
| appearance  | 文本 | 外貌描述         |
| background  | 文本 | 人物背景         |
| concept     | 文本 | 核心理念         |
| speechStyle | 文本 | 说话风格         |
| faction     | 文本 | 阵营/组织        |
| tags        | 文本 | 标签（逗号分隔） |
| alias       | 文本 | 别名（逗号分隔） |
| cv          | 文本 | 声优             |
| actor       | 文本 | 演员             |

**relationships 表**:

| 字段        | 类型 | 说明        |
| ----------- | ---- | ----------- |
| sourceId    | 文本 | 源角色 ID   |
| targetId    | 文本 | 目标角色 ID |
| type        | 文本 | 关系类型    |
| description | 文本 | 关系描述    |

### 初始化

使用 `plugins/plugin-feishu/scripts/create-characters-bitable.ts` 脚本创建表格：

```bash
cd plugins/plugin-feishu
npx tsx scripts/create-characters-bitable.ts
```

脚本会在飞书知识库的「数据源」节点下创建多维表格，并输出 `APP_TOKEN`、`TABLE_ID` 等信息，需要填入 `scripts/config.ts`。

## Server API 代理层

Nuxt server routes 位于 `editor/core/server/api/feishu/bitable/`：

| 路由                          | 方法   | 功能                    |
| ----------------------------- | ------ | ----------------------- |
| `/api/feishu/bitable/records` | GET    | 列表查询 / 获取单条记录 |
| `/api/feishu/bitable/records` | POST   | 创建记录                |
| `/api/feishu/bitable/records` | PUT    | 更新记录                |
| `/api/feishu/bitable/records` | DELETE | 删除记录                |

使用 `tenant_access_token` 模式（应用自身授权），需配置环境变量：

```bash
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BITABLE_APP_TOKEN=your_bitable_token
```

字段映射逻辑封装在 `server/utils/feishu-fields.ts` 中，处理飞书文本字段（可能为 `[{type: 'text', text: 'value'}]` 格式）与 `AdvCharacter` 之间的转换。

## 前端数据层

### useFeishuBitable Composable

通用的飞书多维表格 CRUD 封装，位于 `editor/core/app/composables/feishu/useFeishuBitable.ts`：

```ts
const { list, get, create, update, remove, loading, error }
  = useFeishuBitable<AdvCharacter>(tableId)
```

此 composable 是泛型的，未来可复用于其他飞书表格（如世界观设定、剧情大纲等）。

### useCharacterStore

基于 Pinia 的角色管理 Store，提供：

- `characters` — 所有角色列表
- `selectedCharacter` — 当前选中角色
- `searchQuery` / `filteredCharacters` — 搜索与过滤
- `fetchCharacters()` / `createCharacter()` / `updateCharacter()` / `deleteCharacter()` — CRUD 操作
- `loading` — 加载状态

## 编辑器 UI

### 页面

| 路径               | 说明                                 |
| ------------------ | ------------------------------------ |
| `/characters`      | 角色列表页（卡片网格 + 搜索 + 新建） |
| `/characters/[id]` | 角色详情/编辑页                      |

### 组件

| 组件                 | 说明                                   |
| -------------------- | -------------------------------------- |
| `CharacterCard`      | 角色卡片（头像、名字、标签、性格预览） |
| `CharacterList`      | 列表容器（网格/列表视图切换、筛选）    |
| `CharacterForm`      | 编辑表单（基于 AGUI 表单组件）         |
| `CharacterDetail`    | 详情展示（只读 + 编辑切换）            |
| `TachieManager`      | 立绘管理（添加、预览、删除）           |
| `RelationshipEditor` | 角色关系编辑                           |

## 社区参考方案

| 方案                                                                                       | 亮点                     | 参考价值                       |
| ------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------ |
| [SillyTavern Character Card V2](https://github.com/malfoyslastname/character-card-spec-v2) | 业界 AI 角色卡标准       | 类型设计参考，后续格式兼容导出 |
| [Kanka.io](https://kanka.io/)                                                              | 模块化角色管理，关系图谱 | 功能设计参考                   |
| [Ren'Py](https://www.renpy.org/)                                                           | VN 引擎标准角色定义      | 已有相似模式                   |
| [Ginger Editor](https://github.com/ginger-editor)                                          | 角色卡编辑器，多格式转换 | UI 交互参考                    |

## 路线图

### 第一期（已完成）

- [x] 扩展 `AdvCharacter` 类型定义
- [x] 飞书多维表格 Schema 与初始化脚本
- [x] Nuxt Server API 代理层
- [x] `useFeishuBitable` 通用 Composable
- [x] `useCharacterStore` 完整 CRUD
- [x] 角色管理页面与组件

### 第二期（规划中）

- [ ] 世界观设定管理（worldbuilding 表）
- [ ] AI 辅助角色性格/背景/对话风格生成（复用 `plugin-openai`）
- [ ] AI 根据世界观 + 角色生成故事大纲
- [ ] 角色关系图谱可视化（基于 Vue Flow）
- [ ] SillyTavern V2 格式兼容导出
- [ ] 立绘 AI 生成（复用 `plugin-runware`）
