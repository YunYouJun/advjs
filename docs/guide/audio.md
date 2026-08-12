# 音频创作与 AI 配音

::: warning 设计已确认，功能待实施

本页描述已经采纳的目标工作流。当前版本仍使用旧 BGM 与 Studio TTS 能力；在[实施计划](/superpowers/plans/2026-08-12-audio-system-implementation)完成前，请不要把下列新 schema 当作已发布 API。

:::

ADV.JS 的目标音频系统统一管理背景音乐、环境音、角色配音、剧情音效和 UI 音效。作者通过稳定资产 ID 创作，Editor/Studio 负责维护素材文件、语音 take 和 COS 发布信息。

## 音频类型

| 类型 | 用途 | 播放规则 |
| --- | --- | --- |
| BGM | 场景主音乐 | 单一逻辑主轨，切换时交叉淡化 |
| Ambience | 风雨、人群、室内底噪 | 按命名槽位叠加 |
| Voice | 角色台词和旁白 | 一次只播放当前台词 |
| SFX | 脚步、关门、撞击 | 多声部，按并发组限流 |
| UI | 确认、悬停、系统提示 | 独立于剧情时间线 |

## 项目文件

推荐把音频资源目录作为 Asset Catalog 分片：

~~~text
adv/
├── assets.json
├── assets/
│   └── audio.json
├── audio/
│   ├── mixer.json
│   ├── toolchain.json
│   └── voice-ledger.json
├── characters/
└── chapters/
~~~

职责：

- `assets/audio.json`：最终可播放的音频资产；
- `audio/mixer.json`：项目总线默认值、ducking 和并发组；
- `audio/toolchain.json`：进入 Git 的发布工具链锁，记录受信 profile、FFmpeg build fingerprint 和 worker image digest；
- `audio/voice-ledger.json`：全部语音 take、生成来源和选择结果；
- 角色文件：角色 Voice Profile；
- 章节 ADVScript：BGM、环境音、SFX cue 和稳定 `lineId`。

通常不需要手工维护账本。Editor 与 Studio 的可视化操作会规范化写回这些文件。

## 导入音频

### Editor

1. 打开 **View → Audio Studio**。
2. 进入 **Asset Library**。
3. 选择 BGM、Ambience、SFX、Voice 或 UI 分类。
4. 拖入音频文件或选择导入。
5. 检查系统探测的时长、格式、声道、响度和峰值。
6. 填写稳定资产 ID、标题、标签、来源与许可。
7. 保存后，在剧本和 Flow 中通过资产 ID 选择该音频。

### Studio

1. 打开 **Workspace → Audio**。
2. 选择音频分类并导入文件。
3. 试听并补充元数据。
4. 保存到项目资产目录；需要协作或发布时再上传 COS。

Editor 提供完整媒体检查与批量处理；Studio 提供适合移动端的核心导入、试听和发布状态。

## 配置 BGM

~~~yaml
type: bgm
action: set
asset: bgm.observatory
fade:
  in: 1200
  out: 700
~~~

停止 BGM：

~~~yaml
type: bgm
action: clear
fade:
  out: 700
~~~

`asset` 必须是 Asset Catalog 中 `kind: bgm` 的稳定 ID。新协议不接受 `src` 或未经目录管理的 URL。

## 配置环境音

环境音通过槽位叠加。默认槽位：

- `bed`：基础底噪；
- `weather`：风、雨、雷；
- `crowd`：人群和交通；
- `detail`：虫鸣、机器和局部细节。

设置雨声：

~~~yaml
type: ambience
action: set
slot: weather
asset: ambience.rain
fade:
  in: 800
  out: 800
~~~

替换同一槽位时，旧音频与新音频交叉淡化。其他槽位保持不变。

清除雨声：

~~~yaml
type: ambience
action: clear
slot: weather
fade:
  out: 500
~~~

场景切换时可以在可视化面板选择：

- **Inherit**：继承未修改槽位；
- **Reset all**：清空全部环境音后应用新配置。

## 播放 SFX

~~~yaml
type: sfx
action: play
asset: sfx.door-close
group: environment
priority: 50
~~~

SFX 是一次性事件。正常前进时触发；回退或读档默认不重放。并发达到上限时，系统先淘汰最低优先级，再淘汰最旧实例。

## 配置角色音色

角色的音色在角色管理中维护，不在每句台词中重复 `voiceId`。

目标角色 Voice Profile：

~~~yaml
voiceProfile:
  intent:
    ageImpression: young-adult
    genderExpression: feminine
    temperament:
      - gentle
      - determined
    speakingStyle: calm and clear
    pitch: medium
    pace: medium
  locales:
    zh-CN:
      providers:
        minimax:
          voiceId: voice_abc123
          source: designed
          model: speech-02-hd
~~~

在 Editor 中：

1. 打开角色详情的 **Voice** 区域。
2. 补充声音意图，或让 AI 根据角色性格、背景与说话风格生成建议。
3. 选择 locale 和 Provider。
4. 使用系统音色匹配或 Voice Design 生成候选。
5. 逐一试听候选。
6. 手工确认后绑定到角色。

