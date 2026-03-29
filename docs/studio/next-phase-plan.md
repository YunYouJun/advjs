# Studio 下一阶段计划：AI Living World 深化

> 📅 2026-03-29
>
> 基于 Phase 5（Mobile Studio）已完成的角色对话系统，以及 `brainstorm-ai-living-world.md` 的远期愿景，制定 Studio 的下一阶段开发路线。

---

## 当前已完成功能

### Phase 5 已交付（截至 2026-03-29）

| 功能         | 说明                                 |
| ------------ | ------------------------------------ |
| 5 Tab 架构   | Workspace / Chat / World / Play / Me |
| AI 创作助手  | Chat Tab，项目上下文感知，流式回复   |
| 角色对话系统 | World Tab，角色列表 + 沉浸式角色对话 |
| 内容创建     | 角色/章节/场景的表单 + AI 辅助创建   |
| 文件管理     | 文件树浏览、Monaco Editor 预览/编辑  |
| 云同步       | 腾讯云 COS 上传/下载/同步            |
| 游戏预览     | ChapterReader + GamePlayer           |
| i18n         | 中英双语                             |

### 类型/解析器已扩展

- `AdvCharacterBody` 新增 `knowledgeDomain` + `expertisePrompt` 字段
- 解析器 `SECTION_MAP` / `BODY_SECTION_ORDER` 已同步更新
- `exportCharacterForAI()` 自动包含新字段

---

## Phase 6：角色记忆与对话增强（2-3 周）

### 目标

让角色对话从「无状态聊天」进化为「有记忆的持续关系」。

### 6.1 角色记忆系统

**新文件**: `apps/studio/src/stores/useCharacterMemoryStore.ts`

为每个角色维护一份结构化记忆：

```ts
interface CharacterMemory {
  characterId: string
  /** 关键事件摘要（AI 自动提取） */
  keyEvents: { summary: string, timestamp: number }[]
  /** 用户偏好/信息（角色视角记住的关于用户的信息） */
  userProfile: { key: string, value: string }[]
  /** 情感状态（好感度、信任度等） */
  emotionalState: {
    affinity: number // -100 ~ 100
    trust: number // 0 ~ 100
    mood: string // 当前心情关键词
  }
}
```

**工作原理**：

- 每轮对话结束后，调用 AI（用一个轻量 prompt）从对话中提取关键信息
- 关键事件列表保持最近 50 条，超出后用 AI 合并摘要
- `emotionalState` 根据对话语气由 AI 微调
- 记忆注入 system prompt：`buildCharacterSystemPrompt()` 额外追加记忆段落
- 持久化到 `localStorage`（key: `advjs-studio-character-memories`）

### 6.2 对话历史搜索

**新文件**: `apps/studio/src/components/ChatHistorySearch.vue`

- 搜索框过滤对话历史中的关键词
- 高亮匹配的消息
- 点击跳转到对应消息位置

### 6.3 多轮对话上下文优化

**修改文件**: `apps/studio/src/stores/useCharacterChatStore.ts`

- 当前：固定发送最近 20 条消息
- 改进：智能上下文窗口
  - 始终保留首条消息（用户初次交流，包含重要意图）
  - 保留最近 15 条消息
  - 中间消息用 AI 生成的摘要替代
  - 注入角色记忆摘要

### 6.4 对话导出

**修改文件**: `apps/studio/src/views/CharacterChatPage.vue`

- Header 新增"导出"按钮
- 导出为 `.adv.md` 格式（对话内容转为 AdvScript 对话脚本）
- 导出为 Markdown 纯文本
- 可直接保存到项目的 `adv/chapters/` 目录

### 验证

- 连续对话 30 条后，角色仍能回忆之前讨论的话题
- 关闭 / 重新打开 App，记忆保持
- 导出的 `.adv.md` 可在游戏引擎中预览

---

## Phase 7：动态角色状态（2-3 周）

### 目标

角色从静态人设进化为有状态变化的动态角色。

### 7.1 动态角色状态类型

**修改文件**: `packages/types/src/game/character.ts`

