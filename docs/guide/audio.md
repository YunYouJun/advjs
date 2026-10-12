# 音频创作与 AI 配音

ADV.JS 使用统一 AudioEngine 播放音乐、环境音、对白、剧情音效与 UI 音效。Editor、Studio 和 CLI 共用音频资源、Mixer 与对白账本协议。本页介绍当前可用的脚本、配音与迁移流程；TTS 插件配置见[作者语音模块](/guide/authoring-voice)，自创或借助 AI 的音乐方案与文件回流见[音乐创作指南](/guide/authoring-music)。

::: warning 破坏性音频升级

Runtime Program 与 Snapshot 已升级到版本 2。旧 `bgm.name / src / stop` 和旧存档不再由播放器解释，需先运行迁移报告并处理未解析引用。播放引擎、资源管理、两端配音审核、Mixer、Studio 服务端任务与 COS 发布宿主已实现。云端部署、真实模型与凭据环境的验收状态见[实现报告](/reports/2026-10-11-audio-runtime-implementation)。

:::

## 音频类型与播放规则

原生 Asset Catalog 使用 `type: audio`，用 `kind` 区分用途。剧情只引用稳定资产 ID，不直接引用文件 URL。

| kind        | 总线     | 播放规则                                      | 历史回退与读档         |
| ----------- | -------- | --------------------------------------------- | ---------------------- |
| `bgm`       | music    | 一条逻辑主轨，切换时交叉淡化                  | 恢复目标轨道           |
| `ambience`  | ambience | `bed / weather / crowd / detail` 四个独立槽位 | 恢复各槽位             |
| `voice`     | voice    | 当前对白的一条前景语音                        | 取消旧语音，不自动重播 |
| `sfx`       | sfx      | 一次性事件，按组和优先级限流                  | 不重播                 |
| `ui`        | ui       | 语义交互 cue，独立于剧情                      | 保留独立交互生命周期   |
| `reference` | 无       | 作者侧参考材料                                | 不进入剧情播放         |

长音乐与环境音使用 HTMLMediaElement 流式播放，短音频通过 AudioBuffer 解码，解码缓存默认限为 64 MiB。浏览器后端在首次交互时创建并解锁 AudioContext，过期对白不会排队补播。加载使用 AbortSignal 与 generation 校验，快速切换不会让旧回调停止新轨。解锁后预取当前及确定路径上的后两句配音；遇到分支停止预取，切换台词、语言、历史或项目时取消旧请求。

