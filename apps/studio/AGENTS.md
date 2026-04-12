# ADV.JS Studio — Agent Guidelines

## Ionic Vue Slot 规则

Ionic Vue 组件底层是 Web Components，**必须使用原生 `slot` 属性**，不能用 Vue 的 `<template #slotName>` 语法。

```html
<!-- ❌ -->
<template #start>
  <IonIcon :icon="icon" />
</template>

<!-- ✅ -->
<IonIcon slot="start" :icon="icon" />
```

多个子元素放入同一 slot 时，用容器 `<div>` 包裹：

```vue
<div slot="start" class="tree-slot-start">
  <IonIcon :icon="chevronForwardOutline" />
  <span class="tree-icon" />
</div>
```

> `vue/no-deprecated-slot-attribute` 已在 `.eslintrc.cjs` 中全局关闭，无需逐行添加 eslint-disable 注释。

---

## Scene vs Location — 概念辨析

### 一句话区分

- **Scene（场景）** = 叙事中的"镜头"，包含**视觉背景 + 时间地点标注**，在游戏脚本中播放
- **Location（地点）** = 世界观中的"地方"，包含**地理元数据 + 关联关系**，在创作工具中管理

两者是**互补关系**，不是替代关系。一个 Location 可以出现在多个 Scene 中，一个 Scene 也可能跨越多个 Location。

### 详细对比

| 维度 | Scene（场景） | Location（地点） |
|------|--------------|-----------------|
| **本质** | 叙事中的视觉/时空单元 | 世界观中的地理实体 |
| **类比** | 电影里的"一个镜头" | 电影的"取景地档案" |
| **文件位置** | `adv/scenes/{id}.md` | `adv/locations/{id}.md` |
| **脚本语法** | `【地点，时间，内/外景】` | 无（不出现在脚本中） |
| **运行时** | 解析为 AST 节点，控制背景切换 | 不参与运行时 |
| **视觉资源** | ✅ 有背景图/3D模型 (`src`, `imagePrompt`) | ❌ 无 |
| **时间维度** | ✅ 有 (`time`, `inOrOut`) | ❌ 无 |
| **关联关系** | ❌ 无 | ✅ `linkedScenes[]`, `linkedCharacters[]` |
| **AI 集成** | ❌ 不参与 AI 聊天 | ✅ 角色状态追踪会提取 location |
| **主要用途** | 游戏播放时切换背景 | Studio 中组织世界观、追踪角色位置 |

### 三层数据结构

```
1. AST 层 — 脚本运行时（@advjs/types/ast）
   SceneInfo { type: 'scene', place, time, inOrOut }
   ↑ 从 【地点，时间，内/外景】 语法解析而来
   ↑ 用于游戏引擎播放

2. 资源层 — 场景素材管理（@advjs/types/game/scene）
   AdvBaseScene { id, name, description, imagePrompt, type: 'image'|'model' }
   AdvSceneImage extends AdvBaseScene { src }
   ↑ 存储在 adv/scenes/*.md
   ↑ Studio 中管理背景图、生成 AI 图片

3. 地理层 — 世界观地点（Studio 独有）
   LocationFormData { id, name, type, description, tags, linkedScenes[], linkedCharacters[] }
   ↑ 存储在 adv/locations/*.md
   ↑ Studio 中管理世界地理、角色位置追踪
```

### 典型使用场景

**Scene 的工作流：**
```
作者在 Studio 创建场景 → 填写 imagePrompt → AI 生成背景图 → 在章节脚本中引用
│
│  adv/scenes/cafe.md
│  ---
│  id: cafe
│  name: 涩谷咖啡厅
│  type: image
│  imagePrompt: "A cozy café in Shibuya with warm lighting"
│  src: cafe.webp
│  ---
│
│  adv/chapters/ch01.adv.md
│  【涩谷咖啡厅，早晨，内景】
│  简：「你来了。」
│
└→ 游戏运行时：切换背景为 cafe.webp，显示对话
```

