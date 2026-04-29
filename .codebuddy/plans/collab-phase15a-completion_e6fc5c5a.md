---
name: collab-phase15a-completion
overview: 按优先级完成 Phase 15a 多人协作剩余功能：首先实现状态数据协同（角色状态/世界时钟/对话消息走 Y.Map/Y.Array），其次完成协作者邀请/成员管理 UI 页面，然后补全 CloudBase 安全规则权限闭环，最后编写核心 E2E 测试。
todos:
  - id: collab-sync
    content: 实现 useCollabSync composable，将角色状态/世界时钟/对话消息通过 Y.Map/Y.Array 双向桥接到 Pinia Store，含防回环和断线恢复
    status: completed
  - id: collab-sync-integration
    content: 在 useCollabRoom 和 ContentEditorModal 中集成 useCollabSync，协作模式激活时自动启动状态同步
    status: completed
    dependencies:
      - collab-sync
  - id: collab-settings-page
    content: 创建 CollabSettingsPage.vue 成员管理页面（成员列表/邀请/移除/角色切换），注册路由，ContentEditorModal 增加导航入口，补充 i18n 文案
    status: completed
  - id: collab-auth-function
    content: 使用 [skill:cloudbase] 创建 collab-auth 云函数实现服务端权限校验（invite/remove/updateRole），useCollabStore 改为云函数调用
    status: completed
  - id: collab-tests
    content: 编写 collabSync 单元测试和 collab E2E 测试，覆盖房间生命周期、状态同步、成员管理 UI 流程
    status: completed
    dependencies:
      - collab-sync
      - collab-settings-page
  - id: update-roadmap
    content: 更新 roadmap.md，标记 Phase 15a 已完成项
    status: completed
    dependencies:
      - collab-sync-integration
      - collab-settings-page
      - collab-auth-function
      - collab-tests
---

## 产品概述

ADV.JS Studio Phase 15a 多人协作功能的剩余 4 项待办工作，按用户价值和核心体验优先级排序后分批实施。

## 核心功能

### P0: 状态数据协同（角色状态 / 世界时钟 / 对话消息的 Y.Map / Y.Array 协同）

- 将 `useCharacterStateStore` 的角色动态状态（位置/健康/活动）双向绑定到 `Y.Map`，协作参与者实时可见同一角色的状态变化
- 将 `useWorldClockStore` 的世界时钟（日期/时段/天气/运行状态）同步到 `Y.Map`，所有协作者共享统一的世界时间线
- 将 `useChatStore` 的项目级对话消息同步到 `Y.Array`，协作者可在同一对话上下文中交互
- 协同层与本地 Dexie 持久化层共存：协作模式时 Yjs 为 single source of truth，离线/单人模式时回退到 Dexie

### P1: 协作者邀请 / 成员管理完整页面

- 新建 `CollabSettingsPage.vue`：成员列表展示（头像/昵称/角色/在线状态指示灯）、邀请新成员（输入 UID + 选择角色）、移除成员（仅 owner 可操作）、角色切换（owner/editor/viewer）
- 注册路由 `/tabs/workspace/collab`，从 `ContentEditorModal` 协作状态条可导航进入
- 在线状态指示使用已有的 `useCollabStore.onlineUsers` 心跳数据

### P2: CloudBase 集合安全规则 / 云函数权限闭环

- 新建 `collab-auth` 云函数，封装成员邀请、移除、房间数据写入的服务端权限校验
- 为 4 个协作集合（`advjs_collab_rooms`/`advjs_collab_state`/`advjs_collab_updates`/`advjs_collab_awareness`）定义 CloudBase 安全规则，按 UID 做读写隔离
- 客户端 `useCollabStore` 的 `inviteMember`/`removeMember` 改为通过云函数调用，不再直接写数据库

### P3: E2E 测试

- 新建 `collab.spec.ts` Playwright E2E 测试：协作房间创建 / 加入 / 离开、成员邀请 / 移除、协作状态条 UI 验证
- 测试断线重连场景（模拟网络断开后恢复，验证 Provider 自动重连和数据一致性）
- 测试权限拒绝场景（非成员尝试访问房间、viewer 尝试写入）

## 技术栈

- 前端框架: Vue 3 + Ionic 7 + Pinia
- 协同引擎: Yjs ^13.6.30 + y-monaco ^0.1.6
- 同步传输: CloudBase JS SDK + 实时数据库 watch()
- 云函数: CloudBase Node.js 云函数
- 测试: Playwright (E2E) + Vitest (单测)
- 持久化: Dexie (IndexedDB)
- 国际化: vue-i18n

