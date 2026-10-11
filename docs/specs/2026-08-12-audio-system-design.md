# ADV.JS 多轨音频与 AI 配音系统设计

状态：已确认，分阶段实施；运行时与两端音频管理已实现，认证托管执行、COS 发布宿主、版本化音色设计与 JSON Flow 可视化编辑／构建已实现，部署验收单独记录

日期：2026-08-12

最近更新：2026-10-11

适用范围：`@advjs/types`、`@advjs/parser`、`@advjs/core`、`@advjs/client`、`@advjs/editor`、`@advjs/studio`、CLI、COS 发布链路

## 1. 背景

统一 AudioEngine、Mixer、稳定 lineId、多语言 take、Dialogue Voice、共享作者文件协议和安全迁移 CLI 已实现，旧 BGM Runtime 已移除。Editor／Studio 音频库、take 审核、混音、角色／旁白 Profile、发音词典及批量任务已接入共享服务；Editor 还提供原生 Markdown 流程图与源码音频属性。Qwen／OpenAI 沿用现有供应商注册表，本地认证宿主与 Studio 私有队列复用相同 Planner／Runner。本地 FFmpeg 处理和发布域逻辑已可单独验证。可执行契约见[音频指南](/guide/audio)和[作者语音指南](/guide/authoring-voice)，验证证据见[本轮实现报告](/reports/2026-10-11-audio-runtime-implementation)。Studio 的有限认证服务复用既有 Provider，同步原生文件／音频、持久执行任务并下载校验相同 ID 的 take；发布宿主接入后台转码、可信收据和真实 COS SDK；标准 `.chapter.json` 项目共用编译与绑定协议。固定 Qwen 模型的自动准备、真实本地合成、两端音色／对白／Flow 导出播放与缓存复用已在 Apple Silicon 上验收；听审、跨设备／长任务评估以及云端部署和 STS 环境仍需独立验收。

本次升级前，浏览器音频能力以 BGM 专用组合式函数和 Howler 实例为中心，不适合继续承载语音、环境音、音效和 UI 音频：

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
3. 支持按角色 Voice Profile 和台词文本生成配音，沿用已落地的通用作者接口与 Qwen／OpenAI 适配器，后续扩展 MiniMax、豆包及其他服务；完整托管批量 Provider 仍须独立验收。
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

```text
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
```

职责边界：

- **Runtime**：保存“应该播放什么”，发出纯数据效果；
- **Audio Director**：决定如何切换、停止、恢复、预取和丢弃过期请求；
- **Audio Mixer**：总线、音量、静音、ducking、淡化与并发；
- **Audio Backend**：实际创建 Web Audio、MediaElement 或测试替身；
- **Vue composable**：提供只读状态与玩家设置，不拥有音轨状态机。

## 6. 音频总线与并发

音频是媒体类型，配音、音乐、环境音和音效是用途分类。原生 Asset Catalog 使用 `type: audio`；推荐 `kind` 为 `bgm / ambience / voice / sfx / ui`，作者参考片段使用 `reference`，不进入剧情播放总线。Studio 旧素材字段通过迁移归一化，不以文件扩展名或模型供应商猜测用途。

| 分类        | 目标总线 | 内容身份与引用                              | 管理边界                                                  |
| ----------- | -------- | ------------------------------------------- | --------------------------------------------------------- |
| `bgm`       | music    | `assetId`                                   | 循环、切轨、淡化与响度；只有该 kind 可投影进兼容 BGM 曲库 |
| `ambience`  | ambience | `assetId + slot`                            | 持续叠加，场景继承／重置                                  |
| `voice`     | voice    | `lineId + locale + takeId` 解析为 `assetId` | 角色／旁白配音；音色短句样本可先作为作者资产存在          |
| `sfx`       | sfx      | `assetId + event`                           | 一次性剧情 cue、优先级与并发组                            |
| `ui`        | ui       | `cue → assetId`                             | 交互反馈，独立于剧情时间线                                |
| `reference` | 无       | 作者预设中的 `assetId`                      | 只用于参考条件与来源审核，不作为选中台词或曲库内容        |

同一二进制可以去重存储，但用途、许可和引用必须显式登记。类别未知的音频可留在素材库，不能被自动当作 BGM、SFX 或配音。跨类型引用由编译器／资源校验器阻断。

