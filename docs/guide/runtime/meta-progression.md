---
outline: deep
---

# 跨周目进度

普通 Runtime 变量属于一次游玩：创建新 Runtime 时会从 `gameConfig.variables` 重新开始。需要在完整通关后解锁新路线、结局画廊或周目选项时，可以用 `gameConfig.progression` 明确声明少量跨周目变量。

```ts
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  gameConfig: {
    variables: {
      canonicalCompleted: false,
      storyMode: 'canonical',
      unlockedEndings: [],
    },
    progression: {
      id: 'my-game',
      version: 1,
      keys: ['canonicalCompleted', 'unlockedEndings'],
    },
  },
})
```

`id` 是稳定的游戏存储命名空间，`version` 是进度数据版本，`keys` 只接受顶层 Runtime 变量名。上例不会保存 `storyMode`，因此每次新游戏仍从原作模式开始，但已经完成的主线和结局解锁会被保留。

## 生命周期与确定性边界

浏览器宿主启动游戏时按以下顺序处理：

1. 读取 `gameConfig.variables`，得到本次游玩的全新默认值；
2. 从 `advjs:progression:{encoded-id}:v{version}` 读取进度记录；
3. 只把 `keys` 白名单中的持久值覆盖到默认变量；
4. 以合并后的 `initialVariables` 创建 Runtime；
5. Runtime 状态变化后，再把白名单字段同步回浏览器存储。

Core Runtime 不读取 `localStorage`，也不知道某个字段是否持久化。只要给定相同 Program 和合并后的初始变量，它仍产生相同结果。CLI、单元测试和其他宿主可以显式提供同样的初始变量，而不需要模拟浏览器存储。

存储缺失、JSON 损坏或浏览器禁止读取时，游戏退回配置中的全新默认值，不会因此拒绝启动。

## 适合与不适合持久化的状态

适合：

- 主线是否完整通关；
- 已解锁结局 ID；
- CG、音乐或附录的解锁 ID；
- 明确设计为跨周目继承的少量标记。

不适合：

- 当前章节、节点或选项；这些属于 `RuntimeSnapshot` 和存档；
- 本周目的好感、资源或临时路线模式；
- 大段玩家输入、秘密或不必要的业务数据；
- 可以从其他持久字段确定性推导出的重复状态。

白名单越小，迁移和隐私风险越低。需要在设置页解释或删除的数据，不应悄悄加入 progression。

## 版本与清除

改变持久字段的含义或 JSON 形状时，提高 `version`：

```json
{
  "progression": {
    "id": "my-game",
    "version": 2,
    "keys": ["canonicalCompleted", "unlockedEndings"]
  }
}
```

新版本使用独立存储键，不会把旧形状直接注入 Runtime。若必须保留旧进度，应在宿主层编写明确迁移，而不是让剧本猜测旧数据。

运行中的客户端可以清除当前游戏的进度记录：

```ts
$adv.progression?.clear()
```

清除只影响跨周目记录，不删除命名存档；已经运行的会话也不会被就地改写，重新开始游戏后才会使用默认值。

## Studio 与调试

Studio 试玩默认禁用浏览器 progression，始终从项目 `variables` 开始，避免作者机器上的通关记录让测试不可复现。要测试已解锁路线，可以在 Studio 的测试配置或快照中显式把 `canonicalCompleted` 设为 `true`。

浏览器开发模式的 Runtime Inspector 会像其他变量一样展示持久字段和变化轨迹。问题报告可能包含这些值，分享前仍需检查其内容。

## 仓鼠 Demo 的 A+ 模式

`demo/hamster` 只持久化：

```json
{
  "id": "hamster",
  "version": 1,
  "keys": ["canonicalCompleted", "unlockedEndings"]
}
```

首次游玩从两篇原作的完整主线开始。脚本在第二篇原作结尾设置 `canonicalCompleted: true`；下一次新游戏才显示演绎模式入口。`storyMode` 不持久化，避免玩家被永久留在某条路线中。
