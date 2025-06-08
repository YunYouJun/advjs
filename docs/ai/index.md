---
outline: deep
---

# AI

我们计划支持通过 AI 生成项目相关游戏剧本（JSON）与图片等资源。

更多的推进正在 [Pominis](https://www.pominis.com/) 中进行。

我们希望能在此处约定一个统一的 AI 生成格式。

## 约定格式

若打包为文件夹，文件夹名默认为`游戏 ID`。

### `adv.config.json`

> 游戏配置文件

与 `adv.config.ts` 中的配置项相同。

允许定义修改更多游戏层面的配置，如屏幕尺寸、亮暗模式等。

可参见 [AdvConfig](/api/@advjs/types/interfaces/AdvConfig)。

### `index.adv.json`

> 由 AI 生成的主要剧本文件。

游戏入口文件，定义了游戏的起始节点。

可在 Flow 编辑器格式与 AI 剧本格式中互相转换。
为了节约 token，AI 剧本格式是 Flow 编辑器格式的特殊简化版。

类型参见 [VSNode | Pominis](/api/plugins/plugin-pominis/interfaces/VSNode)。

其中主要包括：基础的节点 ID、场景描述、会话内容等。

### 资源目录结构

为了便于映射 CDN 资源，我们约定游戏中图片、音频等资源默认的目录结构。

- `nodes/`: 节点文件夹
  - `<节点 ID>/`: 节点 ID 文件夹
    - `default.png`: 默认的节点背景图
- `characters/`: 角色文件夹
  - `<角色 ID>/`: 角色 ID 文件夹
    - `avatar.png`: 角色头像
    - `tachie.png`: 角色全身立绘
- `audios/`: 音频文件夹
  - `bgms/`: 背景音乐文件夹
    - `<音乐名称>.mp3`: 背景音乐音频文件
  - `voices/`: 角色语音文件夹
    - `<角色 ID>/`: 角色 ID 文件夹
      - `<音频名称>.mp3`: 角色语音音频文件
  - `sfx/`: 音效文件夹
    - `<音效名称>.mp3`: 音效音频文件

例如：

小云的 ID 为 `XiaoYun`，此时头像 CDN 链接为 `CDN 前缀` + `游戏 ID` + `/characters/XiaoYun/avatar.png`

### 公共背景音乐列表

一组背景音乐：

音乐类型及其对应音乐名称/简介。

公共背景音乐列表可以 CDN 链接/JSON 形式配置在 `adv.config.json` 中，它的路径不依赖于游戏路径，可在多个游戏中复用曲库。

```ts
export interface PominisBgmLibrary {
  [key: string]: AdvMusic | AdvMusic[]
}
```

文件夹结构如下：

- `bgms/`: 背景音乐文件夹
  - `bgm-library.json`: 曲库列表 JSON 文件
  - `library/`: 曲库文件夹
    - `<音乐名称>.mp3`: 音乐文件

---

- 此时曲库 CDN 链接为：`CDN 前缀` + `bgms` + `/bgm-library.json`。
  - `https://cos.advjs.yunle.fun/bgms/bgm-library.json`
- 音乐 CDN 链接为：`CDN 前缀` + `bgms` + `/library/` + `<音乐名称>.mp3`。
  - `https://cos.advjs.yunle.fun/bgms/library/渚～坂の下の別れ.mp3`

如：

```json
{
  "daily_calm_piano_gentle": {
    "name": "渚",
    "description": "A very classic daily life theme. Slow, gentle piano melody with warmth and a subtle touch of melancholy. Perfect for peaceful school scenes, casual chats, quiet afternoons, or introducing the character Nagisa. Creates a comforting, serene atmosphere."
  },
  "daily_upbeat_piano_cheerful": {
    "name": "日々の遑",
    "description": "A more cheerful and upbeat daily life theme than 'Nagisa'. Faster tempo, lively piano melody with light percussion. Suitable for energetic mornings, school breaks, lighthearted club activities. Conveys sunshine and carefree feelings."
  },
  "calm_piano_pure_gentle": {
    "name": "約束",
    "description": "A gentle, pure piano piece with a sense of wintery clarity. Simple, touching melody suitable for quiet, warm moments between two people, a character's inner peace, or as a prelude to slightly melancholic memories. Creates a pure, tranquil atmosphere."
  },
  "emotional_warm_touching_piano_strings": {
    "name": "小さな手のひら",
    "description": "An extremely touching and warm melody, usually featuring piano and strings. Expresses deep familial love, romance, or friendship, filled with healing and redemption. Use for highly emotional heartwarming moments, relationship breakthroughs, successful confessions, or reunions."
  }
}
```