```text
master
├── music       单一逻辑主轨，允许切轨交叉淡化
├── ambience    命名槽位分层，默认最多 4 层
├── voice       单一前景语音，新台词替换旧语音
├── sfx         多声部，按并发组限流
└── ui          独立短音效，不参与剧情暂停与 voice ducking
```

默认规则：

- voice 对 music 与 ambience 做 ducking，不压低 sfx 与 ui；
- SFX 默认全局上限 16，并允许 `footstep`、`impact` 等组设置更小上限；
- 达到并发上限时，按优先级淘汰最低优先级，再淘汰最旧实例；
- UI 总线用于确认、悬停和系统提示，不由剧情回退重放；
- 项目默认音量与玩家偏好分层，玩家偏好优先且不进入剧情存档。

## 7. 环境音槽位

环境音采用命名槽位，而不是无限叠加：

| 槽位      | 典型用途                   |
| --------- | -------------------------- |
| `bed`     | 室内、森林、城市等基础底噪 |
| `weather` | 风、雨、雷                 |
| `crowd`   | 人群、咖啡馆、车站         |
| `detail`  | 虫鸣、机器、电流           |

同一槽位的新资产交叉淡化并替换旧资产；不同槽位可以同时播放。未提及的槽位保持不变，清空必须显式执行。场景切换可以声明继承或整体重置。

## 8. Runtime 音频语义

目标 Runtime 舞台状态只保存可恢复的音频状态：

```ts
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
```

目标 AdvScript operation：

```yaml
type: bgm
action: set
asset: bgm.observatory
fade:
  in: 1200
  out: 700
```

```yaml
type: ambience
action: set
slot: weather
asset: ambience.rain
fade:
  in: 800
  out: 800
```

```yaml
type: sfx
action: play
asset: sfx.door-close
group: environment
```

停止使用显式 action：

```yaml
type: ambience
action: clear
slot: weather
fade:
  out: 500
```

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

```md
@mitsuha
你好，我们又见面了。 {#line_019c...}

> 夜色渐渐沉下来。 {#line_019d...}
```

规则：

- 标记必须是对话或旁白最后一个物理行的最后一个非空白 token；
- 每个对话或旁白节点最多一个 `{#line_<uuidv7>}`；
- Parser 将标记写入 `lineId`，不把它计入 `displayText` 或 `spokenText`；
- Serializer 必须原位写回同一个 ID；
- Flow 的 `AdvDialogNode.lineId` 与 Markdown 使用同一标识；
- 只有获得配音或被作者显式固定的台词必须写入 ID，编译器仍可给其他顺序节点生成非持久内部地址。

## 10. 多语言与 take

语音按以下地址管理：

```text
lineId
└── locale
    ├── selectedTake
    └── takes[]
```

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

```ts
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
      projectVoiceId?: string
      projectVoiceVersion?: string
    }>
  }>
}
```

意图保存角色的年龄印象、性格、说话风格和语言要求，两端使用相同字段。当前按可信宿主能力支持 Qwen VoiceDesign 描述条件与 Base 授权参考，以及 OpenAI 内置音色／指令；MiniMax 为后续供应商。候选、登记、样本选用和角色应用是分别可审核的操作；参考来源必须在执行前验证原生媒体、许可与项目同意文件。

导入的参考资源可以尚未分配角色；显式填写 `characterId` 时必须匹配本次设计人物。Node 预览、共享设计服务与本地模型检查使用同一规则，并继续校验参考字节／SHA-256、格式、时长和授权。不能通过清除一个已登记参考的角色资料绕过其版本与来源审核。

`packages/types/src/audio/voice-design.ts` 的 `VoiceDesignPort` 是两端完整设计契约，`@advjs/audio` 校验不可变草稿与作者库。设计只扩展唯一 `authoring/voices/library.json`，不维护第二份媒体或供应商数据库。每个版本使用唯一库 ID，以 `supersedes` 指向旧版本；保存输入包括意图、精确语言、供应商、可信预设及来源条件。宿主派生预设的模型／revision／权重保持来自可信模板，固定预设 SHA-256。

样本按精确语言／供应商保存在 `design.samples` 与 `design.selectedSamples`，媒体进入原生 Asset Catalog。显式应用写入当前 binding 的实际供应商 `voiceId` 和作者 `projectVoiceId + projectVoiceVersion`，任务按精确语言设计实现解析预设；保留其他绑定与全部旧 take。共享 revision/CAS 拒绝角色、授权、媒体或设计发生变化后的覆盖。