**Location 的工作流：**
```
作者在 Studio 创建地点 → 关联场景和角色 → AI 聊天中自动追踪角色位置
│
│  adv/locations/shibuya-cafe.md
│  ---
│  id: shibuya-cafe
│  name: 涩谷咖啡厅
│  type: indoor
│  linkedScenes: [cafe]
│  linkedCharacters: [jane, tom]
│  tags: [主线, 日常]
│  ---
│  位于涩谷中心的温馨咖啡厅，是简和汤姆的常去之地。
│
│  AI 聊天时：
│  用户：「简，你现在在哪？」
│  简：「我在涩谷那家咖啡厅等你呢。」
│  → 系统自动提取：location = "涩谷咖啡厅"
│
└→ 角色状态存储该位置，下次聊天注入上下文
```

---

## 内容模块 CRUD 架构模式

Studio 中每种内容类型遵循统一的架构：

```
utils/{type}Md.ts          — frontmatter 解析/序列化
components/{Type}Card.vue  — 列表卡片组件
components/{Type}EditorForm.vue — 编辑表单组件
views/workspace/{Type}sPage.vue — 列表页面
```

共用基础设施：
- `composables/useContentEditor.ts` — 通用编辑器状态机 (ContentType 联合类型)
- `composables/useContentSave.ts` — 通用保存逻辑 (switch by contentType)
- `composables/useContentDelete.ts` — 通用删除 + 确认弹窗
- `composables/useProjectContent.ts` — 项目内容加载 (singleton, 自动 watch)
- `components/ContentEditorModal.vue` — 通用编辑弹窗 (表单/Markdown/AI 三栏)

当前已实现的 ContentType：`'character' | 'scene' | 'chapter' | 'audio' | 'location'`

---

## Location 模块 — 后续完善计划

### Phase 1 ✅ 已完成：基础 CRUD
- [x] `locationMd.ts` 解析/序列化
- [x] `LocationCard.vue` + `LocationEditorForm.vue`
- [x] `LocationsPage.vue` 列表页
- [x] `useProjectContent` / `useContentEditor` / `useContentSave` 扩展
- [x] 路由注册 + i18n (en/zh-CN)
- [x] `ProjectOverview.vue` 统计卡 + 地点地图入口卡

### Phase 2 🔲 待实现：关联增强
- [ ] **Scene ↔ Location 自动关联**：在场景编辑表单中增加 `linkedLocation` 字段，反向在 Location 中显示关联的 Scene 列表
- [ ] **Character ↔ Location 动态关联**：将 `useCharacterStateStore` 提取的 location 字符串与 Location.md ID 进行模糊匹配，在角色卡片上显示当前所在地点
- [ ] **场景背景继承**：Location 可配置默认背景图，新建关联 Scene 时自动填充 `imagePrompt`
- [ ] **Location 详情页**：点击 Location 卡片进入详情页，展示关联场景列表、出现角色列表、描述 Markdown 渲染

### Phase 3 🔲 待实现：可视化地图
- [ ] **关系图谱 (LocationMapView.vue)**：基于 `@advjs/flow` (Vue Flow) 的节点图，地点为节点、连接关系为边，角色位置标注
- [ ] **自定义地图图片**：Location 增加 `mapImage` 字段，支持上传世界地图图片
- [ ] **热区标注**：在地图图片上标注地点热区（坐标 + 半径），点击跳转到 Location 详情

### Phase 4 🔲 待实现：运行时集成
- [ ] **AST 层打通**：在 `@advjs/parser` 中，解析 `【place，time，inOrOut】` 时尝试匹配 `adv/locations/{place}.md`，丰富 SceneInfo 节点信息
- [ ] **游戏内地图界面**：在 `@advjs/client` 中添加可选的地图 UI 组件，玩家可在游戏中查看地点地图
- [ ] **位置驱动剧情**：在 Flow 编辑器中支持"角色到达某地点"作为分支条件