Studio 使用同一 Voice Profile，但以简化卡片展示候选和已选音色。

::: danger 声音克隆

首版不开放声音克隆界面。未来启用时，必须记录声音主体、授权主体、许可范围、用途、有效期和同意证明；缺少任一强制记录时，生成与发布都会被阻止。

:::

## 生成台词配音

### 为台词建立稳定 ID

第一次为台词生成语音时，Editor/Studio 会写入稳定 `lineId`。文本、角色名和文件位置变化时 ID 不变；复制台词时生成新 ID。

目标源码示例：

~~~md
@mitsuha
你好，我们又见面了。 {#line_019c...}

> 夜色渐渐沉下来。 {#line_019d...}
~~~

`{#line_<uuidv7>}` 必须位于一个对话或旁白节点最后一个物理行的末尾。它不会进入展示文本或朗读文本。角色台词的 ledger 记录保存角色 `characterId`；旁白使用项目级保留 profile `narrator`。

### 单句生成

在剧本编辑器中，台词旁显示：

- **Missing**：没有当前 locale 的 take；
- **Stale**：文本、音色或参数已改变；
- **Ready**：选中 take 可播放；
- **Failed**：最近一次任务失败。

点击台词旁的语音按钮可以：

1. 编辑 `spokenText`、情绪、停顿和发音；
2. 选择角色 Voice Profile；
3. 试听或生成新 take；
4. 比较多个 take；
5. 将一个 take 设为 `selectedTake`。

每次生成都创建新 take，不覆盖旧音频。

take 会固化生成时实际使用的 Provider、`voiceId`、模型和 Voice Profile revision。之后修改角色音色时，旧 take 会变为 Stale，但仍能还原其生成来源。

### 批量生成

在 **Audio Studio → Voice Jobs** 中可以：

- 扫描全项目、章节或角色；
- 筛选 Missing、Stale、Ready、Failed；
- 查看台词数、字符数、缓存命中数和预计费用；
- 设置单次字符或费用上限；
- 启动、暂停、取消、恢复和重试任务；
- 生成完成后批量试听、选择并发布。

Provider 无法提供可靠价格时，费用显示为“未知”，不得显示伪精确估算。

托管任务状态保存在服务端，本地 Editor 保存在操作系统应用数据目录，Studio 离线任务保存在不会随项目导出的 IndexedDB 应用状态中。项目账本只在一个 take 已完整生成、校验并提交后记录最终结果。

## 展示文本与朗读文本

展示文本可以包含 Markdown 和变量；朗读文本只包含实际发音内容。

例如：

~~~text
displayText: **欢迎回来**，{{ playerName }}。
spokenText: 欢迎回来，小云。
~~~

规范化器会移除展示标记并应用项目发音词典。作者可以逐句覆盖 `spokenText`，并使用 Provider 无关的情绪、停顿和重音字段。

运行时才能确定且没有有限候选的变量，不能直接预生成。此类台词可以：

- 为有限变量值分别生成变体；
- 改写为确定文本；
- 保持没有配音。

## 多语言

语音按 `lineId + locale` 独立管理。切换语言时：

- 只选择当前 locale 的 `selectedTake`；
- 缺少语音时继续显示文本并保持静音；
- 不回退播放其他语言；
- 角色可以为各语言绑定不同 `voiceId` 或音色变体。

项目文件使用规范 BCP 47，如 `zh-CN`、`ja-JP`。COS 对象键使用规范化小写 `zh-cn`、`ja-jp`。

## Mixer

在 **Audio Studio → Mixer** 中配置项目默认值：

- `master / music / ambience / voice / sfx / ui` 音量；
- Voice ducking 的目标衰减、attack 和 release；
- BGM 与环境音默认淡入淡出；
- SFX 全局上限和各并发组上限；
- 环境音最大槽位数；
- 预览与 Solo/Mute。

同一配置还把 `confirm`、`cancel`、`hover`、`notification` 等语义 UI cue 映射到稳定资产 ID。主题与组件只触发 cue 名称，不直接引用音频文件。

玩家仍可以覆盖六个总线音量、关闭自动配音，并选择 Auto 是否等待语音。玩家设置按设备保存，不写入项目或剧情存档。

## Flow 可视化编辑

Flow 编辑器提供与 ADVScript operation 等价的节点或属性卡：

- **BGM State**：选择资产、set/clear、循环与淡化；
- **Ambience State**：选择槽位、资产、继承/重置与淡化；
- **SFX Event**：选择资产、并发组和优先级；
- **Dialogue Voice**：查看 lineId、locale、状态与 selected take。

可视化编辑最终写回规范项目数据，不创建只能由 Flow Editor 读取的私有音频字段。

## 试听与调试

Editor 的 Runtime 音频 Inspector 显示：

- 各总线有效音量与 ducking；
- 正在播放的 BGM、环境音槽位和语音；
- SFX 并发组与被淘汰实例；
- 加载、播放、停止、替换和失败 trace；
- locale、Auto、Skip、回退和读档模拟。

Studio 显示简化的生成、上传和播放失败状态，不提供完整调音控制台。

## 发布到 COS

### 存储边界

| 内容 | 默认位置 |
| --- | --- |
| 母版、全部 take、未发布变体 | 私有 COS |
| 内容哈希发布变体 | 公共 COS/CDN |
| 任务中间文件 | 临时 COS 前缀 |
| Asset Catalog 与语音账本 | Git |
| 密钥 | 服务端密钥系统或本机安全存储 |
| 本地试听缓存 | 本机缓存，不提交 |

### 对象键

~~~text
{projectPrefix}/audio/voice/{locale}/{speakerId}/{lineId}/{takeId}.{hash}.{ext}
~~~

`projectPrefix` 由 Asset Catalog Profile 决定，例如私有托管空间中的 `private/accounts/{accountId}/projects/{projectId}`，或公共发布的 `games/{game-id}/v{major}`。角色显示名和台词原文不进入对象键。普通角色的 `speakerId` 等于稳定 ASCII `characterId`，旁白使用 `narrator`；复杂查询由资产索引完成。

### 发布流程

1. 检查音频处理、权利记录与选中 take。
2. 使用 `adv/audio/toolchain.json` 锁定的 FFmpeg build 或 worker image 生成 Opus/WebM 主变体和 AAC/M4A 兼容回退，并验证媒体指标。
3. 使用短期 STS 或单对象预签名上传。
4. 服务端 HEAD 并重新校验字节数、MIME 和 SHA-256。
5. 所有对象成功后，最后更新稳定 manifest。
6. 运行远端审计。

`adv build` 不执行上述上传操作。

本机其他 FFmpeg 版本可以生成试听预览，但不能产生正式发布 receipt，也不能更新发布哈希或 manifest。Editor 会提示改用匹配 build fingerprint 的本地 container 或 hosted worker。

托管服务只运行平台签名或服务端 allowlist 中的 toolchain profile 和 image digest。项目不能通过 `toolchain.json` 指定任意容器；缺失 lock、schema 非法、未知 profile 或 digest 不匹配都会阻止正式发布。

## 迁移旧项目

新音频系统采用破坏性迁移，不保留旧 Runtime 解释分支。先生成报告：

~~~bash
adv migrate audio --report temp/audio-migration.json
~~~

无法确定的旧 URL 或 BGM 引用会标为 Unresolved，并阻止 apply。作者把选择写入 `adv/migrations/audio-v1.json` 后执行：

~~~bash
adv migrate audio --resolutions adv/migrations/audio-v1.json --apply
~~~

Apply 会先完整验证目标项目，再原子替换文本文件；失败时根据 journal 恢复本次写入。迁移不上传 COS、不删除原音频，重复执行 canonical 项目不会产生新 diff。

## Player 播放行为

默认行为：

- 打字机和语音同时开始；
- 第一次确认补全文字，语音继续；
- 第二次确认停止语音并前进；
- Auto 等待文字与语音完成；
- Skip 立即停止语音；
- 跳转、回退、读档和切章取消旧语音；
- 历史记录不自动播放语音；
- Voice 播放时降低 music 与 ambience。

首次用户交互前，浏览器可能阻止音频。AudioEngine 会在首次交互统一解锁；已经过期的语音不会延迟补播。

## 校验

运行：

~~~bash
adv check
adv build
~~~

构建会阻止：

- 重复 ID、非法 locale；
- 未知音频资产；
- 丢失或哈希错误的 selected take；
- 临时 URL 或密钥进入清单；
- 缺少授权的克隆音色。

缺少某语言配音或 selected take 已过期通常是警告。游戏仍显示文本，不因可选语音缺失而崩溃。

## 常见问题

### 为什么不能直接写音频 URL？

URL 是部署位置，不是内容身份。稳定 `assetId` 允许改名、重新编码、切换 COS/CDN 和离线运行，而不修改剧情。

### 为什么旧 take 不自动删除？

AI 配音需要比较和回退。只有作者明确清理，或资产垃圾回收确认无引用后，才删除本地与 COS 对象。

### 为什么 locale 放在 speaker 前？

配音最常见的批处理是按语言发布、质检和统计缺失。角色与旁白搜索由账本索引完成，不依赖 COS 路径。

### 可以完全离线吗？

可以。本地 Editor 可以使用 `provider: project` 的 Asset Catalog Profile 和本机 Provider 配置。没有 COS 时，发布构建打包本地音频；密钥仍不能写入项目。

### Editor 和 Studio 会产生不同项目吗？

不会。Editor 提供完整专业界面，Studio 提供移动端核心界面，但两端写入同一套项目 schema。

## 相关文档

- [音频资产与 AI 配音决策](/about/design/audio)
- [资源目录协议](/guide/assets/catalog)
- [COS 存储与发布规范](/guide/assets/cos)
- [场景演出与素材](/guide/runtime/presentation)