旁白使用相同结构，保存在 `adv/audio/voice-profiles.json` 的 `narrator` 字段中，不要求创建伪角色卡。该文档包含 `schemaVersion: 1`、非负整数 `revision` 和可选 `narrator`；未知字段被拒绝。任何可生成语音的 ledger line 都必须拥有角色 ID 或 `narrator`，因此 COS voice key 的 speaker 段始终确定。

项目发音词典保存在 `adv/audio/pronunciation.json`，包含 `schemaVersion: 1`、非负整数 `revision`、全局 `replacements` 和精确语言 `locales[locale].replacements`。使用最长字面匹配、一次替换，全局规则被当前精确语言覆盖；显式逐句 `spokenText` 优先。规范化的词典身份进入生成输入指纹与 take provenance；空默认词典保持旧指纹兼容。词典与旁白配置均使用共享 revision/CAS，不覆盖冲突草稿。

## 13. TTS Provider

### 13.1 当前公开接入契约

当前权威 TypeScript 契约是 `packages/types/src/config/voice.ts` 的 `AdvVoiceSynthesisProvider`，通过可信 `adv.config.ts` 的 `authoring.voice.providers` 显式注册。不要另建 `plugin-tts` 注册表或将 TTS 塞进播放器 `plugins`。

- 必需操作：只读 `inspectPreset` 与生成 `synthesize`。
- 可选操作：只读 `doctor`、显式 `setup`、独立 `createVoice`；只读 `listVoices` 和从可信模板派生 JSON 的 `buildDesignPreset`。
- 能力：`backend`、`synthesis`、`voiceCreation`、`offline`、可选 `designSources`，以及各模型的模式、文本上限、格式与 streaming 声明；注册时验证类型、唯一模型 ID 和合法音频 MIME。设计来源只在实际模板支持时显示。
- 适配器持有供应商模型／参数约束；Qwen 的参考模式、500 字及 seed 不施加给 OpenAI 或第三方插件。
- `synthesize` 返回实际本地候选，主机复核人物、文本、文件边界、字节数与 SHA-256，计算输入 fingerprint，并拒绝取消或预设变化后的成功结果。
- `voiceId + voiceVersion` 是项目作者音色身份；`providerVoiceId` 是实际供应商音色。两者不得混用。完整台词 ledger 将分别固化这些身份。
- 生成只创建候选，不隐式登记、选用、绑定对白、创建云端声音或发布媒体；供应商失败不静默切换 Provider。

Qwen 为本地 MLX，OpenAI 为云端内置音色；两者当前均返回 WAV 候选。Web Speech 只用于本机临时试听，不作为可发布生成来源。Studio 正式配音与音色设计使用认证 Node 服务和共享作者协议，不得将旧浏览器 `TtsProvider` 的本地 Blob 直接冒充正式 take。

### 13.2 完整系统的后续能力

未来以兼容扩展提升现有能力声明，界面按能力显示操作，不硬编码供应商名称。以下是目标能力集合，并非已导出的第二套接口：

```ts
interface PlannedTtsCapabilities {
  synthesis: boolean
  voiceCatalog: boolean
  voiceDesign: boolean
  voiceClone: boolean
  timestamps: boolean
  emotions: boolean
  streaming: boolean
  outputFormats: string[]
}
```

后续统一 Adapter 接收 Provider 无关台词请求，返回音频母版、时间戳、筛选后的 Provider 结果摘要和可审计元数据。MiniMax、豆包按现有契约接入，并单独验证声音创建能力。云端密钥与 SDK 仅位于可信服务端／本机 Node 环境。

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

当前 `authoring/voices/library.json` 保存作者音色身份、实现预设、版本化 `design` 和音色样本审核，媒体仍唯一存放于原生 Asset Catalog。它不是下列 `voice-ledger.json` 的替代格式。保留现有音色版本与审核证据，明确建立台词绑定，不能直接把 `selectedSample` 或 `design.selectedSamples` 当作某句台词的 `selectedTake`。

建议项目文件：

```text
adv/
├── assets.json
├── assets/audio.json
└── audio/
    ├── mixer.json
    ├── toolchain.json
    ├── voice-ledger.json
    ├── pronunciation.json
    └── voice-profiles.json
```

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

`adv/assets.json` 是唯一原生作者目录，可分片包含 `adv/assets/audio.json`。作者目录保存已登记母版、历史 take、参考媒体与衍生变体；不能把它直接当作公开发布清单。播放配置与公共发布另行投影，只包含运行所需的 BGM、环境音、SFX、UI 和各语言已选 voice take，排除未采用配音和参考媒体；构建输出生成扁平运行时清单。