```ts
/** 角色的可变状态（运行时/世界模拟用） */
export interface AdvCharacterDynamicState {
  /** 当前心情 */
  mood?: string
  /** 健康状态 */
  health?: string
  /** 当前位置 */
  location?: string
  /** 自定义数值属性 */
  attributes?: Record<string, number>
  /** 最近发生的事件 */
  recentEvents?: string[]
  /** 状态最后更新时间 */
  lastUpdated?: string
}
```

**修改文件**: `packages/types/src/game/character.ts` → `AdvCharacter`

```ts
export interface AdvCharacter extends AdvCharacterFrontmatter, AdvCharacterBody {
  // ... 现有字段 ...
  /** 动态状态（运行时） */
  dynamicState?: AdvCharacterDynamicState
}
```

### 7.2 状态持久化

**新文件**: `apps/studio/src/stores/useCharacterStateStore.ts`

- 每个角色的动态状态独立存储
- 与 `.character.md` 分离（不修改源文件），存在 `adv/.state/characters/{id}.json`
- 支持本地和 COS 两种存储
- World Tab 的角色卡片展示当前心情/位置

### 7.3 状态感知对话

**修改文件**: `apps/studio/src/stores/useCharacterChatStore.ts`

- `buildCharacterSystemPrompt()` 注入角色当前状态
- 对话后 AI 自动更新角色状态（心情、关系值等）
- 状态变化在 UI 中有微妙的视觉反馈（如心情 emoji 变化）

### 验证

- 角色在"开心"状态下的回复风格与"沮丧"状态明显不同
- 对话导致的状态变化即时反映在 World Tab 的角色卡片上

---

## Phase 8：世界事件与时间系统（3-4 周）

### 目标

引入世界时间概念和事件系统，让世界有"活"的感觉。

### 8.1 世界时钟

**新文件**: `apps/studio/src/stores/useWorldClockStore.ts`

```ts
interface WorldClock {
  /** 世界内日期 (YYYY-MM-DD) */
  date: string
  /** 时段 */
  period: 'morning' | 'afternoon' | 'evening' | 'night'
  /** 天气 */
  weather?: string
  /** 时钟是否在运行 */
  running: boolean
}
```

- 时间流逝速率可配置（默认：现实 5 分钟 = 世界 1 小时）
- 时间变化触发角色位置/心情的自动更新
- 暂停/恢复控制

### 8.2 事件生成器

**新文件**: `apps/studio/src/composables/useWorldEvents.ts`

- 基于世界设定（`world.md`）和当前角色状态，AI 生成随机事件
- 事件类型：日常（买菜、上学）、社交（角色间对话）、意外（生病、纠纷）
- 事件影响角色状态，产生连锁反应
- 事件日志持久化，可浏览"世界历史"

### 8.3 World Tab 增强

**修改文件**: `apps/studio/src/views/WorldPage.vue`

- 顶部新增世界时钟显示（日期 + 时段 + 天气）
- 角色卡片显示当前位置和心情
- 新增"世界动态"信息流（最近发生的事件）
- 新增"推进时间"按钮（手动触发时间流逝）

### 验证

- 推进时间后，角色位置和心情发生变化
- 世界动态信息流显示新事件
- 进入角色对话，角色知道最近发生的事件

---

## Phase 9：多角色交互与场景模拟（3-4 周）

### 目标

支持多角色同时在场景中互动，而非仅 1v1 对话。

### 9.1 场景对话模式

**新文件**: `apps/studio/src/views/SceneChatPage.vue`

- 选择一个场景 + 多个角色
- AI 生成角色间的对话（用户可选择观察或以某个角色身份参与）
- 场景对话自动以 `.adv.md` 格式记录
- 每个角色维持各自的人设和说话风格

**路由**: `/tabs/world/scene/:sceneId`

### 9.2 角色关系网络可视化

**新文件**: `apps/studio/src/components/RelationshipGraph.vue`

- 基于 `@advjs/flow`（Vue Flow）渲染角色关系图
- 节点 = 角色（头像 + 名字）
- 边 = 关系（类型 + 描述）
- 只读可视化，点击节点进入角色对话
- 关系值随对话和事件动态变化

### 9.3 角色自主对话

**新文件**: `apps/studio/src/composables/useAutonomousChat.ts`

- 当世界时钟运行时，同一场景的角色会自主产生对话
- AI 基于角色性格、关系、当前事件生成对话
- 对话结果影响角色记忆和状态
- 用户可在 World Tab 的"世界动态"中查看

