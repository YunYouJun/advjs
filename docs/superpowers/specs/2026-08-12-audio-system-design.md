# ADV.JS 多轨音频与 AI 配音系统设计

状态：已确认，待实施

日期：2026-08-12

适用范围：`@advjs/types`、`@advjs/parser`、`@advjs/core`、`@advjs/client`、`@advjs/editor`、`@advjs/studio`、CLI、COS 发布链路

## 1. 背景

ADV.JS 当前的浏览器音频能力以 BGM 专用组合式函数和 Howler 实例为中心。它能够播放与切换背景音乐，但不适合继续承载语音、环境音、音效和 UI 音频：

- BGM 切轨、淡出、停止和销毁由多份平行状态维护，异步 fade 回调存在竞态；
- Runtime 舞台状态只有单一 BGM 字段，无法表达环境音分层、一次性音效与配音；
- 音量只有有限的全局配置，没有独立总线、ducking 和并发策略；
- Studio 已有 TTS 试听能力和音频素材页，但生成结果、角色音色、台词版本、COS 发布与 Runtime 仍未形成一条确定性管线；
- Editor 与 Studio 定位不同，如果各自维护音频协议与 Provider 特判，会出现两套不兼容的创作语义；
- 普通台词节点主要依赖位置生成 ID，无法长期绑定多语言配音与多个 take。

本设计采用破坏性升级。现有项目、Demo、主题、Editor、Studio、CLI 和测试一次性迁移到新协议；新 Runtime 不保留旧音频格式解释器。

## 2. 目标

1. 建立统一的多轨音频子系统，覆盖音乐、环境音、语音、音效与 UI 音频。
2. 让 Runtime 只表达确定性的目标状态和效果，浏览器播放对象不进入 Program 或 Snapshot。
3. 支持按角色 Voice Profile 和台词文本生成配音，首个完整 Provider 为 MiniMax，并允许后续接入 OpenAI、豆包及其他服务。
4. 支持自动生成、试听、多 take 选择、批量任务、非破坏式处理和 COS 发布。
5. 让角色管理、剧本编辑、场景/Flow 编辑与 Audio Studio 使用同一份 Git 友好项目数据。
6. 从第一版保留多语言、权利记录、成本防护、可观测性与离线创作边界。
7. 彻底替换 BGM 专用编排，并用状态机测试防止异步音频竞态回归。

## 3. 非目标

- Runtime 不直接调用 TTS Provider，也不保存 Provider 凭证。
- `adv build` 不生成付费内容、不上传 COS，也不修复作者数据。
- 第一版不开放声音克隆 UI；只预留协议。没有明确授权与同意记录时禁止克隆、生成和发布。
- 不把 COS 当结构化查询数据库；复杂筛选由资产索引和创作账本完成。
- 不要求 Editor 与 Studio 的界面逐项相同，只要求能力契约和项目格式一致。
- 不在存档中保存 `AudioNode`、`HTMLMediaElement`、播放句柄、计时器或淡化进度。

## 4. 核心原则

### 4.1 一个协议，分层实现

`@advjs/types` 定义纯数据契约；Parser 和 Compiler 负责规范化与诊断；Core Runtime 保存目标舞台状态并发出效果；Client 的音频宿主负责实际播放。Editor 与 Studio 只通过共享创作服务修改项目文件。

### 4.2 状态与事件分离

- BGM 和环境音是持续状态，可进入 Runtime Snapshot；
- Voice 是绑定当前台词的前景展示，不进入长期舞台状态；
- SFX 和 UI 音效是一次性事件，不进入 Snapshot；
- 回退或读档默认不重放一次性事件。

### 4.3 逻辑 ID 与物理位置分离

剧情、角色、场景和 Flow 只引用稳定 `assetId`。本地路径、COS 对象键、发布 URL、哈希和媒体变体由 Asset Catalog 管理。

### 4.4 创作与运行分离

创作账本保留生成历史、Provider 参数和全部 take；运行时清单只包含最终选中的可播放资产。密钥不进入两者。

### 4.5 异步操作可取消

