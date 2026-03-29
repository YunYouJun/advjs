# ADV.JS Studio

ADV.JS Studio 是一个移动端/Web 端的 ADV.JS 项目管理与创作工具。

## 概述

Studio 旨在让创作者能够随时随地管理和预览自己的视觉小说项目，无需依赖桌面 IDE。它提供了直观的文件管理、AI 辅助创作和实时预览功能。

**访问地址**: [studio.advjs.org](https://studio.advjs.org)

## 功能介绍

### Workspace（工作区）

工作区是 Studio 的核心功能页面，合并了项目管理和文件浏览。

**无项目时 — 欢迎页**：

- 快速操作卡片：创建新项目、打开本地项目、从 URL 加载、从云端加载
- 最近项目的精选大卡片展示
- 历史项目列表（支持左滑删除）

**有项目时 — 工作区视图**：

- **文件树浏览**：基于 AGUI AssetsExplorer 组件，支持展开/折叠、面包屑导航、右键菜单
- **文件预览**：双击文件在 Monaco Editor 中查看，支持语法高亮
- **Diff 对比**：AI 修改文件后可查看修改前后对比
- **项目切换**：右上角下拉菜单快速切换项目
- **内容编辑器**：表单化创建/编辑角色、章节、场景，支持 AI 辅助生成

### Chat（AI 聊天）

与 AI 对话来辅助视觉小说创作：

- 自动加载当前项目上下文
- 支持复制项目上下文到剪贴板（配合外部 AI 工具使用）
- 内置快捷建议：创建角色、编写场景、故事大纲
- 支持多种 AI 服务商（OpenAI 兼容接口）

### World（世界）

AI Living World 的入口，浏览和与角色互动：

- **角色列表**：展示项目中的所有角色卡片，显示头像/初始字母、心情、位置、标签
- **角色对话**：选择角色进入沉浸式 1v1 对话，AI 基于 `.character.md` 人设保持角色一致性
- **对话记忆**：AI 自动提取每轮对话的关键记忆（事实、偏好、情感状态），跨会话保持连贯
- **动态状态**：角色位置、健康、活动、自定义属性实时变化
- **世界时钟**：可推进的日期/时段/天气系统，影响角色对话语境
- **世界事件**：随时间推进自动生成日常/社交/意外/天气等事件
- **群聊**：多角色群组对话，AI 自动选择发言角色轮流回复
- **视角模式**：角色模式（扮演已有角色）、上帝模式（全知视角）、访客模式（旁观者）
- **玩家角色**：自建角色或 AI 生成角色，以自定义身份参与世界
- **专业角色**：通过 `knowledgeDomain` + `expertisePrompt` 字段支持领域专家角色
- **知识库系统**：从 `adv/knowledge/` 加载 `.md` 知识文件，按 section 级粒度检索注入
- **对话导出**：将对话导出为 `.adv.md`（到项目）或 Markdown（下载）
- **对话搜索**：搜索历史消息并跳转定位
- **世界上下文**：自动加载 `world.md` + `glossary.md` 作为对话背景

### Play（播放）

预览当前项目的内容：

- 查看 `world.md` 世界观概要
- 浏览章节列表和内容
- 统计信息（章节数、角色数）
- 云端同步操作（推送、拉取、手动同步）

### Me（我的）

「我的」是个人中心与设置入口页面，采用 iOS Settings 风格的分组列表布局。

**账号区域**：

- 未登录时展示登录/注册引导卡片
- 已登录时显示用户头像、昵称和邮箱

**功能入口**：

- **设置** — 进入设置页面（AI 服务商、外观、云同步、清除缓存）
- **反馈** — 前往 GitHub Issues 提交反馈
- **关于** — 版本信息与文档链接

**开发者选项**（需手动开启，见下方说明）：

- 调试信息查看与复制
- 重新加载应用
- 重置所有数据

#### 开启开发者选项 {#enable-developer-options}

开发者选项默认隐藏，类似 Android 开发者模式的开启方式：

1. 前往「我的」→「设置」→「关于」
2. 连续点击顶部 **ADV.JS Studio Logo** 5 次
3. 最后 3 次点击时会出现倒计时提示
4. 第 5 次点击后提示「开发者选项已开启」
5. 返回「我的」页面底部将出现「开发者选项」入口

::: tip 关闭开发者选项
进入「开发者选项」页面，点击底部的「关闭开发者选项」即可。
:::

## 技术架构

### 核心技术栈

- **Ionic Vue** — 跨平台 UI 框架，提供原生级别的移动端体验
- **AGUI** — ADV.JS GUI 组件库，提供文件树、资源管理器等专业组件
- **Monaco Editor** — VS Code 同款编辑器，用于文件预览和编辑
- **File System Access API** — 浏览器原生文件系统访问（桌面 Chromium）
- **Pinia** — 状态管理
- **Vue I18n** — 国际化（中/英双语）

### 项目来源

Studio 支持多种项目来源：

| 来源  | 说明                                  | 支持平台         |
| ----- | ------------------------------------- | ---------------- |
| Local | File System Access API 打开本地文件夹 | 桌面 Chrome/Edge |
| URL   | 从远程 URL 加载项目                   | 所有平台         |
| COS   | 腾讯云对象存储同步                    | 所有平台         |

### 云同步

使用腾讯云 COS（对象存储）实现项目云同步：

- 手动推送/拉取
- 定时自动同步
- 编辑后自动保存到云端

### 状态管理

Studio 使用 12 个 Pinia Store 管理全局状态，全部 localStorage 持久化：

| Store                     | 职责                                        |
| ------------------------- | ------------------------------------------- |
| `useStudioStore`          | 当前项目信息、项目列表                      |
| `useAiSettingsStore`      | AI 服务商配置（API Key、模型、Base URL）    |
| `useSettingsStore`        | 用户设置（外观、语言、COS 配置）            |
| `useCharacterChatStore`   | 角色 1v1 对话（消息、流式生成、上下文窗口） |
| `useChatStore`            | 通用 AI 聊天（项目创作辅助）                |
| `useCharacterMemoryStore` | 角色记忆（事实、偏好、情感状态提取）        |
| `useCharacterStateStore`  | 角色动态状态（位置、健康、活动、属性）      |
| `useWorldClockStore`      | 世界时钟（日期、时段、天气）                |
| `useWorldEventStore`      | 世界事件（日常/社交/意外/天气）             |
| `useGroupChatStore`       | 多角色群聊（自动选人、轮流发言）            |
| `useViewModeStore`        | 视角模式（角色/上帝/访客）                  |

## 使用说明

### 创建项目

1. 打开 Studio，在工作区欢迎页点击「创建新项目」
2. 输入项目名称，选择模板
3. 选择本地文件夹作为项目目录
4. 项目自动创建并打开

### 打开已有项目

1. 点击「打开本地项目」
2. 选择包含 ADV.JS 项目的文件夹
3. Studio 自动检测项目结构

### 文件浏览和编辑

1. 打开项目后自动进入工作区视图
2. 左侧文件树浏览项目结构
3. 双击文件在右侧 Monaco Editor 中预览
4. 支持 `.adv.md`、`.ts`、`.json` 等多种格式语法高亮

### 云同步设置

1. 前往「我的」→「设置」→「云同步（COS）」
2. 填写腾讯云 COS 配置（Bucket、Region、SecretId、SecretKey）
3. 测试连接确认配置正确
4. 可选开启自动同步

### 专业角色与知识库

角色可通过 `.character.md` 配置专业领域：

```md
## 知识领域

法律

## 专业提示

你是一名资深律师，精通刑法和民法……
```

在 `adv/knowledge/` 目录下放置领域知识文件：

```text
adv/knowledge/
  law/
    criminal-law.md
    civil-law.md
  general/
    overview.md
```

系统自动按 `##` 标题拆分为 section，对话时根据用户提问关键词匹配，仅注入相关段落（默认 3000 字以内），节省 token 消耗。

## 已完成阶段回顾

### Phase 1-5：基础 Mobile Studio

建立了 Studio 的核心框架：

- Ionic Vue 移动端 UI 框架
- 五个主要 Tab：Workspace / Chat / World / Play / Me
- 项目管理（创建、打开本地/URL/COS、切换、删除）
- 文件树浏览与 Monaco Editor 预览
- AI 聊天辅助创作
- 腾讯云 COS 云同步
- 中英双语 i18n
- 内容编辑器（表单化创建角色/章节/场景）
- 设置系统（AI 服务商、外观、语言、云同步）

### Phase 6：角色记忆与对话增强 {#phase-6}

为角色对话添加了记忆系统，让 AI 角色能记住与玩家的互动历史。

**实现内容**：

- `useCharacterMemoryStore` — AI 自动从每轮对话中提取关键记忆（learned facts、preferences、emotional state）
- Smart Context Window — 保留首轮+最近消息+中间摘要，控制 API token 消耗
- 对话导出为 `.adv.md` 或 Markdown
- `ChatHistorySearch` — 消息搜索与跳转高亮
- `MarkdownMessage` — 支持 Markdown 渲染的消息气泡

### Phase 7：动态角色状态 {#phase-7}

角色不再是静态人设，具有了随对话变化的动态属性。

**实现内容**：

- `useCharacterStateStore` — 从对话中自动提取角色的位置、健康、活动、自定义属性变化
- 角色卡片显示位置（📍）和心情 emoji
- `CharacterInfoModal` — 详细展示角色信息 + 动态状态

### Phase 8：世界事件与时间系统 {#phase-8}

给世界增加了时间维度和动态事件。

**实现内容**：

- `useWorldClockStore` — 世界时钟（日期、时段、天气），可推进时间
- `useWorldEventStore` — AI 生成的世界事件（日常/社交/意外/天气）
- 时钟状态自动注入角色对话上下文

### Phase 9：多角色交互 {#phase-9}

从 1v1 扩展到多角色群组对话。

**实现内容**：

- `useGroupChatStore` — 群聊管理，AI 自动选择发言角色
- `GroupChatPage` — 群聊界面，多角色头像/颜色区分
- `CreateGroupChatModal` — 选择 2+ 角色创建群聊

### Phase 10：平行人生与玩家角色 {#phase-10}

允许玩家以自定义身份参与世界。

**实现内容**：

- `useViewModeStore` — 三种视角模式（角色/上帝/访客），影响系统提示词前缀
- `PlayerCreatorPage` — AI 生成或手动创建玩家角色
- `ViewModeSwitcher` — 视角切换控件
- `SelectPlayerCharacterModal` — 选择已有角色扮演

### Phase 11：专业角色知识系统 {#phase-11}

让角色能引用领域知识文件回答专业问题。

**实现内容**：

- `useKnowledgeBase` — 知识库加载（本地 + COS）、`##` section 拆分、关键词检索
  - 中文 2-3 字 n-gram + 英文分词，heading 权重 ×3
  - 按分数降序取 section，累计不超过 maxChars（默认 3000）
  - 接口设计支持未来替换为 embedding 方案
- 知识注入 `buildCharacterSystemPrompt()` — 检索结果作为 `# {domain}知识参考` 注入系统提示词
- `CharacterCard` — 专业领域徽章（emoji + domain），⚖️法律 🏥医学 🧠心理 💰金融 💻科技 📚教育
- `KnowledgeManageModal` — 知识库查看弹窗（文件列表、section 预览、空状态引导）
- `CharacterInfoModal` — 知识库入口按钮
- `useProjectContent` — 集成知识库加载，stats 新增 `knowledge` 计数

**待优化**：

- 知识检索从关键词匹配升级为 embedding 向量相似度（V2）
- 支持在 Studio UI 中直接创建/编辑知识文件
- 知识文件变更时自动重新索引

## 后续路线 {#roadmap}

### Phase 12：原生打包与性能优化

- [ ] Capacitor 打包 iOS/Android 原生应用
- [ ] 虚拟滚动优化长消息列表
- [ ] 离线模式（Service Worker 缓存）
- [ ] 消息数据库迁移（localStorage → IndexedDB）

### Phase 13：账号系统 {#phase-13}

- [ ] 用户注册/登录（邮箱 + OAuth）
- [ ] 用户资料（头像、昵称、简介）
- [ ] 项目云端绑定（账号关联项目，跨设备同步）
- [ ] 个人作品集页面

### Phase 14：世界/故事市场 {#phase-14}

::: tip 前置依赖
需要 Phase 13 账号系统完成后实施。
:::

让用户可以发布和发现其他创作者的世界与故事，一键加载开始游玩。

**核心功能**：

- **市场浏览** — 分类展示公开的世界/故事，支持搜索、标签筛选、热门排序
- **世界发布** — 创作者将项目打包发布到市场（角色 + 世界观 + 知识文件 + 章节）
- **一键加载** — 用户从市场选择世界/故事，自动创建本地项目并加载全部资源
- **角色预览** — 进入市场的世界详情页，查看角色卡片列表、世界观概要、知识领域
- **评价系统** — 用户评分、评论、收藏
- **创作者主页** — 展示创作者发布的所有作品

**数据结构设想**：

```ts
interface MarketplaceEntry {
  id: string
  title: string
  author: { id: string, name: string, avatar?: string }
  description: string
  tags: string[]
  cover?: string
  characters: number // 角色数量
  chapters: number // 章节数量
  knowledgeDomains: string[] // 涉及的知识领域
  downloads: number
  rating: number
  createdAt: string
  updatedAt: string
  // 资源打包（COS 或 CDN 地址）
  bundleUrl: string
}
```

**技术方案**：

- 后端 API（发布/浏览/搜索）— 可基于 Cloudflare Workers / Vercel Edge Functions 等 Serverless 方案
- 项目打包格式 — 将 `adv/` 目录压缩为标准包（.advpkg.zip），含 manifest.json 描述元信息
- CDN 分发 — 利用已有 COS 或 R2 存储分发资源包
- 市场页面 — Studio 内新增 Market Tab 或 World Tab 下的子页面

### 其他计划

- [ ] **Chat 内联 Diff** — AI 修改文件后在对话流中显示 diff 预览
- [ ] **多人协作 / 实时同步** — 基于 CRDT 或 OT 的协同编辑
- [ ] **插件系统** — 接入 Babylon/Three/OpenAI 等引擎插件
- [ ] **资源管理** — 图片/音频/VRM 模型预览与管理
- [ ] **角色关系图谱** — 可视化展示角色间关系网络
- [ ] **对话分支回溯** — 保存对话存档点，回到过去的对话分支重新开始
- [ ] **AI 角色自主日记** — 角色在无玩家交互时自动生成内心独白/日记
- [ ] **语音合成集成** — TTS 为角色对话添加语音

## 已知待优化项 {#improvements}

以下是现有功能中已识别的可改进点：

### 数据持久化

- **localStorage 容量有限** — 当前所有 Store 使用 localStorage 持久化，对话历史过多时可能超出 5MB 限制。应迁移至 IndexedDB。
- **消息清理策略** — 缺少自动归档或清理旧对话的机制。

### 知识库系统

- **检索精度** — 当前 V1 关键词匹配对语义理解有限，中文分词依赖简单 n-gram。未来应引入 embedding 向量检索（可考虑 Web 端 transformers.js 或调用外部 embedding API）。
- **知识编辑** — 目前只能在文件系统层面管理知识文件，应在 Studio UI 中提供创建/编辑界面。
- **增量更新** — 知识文件变更后需手动刷新，应自动检测变化并重新索引。

### AI 对话

- **记忆摘要质量** — `useCharacterMemoryStore` 的记忆提取依赖 AI 响应格式，有时提取不精确。可增加格式校验和重试机制。
- **多模型支持** — 不同角色可使用不同模型/温度设置（如专业角色用高精度低温度模型）。
- **上下文压缩** — Smart Context Window 目前只做简单截断 + 摘要，可引入更智能的上下文压缩算法。

### UI/UX

- **长列表性能** — 消息列表和角色列表未使用虚拟滚动，大量数据时可能卡顿。
- **离线体验** — 当前无 Service Worker 缓存，离线时无法使用。
- **响应式布局** — 桌面端宽屏下布局利用率不足，可优化为双栏布局。
