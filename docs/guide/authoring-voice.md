# 作者语音模块

ADV.JS 内置通用作者协议、CLI、逐句配音账本与两端音色设计、配音审核界面，供应商按需安装。Qwen MLX 与 OpenAI TTS 复用同一个供应商注册入口；Editor、Studio 与 CLI 使用相同的 take、资源与版本检查协议。当前支持版本化音色设计、未登记候选试听、显式角色应用、单句和整章任务、缺失／过期筛选及显式对白绑定；Studio 认证服务与原生同步、后台转码和 COS SDK 发布已接入，真实云环境须独立验收。完整音乐、环境音、音效与配音管理的状态见[音频创作与 AI 配音](/guide/audio)。

不额外要求安装 `@advjs/plugin-tts`。将来需要独立发布维护时可拆为 `@advjs/voice`：范围包含音色身份、试听与选用，不只处理文本转语音。此包名目前是维护规划，尚无新包或 npm 发布。

## 接入与兼容

```ts
import { createQwenTtsProvider } from '@advjs/plugin-qwen-tts'
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  authoring: {
    voice: {
      providers: [createQwenTtsProvider()],
      defaultProvider: 'qwen-tts',
      library: 'authoring/voices/library.json',
      presets: { reference: 'authoring/voices/reference.json' },
      defaultPreset: 'reference',
      defaultReferenceMode: 'embedding-only',
      assetManifest: 'adv/assets.json',
    },
  },
})
```

旧 `provider: createQwenTtsProvider()`、预设文件和 `doctor|setup|preview` 命令继续可用。多个 provider 的 ID 必须唯一；`--provider` 显式选择优先，其次是 `presetProviders`、`defaultProvider` 和旧单 provider。使用 `--voice` 时，服务按该音色实际实现的预设映射选择 Provider；无映射时优先可用默认实现或唯一实现，存在歧义时要求显式 `--provider`。不会因失败自动切换供应商。

新适配器实现 `AdvVoiceSynthesisProvider`：声明 `capabilities`，提供只读 `inspectPreset` 与统一 `synthesize`。`doctor`、本地 `setup`、独立 `createVoice` 是可选操作；云服务不必提供 Python 目录。声音创建与短句合成分别调用，合成不会隐式创建供应商声音资源。Qwen 当前只声明合成，VoiceDesign 试音不是永久供应商音色创建。

适配器负责模型／后端能力、文本长度、模式和种子。Qwen 继续使用 500 字上限、seed 42 与 Base 的 `icl|embedding-only`，这些要求不施加给新云端适配器。旧 `AdvVoiceProvider` 的兼容路径保留历史限制，待各旧插件迁移后再移除。供应商扩展参数仍由预设与适配器校验，不静默忽略不支持的模式。

合成保留适配器生成记录；供应商提供原始 manifest 时一并保留。统一候选包含人物、文本、provider、模型／修订、项目相对文件、MIME、采样率、时长、大小、哈希及可选音色版本。通用服务复核文件、人物和文本，计算输入指纹；预设在执行期间变化或任务取消后，不报告成功。`preview` 只生成候选，`generate` 则通过共享事务服务把候选复制到持久素材目录，并登记一个尚未选中的对白 take。

`candidate.voiceId` 与 `voiceVersion` 是项目作者档案的身份和版本；`providerVoiceId` 记录供应商实际使用的音色，例如 OpenAI 的 `echo`。适配器不能将项目音色 ID 直接传给供应商 API。

## OpenAI 云端插件

插件在仓库中已有构建与 `./voice` 入口；本页不声明其 npm 版本已经发布。在本工作区执行 `pnpm --filter @advjs/plugin-openai build` 后，安装或链接该包到可信作者项目。

```ts
import { createOpenAiTtsProvider } from '@advjs/plugin-openai/voice'
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  authoring: {
    voice: {
      providers: [createOpenAiTtsProvider()],
      defaultProvider: 'openai-tts',
      presets: { openai: 'authoring/voices/openai.json' },
      defaultPreset: 'openai',
      library: 'authoring/voices/library.json',
      assetManifest: 'adv/assets.json',
    },
  },
})
```

`authoring/voices/openai.json`：

```json
{
  "schemaVersion": 1,
  "model": "gpt-4o-mini-tts",
  "characters": [
    {
      "id": "guide",
      "name": "向导",
      "text": "欢迎回来。",
      "voice": "echo",
      "instructions": "Speak calmly and clearly.",
      "speed": 1
    }
  ]
}
```