### 15.3 发布 toolchain lock

`adv/audio/toolchain.json` 进入 Git，使用独立 `schemaVersion`，记录平台发布的 toolchain profile ID、FFmpeg build fingerprint 和 worker image digest。缺失、schema 非法、fingerprint 不匹配或未知 profile 时，正式音频发布产生错误；本地试听仍可使用能力满足但未锁定的 FFmpeg。

## 16. COS 对象键与发布

音频对象键的规范形式：

```text
{projectPrefix}/audio/
├── voice/{locale}/{speakerId}/{lineId}/{takeId}.{hash}.{ext}
├── bgm/{assetId}.{hash}.{ext}
├── ambience/{assetId}.{hash}.{ext}
├── sfx/{assetId}.{hash}.{ext}
└── ui/{assetId}.{hash}.{ext}
```

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

```bash
adv migrate-audio --map adv/migrations/audio-map.json --report adv/migrations/audio-report.json
adv migrate-audio --apply adv/migrations/audio-report.json
adv migrate-audio --recover REVISION
```

已实现的报告 schema 保存源文件、旧引用、明确映射、patch、unresolved、原始 SHA-256、目录 revision 和报告 revision。作者把人工选择写入可审查的映射文件后重新 dry-run，不按 URL 或名称推断类别。当前 CLI 迁移旧 Markdown BGM，旧 Studio 私有缓存与 Flow 字段由各导入边界显式适配；未解析引用仍阻止执行。

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

- 五种播放用途与作者 `reference` 分类保持隔离；构建不会把配音／参考音频／音效加入 BGM 曲库；
- 导入、改名、替换与删除遵循同一资源生命周期；被引用资源不能静默删除，媒体母版与历史 take 不被覆盖；
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

- [作者语音与 TTS 插件接入](/guide/authoring-voice)
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

## 30. 管理系统的资源生命周期

本节是完整管理系统的目标契约。当前已实现原生资源管理、候选登记、显式对白 `selectedTake`、共享批量任务、认证 Studio 执行、媒体处理、COS 发布与标准项目构建，并通过约定的本地完整端到端验收。作者音色 `selectedSample`／`design.selectedSamples` 与对白 `selectedTake` 保持独立；完整音色设计、JSON Flow 编辑及真实模型／云环境验收状态见[实现报告](/reports/2026-10-11-audio-runtime-implementation)。

### 30.1 导入、整理与检查

资源服务统一处理人工录音、授权音乐／音效、TTS 候选与作者参考，生成不可变母版和稳定 `assetId`。文件类型以实际媒体探测为准，导入时检查可解码性、时长、采样率、声道、大小和 SHA-256，按用途补充循环、语言、人物、来源和许可。响度／峰值探测与编码规则遵循第 18 节，不改写母版。

素材库必须按用途、人物、语言、标签、许可、生成来源、引用状态与发布状态筛选；支持试听、定位使用位置、导出元数据、查看母版与发布变体。`assetId` 不因标题、文件名或文件位置变化而改变。资产替换生成新媒体版本与哈希，保留旧引用证据；不允许在相同发布对象键下覆盖不同内容。

### 30.2 候选、审核与剧情采用

| 阶段         | 持有数据                                             | 允许的动作                           | 完成判据                           |
| ------------ | ---------------------------------------------------- | ------------------------------------ | ---------------------------------- |
| 生成候选     | 模型输出、输入摘要、本地文件与 receipt               | 试听、比较、拒绝、重新生成           | 文件与完整性检查通过；没有自动采用 |
| 登记资产     | 原生 Catalog 条目、许可与来源                        | 注册用途、准备缓存、查看来源         | 稳定 `assetId`、媒体与元数据一致   |
| 音色样本审核 | 版本化作者 library                                   | 显式选 `selectedSample`、审核替换    | 库 revision 与人物一致；不修改对白 |
| 台词 take    | `lineId + locale`、speaker、fingerprint、不可变 take | 比较、选 `selectedTake`、恢复旧 take | 文本与音色版本匹配，冲突显式解决   |
| 发布         | 处理 receipt、编码变体、发布计划                     | 校验、上传、审计                     | 所有对象验证成功后再更新 manifest  |

