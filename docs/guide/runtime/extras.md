# 附录：结局、成就、回想与音乐鉴赏

在 `adv/settings/game.json` 中声明结局、成就、可回想场景与音乐鉴赏后，默认客户端会在 `/extras` 页面显示附录，并在 `/flow-chart` 显示玩家已抵达的路线。附录建立在[跨周目进度](/guide/runtime/meta-progression)和 CG 画廊之上：剧本只写入运行时变量，浏览器宿主负责记录与展示。

## 声明附录数据

以下字段都可选，只声明需要的部分。数据是纯 JSON，Studio 与 CLI 都能读取。

```json
{
  "variables": {
    "unlockedEndings": [],
    "unlockedAchievements": []
  },
  "progression": {
    "id": "my-game",
    "version": 1,
    "keys": ["unlockedEndings", "unlockedAchievements"]
  },
  "endings": {
    "key": "unlockedEndings",
    "items": [
      { "id": "true-end", "title": "星光回响", "hint": "走完全部章节", "description": "解锁后显示的说明" }
    ]
  },
  "achievements": {
    "key": "unlockedAchievements",
    "items": [
      { "id": "first-step", "title": "第一次观测", "hint": "开始游戏" }
    ]
  },
  "replays": [
    { "id": "opening", "title": "夏日午后", "chapterId": "prologue", "nodeId": "summer", "endNodeId": "observers" }
  ],
  "musicRoom": {}
}
```

| 字段           | 作用                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| `endings`      | 结局列表；`key` 默认为 `unlockedEndings`                                |
| `achievements` | 成就列表；`key` 默认为 `unlockedAchievements`                           |
| `replays`      | 可回想场景；`nodeId` 默认为章节入口，`variables` 覆盖回想时的初始变量   |
| `musicRoom`    | 音乐鉴赏；`tracks` 指定顺序、标题与说明，省略时列出资源目录中的全部 BGM |

条目的 `hint` 在未解锁时显示，省略则只显示“尚未达成”；`description` 在解锁后显示。`key` 应同时出现在 `progression.keys` 中，否则解锁不会进入下一次新游戏的初始变量。

## 解锁结局与成就

结局和成就都用 `variables/push-unique` 把条目 ID 写入对应变量，可以放在动作块或选项动作中：

```yaml
type: actions
when: starMatched && starMatchScore >= 0.82
actions:
  - type: variables/push-unique
    key: unlockedAchievements
    value: perfect-alignment
```

运行时只看到普通变量，不知道附录的存在，因此同一 Program 和初始变量仍产生相同结果。浏览器宿主在每次状态变化后，把已声明的 ID 合并进附录记录；成就首次记录时，默认客户端在游戏画面右上角显示解锁提示。新游戏恢复已有成就、读取旧存档或历史回退都不会重复提示。

## 场景回想

`replays` 中的场景在任意一次游玩中抵达起点锚点后开放。锚点即章节中的 `## 标题 {#anchor-id}`，章节入口也可作为起点。回想从起点创建一个全新的运行时：

- 初始变量为 `gameConfig.variables` 叠加该条目的 `variables`，不读取已保存的跨周目进度；
- 存档使用内存存储，结束后即丢弃，不覆盖任何存档槽位；
- 不写入跨周目进度、CG 画廊与附录记录，也不触发成就提示；
- 抵达 `endNodeId`、进入其他章节或剧情结束时停止，并显示“回想结束”。

宿主可以通过 `$adv.init({ isolated: true, variables })` 复用同一隔离会话。`persistence: false` 用于 Studio 草稿试玩，它会断开浏览器进度与收藏记录，回想页面不使用它。

## 音乐鉴赏

音乐鉴赏列出 `kind: bgm` 的音频资源，标题优先取 `musicRoom.tracks[].title`，其次取资源目录条目的 `title`。只有成为过当前主音乐的曲目才能播放，播放经过同一 AudioEngine 与 Mixer 的 music 总线，遵守玩家的音量与静音设置。离开页面或开始游戏时停止播放。

## 路线图

`/flow-chart` 从编译后的 Program 生成路线图：每个章节入口与锚点是一个节点，剧情不经过其他锚点即可到达的两个节点之间连一条边，选项目标、条件分支和跨章节跳转都会计入。页面只显示玩家抵达过的节点，以及两端都已抵达的边，未抵达的路线保持隐藏。

## 浏览器记录

附录记录保存在 `advjs:extras:{encoded-id}:v1`，`id` 依次取 `progression.id`、`gallery.id` 与游戏标题。记录只追加，包含抵达过的章节入口与锚点、听过的 BGM，以及已记录的结局与成就。附录页面同时合并记录与已保存的跨周目进度，因此功能上线前已解锁的结局也会显示。

读取解锁前的旧档会恢复当时的剧情变量。附录与跨周目记录保留已解锁的结局和成就，下一次新游戏仍会继承 `progression.keys` 配置的解锁变量。需要清除附录记录时调用：

```ts
$adv.extras?.clear()
```

## 检查

`adv check` 会报告以下问题：

| 诊断码                                | 级别 | 含义                                           |
| ------------------------------------- | ---- | ---------------------------------------------- |
| `ADV_PROJECT_INVALID_EXTRAS`          | 错误 | 字段结构无效、ID 重复或 `key` 不是顶层变量名   |
| `ADV_PROJECT_UNKNOWN_ENDING`          | 错误 | 剧本写入了未在 `endings.items` 中声明的结局 ID |
| `ADV_PROJECT_UNKNOWN_ACHIEVEMENT`     | 错误 | 剧本写入了未声明的成就 ID                      |
| `ADV_PROJECT_UNKNOWN_REPLAY_ANCHOR`   | 错误 | 回想的章节或锚点不存在，或起点与结束锚点相同   |
| `ADV_PROJECT_UNKNOWN_MUSIC_TRACK`     | 错误 | `musicRoom.tracks` 引用了不是 BGM 的资源       |
| `ADV_PROJECT_UNREACHABLE_ENDING`      | 警告 | 没有任何动作解锁该结局                         |
| `ADV_PROJECT_UNREACHABLE_ACHIEVEMENT` | 警告 | 没有任何动作解锁该成就                         |
| `ADV_PROJECT_EXTRAS_NOT_PERSISTED`    | 警告 | 解锁变量未列入 `progression.keys`              |

剧本诊断指向写入该 ID 的章节行，配置诊断指向 `game.json` 中对应条目。动态计算的 ID 无法静态检查，应改为字面值。

## 仓鼠 Demo

`demo/hamster` 声明了 4 个结局、4 个成就、5 段回想与全部 8 首 BGM。运行 `pnpm demo:hamster` 后，从标题页的“观测附录”进入；开场后即可解锁“第一次观测”，可用来确认提示是否出现。

## 验证

1. 运行 `adv check`，确认没有 `ADV_PROJECT_UNKNOWN_*` 诊断；
2. 开始新游戏并抵达一个成就动作，确认右上角出现提示；
3. 打开 `/extras`，确认结局、成就、回想与音乐的计数变化；
4. 从附录回想一个场景，结束后读取存档列表，确认没有新增或被覆盖的槽位。