### 验证

- 选择"学校天台"场景 + 2 个角色，观察他们自动对话
- 对话内容反映各自性格和关系
- 自主对话的内容出现在角色记忆中

---

## Phase 10：平行人生与玩家角色（4-6 周）

### 目标

实现 Living World 头脑风暴中最有共鸣的功能：「捏自己，看不同人生」。

### 10.1 玩家角色创建器

**新文件**: `apps/studio/src/views/PlayerCreatorPage.vue`

- 引导式问卷：姓名、年龄、性格关键词、人生目标
- AI 根据问卷自动生成 `.character.md`
- 角色卡保存到 `adv/characters/player.character.md`
- 支持上传或 AI 生成头像

**路由**: `/tabs/world/create-player`

### 10.2 人生分支模拟

**新文件**: `apps/studio/src/views/LifeSimPage.vue`
**新文件**: `apps/studio/src/stores/useLifeSimStore.ts`

- 设定人生关键节点（专业选择、城市选择、职业选择等）
- AI 模拟不同选择下的人生轨迹
- 同时运行多条平行线（最多 3 条）
- 每条线以时间轴 + 事件列表的形式展示
- 可以在任意节点"穿越"进入，体验对应人生

**路由**: `/tabs/world/life-sim`

### 10.3 混合视角模式

**修改文件**: `apps/studio/src/views/WorldPage.vue`

新增视角切换器：

- 🎮 **角色模式**: 以玩家角色身份参与世界
- 👁️ **上帝模式**: 观察和引导世界运转
- 💬 **访客模式**: 与任意角色自由对话（当前默认模式）

不同模式下 World Tab 和角色对话的 system prompt 不同。

### 验证

- 创建玩家角色后，可在 World Tab 中以角色身份与 NPC 互动
- 人生模拟中选择不同路径，看到不同的事件发展
- 模式切换后，角色对话的风格和互动方式明显不同

---

## Phase 11：专业角色知识系统（2-3 周）

### 目标

让专业角色（法律、医学等）具备真正有用的领域知识。

### 11.1 知识库管理

**新文件**: `apps/studio/src/composables/useKnowledgeBase.ts`

- 支持从 `.md` 文件加载领域知识（放在 `adv/knowledge/{domain}/` 目录下）
- 知识库内容通过 RAG 式 prompt 注入（选取最相关的段落）
- 支持在线加载外部知识源（URL）

### 11.2 专业角色模板

在 `adv/characters/` 中提供预制专业角色模板：

```
adv/characters/
├── templates/
│   ├── legal-expert.character.md    # 法律专家模板
│   ├── medical-expert.character.md  # 医学专家模板
│   ├── life-coach.character.md      # 生活教练模板
│   └── counselor.character.md       # 心理咨询师模板
```

每个模板预设 `knowledgeDomain` + `expertisePrompt` + `speechStyle`。

### 11.3 角色能力标签

**修改文件**: `apps/studio/src/components/CharacterCard.vue`

- 专业角色卡片显示知识领域标签（如 ⚖️ 法律、🏥 医学）
- 带有"专业角色"标识
- 点击知识领域标签可查看该角色的能力范围

### 验证

- 法律专家角色能引用具体法条回答法律问题
- 知识库更新后，角色的回答实时更新
- 非专业问题，角色会委婉表示超出自己专长

---

## Phase 12：原生打包与性能优化（2-3 周）

### 目标

完成 iOS/Android 原生打包，优化移动端体验。

### 12.1 Capacitor 打包

- iOS: Xcode 项目配置、App Store 提审准备
- Android: Gradle 项目配置、APK/AAB 构建
- Capacitor Filesystem 适配（替代 File System Access API）
- 推送通知（AI 任务完成、世界事件触发）

### 12.2 性能优化

- 对话历史虚拟滚动（大量消息时保持流畅）
- 角色列表懒加载
- 世界状态增量更新（避免全量刷新）
- IndexedDB 替代 localStorage 存储大量对话数据
- Service Worker 离线缓存

### 12.3 离线模式

- 已加载的角色和对话历史离线可用
- 离线时的操作排队，上线后自动同步
- 本地 LLM 支持（通过 Ollama）实现完全离线对话

### 验证

