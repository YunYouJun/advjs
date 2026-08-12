# 场景演出、立绘、CG 与音频

ADV.JS 把可恢复的舞台状态和只播放一次的演出 Effect 分开保存。背景、当前 BGM、当前 CG、立绘表情与位置会进入存档；转场、入退场动作和交叉淡化不会在读档时重播。

`back()`、`forward()` 和 `restore()` 会取消正在播放的一次性演出，直接同步舞台最终状态。背景、CG 和立绘使用 cut，BGM 使用固定短淡化避免爆音；spritesheet 从头播放，但 P0 不保存逐帧动画相位。

## 场景转场

背景指令默认使用 `crossfade`，也可以写预置名称或完整参数：

```yaml
type: background
name: summer-room
transition:
  name: dissolve
  duration: 900
  easing: cubic-bezier(.2,.8,.2,1)
```

内置预置为 `cut`、`crossfade`、`fade`、`dissolve`、`wipe-left`、`wipe-right`、`rise` 和 `flash-white`。不切换背景、只需要全舞台效果时使用独立指令：

```yaml
type: transition
name: flash-white
duration: 420
```

客户端使用双背景层，先预载新图再切换。加载失败会保留旧背景并报告诊断，不会先清空舞台。设置中的“减少动态效果”会把位移动画降级为短淡入；“关闭”会直接显示最终状态，同时仍遵循系统的 `prefers-reduced-motion`。

## 立绘调度与逐帧动画

旧的字符串写法保持可用。对象写法可以指定表情、绝对槽位、缩放、镜像和一次性动作：

```yaml
type: tachie
enter:
  - name: 观测者
    status: curious
    position: right
    scale: 0.96
    mirror: false
    motion: slide-right
exit:
  - name: 读书人
    motion: fade
```

`position` 可为 `left`、`center`、`right`，也可写 `0`—`100` 的舞台百分比；常用 `motion` 为 `fade`、`slide-left`、`slide-right`、`emphasis`、`shake`、`hop`。移动端会收紧槽位宽度，但不改变存档中的逻辑位置。

角色差分可声明水平 spritesheet：

```ts
const character = {
  tachies: {
    running: {
      src: '/hamster-running.webp',
      sprite: {
        frameWidth: 512,
        frameHeight: 512,
        frames: 6,
        fps: 10,
        loop: true,
      },
    },
  },
}
```

帧画布必须相同，角色底部中心锚点、体积和阴影应保持稳定。恢复存档只恢复 `running` 状态，不重播入场动作。

## BGM 交叉淡化

脚本通过音乐库中的稳定名称选择曲目：

```yaml
type: bgm
name: star-revelation
loop: true
fade:
  in: 1000
  out: 700
```

切换曲目时旧音轨按 `out` 淡出，新音轨同时按 `in` 淡入；`stop: true` 只淡出当前曲目。存档仅记录当前曲目 ID。循环音频应统一响度、避免削波，并在导出前检查首尾波形与听感接缝。

## CG 与跨周目画廊

在 `gameConfig.gallery` 声明稳定 ID 和展示元数据：

```ts
const gameConfig = {
  gallery: {
    id: 'example-game',
    version: 1,
    allowDownload: true,
    items: [{
      id: 'star-in-hand',
      title: '恒星在手',
      src: 'https://assets.example.com/cg/star.0123abcd.webp',
      thumbnail: 'https://assets.example.com/cg/star.thumbnail.4567abcd.webp',
      alt: '角色掌心托起一颗恒星',
      chapterId: 'revelation',
    }],
  },
}
```

剧情中显示、隐藏并解锁：

```yaml
type: cg
action: show
id: star-in-hand
transition: crossfade
unlock: true
```

```yaml
type: cg
action: hide
transition: fade
```

显示 CG 时会覆盖背景与普通立绘；后续背景指令自动结束 CG。浏览器只持久化已解锁 ID，不写入图片二进制。默认画廊提供收集进度、锁定轮廓、缩略图、全屏查看和原图下载；CORS 下载失败时回退为打开原图。

## 自定义设置界面

项目可创建 `components/AdvSettingsPanel.vue` 覆盖默认设置内容，并通过 `useAdvSettingsControls()` 读写字号、速度、动态效果、全屏与横屏状态。音量仍由 `useAudioStore()` 管理。默认主题提供 `--adv-*` CSS tokens；覆盖面板仍需保留键盘焦点、可读标签、窄屏布局和减少动态效果选项。

标题页可用 `useAdvStartActions().startGame({ chapterId, nodeId })` 启动指定章节或节点，例如通关后出现的二周目入口。

## 素材发布与诊断

公共资源的对象键、内容哈希、缓存、CORS 和 manifest 上传顺序见 [COS 素材发布规范](../assets/cos)。

- 背景不得包含需要随剧情调度的前景人物；关键一次性镜头才使用 CG。
- 角色透明图需在棋盘、黑、白、暖色和冷色底上检查边缘与主体孔洞。
- 使用内容哈希文件名与不可变缓存；角色动画、背景、CG、缩略图和 BGM 都记录尺寸或时长、字节数、SHA-256、生成版本、日期与许可。
- 允许公开 `GET`/`HEAD` 并配置适合浏览器的 CORS；Studio 与正式游戏使用同一逻辑 ID。
- Studio 的 Preview 可插入和预览演出指令；Inspector 会显示当前 CG、立绘槽位与按顺序发生的 Effect。未知转场、资源 ID、角色差分和非法时长会定位回脚本行。