拒绝候选不删除已登记资产；修改音色或文本不自动覆盖已选 take。重新生成不等于替换；作者必须决定是否采用新结果。生成、登记、试听选用、对白绑定和发布是分别可审查的操作。

### 30.3 引用、删除与恢复

引用索引覆盖章节／Flow、场景状态、UI cue、角色音色预设、作者 library、voice ledger 与发布清单。删除前列出直接和间接使用位置；存在引用时阻断删除，或由作者通过一个可审查的事务先替换全部引用。默认删除只取消目录登记，不立即删除母版、take 或远端对象。

垃圾回收先生成按哈希和引用确认的计划，再显式执行；历史发布、选中样本、已采用 take 与参考片段都算有效引用。缓存清理与正式资源删除分开，禁止把“本机未缓存”当成“资源未使用”。失败写入需要 rollback／journal，跨端修改使用 revision 检查，恢复保持同一逻辑 ID。

### 30.4 交付与兼容

静态发布只携带实际使用的可播放资产及必要兼容变体；参考音频、未选 take、Provider SDK／密钥、作者库与成本记录不进入玩家包。下载、存储、TTS、媒体处理与播放分别通过有限接口协作，不共享私有工作区对象。

Editor 提供完整素材表格、引用检查、批量任务与 Mixer；Studio 使用同一协议的移动界面。临时试听、正式素材、已采用对白和发布完成须在界面分别展示状态。新 Runtime 迁移按第 24 节执行，不因新增 Provider 修改剧情语义或隐藏旧格式。

## 31. 认证执行与发布的宿主边界

Studio 通过部署配置的服务地址和现有账号 access token 调用有限音频 API。每次请求由服务端验证身份、检查注册项目／ACL；项目根、Provider 对象、预设路径、凭据与允许的工具链只由可信部署配置指定。账号不是浏览器传入的 claim；不同账号／项目不能共享或嵌套同一真实根目录。同步只接受原生 JSON／Markdown／YAML、明确授权记录和按已登记 asset ID／SHA-256 校验的媒体，拒绝可执行配置、路径穿越、超限请求与历史 take 重写。

在线服务是唯一 Provider 执行方，Editor／Studio 使用相同 Planner／Runner、预算、指纹与持久恢复协议。生成媒体通过认证范围内的下载地址传输，客户端核验字节和哈希，再用共享 `importTake()` 保存原始 asset／take ID，保持未选状态。源语言生成和 stale 检查读取当前剧情原文；其他语言保留明确翻译，显式朗读文本优先。供应商未提供 query 时未知结果继续阻塞，不能把 HTTP 中断解释为尚未收费。

发布准备使用项目外持久任务，并通过查询恢复；单服务进程最多两个媒体 Worker。工具链只读取可信主机 allowlist；可选容器 runner 先核对已安装 image ID，禁止网络与自动 pull。实际处理结果保存为可信收据，项目和客户端计划本身不授予发布权。审核记录有效期 30 分钟；发布重查当前选用、母带、变体与同意记录字节，任何变动阻止当前审核继续发布。

COS 适配器对完整对象键使用禁止覆盖写入、有界 ETag 固定 GET 和实际 SHA-256 校验。版本控制桶中禁止覆盖头不生效，宿主因此拒绝此类桶，规则见 [COS PUT Object](https://intl.cloud.tencent.com/document/product/436/7749?lang=en)；固定读取规则见 [COS GET Object](https://cloud.tencent.com/document/api/436/7753)。所有对象通过验证后，公开 manifest 最后上传到内容哈希地址。当前发布指针在可信主机项目外以锁、fsync、原子替换和 revision CAS 持久更新；不假设 COS 支持条件替换 PUT。失去 CAS 的不可变清单是未引用对象，不会覆盖已发布版本，且不会自动删除。

标准构建须显式提供公开 manifest 和其内容 SHA-256，再核对完整 Opus／AAC 变体、原生母版身份与当前已选 take 对象键。编译仍读取原生剧情和账本，并验证母版实际字节；发布音频只替换运行时传输地址。公开时长取可信处理收据中两种编码时长的最大值，避免作者录入时长影响浏览器路由。玩家输出移除参考、未选历史、母版、授权记录及供应商参数，按明确引用收集非音频资源，禁止整体复制作者 `public/`。

操作指南是 [Studio 音频服务](/guide/studio/audio-service)与[序列化 Flow 项目](/guide/flow-projects)，真实验证与部署限制统一记录在[实现报告](/reports/2026-10-11-audio-runtime-implementation)。