所有加载、播放、淡化、停止和切换都使用 generation token 或 `AbortSignal`。过期回调可以完成底层清理，但不得修改当前逻辑轨道。

## 5. 总体架构

~~~text
Markdown / Flow / Character Voice Profile
                    │
                    ▼
          Parser + Compiler + Catalog
                    │
                    ▼
          Runtime Program / Snapshot
                    │ RuntimeEffect
                    ▼
             Audio Director
       ┌────────────┼────────────┐
       ▼            ▼            ▼
 persistent      foreground    transient
 BGM/ambience      voice        SFX/UI
       └────────────┼────────────┘
                    ▼
              Audio Mixer
 master/music/ambience/voice/sfx/ui
                    │
                    ▼
         Browser Audio Backend
     MediaElement         AudioBuffer
~~~

职责边界：

- **Runtime**：保存“应该播放什么”，发出纯数据效果；
- **Audio Director**：决定如何切换、停止、恢复、预取和丢弃过期请求；
- **Audio Mixer**：总线、音量、静音、ducking、淡化与并发；
- **Audio Backend**：实际创建 Web Audio、MediaElement 或测试替身；
- **Vue composable**：提供只读状态与玩家设置，不拥有音轨状态机。

## 6. 音频总线与并发

~~~text
master
├── music       单一逻辑主轨，允许切轨交叉淡化
├── ambience    命名槽位分层，默认最多 4 层
├── voice       单一前景语音，新台词替换旧语音
├── sfx         多声部，按并发组限流
└── ui          独立短音效，不参与剧情暂停与 voice ducking
~~~

默认规则：

- voice 对 music 与 ambience 做 ducking，不压低 sfx 与 ui；
- SFX 默认全局上限 16，并允许 `footstep`、`impact` 等组设置更小上限；
- 达到并发上限时，按优先级淘汰最低优先级，再淘汰最旧实例；
- UI 总线用于确认、悬停和系统提示，不由剧情回退重放；
- 项目默认音量与玩家偏好分层，玩家偏好优先且不进入剧情存档。

## 7. 环境音槽位

环境音采用命名槽位，而不是无限叠加：

| 槽位 | 典型用途 |
| --- | --- |
| `bed` | 室内、森林、城市等基础底噪 |
| `weather` | 风、雨、雷 |
| `crowd` | 人群、咖啡馆、车站 |
| `detail` | 虫鸣、机器、电流 |

同一槽位的新资产交叉淡化并替换旧资产；不同槽位可以同时播放。未提及的槽位保持不变，清空必须显式执行。场景切换可以声明继承或整体重置。

## 8. Runtime 音频语义

目标 Runtime 舞台状态只保存可恢复的音频状态：

~~~ts
interface RuntimeAudioStageState {
  music?: {
    assetId: string
    loop: boolean
  }
  ambience: Record<string, {
    assetId: string
    loop: boolean
  }>
}
~~~

目标 AdvScript operation：

~~~yaml
type: bgm
action: set
asset: bgm.observatory
fade:
  in: 1200
  out: 700
~~~

~~~yaml
type: ambience
action: set
slot: weather
asset: ambience.rain
fade:
  in: 800
  out: 800
~~~

~~~yaml
type: sfx
action: play
asset: sfx.door-close
group: environment
~~~

停止使用显式 action：

~~~yaml
type: ambience
action: clear
slot: weather
fade:
  out: 500
~~~

新协议不接受直接 `src`、隐式公共 BGM 名称或 Provider URL。语音不通过普通 operation 写入，而是由当前台词的 `lineId + locale + selectedTake` 解析。

UI 音效不写入剧情 operation。项目或主题在 `audio/mixer.json` 中把 `confirm`、`cancel`、`hover`、`notification` 等语义 cue 映射到稳定 `assetId`；组件只发出语义 cue，由 Audio Director 路由到 ui 总线。这样更换主题音效不需要修改剧情或组件代码。

## 9. 台词稳定 ID

需要配音的台词必须拥有项目内唯一、与文本和位置无关的 `lineId`：