## 实现方案

### P0: 状态数据协同 — Y.Map / Y.Array 桥接层

**核心策略**: 创建 `useCollabSync` composable 作为 Yjs 共享类型与 Pinia Store 之间的双向桥接器。

**工作原理**:

1. 当协作模式激活时（`isInRoom && isSynced`），`useCollabSync` 从 `useCollabRoom` 获取 `Y.Map` / `Y.Array` 实例
2. 使用 `Y.Map.observe()` / `Y.Array.observe()` 监听远端变更 → 更新 Pinia Store
3. 使用 Pinia `$subscribe()` 或 `watch()` 监听本地 Store 变更 → 写入 Y.Map / Y.Array
4. 防回环：设置 `syncing` 标志位，远端写入时跳过本地监听器，本地写入时跳过远端监听器

**关键设计决策**:

- **角色状态** (`useCharacterStateStore`): 使用 `Y.Map` 键为 `state:characterStates`，值为嵌套 `Y.Map<characterId, JSON>`。因为角色状态是键值对结构，且冲突可通过 LWW (Last Writer Wins) 合理解决
- **世界时钟** (`useWorldClockStore`): 使用 `Y.Map` 键为 `state:worldClock`。时钟状态是全局唯一单值，`Y.Map.set()` 天然 LWW 语义即可
- **对话消息** (`useChatStore`): 使用 `Y.Array` 键为 `state:chatMessages`。消息是追加型列表，Y.Array 的 insert 语义确保消息顺序一致性，不会丢失并发消息
- **退出协作时**的处理：销毁 observe 监听器，Pinia Store 保留当前快照继续独立运行，Dexie 持久化恢复正常工作

**性能考量**:

- Y.Map.observe 回调使用 `requestAnimationFrame` 或 `queueMicrotask` 合并批量更新，避免高频事件引发 N 次 Vue 响应式更新
- 角色状态更新使用 `Y.Doc.transact()` 包裹多字段修改，减少增量更新数量
- 对话消息的 Y.Array 仅同步最近 100 条（与现有 `MAX_STORED_MESSAGES` 一致），加入房间时做初始截断

### P1: 协作设置 UI 页面

**策略**: 遵循项目已有的 Settings Page 模式（`IonPage` + `IonHeader` + `IonBackButton` + `section-card` 布局），使用 Ionic 组件库，复用 `useCollabStore` 已有的 `inviteMember`/`removeMember` API。

**关键设计**:

- 成员列表使用 `IonList` + `IonItem`，每行展示头像占位符、昵称、角色标签（`IonBadge`）、在线绿点
- 邀请表单使用 `IonInput`（UID）+ `IonSelect`（角色选择）+ `IonButton`
- Owner 操作栏：移除按钮（`IonItemSliding` 滑动删除）、角色切换（`IonSelect`）
- 从 `ContentEditorModal` 协作状态条增加设置图标按钮，点击 `router.push('/tabs/workspace/collab')`

### P2: 云函数权限闭环

**策略**: 新建 `collab-auth` HTTP 云函数，封装 3 个 action（invite/remove/updateRole），通过 `context.auth.uid` 获取调用者身份，校验调用者是否为房间 owner。客户端改为 `cloudApp.callFunction()` 调用。

**安全规则设计**:

- `advjs_collab_rooms`: 只允许 owner 修改 members 字段；所有已登录用户可读（fetchRoom 需要校验 membership）
- `advjs_collab_updates` / `advjs_collab_awareness`: 已登录用户可读写（通过 roomId 隐式隔离）
- `advjs_collab_state`: 已登录用户可读写（心跳更新）

### P3: E2E 测试

**策略**: 新增 `collab.spec.ts`，由于 CloudBase 实时同步难以在 CI 中完全模拟，测试分为两层：

1. 单元测试：`useCollabSync` 桥接逻辑的纯函数测试（mock Y.Map/Y.Array）
2. E2E 测试：协作 UI 交互流程（创建房间 → 状态条变化 → 设置页导航 → 离开房间）

## 实现注意事项

### 防回环机制

桥接层使用 `_syncOrigin` 标志区分本地变更和远端变更，`Y.Map.observe` 回调中检查 `transaction.origin !== 'local'` 才写入 Store，`$subscribe` 中检查 `!isSyncing` 才写入 Y.Map。

### 断线重连