- iOS/Android 真机流畅运行
- 500+ 条对话历史无卡顿
- 断网后仍可浏览历史对话

---

## 阶段总览

| Phase | 名称                 | 周期   | 依赖                   |
| ----- | -------------------- | ------ | ---------------------- |
| 6     | 角色记忆与对话增强   | 2-3 周 | Phase 5 ✅             |
| 7     | 动态角色状态         | 2-3 周 | Phase 6                |
| 8     | 世界事件与时间系统   | 3-4 周 | Phase 7                |
| 9     | 多角色交互与场景模拟 | 3-4 周 | Phase 7, 8             |
| 10    | 平行人生与玩家角色   | 4-6 周 | Phase 8, 9             |
| 11    | 专业角色知识系统     | 2-3 周 | Phase 6（可并行 8-10） |
| 12    | 原生打包与性能优化   | 2-3 周 | 可在任意阶段并行       |

```
Phase 6 ──→ Phase 7 ──→ Phase 8 ──→ Phase 9 ──→ Phase 10
                │                      │
                └──→ Phase 11          └──→ (可并行)
                     (可独立)

Phase 12 (贯穿全程，可随时推进)
```

**推荐优先级**：Phase 6 → 7 → 11 → 8 → 9 → 10 → 12

理由：记忆和状态是所有后续功能的基础；专业角色知识系统独立性强、用户价值高，可以提前交付；世界模拟和人生模拟是更复杂的系统，放在后面打磨。

---

## 新增文件清单（全部阶段）

| Phase | 新文件                              | 说明           |
| ----- | ----------------------------------- | -------------- |
| 6     | `stores/useCharacterMemoryStore.ts` | 角色记忆管理   |
| 6     | `components/ChatHistorySearch.vue`  | 对话搜索       |
| 7     | `stores/useCharacterStateStore.ts`  | 动态角色状态   |
| 8     | `stores/useWorldClockStore.ts`      | 世界时钟       |
| 8     | `composables/useWorldEvents.ts`     | 世界事件生成   |
| 9     | `views/SceneChatPage.vue`           | 场景多角色对话 |
| 9     | `components/RelationshipGraph.vue`  | 关系网络可视化 |
| 9     | `composables/useAutonomousChat.ts`  | 角色自主对话   |
| 10    | `views/PlayerCreatorPage.vue`       | 玩家角色创建   |
| 10    | `views/LifeSimPage.vue`             | 人生模拟       |
| 10    | `stores/useLifeSimStore.ts`         | 人生模拟状态   |
| 11    | `composables/useKnowledgeBase.ts`   | 知识库管理     |

### 修改文件

| Phase | 文件                                   | 改动                            |
| ----- | -------------------------------------- | ------------------------------- |
| 6     | `stores/useCharacterChatStore.ts`      | 智能上下文窗口、记忆注入        |
| 6     | `views/CharacterChatPage.vue`          | 导出按钮、搜索                  |
| 7     | `packages/types/src/game/character.ts` | 添加 `AdvCharacterDynamicState` |
| 7     | `stores/useCharacterChatStore.ts`      | 状态感知 prompt                 |
| 8     | `views/WorldPage.vue`                  | 世界时钟 + 动态信息流           |
| 9     | `router/index.ts`                      | 场景对话路由                    |
| 10    | `router/index.ts`                      | 人生模拟路由                    |
| 10    | `views/WorldPage.vue`                  | 视角切换器                      |
| 11    | `components/CharacterCard.vue`         | 专业角色标识                    |
| 全    | `i18n/locales/*.json`                  | 新增翻译 key                    |

---

## 与 ai-first-strategy.md 的关系

| 战略文档提到的目标 | 对应阶段   |
| ------------------ | ---------- |
| 动态角色卡格式     | Phase 7    |
| 角色对话 API       | Phase 5 ✅ |
| 角色记忆系统       | Phase 6    |
| 性格演化引擎       | Phase 7    |
| 知识注入机制       | Phase 11   |
| 世界时钟           | Phase 8    |
| 角色自治 AI        | Phase 9    |
| 事件生成器         | Phase 8    |
| 角色关系网络       | Phase 9    |
| 玩家角色创建器     | Phase 10   |
| 多视角切换         | Phase 10   |
| 平行人生模式       | Phase 10   |
| iOS/Android 打包   | Phase 12   |