Opus／WebM 为主变体，AAC／M4A 为兼容变体。[WebKit 的 Opus 流式混音问题](https://bugs.webkit.org/show_bug.cgi?id=276813)会使 MediaElement 播放绕过 Web Audio 音量处理，不能仅依据 `canPlayType()` 判定可混音。变体选择需区分流式与解码路径，测试用实际分析器信号验证总线控制。

## 项目文件

```text
adv/
├── assets.json
├── assets/
│   └── audio.json
├── audio/
│   ├── mixer.json
│   ├── pronunciation.json
│   ├── voice-profiles.json
│   └── voice-ledger.json
├── characters/
└── chapters/
```

`adv/assets.json` 是唯一资源根，可内联资源或引用 `assets/audio.json`。Mixer 保存项目默认混音参数；账本保存全部 take、生成来源和选择结果。玩家设备的六总线音量与静音独立持久化，不进入项目文件或剧情存档。正式处理使用 `adv/audio/toolchain.json` 选择可信主机批准的 FFmpeg 构建和 Worker 镜像。

当前音频作者服务固定使用 `adv` 内容根。自定义内容根的项目会显示 `ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED` 并禁用音频写入；请先按项目迁移流程使用 `adv` 根，服务不会静默另建一套文件。

Profile 和分片规则见[资源目录协议](/guide/assets/catalog)。作者服务保留资源根和既有分片，登记不可变媒体后最后提交账本；写入冲突或失败时拒绝覆盖并清理本次导入。

## BGM 与环境音

以下指令写入章节的 YAML 围栏中；`asset` 必须对应目录中相同 kind 的资源。时长单位为毫秒，`gain` 范围为 0–1。

```yaml
type: bgm
action: set
asset: bgm/summer-day
gain: 0.8
loop: true
fade:
  in: 1200
  out: 700
```

停止主音乐：

```yaml
type: bgm
action: clear
fade:
  out: 700
```

环境音按槽位叠加，替换一个槽位不会改变其他槽位。

```yaml
type: ambience
action: set
slot: weather
asset: ambience/rain
loop: true
fade:
  in: 800
  out: 800
```

```yaml
type: ambience
action: clear
slot: weather
fade:
  out: 500
```

BGM 和环境音目标保存在 `stage.audio` 中。历史回退、前进和读档只同步最终状态，使用短淡化；存档不保存物理播放器、播放位置、计时器或退场包络。

### 在 Editor 中编辑场景音频

流程图展开剧情详情后，节点的音频属性按钮可编辑音乐、四槽位环境音与音效。选中原有音频代码块时更新该块；选中其他剧情节点时在节点之前插入新操作。素材选择只列出对应用途的原生音频，参考素材不进入播放指令。保存通过完整源文件 CAS；源码尚有未保存草稿或外部修改时阻止覆盖，并保留音频属性草稿。

源码编辑器的「场景音频」在当前光标所在剧情块打开同一属性控件。「应用到源码草稿」进入 Monaco 撤销栈，随后按正常文件流程保存。纯音频块可显式移除；混合块保留其他演出操作和周围正文、对白 ID，但保存会把所编辑围栏规范化为 JSON `advnode`，不保留该围栏内部的 YAML 注释。该界面编辑原生 Markdown 的流程图投影。标准文件项目也可使用原生 `.chapter.json` 构建；格式、校验和独立音频节点的无损修改接口见[序列化 Flow 项目](/guide/flow-projects)。

## 剧情音效与 UI cue

```yaml
type: sfx
action: play
asset: sfx/door-close
group: environment
priority: 50
gain: 0.9
```

SFX 只在正常剧情推进时触发。达到全局或分组并发上限时，优先淘汰最低优先级，再淘汰最旧实例；更低优先级的新请求不会抢占较高优先级实例。

主题和控件通过 `$adv.$audio.playUi('confirm')` 触发 cue。UI cue 到资产的映射由 Mixer 管理，未配置的 cue 保持静音。确认按钮和复选框只在用户操作时触发，恢复设置不会补播反馈音。

## Mixer

在 `adv/audio/mixer.json` 配置项目默认值。六条总线为 `master / music / ambience / voice / sfx / ui`，均支持 `gain / muted / solo`。

```json
{
  "schemaVersion": 1,
  "buses": {
    "music": { "gain": 0.7 },
    "ambience": { "gain": 0.5 },
    "voice": { "gain": 1 }
  },
  "ducking": {
    "enabled": true,
    "gain": 0.35,
    "attackMs": 120,
    "releaseMs": 300
  },
  "sfx": {
    "maxVoices": 16,
    "groups": { "environment": 4 }
  },
  "ui": {
    "confirm": "ui/confirm",
    "cancel": "ui/cancel"
  }
}
```

Voice 播放时只衰减 music 与 ambience，停止或自然结束后恢复；不改变 SFX 与 UI。播放器设置提供六总线音量、独立静音与恢复项目默认值。设备设置通过 `setUserSettings()` 覆盖项目默认值，主静音和音乐静音保留各总线音量，不改写剧情数据。

## 对白配音绑定

配音通过 `lineId + locale + selectedTake` 解析最终资产。为台词添加完整 UUIDv7 标记，必须位于最后一个物理行的末尾：

```md
@guide
欢迎回来。 {#line_019b1ca0-0000-7000-8000-000000000001}

> 夜色渐渐沉下来。 {#line_019b1ca0-0000-7000-8000-000000000002}
```

Parser 会移除标记，不将其显示或朗读；Flow 序列化保留同一个 `lineId`。角色使用稳定 `characterId`，旁白使用保留 `speakerId: narrator`。复制台词时创建新 ID；移动和编辑文本时保留原 ID。

配置好 Qwen 或 OpenAI 的作者 Provider 后，先读取账本 revision，再显式生成单句。以下 `REVISION`、`TAKE_ID` 需替换为命令返回的值。

```bash
adv voice takes --json
adv voice generate --line line_019b1ca0-0000-7000-8000-000000000001 --locale zh-CN --speaker guide --text '欢迎回来。' --expected-revision REVISION --json
adv voice bind --line line_019b1ca0-0000-7000-8000-000000000001 --locale zh-CN --take TAKE_ID --expected-revision REVISION --json
```

`generate` 创建新资源和未选 take，不覆盖旧音频或自动替换配音。`bind` 使用生成后的最新 revision；替换已选 take 还需 `--replace-selected`。`selectedSample` 是作者音色短句审核，不能代替对白 `selectedTake`。

每个 take 固化真实 Provider 音色 ID、模型、revision、输入指纹、声音来源、音频 SHA-256 和生成时间。编辑文本或 Voice Profile 后，旧 take 标记 Stale 并保留审核历史。克隆来源必须有许可、权利主体和项目内同意记录；缺少记录时在模型启动或收费请求之前拒绝。

展示文本的 Markdown 标记会被移除；含运行时变量的台词必须显式提供确定的 `spokenText`。项目按规范 BCP 47 管理 locale，缺少当前语言的选中 take 时显示文本并静音，不回退播放其他语言。

### 发音词典与旁白音色

`adv/audio/pronunciation.json` 保存全局和精确语言的字面发音替换，不执行正则或 SSML。例如：

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "replacements": { "ADV.JS": "冒险引擎" },
  "locales": {
    "zh-CN": { "replacements": { "重行": "虫行" } }
  }
}
```

精确 locale 条目覆盖同词的全局条目，最长匹配只替换一次，不递归扩大文本。显式 `spokenText` 优先于词典。保存需带最新 revision，字典内容及版本进入输入指纹；修改后已选 take 会标记 stale，音频与选择记录保留。

角色音色配置保存到 `.character.md` 的 `voiceProfile`，每个语言绑定供应商实际 voice ID、模型和来源。旁白使用项目文件 `adv/audio/voice-profiles.json` 的 `narrator` 字段，结构与角色相同，不创建角色卡。两端使用同一校验与 CAS 保存；Node 合成再通过插件的只读预设检查核对实际身份，配置不一致时在模型／网络调用之前拒绝。

正常推进同时开始文字和语音。Auto 等待打字机和语音完成后再计时；Skip、回退、读档和跳转取消旧语音。加载失败解除 Auto 等待并报告诊断。

## Editor 与 Studio 共用服务

两端复用 `@advjs/audio` 的 `createVoiceAuthoringService()` 和 `createProjectAudioService()`，提供相同的 `read / synthesize / register / select` 操作。Editor 通过 ProjectWorkspace 写入，Studio 通过 IFileSystem 写入，都执行 revision 冲突检测、媒体哈希校验和失败回滚。读取账本不会替换 Editor 正在使用的预览 URL。

播放预览统一投影为 `AdvGameConfig.audio` 并使用同一个客户端 Audio Director。Python、模型和供应商 SDK 留在可信作者主机；Studio 配置 `VITE_ADVJS_VOICE_SERVICE_URL` 后使用已登录账号的真实 access token 调用[音频服务](/guide/studio/audio-service)，复用现有 Qwen／OpenAI 注册表。没有配置服务时可以读写既有 take，但不能直接运行 Qwen。

Editor 音频面板与 Studio `/tabs/workspace/audio` 均提供素材库、音色设计、配音审核、生成任务、发音词典、旁白音色和项目 Mixer。角色表单编辑同一个 `voiceProfile`。可以导入音频、显式指定六类用途、编辑资料、试听、按语言选择或替换 take，以及保存项目混音配置。Editor 的 Mixer 保留经过 schema 校验的 JSON 草稿，Studio 提供六总线控制与高级配置。界面遵循各自主机设计规范，输出的项目数据相同。

旧 `kind: audio` 条目需要作者显式选择用途。删除前会检查全部 take 历史、克隆参考、Mixer cue、编译后的剧情操作和衍生关系；仍有引用或无法检查剧情时拒绝删除。删除仅移除目录条目，母版文件保留。登记后的母版路径、SHA-256 与字节数不可通过资料编辑修改。

服务地址由应用部署配置提供，Provider 与凭据由可信主机配置；测试宿主仍可注入 transport。生成前审核真实 Provider、模型、音色、来源与预算，结果登记为未选 take；选择和替换另行确认。两端音色设计支持未登记候选的直接试听、不可变设计版本、精确语言实现，以及分别审核样本登记、选用与角色应用，操作与数据边界见[作者语音](/guide/authoring-voice#两端音色设计)。原生 JSON Flow 编辑、条件和跨章连线见[Flow 文件项目](/guide/flow-projects#editor-与-studio-可视化编辑)。

## 持久任务与恢复

`@advjs/audio` 提供 `planVoiceGeneration()` 和 `createVoiceGenerationRunner()`。计划列出句数、字符数、缓存命中与估价，明确批准字符预算、并发上限及未知费用后才可入队。Runner 复用同一个作者合成／登记服务，不另建供应商注册表，也不自动选择生成结果。

可信 Node 主机可通过 `advjs/node` 的 `createNodeVoiceGenerationStore()` 将任务放在操作系统应用数据目录。任务不进入项目 Git、导出包或存档；状态保存指纹、来源与媒体恢复收据，不保存对白正文、私密提示词或供应商日志。幂等记录至少保留 30 天，取消、恢复与登记失败重试复用已完成媒体。

本地 Editor 的「生成任务」通过已认证的 loopback bridge 使用当前项目与默认作者预设。选择整章、缺失或过期台词及语言、供应商，创建计划，审核预算后入队，再显式运行；单次最多 200 句，较长章节分批审核。主机只读检查真实预设、模型版本、音色与参考哈希；执行前重读剧本、音色、词典和授权，变化时要求重新计划。无需在浏览器填写供应商密钥。

Studio 使用相同 Planner／Runner。在线服务是唯一的供应商执行方，账号由服务端验证的会话决定，项目 ID 必须匹配服务器注册的根目录；浏览器不能提供主机路径或供应商密钥。有限原生文件与音频母带按 revision、asset ID、SHA-256 同步。服务端独立重读预设、Profile、词典、参考媒体和授权，再审核、入队、显式运行。已登记结果通过认证下载、字节校验和共享 `importTake()` 原样导回相同的 asset／take ID，不再次合成，也不自动选用。

离线任务仍存入按账号、项目隔离的私有 IndexedDB，不进入项目导出；联网只恢复状态，执行前需要服务器重新审核。完整配置和有限 HTTP 路由见[Studio 音频服务](/guide/studio/audio-service)。两端相同的实际参数产生同一输入指纹，已有媒体先校验再复用。

请求结果不确定时必须先查询供应商，不能直接重发。当前 Qwen／OpenAI 适配器没有远程任务查询接口，这类未知请求保持阻塞，不能宣称能自动恢复收费调用。服务端持久任务可在重启后查询已知生成结果，但不能把本机 HTTP 中断当作供应商未执行的证明。

## 非破坏式媒体处理与发布

可信 Node 主机通过 `advjs/node` 的 `processProjectAudio()` 显式处理本地母版；`adv build` 不运行它。处理生成 48 kHz Opus／WebM 与 AAC／M4A 变体，并记录原始 SHA-256、FFmpeg 构建指纹、预设、字节数、时长、声道、响度与真峰值。输出按内容哈希命名，可重跑复用，母版保持原样。Voice 只裁去两端静音，保留句内停顿；极短 cue 使用峰值限制，无法测得的综合响度记为 `null`。

本地预览检查 FFprobe、Opus、AAC、响度和静音处理能力。正式发布还必须匹配工具链锁与可信主机的批准列表；项目不能指定任意容器镜像，预览收据不能更新公共发布清单。`adv doctor` 提供能力与构建诊断。

共享 `planAudioRelease()` 与 `publishAudioRelease()` 生成规范对象键并执行二进制先验证、原生 Asset Catalog manifest 最后 CAS 更新的顺序。计划读取原生目录与真实账本中的已选 take，执行时重新核对可信处理收据、当前绑定、工具链批准列表及全部 Voice 授权，克隆来源还需重读同意记录。参考素材、未选配音和私有母版不能夹带到公开目录。可信宿主必须实现 `verifyProcessingReceipt()` 并返回其存储中的收据，不能回显客户端计划作为验证。`createNodeAudioPublicationHost()` 将该协议接到真实 FFmpeg、项目外可信收据存储和现有 `CosStorage`。Studio「审核音频发布」提交可查询的后台转码任务；同进程最多两个处理 Worker，恢复中断任务时复用不可变输出。审核完成后单独点击发布，宿主重读当前选用、母带、变体与授权记录的字节。

COS 对象使用禁止覆盖的 PUT，HEAD 后再用 ETag 固定 GET 并核验实际 SHA-256。部署应使用从未启用版本控制的专用桶；SDK 的 `getAuthorization` 支持刷新 STS。公开清单使用 `manifests/assets.<sha256>.json` 不可变地址，全部音频验证后最后上传；服务端项目外指针以持久锁和原子写入执行 revision CAS。失败的 CAS 只留下未引用的不可变对象，不覆盖旧清单；发布响应丢失时查询状态或重用同一审核记录，不生成新音频。

正式处理必须使用服务端批准的工具链。需要容器时，`createLockedAudioContainerRunner()` 只运行已安装且 ID 与 allowlist 一致的固定 digest 镜像，不联网、不拉取项目指定镜像，项目根只读、处理输出单独可写。容器部署和真实 STS／云端环境仍须按[实现报告](/reports/2026-10-11-audio-runtime-implementation)验收。发布配置示例见[Studio 音频服务](/guide/studio/audio-service)。

## 旧项目迁移

先把旧 BGM 引用对应的资源登记在原生目录，再创建项目内显式映射文件：

```json
{
  "summer-day": "bgm/summer-day",
  "/audio/summer-day.wav": "bgm/summer-day"
}
```

生成只读报告并检查 `unresolved`：

```bash
adv migrate-audio --map adv/migrations/audio-map.json --report adv/migrations/audio-report.json --json
adv migrate-audio --apply adv/migrations/audio-report.json --json
```

迁移不猜测类别或 URL。Apply 在项目锁内重新核对源文件和资源目录哈希，拒绝未解析引用、过期或被修改的报告；journal 记录先于文件替换，失败时保护性回滚。异常退出可用 `adv migrate-audio --recover REVISION` 恢复。它不迁移旧存档、不上传 COS，也不删除原音频。

Hamster Demo 的源内容和资产已迁移，原始映射与哈希证据见[迁移报告](/reports/2026-10-11-audio-migration)。

## 验证

```bash
adv check
adv build
pnpm vitest run tests/unit/audio tests/unit/runtime/runtime-audio-state.test.ts
pnpm e2e:audio
```

编译检查非法操作、重复 lineId、错误用途的资产、Mixer／账本 schema、selected take 的资源和哈希、角色不一致及缺失权利记录。文本变化是 warning；没有配音的普通台词仍可运行。Node 与两端作者绑定服务另会读取媒体实际字节，拒绝登记或选中已被修改的音频。

测试使用离线 Fake TTS、Fake Backend 和测试 WAV。真实 Chromium／WebKit 测试验证手势解锁、实际声音输出、多轨混音、ducking、历史取消和销毁；不会下载模型、调用付费 TTS 或访问真实云桶。发布测试另用真实 COS SDK 连接本地 HTTP 验收端，检查内容哈希、缓存头、冲突与 manifest-last。

相关设计与阶段验收见[音频设计规范](/about/design/audio)、[实施计划](/plans/2026-08-12-audio-system-implementation)与[本轮实现报告](/reports/2026-10-11-audio-runtime-implementation)。