`YCloudbaseProvider` 已有 `flushPendingUpdate` 失败重试机制。额外在 `useCollabSync` 中监听 provider 的 `status` 事件，`disconnected` 时暂停桥接，`connected` 时从 Y.Doc 重新加载最新状态到 Store。

### 向后兼容

所有改动对单人编辑模式零影响：`useCollabSync` 仅在 `isInRoom && isSynced` 为 true 时激活，否则 Store 完全独立运行。

## 架构设计

```mermaid
graph TD
    subgraph "Pinia Stores (本地状态)"
        CS[useCharacterStateStore<br/>states: Map]
        WC[useWorldClockStore<br/>clock: WorldClockState]
        CH[useChatStore<br/>messages: ChatMessage[]]
    end

    subgraph "桥接层"
        SYNC[useCollabSync<br/>双向桥接 composable]
    end

    subgraph "Yjs 共享类型"
        YM1["Y.Map 'state:characterStates'"]
        YM2["Y.Map 'state:worldClock'"]
        YA1["Y.Array 'state:chatMessages'"]
    end

    subgraph "传输层"
        PROV[YCloudbaseProvider]
        CB[(CloudBase<br/>advjs_collab_updates)]
    end

    CS <-->|"$subscribe / observe"| SYNC
    WC <-->|"$subscribe / observe"| SYNC
    CH <-->|"$subscribe / observe"| SYNC

    SYNC <-->|"getSharedMap / getSharedArray"| YM1
    SYNC <-->|"getSharedMap"| YM2
    SYNC <-->|"getSharedArray"| YA1

    YM1 & YM2 & YA1 --> PROV
    PROV <-->|"watch() + add()"| CB
```

## 目录结构

```
apps/studio/
├── src/
│   ├── composables/
│   │   └── useCollabSync.ts          # [NEW] Yjs <-> Pinia Store 双向桥接 composable。实现 Y.Map/Y.Array 与三个 Store (characterState/worldClock/chat) 的实时同步，包含防回环机制、协作模式自动激活/停用、断线重连状态恢复。暴露 startSync()/stopSync() 生命周期方法。
│   ├── views/
│   │   └── workspace/
│   │       └── CollabSettingsPage.vue # [NEW] 协作设置页面。展示成员列表（头像/昵称/角色/在线状态）、邀请成员表单（UID+角色选择）、移除成员（滑动删除）、角色切换。使用 Ionic 组件 + section-card 布局，复用 useCollabStore API。
│   ├── stores/
│   │   └── useCollabStore.ts         # [MODIFY] 将 inviteMember/removeMember 改为通过云函数调用（P2），新增 updateMemberRole 方法。
│   ├── components/
│   │   └── ContentEditorModal.vue    # [MODIFY] 协作状态条增加设置页导航按钮（齿轮图标），点击跳转 /tabs/workspace/collab。
│   ├── router/
│   │   └── index.ts                  # [MODIFY] 新增 /tabs/workspace/collab 路由指向 CollabSettingsPage。
│   ├── i18n/
│   │   └── locales/
│   │       ├── en.json               # [MODIFY] 新增协作设置页相关英文文案。
│   │       └── zh-CN.json            # [MODIFY] 新增协作设置页相关中文文案。
│   └── __tests__/
│       └── collabSync.test.ts        # [NEW] useCollabSync 桥接逻辑单元测试。覆盖 Y.Map <-> Store 双向同步、防回环、边界条件。
├── cloud/
│   └── functions/
│       └── collab-auth/
│           ├── index.js              # [NEW] 协作权限云函数。处理 invite/remove/updateRole 三个 action，通过 context.auth.uid 校验调用者是否为房间 owner，操作 advjs_collab_rooms 集合。
│           └── package.json          # [NEW] 云函数依赖声明。
├── tests/
│   └── e2e/
│       └── collab.spec.ts            # [NEW] 协作 E2E 测试。覆盖协作房间创建/加入/离开流程、协作状态条 UI、成员管理页导航。
└── docs/
    └── guide/
        └── studio/
            └── roadmap.md            # [MODIFY] 更新 Phase 15a 进度，标记已完成项。
```

## Agent Extensions

### Skill

- **cloudbase**
- 用途: 创建 collab-auth 云函数、配置 CloudBase 集合安全规则
- 预期结果: 云函数正确部署，安全规则生效，协作集合按 UID 做权限隔离

### SubAgent

- **code-explorer**
- 用途: 在实施各步骤时深入探索相关文件的最新状态和依赖关系
- 预期结果: 确保每步实施都基于最新代码上下文，避免遗漏依赖或引入冲突