- Editor/Studio 自动生成带类型前缀的 UUIDv7；
- 文本、角色名、显示名和文件路径变化时 ID 不变；
- 移动台词保留 ID，复制或跨项目导入时生成新 ID；
- 重复或非法 ID 是编译错误，不允许工具静默重写；
- 手写 ID 可以保留，但必须满足格式与唯一性校验。

稳定 ID 的源码语法冻结为行尾属性标记：

~~~md
@mitsuha
你好，我们又见面了。 {#line_019c...}

> 夜色渐渐沉下来。 {#line_019d...}
~~~

规则：

- 标记必须是对话或旁白最后一个物理行的最后一个非空白 token；
- 每个对话或旁白节点最多一个 `{#line_<uuidv7>}`；
- Parser 将标记写入 `lineId`，不把它计入 `displayText` 或 `spokenText`；
- Serializer 必须原位写回同一个 ID；
- Flow 的 `AdvDialogNode.lineId` 与 Markdown 使用同一标识；
- 只有获得配音或被作者显式固定的台词必须写入 ID，编译器仍可给其他顺序节点生成非持久内部地址。

## 10. 多语言与 take

语音按以下地址管理：

~~~text
lineId
└── locale
    ├── selectedTake
    └── takes[]
~~~

规则：

- locale 使用 BCP 47；项目文件保留规范形式，如 `zh-CN`，对象键使用规范化小写 `zh-cn`；
- 不同语言可以绑定不同 Provider voice；
- 缺少当前 locale 的配音时保持静音并继续显示文本，不播放其他语言的语音；
- 每次生成创建不可变 `takeId`，不覆盖旧文件；
- 文本、Voice Profile、模型或参数变化后，旧 take 标记 `stale`，但不自动删除；
- `selectedTake` 冲突必须由作者显式解决，未选 take 可并存。

每个 voice ledger line 还必须固化 `speakerId`。角色台词使用 `characterId`；旁白统一使用保留值 `narrator`，并读取项目级 Narrator Voice Profile。每个 take 固化生成时实际使用的 `providerId`、`voiceId`、模型、Provider voice source 和 `voiceProfileRevision` 哈希。当前 Profile 哈希与 take 中的 revision 不一致时，该 take 变为 stale，但历史审计仍能还原当时的音色。

## 11. 展示文本与朗读文本

`displayText` 和 `spokenText` 分离：

- `displayText` 保留 Markdown、变量和排版；
- `spokenText` 默认由规范化器移除标记并应用多语言发音词典；
- 作者可以逐句覆盖朗读文本；
- 停顿、重音、情绪和读法保存为 Provider 无关的结构化标注；
- Provider Adapter 负责映射为 MiniMax 参数或供应商专属格式；
- 运行期才确定且没有有限变体的变量台词不做预生成，缺失语音不阻塞剧情。

## 12. 角色 Voice Profile

`voiceId` 属于角色管理，但不作为裸字段散落在台词节点中。角色拥有 Provider 无关意图和 Provider 绑定：

~~~ts
interface CharacterVoiceProfile {
  intent: {
    ageImpression?: string
    genderExpression?: string
    temperament?: string[]
    speakingStyle?: string
    pitch?: 'low' | 'medium' | 'high'
    pace?: 'slow' | 'medium' | 'fast'
  }
  locales?: Record<string, {
    providers: Record<string, {
      voiceId: string
      source: 'system' | 'designed' | 'cloned'
      model?: string
    }>
  }>
}
~~~

AI 可以结合角色的年龄印象、性格、背景、说话风格和语言生成音色意图。第一版支持系统音色匹配与 MiniMax Voice Design；候选必须试听并人工确认后才能绑定角色。克隆音色只预留 `source: cloned`。

旁白使用相同结构，但存放在项目音频配置的保留 `narrator` Profile 中，不要求创建伪角色卡。任何可生成语音的 ledger line 都必须拥有角色 ID 或 `narrator`，因此 COS voice key 的 speaker 段始终确定。

## 13. TTS Provider

Provider 使用能力声明，而不是由 UI 硬编码供应商名称：

~~~ts
interface TtsProviderCapabilities {
  synthesis: boolean
  voiceCatalog: boolean
  voiceDesign: boolean
  voiceClone: boolean
  timestamps: boolean
  emotions: boolean
  streaming: boolean
  outputFormats: string[]
}
~~~

统一 Adapter 接收 Provider 无关请求，返回音频母版、时间戳、Provider 结果摘要和可审计元数据。MiniMax、OpenAI、豆包分别实现 Adapter。Web Speech 只用于本机临时试听，不作为可发布生成来源。

## 14. 生成队列与成本防护

创作期支持单句、按角色、按章节和全项目扫描。每条台词显示 `missing`、`stale`、`ready`、`failed` 状态。

生成前必须显示：

- 台词数与字符数；
- fingerprint 缓存命中数；
- 预计新生成数；
- Provider 可计算时的预计费用，否则明确显示未知；
- 项目或用户配置的字符/费用上限。

任务支持取消、限流、断点续跑、失败重试和幂等去重。成功生成或上传的条目不因整批重试而再次计费。`adv build` 只检查状态，不启动队列。

任务状态不进入项目 Git，但必须有明确的 durable store：

- 托管 Editor/Studio 使用服务端 `audio_jobs`、`audio_job_items` 和 `audio_idempotency` 记录；
- 本地 Editor 使用操作系统应用数据目录中的本地数据库；
- Studio 离线队列存 IndexedDB 的应用状态，项目导出时排除，并在登录后同步到服务端；
- 完成结果只有在音频、哈希和账本更新成功后才标记 committed；
- idempotency 记录按 `account + project + fingerprint` 唯一，默认保留 30 天；产品可以延长，不能短于可恢复任务的最长保留期；
- 恢复协议从 durable item 状态继续，不根据前端进度条猜测；未知远端结果先查询 Provider/对象状态，再决定重试。

## 15. 创作账本与运行时清单

建议项目文件：

~~~text
adv/
├── assets.json
├── assets/audio.json
└── audio/
    ├── mixer.json
    ├── toolchain.json
    └── voice-ledger.json
~~~

### 15.1 创作期语音账本

`adv/audio/voice-ledger.json` 保存：

- `lineId`、locale、全部 take 与 `selectedTake`；
- `spokenText`、文本/音色 fingerprint；
- Provider、模型和非敏感生成参数；
- 本地/COS 资产 ID、内容哈希与生成时间；
- 来源、许可、授权主体和同意记录；
- 处理预设与工具版本。

它不保存密钥、队列锁、瞬时进度、重试计数或临时签名 URL。

### 15.2 运行时资产清单

`adv/assets/audio.json` 只暴露最终选中的 BGM、环境音、语音、SFX 与 UI 音频，以及运行所需的 URL/objectKey、哈希、格式、时长和循环信息。构建输出再生成扁平运行时清单。

### 15.3 发布 toolchain lock

`adv/audio/toolchain.json` 进入 Git，使用独立 `schemaVersion`，记录平台发布的 toolchain profile ID、FFmpeg build fingerprint 和 worker image digest。缺失、schema 非法、fingerprint 不匹配或未知 profile 时，正式音频发布产生错误；本地试听仍可使用能力满足但未锁定的 FFmpeg。

## 16. COS 对象键与发布

音频对象键的规范形式：

~~~text
{projectPrefix}/audio/
├── voice/{locale}/{speakerId}/{lineId}/{takeId}.{hash}.{ext}
├── bgm/{assetId}.{hash}.{ext}
├── ambience/{assetId}.{hash}.{ext}
├── sfx/{assetId}.{hash}.{ext}
└── ui/{assetId}.{hash}.{ext}
~~~

关键规则：

- voice 域中 locale 优先于 speaker，便于按语言发布、质检和统计；
- `speakerId` 使用稳定、可读的 ASCII slug；普通角色与 `characterId` 相同，旁白固定为 `narrator`，显示名只进入元数据；
- 不在路径中放台词原文、角色显示名、Provider 密钥或签名参数；
- 已发布对象不可变，不原地覆盖；
- 先上传并校验二进制对象，再原子更新稳定 manifest；
- 内容哈希对象使用一年 immutable 缓存，稳定 manifest 使用短缓存并重新验证；
- 私有母版、公共发布变体和临时任务使用不同前缀与权限。

`projectPrefix` 由 Asset Catalog Profile 决定：托管创作空间可以使用 `private/accounts/{accountId}/projects/{projectId}`，公共游戏发布可以使用 `games/{game-id}/v{major}`。不论外层 namespace 如何选择，`audio/voice/{locale}/{speakerId}` 的相对顺序固定。

## 17. 凭证安全

- 在线 Editor/Studio 的 TTS 密钥只存在服务端密钥系统；
- 浏览器上传使用限定项目/对象前缀、方法、MIME、大小和短有效期的 STS 或单对象预签名；
- 本地 Editor 可以从环境变量或系统安全存储读取用户密钥；
- 项目文件、日志、trace、错误报告与构建产物不得包含密钥或临时签名 URL；
- 永久 COS 密钥只允许作为本地降级方案，必须是最小权限子账号；禁止使用主账号密钥。
- 托管服务只接受平台签名或服务端 allowlist 中的 audio toolchain profile 与 image digest；项目不能要求服务端拉取或执行任意镜像。lock 校验失败时阻断发布。

## 18. 非破坏式媒体处理

- 原始 WAV、FLAC 或 Provider 返回文件作为不可变母版；
- 发布时生成浏览器优先格式与兼容回退格式；
- 自动记录时长、声道、采样率、响度、峰值、字节数与 SHA-256；
- 语音使用独立的响度归一化、首尾静音修剪和峰值保护预设；
- BGM、环境音、SFX 使用各自预设，不套用统一响度；
- 工具版本与处理参数进入创作账本；
- 处理失败阻止该资产发布，但不破坏母版。

二进制媒体默认存 COS，结构化账本与清单存 Git。离线项目允许只使用 `provider: project` 的 Asset Catalog Profile，COS 不是运行 ADV.JS 的强制依赖。

执行方案固定为同一套 FFmpeg 命令模板和发布 toolchain：

- `adv/audio/toolchain.json` 锁定 FFmpeg build fingerprint 与 hosted worker image digest；
- 本地 Editor 可以调用 `adv doctor` 探测到的 FFmpeg 做快速预览；
- 只有本机 build fingerprint 与 toolchain lock 完全匹配时才能生成正式发布 receipt；不匹配时必须转交锁定 digest 的本地 container 或 hosted worker；
- 托管 Editor/Studio 把任务交给固定镜像和版本的 FFmpeg worker，不在 Cloud Function 请求内执行长转码；
- 发布主变体使用 Opus/WebM，兼容回退使用 AAC/M4A；Asset Catalog 按浏览器能力选择；
- Chromium 与 WebKit E2E 必须分别播放两个变体，媒体 fixture 还需使用 ffprobe 验证 codec、时长、声道、采样率、响度和峰值；
- Worker 以 job/item 幂等键写内容哈希输出，失败可以从母版重跑，不复用半成品；
- 非锁定本地预览不承诺字节级复现，不得更新发布 objectKey、哈希或稳定 manifest。

## 19. 播放交互

默认玩家行为：

- 打字机与语音同时开始；
- 第一次确认只补全文字，语音继续；
- 第二次确认停止语音并前进；
- Auto 等待文字和语音都结束，再应用短延迟；
- Skip 立即停止语音并前进；
- 前进、跳转、回退、读档和章节切换都取消旧语音；
- 历史记录页面不自动播放语音；
- voice 播放时平滑 duck music 与 ambience。

这些是项目默认值。玩家可以关闭自动配音、调整六个总线音量，并选择 Auto 是否等待语音。玩家偏好按设备持久化，不进入剧情存档。

## 20. 加载与缓存

- UI 音效与高频短 SFX 在进入游戏后预加载；
- 当前场景 BGM 与环境音在进入场景前预取并流式播放；
- 配音默认预取当前和后续 2 条，不预载整章；
- 切换章节、语言或读档时取消失效请求；
- 内容哈希 URL 使用浏览器缓存，内存解码缓存采用有限 LRU；
- 首次用户交互统一解锁 `AudioContext`；
- 解锁前请求可以排队，但过期语音不得事后补播；
- 网络失败不阻塞剧情，宿主记录可诊断降级状态。

## 21. Editor 与 Studio

采用“集中管理 + 上下文编辑”和“能力一致、界面分级”。

### 21.1 Editor

`@advjs/editor` 提供完整专业能力：

- Audio Studio：素材库、Voice Jobs、Mixer；
- 角色编辑器：Voice Profile、语言绑定、音色候选试听；
- 剧本编辑器：逐句状态、生成、重生成、take 选择和朗读文本；
- 场景/Flow：BGM、环境音槽位和 SFX cue 可视化节点；
- Runtime Inspector：总线、ducking、当前轨道、并发与音频 trace；
- 批量迁移、批量生成、处理、发布与审计。

### 21.2 Studio

`@advjs/studio` 提供移动端核心能力：

- 扩展现有 `/tabs/workspace/audio`；
- 角色音色与候选试听；
- 台词生成队列、缺失/过期状态；
- 资产试听、COS 发布与简化混音设置；
- 生成、上传和播放失败诊断。

两端读写相同 ADVScript、角色文件、Asset Catalog、Mixer 配置与语音账本。UI 不逐项相同，但不得创造私有项目语义。

## 22. 可观测性

Editor 预览器提供：

- 各总线有效音量、静音、Solo 与 ducking；
- 当前音轨、环境音槽位、语音 line/take 与 SFX 并发组；
- 语言、Auto、Skip、回退和读档模拟；
- `voice.start`、`voice.stop`、`ambience.replace`、`sfx.steal`、`asset.loadFailed` 等结构化 trace。

Trace 只记录逻辑 ID、序列、时长、状态和错误码，不记录密钥或临时 URL。生产构建默认关闭详细 trace，只保留可选错误遥测钩子。

## 23. 校验与构建

接入现有 `adv check` / `adv build` 诊断体系。

构建错误：

- 重复或非法的 line、character、asset、take ID 或 locale；
- `selectedTake` 不存在、文件缺失或哈希不匹配；
- operation 参数非法或引用未知资产；
- 运行时清单出现密钥、临时 URL 或未完成资源；
- 克隆音色缺少权利与同意记录；
- 标记已发布的对象没有完整性证明。

构建警告：

- 某 locale 缺少配音；
- 选中 take 已过期；
- 响度、格式或大小不符合推荐值；
- 只有本地资源但项目目标要求远程发布。

音频缺失不使 Runtime 崩溃；可选语音保持静音。构建不调用付费 API，也不上传对象。

## 24. 破坏性迁移

实施时执行一次性全仓迁移：

1. 生成迁移报告并列出所有旧 BGM、`src`、直接 URL、Studio TTS 缓存与 Flow 字段；
2. 把可识别媒体导入统一 Asset Catalog 并生成稳定 ID；
3. 把 Runtime、Client、Studio、Editor、CLI、Demo、主题、文档和测试切换到新契约；
4. 无法自动解析的引用阻断迁移，要求人工选择资产；
5. 不自动上传 COS，不删除原文件；
6. 新 Runtime 不保留旧格式分支。

迁移完成后，`useAdvBgm`、BGM 专用状态所有者、`bgmSrc` 和音频直接 URL 从公共契约移除。

迁移命令固定为：

~~~bash
adv migrate audio --report temp/audio-migration.json
adv migrate audio --resolutions adv/migrations/audio-v1.json --apply
~~~

报告 schema 逐项保存源文件/行列、旧引用、推断 kind、候选资产、`resolved | unresolved | already-canonical` 状态和原文件 SHA-256。作者把人工选择写入可审查的 resolution 文件后重新 dry-run。

Apply 在内存中生成全部目标文件，先验证新项目，再通过同目录临时文件原子替换。迁移 journal 保存原/新哈希和已提交文件；失败时按 journal 恢复本次已写文件。对已 canonical 的输入重复执行必须得到空变更。未跟踪且会被覆盖的文件先复制到被 Git 忽略的迁移备份目录，并在结果中给出恢复路径。

## 25. 测试策略

### 25.1 纯状态机单元测试

- 快速 A→B→A 切轨；
- 淡出中重播、停止和销毁；
- 相同资产重复同步；
- 环境音同槽替换与跨槽叠加；
- voice token 过期；
- SFX 并发淘汰；
- ducking attack/release；
- Snapshot 目标状态恢复。

### 25.2 Fake Backend 集成测试

Fake Backend 必须能够手动推进 load、play、fade、ended 和 error，覆盖乱序回调、取消、网络失败和 AudioContext 解锁。

### 25.3 浏览器 E2E

少量真实浏览器用例验证：

- 首次交互解锁；
- MediaElement 与 AudioBuffer 路由；
- Auto/Skip/回退/读档；
- locale 切换与语音预取取消；
- Editor 音频 Inspector；
- Studio 生成与发布状态。

## 26. 验收标准

- Runtime Program、Snapshot、effects 与 trace 保持 JSON-only；
- 同一命令序列在浏览器和 Fake Backend 上产生一致逻辑轨迹；
- 任意乱序异步回调不能复活已停止轨道；
- 六个总线独立可控，voice ducking 不影响 sfx/ui；
- Editor 与 Studio 写出的项目文件可互相读取且 Git diff 可审查；
- 多语言缺失、stale take、权利缺失和哈希错误产生约定的诊断；
- 构建过程不发起 TTS 或 COS 写请求；
- 文档示例都由 schema/fixture 测试覆盖。

## 27. 实施顺序

1. 固定共享类型、文件 schema、诊断码和迁移输入；
2. 用测试驱动实现 Audio Director、Mixer 与 Fake Backend；
3. 实现 Browser Backend 与 Runtime effect bridge；
4. 一次性迁移现有 BGM 与项目内容；
5. 实现语音账本、Voice Profile 和 Provider capability；
6. 实现媒体处理、COS 私有/发布链路；
7. 实现 Editor 完整工作流；
8. 实现 Studio 移动端核心工作流；
9. 完成 E2E、文档示例和发布审计。

逐任务文件与验证命令见[实施计划](../plans/2026-08-12-audio-system-implementation)。

## 28. 相关文档

- [音频资产与 AI 配音决策](/about/design/audio)
- [音频创作与发布指南](/guide/audio)
- [资源目录协议](/guide/assets/catalog)
- [COS 存储与发布规范](/guide/assets/cos)
- [统一 Runtime 场景演出](/guide/runtime/presentation)

## 29. 业界与供应商参考

- [Ren'Py Voice](https://www.renpy.org/doc/html/voice.html)：稳定语音标识、台词前进时停止语音；
- [Ren'Py Preferences](https://www.renpy.org/doc/html/preferences.html)：玩家音量与等待语音偏好；
- [Ren'Py Configuration](https://www.renpy.org/doc/html/config.html)：音频 channel 与 ducking；
- [Unreal Engine Audio Engine Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/audio-engine-overview-in-unreal-engine)：Sound Class、Sound Mix 与并发控制；
- [Unreal Engine Asset Localization](https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-localization-in-unreal-engine)：按 culture 管理本地化资产；
- [MiniMax T2A API](https://platform.minimax.io/docs/api-reference/speech-t2a-http)：语音合成、音色、情绪、格式与时间戳能力；
- [腾讯云 COS 临时密钥](https://cloud.tencent.com/document/product/436/45242)：短期凭证与临时策略；
- [腾讯云 COS 最小权限](https://cloud.tencent.com/document/product/436/38618)：按操作和对象前缀收敛授权；
- [腾讯云 COS 生命周期](https://cloud.tencent.com/document/product/436/17031)：按对象前缀清理临时任务资源。
