# 玩家操作与已读记录

默认游戏界面 `AdvGame` 提供常见视觉小说的键盘、鼠标和手柄操作，并在浏览器中记录已读文本和已选选项。这些功能只属于宿主层：Core Runtime 仍然只维护 `RuntimeState.visited` 和 `RuntimeState.choices`，不读取浏览器存储。

## 快捷键

| 操作                 | 键盘与鼠标             | 手柄（标准布局） |
| -------------------- | ---------------------- | ---------------- |
| 推进对白             | Space、Enter、点击对白 | A                |
| 按住快进             | 按住 Ctrl              | —                |
| 自动播放             | A                      | X                |
| 隐藏 / 显示界面      | H、右键                | —                |
| 回看                 | L、滚轮上滑            | Y                |
| 快速存档             | S、F5                  | —                |
| 快速读档             | F9                     | —                |
| 设置菜单             | Esc                    | —                |
| 关闭菜单，否则回退   | —                      | B                |
| 在选项和菜单之间移动 | Tab                    | 方向键           |

推进与点击对白的效果相同：打字机未完成时先显示整句，再次推进才进入下一句。界面隐藏时，推进、Esc 或手柄 B 只恢复界面，不推进剧情。选项、互动活动和结局不会被推进键跳过。

以下情况不响应快捷键，`useAdvKeys` 中的 `uiBlocked()` 统一判断：

- 回看、存读档、设置或术语弹层已打开；它们自己处理 Esc 等按键，关闭弹层的 Esc 不会再次打开菜单；
- 焦点在输入框、下拉框或可编辑内容中；
- 焦点在按钮上时，Space 和 Enter 交给按钮本身，手柄 A 也会点击该按钮。

带 Ctrl、Alt 或 Meta 的组合键保留给浏览器。F5 在游戏中改为快速存档，不会刷新页面。滚轮上滑只在指针下的内容无法继续向上滚动时打开回看，例如很长的选项列表会先滚动到顶部。

操作栏按钮的提示气泡会显示对应快捷键，文字来自 `useGameControlsI18n` 的 `shortcuts` 文案。

### 嵌入页面

`AdvGame` 的 `keyControls` 决定快捷键的作用范围：

| 值               | 行为                                                           |
| ---------------- | -------------------------------------------------------------- |
| `'page'`（默认） | 焦点在游戏内，或页面上没有聚焦元素时响应，适合独立游戏页面     |
| `'focus'`        | 只在焦点位于游戏内时响应；点击游戏画面即可获得焦点，适合编辑器 |
| `false`          | 不注册快捷键                                                   |

```vue
<template>
  <AdvGame key-controls="focus" />
</template>
```

Editor 和 Studio 的内嵌游戏预览使用 `focus`。鼠标操作通过游戏区域接收。Studio 在作者查看运行时检查器或定位剧情节点时禁用预览快捷键。

## 快进与已读文本

设置面板的「对白」页提供「快进」选项：

| 设置               | 行为                             |
| ------------------ | -------------------------------- |
| 仅已读文本（默认） | 在任一周目都没有读过的第一句停下 |
| 全部文本           | 也跳过未读文本                   |

两种模式都会在选项、结局和互动活动处停下，打开菜单时暂停。从未读文本开始快进时会立即停止。该设置保存在玩家设置 `skip` 字段中，旧版设置缺少该字段时按「仅已读文本」处理。

### 已读记录

浏览器客户端安装 Program 后为它创建一个已读记录，并在每次状态更新时合并 `visited` 与 `choices`：

```json
{
  "schemaVersion": 1,
  "hash": "<RuntimeProgram.hash>",
  "nodes": ["intro#first", "intro#decision"],
  "choices": { "intro#decision": ["left"] }
}
```

记录以 `advjs:read-log:{encoded-program-id}` 为键，并保存 Program 的语义 `hash`。剧本修改后 hash 改变，节点 ID 可能对应不同台词，因此旧记录不再生效，下一次更新会以新 hash 重新开始。这与[存档快照](./navigation-and-saves#snapshot-与-checkpoint)遇到 hash 不一致时拒绝恢复的规则一致。

已读记录独立于存档和[跨周目进度](./meta-progression)：读档、回退或开始新游戏都不会清除它，删除存档也不会影响它。宿主可以调用 `$adv.readLog?.clear()` 清除当前 Program 的记录。Studio 草稿、调用 `init({ persistence: false })` 的会话及 Extras 回想使用各自的内存记录。

自定义宿主可以直接使用同一控制器：

```ts
import { createBrowserReadLog } from '@advjs/client'

const readLog = createBrowserReadLog(program, { storage: localStorage })
runtime.subscribe(() => readLog.capture(runtime.state))

readLog.isRead('intro#first')
readLog.isChoiceTaken('intro#decision', 'left')
```

`currentWasRead` 表示当前节点在进入之前是否已读；同一节点的普通状态更新会保留该值。读档和回退可用恢复的快照补齐已读记录。`setupAdvContext()` 通过 `readLogStorage` 选项替换或关闭存储，规则与 `progressionStorage` 相同。

## 已选选项

选过的选项显示勾选标记，读屏软件会读出「已选过」。主题可以用 `.adv-option-read` 类和 `data-read` 属性重设样式，并用 `--adv-choice-read-color` 调整静态文字颜色。

例如，主题可以用 token 调整颜色。

```ts
import { defineThemeConfig } from 'advjs'

export default defineThemeConfig({
  ui: {
    tokens: {
      '--adv-choice-read-color': '#b8a98f',
    },
  },
})
```

完整 token 列表见[游戏界面规范](/about/design/game-ui)。