`OPENAI_API_KEY` 由本机进程环境或可信服务端提供，不写入预设。`./voice` 的导入、`providers`、`doctor` 和 `preview --list` 均不创建 SDK 客户端、不联网、不要求密钥。`doctor` 只检查配置，不能确认额度、权限或连通性。历史包根入口仍含旧 SDK 单例，作者工作流使用 `./voice`。

```bash
adv voice providers --json
adv voice doctor --provider openai-tts --json
adv voice preview --provider openai-tts --preset openai --list --json
```

配置好环境密钥后，下列命令会发起收费合成请求：

```bash
adv voice preview --provider openai-tts --preset openai --character guide --text '欢迎回来。' --json
```

本适配器仅支持内置音色，不开放创建或克隆声音。它校验模型、1–4096 字文本、0.25–4 倍语速和指令能力；`tts-1`／`tts-1-hd` 不接受 `instructions`，`--seed`、`--reference-mode`、`--offline` 显式报错。参数依据 [OpenAI Speech API](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)。

合成请求采用 PCM，封装为 24 kHz、单声道、16 位 WAV，写到 `.advjs/voice/previews/openai/<任务ID>/`，包含不可变音频与候选 manifest。格式依据 [OpenAI 输出格式文档](https://developers.openai.com/api/docs/guides/text-to-speech#supported-output-formats)。失败、取消或执行中修改预设会清理本次部分文件，不自动重试或登记资产。已完成的云端请求可能已经计费；清理文件或取消不代表退费，也不提供断点续跑保证。

同时接入 Qwen 时，把两个工厂放入 `providers`，分别配置预设，并用 `presetProviders: { reference: 'qwen-tts', openai: 'openai-tts' }` 路由。Qwen 的参考模式默认值只作用于参考预设；不要把 `--seed` 或 `--reference-mode` 显式传给 OpenAI。

## 第三方 TTS 插件契约

第三方包导出 Node 工厂，返回 `AdvVoiceSynthesisProvider`。通过 `authoring.voice.providers` 显式注册，不依赖运行时插件扫描。最小实现包含 `id`、`capabilities`、`inspectPreset(request)` 与 `synthesize(request)`；真实实现可参照仓库 `plugins/plugin-openai/src/voice.ts` 和 `plugins/plugin-qwen-tts/src/index.ts`。

| 操作              | 必须满足的行为                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------- |
| 能力声明          | 使用唯一 Provider／模型 ID、合法音频 MIME、布尔能力和正整数文本上限；主机注册时检查声明  |
| `inspectPreset`   | 只读，返回本次实际选择的人物和文本；不下载、安装或合成；适配器负责校验模型与参数         |
| `synthesize`      | 返回每个人物对应的本地候选，固化实际输入和供应商音色；响应文本、人物、大小与哈希必须匹配 |
| `signal`          | 转交给网络／子进程；取消后的结果不得报告成功                                             |
| `doctor`／`setup` | 可选，分别只读诊断与显式环境准备；云端不伪造本地安装能力                                 |
| `createVoice`     | 独立可选操作，需同时声明 `voiceCreation`；合成不隐式创建声音                             |
| 收费与日志        | 默认不重试未知结果的收费请求；不回传凭证、签名 URL 或未经筛选的供应商错误                |
| 资源管理          | 插件只产出候选；登记、试听选用、对白绑定、转码和发布归共享作者／资源服务                 |

浏览器 Web Speech 没有可持久化音频，继续只用于临时试听；共享 take 服务拒绝将它登记为可发布 take。托管 Studio／Editor 应经可信服务端调用已有 Node 适配器。Studio 的旧浏览器 `TtsProvider` 仍用于临时试听；项目配音登记与绑定使用下述共享服务。浏览器主机没有配置可信合成 transport 时，不能直接执行本地 Qwen，也不能把供应商凭证写入项目文件。

## 人物音色与短句选用

`authoring.voice.library` 是版本 1 的作者 JSON；不是第二份媒体清单。每个 `voices` 条目有稳定 `id`、`version`、原生 `characterId`、`label`，以及以 provider ID 为键的 `implementations`。实现引用预设，支持 `character`、`referenceMode` 与 `presetSha256`；固定预设哈希可防止沿用旧音色版本却改变参考或模型输入。

音色身份与单句文本／种子分开。`adv voice preview --voice <id> --list` 解析指定实现；`--text` 仅覆盖选中人物的短句。参考、模型或声音定义变化时新建音色版本并重新试听，不默认覆盖原档案。同一人物的跨供应商实现不承诺有相同听感；人物卡 `cv` 继续是声优署名。

```bash
adv voice providers --json
adv voice doctor --json
adv voice preview --list --json
adv voice preview --voice guide-reference-v1 --list --json
adv voice samples --json
```

这些读取不安装环境、不下载媒体／模型、不合成。`samples` 复用原生 `type: audio`／`kind: voice` 条目，支持 `includes`、`cachePath` 与项目 profile 路径。播放或选用才读取缓存并验证大小／哈希；不会临时访问远程 URL。资源下载和缓存准备由项目原有媒体流程负责；本模块不安装通用下载器。支持 WAV、MP3、Ogg 短句，每份本地样本不超过 20 MiB。

本地 Editor 的人物详情提供“人物音色与短句试听”：打开候选，手动播放，显式选用。关闭、切换人物／项目、切换供应商／音色版本／候选或卸载组件会中断读取并释放音频 URL。浏览器目录工作区尚未接入本地语音服务；生成仍通过作者 CLI。

```bash
adv voice select --voice guide-reference-v1 --asset guide-sample-v1 \
  --expected-revision <samples返回的库SHA-256> --json
```

选择只写库中当前音色版本的 `selectedSample: { assetId, sha256 }`，不改人物卡、参考资源、音频、资源清单或剧本。保留未知作者字段，以完整库版本拒绝过期写入，拒绝不同人物、损坏、被拒绝或越界的音频。替换已有选用须显式 `--replace-selected` 或在界面勾选。此选择是试听审核记录，不代表正式采用人物音色，更不代表已经绑定对白。

已有背景图片的 `assets ingest|accept` 继续只处理背景图。短句审核可以选用已按原生媒体流程登记的样本；逐句 `generate` 使用共享配音服务登记候选。模型插件负责生成，主机负责项目写入，上传由存储服务处理。

旧 CLI 候选也可以手工登记：试听后将选中的 WAV 复制到项目持久素材目录，按[资源目录协议](/guide/assets/catalog)在唯一 `adv/assets.json` 根或其分片中添加 `type: audio`、`kind: voice` 条目。填写稳定 `id`、对应 `characterId`、本地 profile 相对 `path`，并从生成 receipt 复用真实 `sha256`、`bytes`、`mimeType`，把 `durationSeconds` 填到资产的 `duration`（秒）。另记录许可与生成来源；不要用示例哈希代替实际数据。下述两端音色设计界面通过共享原生事务完成登记，不需要手工复制候选。

`.advjs/voice/previews/` 是忽略提交的作者候选目录，不能作为永久发布资源目录。登记后运行 `adv voice samples --json`，通过本地 Editor 试听，再显式 `select`。`selectedSample` 仅记录音色短句审核，逐句配音使用独立的 `selectedTake`。

## 两端音色设计

本地 Editor 的音频面板和 Studio 音频页提供「音色设计」。Editor 通过项目 bridge、Studio 通过已认证音频服务使用同一个 `VoiceDesignPort`；模型、revision、权重位置与供应商凭证仍由可信宿主控制。没有可用服务或设计预设时，界面显示不可用状态，不在浏览器安装模型或猜测供应商能力。

1. 新建音色，选择角色或旁白，填写名称、版本和意图：说话风格、年龄印象、性别表达、气质、音高与语速。
2. 按精确语言添加供应商实现，选择宿主提供的预设与来源。系统音色使用真实内置目录；描述设计需要声音描述；授权参考需要已登记 `kind: reference` 的音频、其真实哈希、参考模式和项目内同意文件。`icl` 还必须填写参考文本。
3. 保存不可变设计版本。修改已保存设计时「复制为新版本」，新版本取得新 ID，并以 `supersedes` 关联旧版本；不会沿用旧身份覆盖其输入。
4. 选择试听语言、供应商、文本和字符预算，创建审核计划。费用无法估算时先明确允许未知费用；确认计划后才调用插件。未登记候选可以直接试听，主机和界面均验证真实媒体字节与哈希。
5. 分别执行「登记为音色样本」「审核并选用样本」「应用已审核音色」。登记只添加原生音频和库中样本；选用只记录当前语言／供应商的审核选择；应用写回角色 `voiceProfile` 或项目旁白 Profile。替换已有选择或绑定须明确确认。

意图是供应商无关的作者数据，不承诺各模型生成相同听感。当前 Qwen MLX 适配器根据可信模板支持 VoiceDesign 描述设计或 Base 参考条件；OpenAI 开放内置音色及模型支持的指令，不开放声音创建或克隆。参考条件和描述条件用于每次合成，不冒充永久供应商音色。

设计保存在唯一 `authoring/voices/library.json` 的 `design` 中；其 `locales`、样本来源和 `selectedSamples` 按精确语言／供应商隔离。宿主生成 `authoring/voices/designs/` 下的 JSON 预设并记录完整 SHA-256。应用后的绑定保留实际 `voiceId`，同时记录 `projectVoiceId` 和 `projectVoiceVersion`；已有配音任务可以按该语言自动解析对应设计预设。其他语言／供应商、旧样本和对白 take 保留，旧 take 由原有 fingerprint 检查报告过期。

候选、审核计划与执行状态保存在项目外私有宿主状态中，项目导出只包含原生作者文件与已登记媒体。相同设计、语言、供应商、文本及预设输入复用已有执行；关闭界面、断网或重启后先查询状态。无法确认供应商结果时保持 `unknown`，新建同输入的审核计划也不会重复调用。供应商没有查询能力时仍需人工核对其结果，主机不保证供应商侧退款或远程去重。

Studio 把服务返回的有限文件变更按原始字节 CAS 写入自己的文件系统，并保留相同音色／资源 ID；不同实现中的 JSON 排版不会成为覆盖冲突的理由。切换账号、项目或离开页面时终止媒体读取和播放，回到页面仅恢复查询。

宿主升级可信模板时，已经认可的旧版本继续保留其原始预设字节与哈希，新版本才使用当前模板派生。同步不能改写旧版本的预设字节，也不能借同意文件路径覆盖宿主模型模板。普通标准项目构建与发布清单构建都排除未选样本和参考素材，不会因媒体位于 `public/` 而自动公开。

## 对白 take 与多语言绑定

剧本为需要配音的对白或旁白保存稳定的 UUIDv7 行 ID。它必须位于该节点最后一个物理行的末尾，解析后从展示文本移除。移动对白保留 ID，复制对白创建新 ID；同一项目中的重复 ID 会报错。Flow 使用相同的 `lineId`。

```md
@guide
欢迎回来。 {#line_019b1ca0-0000-7000-8000-000000000001}
```

项目须先有原生 `adv/assets.json`；作者服务允许合法的空资源数组来登记第一条音频。默认本地 profile 的 `root` 指向持久素材目录，例如 `public`。对白账本保存为 `adv/audio/voice-ledger.json`，音频仍只在同一资产目录登记；分片目录将新 take 加入 `adv/assets/audio.json`。

```bash
adv voice takes --json

# 替换 expected-revision 占位符为上一步 data.revision。
# OpenAI 会发起收费请求；Qwen 在在线模式下可能下载已固定版本的模型。
adv voice generate --line line_019b1ca0-0000-7000-8000-000000000001 \
  --locale zh-CN --speaker guide --text '欢迎回来。' \
  --provider openai-tts --preset openai \
  --expected-revision <takes返回的revision> --json

# 先试听生成文件，再用 generate 返回的 take ID 和最新 revision 绑定。
adv voice bind --line line_019b1ca0-0000-7000-8000-000000000001 \
  --locale zh-CN --take <生成的takeId> \
  --expected-revision <generate返回的revision> --json
```

`generate` 每次登记新 take，保留全部旧 take，不自动替换选中项。已有账本行可省略 `--speaker` 与 `--text`；`--voice` 复用作者音色档案及其预设路由。替换已有选中 take 须加 `--replace-selected`。生成之前、生成期间及落盘时均检查输入版本，发生冲突须重新读取和审核，不自动重试收费请求。

locale 采用规范 BCP 47，例如 `zh-CN`、`ja-JP`。同一行的各语言保存独立的展示／朗读文本、take 与 `selectedTake`；生成日语不会覆盖中文来源文本或选用。播放器只查当前 locale，缺失配音时静音并继续剧情，不回退播放另一语言。账本固化实际 Provider voice、模型及修订、作者音色 revision、生成参数、内容哈希和输入 fingerprint。已选资产哈希不匹配会报错；文本或音色变化只产生 stale 诊断，旧 take 仍保留，等待作者重生成与审核。

`speakerId` 使用原生角色 ID；旁白使用 `narrator`。角色表单保存 `.character.md` 的 `voiceProfile`，旁白在 `adv/audio/voice-profiles.json` 配置同一结构，无需创建角色卡。两端音频页编辑 `adv/audio/pronunciation.json` 的全局／精确语言字面替换；显式 `spokenText` 优先于词典。词典和音色变化使旧 take 过期，保留已选项等待审核。格式与优先级见[音频指南](/guide/audio#发音词典与旁白音色)。运行期变量没有有限预生成形式时，不自动猜测朗读内容。展示文本和朗读文本分开保存。

## Editor 与 Studio 共享服务

`@advjs/audio` 的 `createVoiceAuthoringService` 和 `createProjectAudioService` 统一生成候选、登记 take、选择与清除绑定的协议。宿主提供项目读取、版本检查、媒体验证和事务提交；Editor 的 `ProjectWorkspace` 与 Studio 文件系统适配器写入相同的项目 JSON。平台中立服务不导入供应商 SDK，不维护第二份 TTS 注册表。

Node 主机可通过 `advjs` 导出的 `runVoiceLedger`、`runVoiceGenerateTake` 与 `runVoiceBindTake` 调用相同协议。可信 transport 调用 Node `runVoicePreview` 的既有 Provider 路由；浏览器主机不能加载本地 Python。Editor 音频面板与 Studio 音频页已接入多语言 take 审核、试听、显式替换及清除绑定；Studio 可以在本机页面显式配对[本地 Qwen 服务](/guide/studio/audio-service#连接本地-qwen)，无需云账号，也可以复用已部署音频服务的登录会话。没有连接服务或可信 transport 时禁用生成，已有 take 仍可管理。两端真实页面验收见[实现报告](/reports/2026-10-11-audio-runtime-implementation)。

本地 Editor 的生成任务使用已认证的项目 bridge 和默认作者预设，整章／缺失／过期计划在审核预算后入队，运行仍须显式操作。Studio 使用同一计划和执行协议，私有 IndexedDB 按账号、项目隔离离线任务；联网只恢复状态。可信服务必须提供只读预设检查，冻结实际模型、音色、参数与哈希，才能执行新生成。详细恢复边界见[持久任务与恢复](/guide/audio#持久任务与恢复)。

Qwen 的新设计版本按 locale 选择实际模型语言，不支持的语言在执行前拒绝。VoiceDesign 将非空的结构化音色偏好按固定顺序添加到原始描述中，参与预设哈希与生成指纹；Base 使用已审核参考条件。旧不可变预设保留原始字节，不因插件升级被重写。这些偏好仍需实际试听，不能当作精确的音高或语速承诺。

参考条件生成固化 `source: cloned`，必须在下载模型或调用合成前提供许可、权利主体和项目内的同意记录。原生导入的 `kind: reference` 可以尚未分配角色；填写 `characterId` 时必须匹配当前人物。媒体哈希、参考格式和已有授权仍须检查。Node 项目快照按角色／旁白 Profile 与账本里的明确引用读取 `.json`、`.md`、`.txt` 授权文档，每份最多 64 KiB，不扫描整个私有作者目录；这些文档不进入播放器。以下示例用于已配置 Qwen reference 预设的可信 Node 主机；`authoring/consent/guide.json` 须为已存在的真实授权记录。

```ts
import { runVoiceGenerateTake, runVoiceLedger } from 'advjs'

const snapshot = await runVoiceLedger({ root: projectRoot })
const generated = await runVoiceGenerateTake({
  root: projectRoot,
  provider: 'qwen-tts',
  preset: 'reference',
  lineId: 'line_019b1ca0-0000-7000-8000-000000000001',
  locale: 'zh-CN',
  speakerId: 'guide',
  displayText: '欢迎回来，ADV.JS 作者。',
  spokenText: '欢迎回来，冒险引擎作者。',
  expectedRevision: snapshot.revision,
  source: 'cloned',
  rights: {
    license: 'project-voice-license',
    subject: '向导配音授权主体',
    consentRecord: 'authoring/consent/guide.json',
  },
  offline: true,
})

// generated 中的新 take 尚未选中；试听后再显式调用 runVoiceBindTake。
```

这个接口不会生成或伪造同意记录；VoiceDesign 使用 `source: designed`。Qwen 的实际 conditioning 身份是参考资产与 SHA-256，或描述内容的 SHA-256，分别以 `reference:`、`design:` 前缀记录；项目档案 ID 与供应商声音身份保持分离。

## 后续阶段

1. 已实现基础：多 provider 协议、稳定作者音色、本地短句审核、逐句不可变 take 与显式对白绑定。运行时配置移除整个 `authoring`；Python、模型、作者档案与供应商函数不进入玩家配置。
2. 阶段二：当前已提供 OpenAI 统一适配器与无付费契约测试；MiniMax 官方合成／音色创建能力仍需独立核对和插件实现。真实云端请求与声音质量需另行验证。区分费用估算与实际用量，不静默重试收费请求。
3. 本地作者工作流已接入：持久任务计划与 Runner、整章／缺失／过期 UI、字符／费用预算、fingerprint 媒体验证、30 天幂等恢复、本地应用数据 Store 和 Studio 私有离线队列。非破坏式转码、Studio 认证服务与原生同步、持久后台发布准备和真实 COS SDK 上传已接入；实际云端部署、真实模型质量和 STS 环境须另外验收。供应商未提供查询接口时，未知请求仍不能直接重试。

本次只核对 OpenAI 官方协议；没有联网核对新的 MiniMax 能力，也没有声明其接入完成。

## 验证

在仓库运行无网络合成的契约与隔离测试：

```bash
pnpm vitest run tests/unit/voice plugins/plugin-openai/tests/voice.test.ts plugins/plugin-qwen-tts/tests
pnpm vitest run tests/unit/audio/voice-ledger.test.ts tests/unit/audio/node-voice-authoring.test.ts
pnpm --filter @advjs/plugin-openai build
pnpm --filter @advjs/plugin-qwen-tts build
```

项目中先执行 `providers` 和 `preview --list`，确认 Provider、预设和人物，再显式生成。`preview` 只生成候选 WAV 与 manifest；`generate` 登记未选 take，`bind` 才选中对白配音。生成不自动上传，项目构建不调用 TTS。

CLI 的 `generate --spoken-text` 可提供含变量台词的确定朗读文本。Qwen 参考条件的正式 take 使用 `--voice-source cloned --license LICENSE --subject SUBJECT --consent-record authoring/rights/consent.json`；三项权利字段必须一起提供，且同意记录必须为项目内存在的文件。它们用于记录已有授权，不会由插件自动创建或授予许可。VoiceDesign 来源使用 `designed`，供应商内置音色使用 `system`。

### 仓库真实 Qwen 验收

Apple Silicon Mac 可显式运行真实模型验收。先安装仓库依赖并构建共享包、插件和两个工作区。准备命令创建独立、持久的测试项目，安装插件锁定的 Python／MLX 依赖，下载固定 VoiceDesign／Base revision 并验证权重 SHA-256；初次准备需要联网和模型磁盘空间。普通单测、构建、`doctor` 与打开工作区不会触发此流程。

```bash
pnpm build:advjs
pnpm --filter @advjs/plugin-qwen-tts build
pnpm editor:build
VITE_LEGACY_BUILD=false pnpm studio:build
pnpm e2e:qwen:prepare
pnpm e2e:qwen:editor
pnpm e2e:qwen:studio
```

两端使用同一准备项目与模型缓存，必须按顺序运行。可在三个命令前一致设置 `ADVJS_REAL_QWEN_ROOT` 指定绝对测试项目路径；不要指向自己的游戏项目。UI fixture 会重建测试作者数据，但保留 `.advjs/voice/` 内的环境、模型与准备收据。准备完成后，UI 合成使用本地缓存，缓存缺失或哈希不符直接失败。

此流程复用真正的 `createQwenTtsProvider()`，覆盖描述设计、原创合成样本的 Base 参考条件、对白任务、显式选用和 JSON Flow 构建播放。参考来源记录明确标识本轮原创合成音频，不冒充真人配音授权。验收保存实际音频哈希、时长、生成 provenance、播放器声音输出及原生项目导出证据；具体通过结果以[实现报告](/reports/2026-10-11-audio-runtime-implementation)为准。Python、模型缓存、未选音色样本及参考授权不进入播放器。
