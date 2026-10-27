# 作者语音模块

ADV.JS 内置通用作者协议、CLI、逐句配音账本与两端音色设计、配音审核界面，供应商按需安装。Qwen MLX 与 OpenAI TTS 复用同一个供应商注册入口；Editor、Studio 与 CLI 使用相同的 take、资源与版本检查协议。当前支持版本化音色设计、未登记候选试听、显式角色应用、单句和整章任务、缺失／过期筛选及显式对白绑定；Studio 认证服务与原生同步、后台转码和 COS SDK 发布已接入，真实云环境须独立验收。完整音乐、环境音、音效与配音管理的状态见[音频创作与 AI 配音](/guide/audio)。

不额外要求安装 `@advjs/plugin-tts`。将来需要独立发布维护时可拆为 `@advjs/voice`：范围包含音色身份、试听与选用，不只处理文本转语音。此包名目前是维护规划，尚无新包或 npm 发布。

## 从角色音色到游戏播放

在同一项目中依次完成四步。Editor 使用人物页与音频工作区，Studio 使用角色编辑与音频页；两端保存相同的原生 Profile、资源目录和对白账本。先连接已有本地 Qwen 服务或可信作者宿主，再执行生成；只有本机目录而没有执行服务时，仍可管理和试听已有配音。

1. **角色音色**：打开「音色设计」，选择当前角色与精确语言。保存设计版本，试听候选，再分别登记样本、审核选用并显式应用到角色。已有角色音色需要确认替换；应用结果记录在角色 `voiceProfile`。旁白使用项目旁白 Profile。
2. **对白生成**：转到该角色的配音任务，选择当前剧本中的稳定台词，核对语言、供应商、字符预算和计划，再明确执行。任务使用已应用 Profile 的真实预设，输出保留为未选 take；没有配音的其他角色不应被误加到当前角色的任务中。
3. **试听选用**：进入「对白配音」／「配音审核」，试听当前台词的实际音频，同文本候选可 A/B 对比，再显式绑定所选 take。替换已有配音与采用过期 take 分别确认。播放、比较或评分不会替作者选用。
4. **游戏播放**：保存项目后打开游戏预览，推进到这句台词；正式导出使用同一个原生项目的普通构建。玩家按当前语言读取 `selectedTake`，播放其 asset ID 对应的已验证音频。未选对白不播放，缺少当前语言的配音不会借用其他语言；推进剧情停止上一句。

音色样本和对白配音有不同用途：旧人物短句面板的 `selectedSample` 只表示样本已审核；新版设计的 `selectedSamples` 也不等于角色已应用或台词已绑定。确认角色 `voiceProfile` 后才能据此生成对白，确认对白 `selectedTake` 后才进入玩家。旧短句记录继续保留，不自动推断语言、模型或声音绑定。

重载项目后核对角色的音色版本、对白的选中 take 和语言仍一致，并在预览中实际听到该句。换音色、改台词或词典后先检查过期提示，再重新生成／试听审核；历史音频保留，不能把旧 take 的指纹改成新输入。完整匿名评分只在需要研究或质量复查时打开。

这条流程沿用 [#51 的人物音色基础](https://github.com/YunYouJun/advjs/pull/51)与[配音实施计划](/plans/2026-08-12-audio-system-implementation)。[#18](https://github.com/YunYouJun/advjs/issues/18) 中的音乐需求独立推进：用户自创或借助 AI 创作后的文件导入与使用见[音乐创作指南](/guide/authoring-music)，后续自动生成适配器见[独立任务计划](/plans/2026-10-12-ai-background-music-generation)。

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

这是通用模型接入协议，现有 `@advjs/plugin-qwen-tts`、`@advjs/plugin-openai/voice` 和 `@advjs/plugin-breeze-tts` 各自适配后端。新增模型提供适配器后即可复用创作界面、候选审核、对白任务和素材登记；模型的参数、参考模式及传输协议仍由适配器处理，不能把任意模型 URL 当作已兼容。`designSources` 声明内置、描述或参考来源，`referenceModes` 可声明支持的参考模式，Editor 据此显示选项；未声明时保留既有适配器的界面行为。

适配器负责模型／后端能力、文本长度、模式和种子。Qwen 继续使用 500 字上限、seed 42 与 Base 的 `icl|embedding-only`，这些要求不施加给新云端适配器。旧 `AdvVoiceProvider` 的兼容路径保留历史限制，待各旧插件迁移后再移除。供应商扩展参数仍由预设与适配器校验，不静默忽略不支持的模式。

合成保留适配器生成记录；供应商提供原始 manifest 时一并保留。统一候选包含人物、文本、provider、模型／修订、项目相对文件、MIME、采样率、时长、大小、哈希及可选音色版本。通用服务复核文件、人物和文本，计算输入指纹；预设在执行期间变化或任务取消后，不报告成功。`preview` 只生成候选，`generate` 则通过共享事务服务把候选复制到持久素材目录，并登记一个尚未选中的对白 take。

`candidate.voiceId` 与 `voiceVersion` 是项目作者档案的身份和版本；`providerVoiceId` 记录供应商实际使用的音色，例如 OpenAI 的 `echo`。适配器不能将项目音色 ID 直接传给供应商 API。

## Breeze 本地插件

`@advjs/plugin-breeze-tts` 通过本机 Xinference 中已加载的 `Breeze-TTS-2` 接入同一供应商协议。它复用音色设计、候选试听、样本选用、角色应用与对白审核界面；没有额外的工作台前端。当前接入描述设计与参考克隆，支持中文区域，情绪写在「说话风格」或音色描述中，年龄印象、性别表达、气质、音高与语速一并转换成模型指令。

在工作区构建并链接插件，将供应商追加到现有 `authoring.voice.providers`，配置 `presetProviders: { breeze: 'breeze-tts' }` 和项目内的 Breeze JSON 预设。默认本地地址为 `http://127.0.0.1:9997`，模型 UID 为 `breeze-bf16`，可通过可信 Node 工厂选项修改。预设默认 seed 为 `42`、CFG 为 `4`，每句上限为 500 字。模型环境和权重由本地服务管理，插件不隐式安装或下载。

克隆时先在「音频资源」按「声音参考 · Reference」导入录音，再在「音色设计」选择「授权参考音色」，填写准确逐字稿和项目内的声音授权记录。Breeze 只显示「参考音频与文本」模式，保存后沿用审核、生成试听和角色应用流程。输入必须是已登记的原生参考素材，实际字节、哈希和角色归属会在调用前后核对；不会隐式建立供应商永久音色。

完整配置、界面操作、候选记录与限制见[插件说明](https://github.com/YunYouJun/advjs/blob/main/plugins/plugin-breeze-tts/README.md)。模型注册修订不被当作实际加载权重的修订。真实 Editor 验收通过独立的 `tests/fixtures/audio/editor-real-breeze.playwright.config.ts` 显式运行，普通测试不调用模型。

### 逐字高亮与已有配音

供应商可声明 `alignment` 能力并提供 `align`，返回绑定准确文本、音频 SHA-256 和时长的 `VoiceAlignment`。中文按字、英文可按词；索引采用 JavaScript UTF-16，时间以音频秒数表示。时间轴随候选登记到音色样本或对白 take，原有音频无需重新合成。

Breeze 可复用已安装的 MLX-Audio 环境和本地 Qwen3-ForcedAligner。工厂选项 `alignment: { python, modelPath, revision }` 指定可信解释器、已下载权重和修订，执行时强制离线。界面在音色候选、样本和对白试听中跟随实际 `audio.currentTime`；玩家对白复用 `PrintWords` 和实际播放后端时钟。暂停保持当前位置，定位更新高亮，切句和停止清除。真实停顿不突出任何字，不按总时长平分。

已有对白 take 可在「音频 → 对白配音」点击「生成逐字时间轴」。宿主重新核对媒体和账本修订，只写对齐元数据；台词或音频变化会拒绝提交。没有对齐数据、对齐失败或显示文字与口语文本不一致时仍可正常播放，玩家不显示失配高亮。模型对齐时间存在误差，应在试听中核对。

候选、已登记样本和对白账本复用统一播放器，提供播放／暂停、前后 5 秒、音量与倍速；进度条支持拖动及键盘 Home／End。所有定位和高亮读取同一个音频时钟。已登记样本不会再重复显示候选正文。若模型给出零时长的字，保留其余有效时间戳，界面显示未定位字数；这些字跳过高亮，不按总时长估算位置。

### 停用、卸载与可选清理

本地 Editor 的「音频 → 供应商与清理」复用供应商注册和审核计划，分别选择缓存、运行环境和模型权重，默认均不选。参考录音、已完成配音、音色库和对白账本保留。共享资源须单独确认影响；受管理服务仍运行时，先停止服务并刷新，再预览清单。审核后执行会重查资源身份和占用状态，拒绝过期或发生变化的计划。

只有可信 Node 宿主通过 `installation` 登记、且与安装目录 `.advjs-voice-installation.json` 一致的资源可自动清理；浏览器只提交资源 ID，不能传任意路径。登记须包含 `root`、安装 `id`、`resources`、`protectedPaths` 和可靠的 `isRunning`，可提供 `stop` 复用已有服务管理工具。资源不得重叠或覆盖保护目录，符号链接不被递归跟随。未登记的外部目录由其管理工具处理。

确认后供应商在此项目停用，新生成被拒绝；已有配音继续可用，可重新启用保留完整依赖的供应商。此操作不自动改写可执行项目配置或运行包管理器：从 `authoring.voice.providers` 移除配置后，按审核清单中的 `pnpm remove` 命令卸载插件包。若已清理环境或模型，重新启用前须自行恢复相应资源。

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

本地 Editor 的生成任务使用已认证的项目 bridge 和默认作者预设。在「音频 → 配音任务」选择全部章节或某一章节、准确语言、合成插件，以及全部台词／仅缺失／仅过期，再勾选多句或全选当前范围。角色工作流入口只列出当前角色台词；列表分页不影响全选。缺失指该语言尚未选用对白 take，过期指已选 take 的输入指纹与宿主实际检查的当前文本、词典、音色、模型或预设参数不同。审核计划会显示最终匹配和跳过数量，不能仅凭浏览器推测的状态开始生成。

单个计划最多 5000 句，审核的是整个计划的总字符预算。入队后显式开始，宿主按每批最多 200 句自动依次推进，继续复用同一任务的并发限制、缓存、幂等记录和预算预留；不需要逐批重新入队。当前批次全部登记后才开始下一批，失败、未知结果、取消或阻断会保留后续排队项。已知失败可以显式重试后继续；未知供应商结果必须先核对，不能重新计费。重新打开后沿用持久任务恢复，不重建另一份批次队列。生成结果仍为未选 take，不会覆盖已选配音；超过单次上限时按章节缩小范围，界面不会截断全选。

任务恢复空间会在入队和调用模型前检查，并为尚未完成的生成保留回执空间。容量不足时先处理其他排队任务或缩小范围，旧配音继续保留。已完成的逐字时间轴保存在原生配音账本，任务恢复记录不重复保存；跨行复用相同输入和音频时会恢复对应时间轴。

Studio 已提供章节、角色及整章／缺失／过期筛选，复用同一指纹筛选规则、计划和执行协议；Editor 的 200 句窗口由其可信宿主配置，不改变其他宿主的默认执行行为。Studio 私有 IndexedDB 按账号、项目隔离离线任务，联网只恢复状态。可信服务必须提供只读预设检查，冻结实际模型、音色、参数与哈希，才能执行新生成。详细恢复边界见[持久任务与恢复](/guide/audio#持久任务与恢复)。

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

## 真人试听与变更复审

Editor 和 Studio 都能试听未登记候选与已登记音色样本，并展示实际生成文本。Editor 的「试听已登记样本」从原生工作区读取媒体，核验字节数和 SHA-256，再交给播放器；临时候选已清理也不影响这项试听。试听不调用模型，不自动选用样本、应用 Profile 或绑定对白。播放器支持暂停、重听和定位，离开面板会停止试听。

两端对白审核共用 `resolveVoiceReviewRows`，以当前编译得到的 Markdown／JSON Flow 行 ID、语言、发音词典和角色／旁白 Profile 检查每条 take。剧情源语言使用当前剧本文本；其他精确语言使用账本中的翻译。显式 `spokenText` 优先，不随词典改变。未设置显式读法时，词典内容版本参与检查，即使替换结果恰好相同，词典版本变化也要求复审。文本、说话角色或音色配置变化，以及行已从当前剧情删除，都会显示过期状态。无法解析当前剧情时不会把历史声音判定为当前有效配音。

「已选」表示当前 `selectedTake`，与声音是否过期、是否通过人工听审分开。过期不会改写音频、清除当前选择或删除历史；作者可以试听旧 take 后显式替换，也可以生成新的未选 take 再审核。媒体缺失、被拒绝或目录哈希不符显示不可用；实际试听和选用还会检查媒体字节，损坏音频不能通过改选择获得认可。

### 工作区试听、A/B 与显式采用

Editor 的音频工作区「对白配音」与 Studio 音频页「配音审核」提供日常试听。先选择对白和精确语言，再选择已有 take；A/B 只能比较同一对白、语言、角色和实际朗读文本的可用候选。历史台词与当前台词不同的 take 仍可单独试听，不能因同属一个角色就当成同文本 A/B。

两端在播放前核验实际媒体 SHA；候选 A/B 共用一个播放器。切换对白、语言、候选、工作区或项目会停止旧试听；迟到读取不会重新播出。暂停、重听和定位只是试听操作，不选用声音、不调用 TTS，也不上传素材。

采用使用原生 `selectedTake` 与 revision／CAS。替换当前配音需要明确确认；过期候选还须确认已经复核当前文本与声音配置。已采用的旧 take 可以明确继续保留，但复审不会重写其生成指纹或消除客观过期状态。再次修改台词、词典或 Profile 后需重新确认。完整生成记录与权利信息保留在折叠详情中。

### 按需高级听审

需要评估新音色、模型或发布前质量时，打开工作区内的「高级听审」。模块按需加载，不需要独立的 `8769` 服务。可以选择当前同文本组或整个项目中的 2–32 个可用 take，按匿名样本逐项填写自然度、清晰度、文本准确性、风格符合度、首尾完整性和参考一致性。跨文本／语言的样本分组评估，不能直接当成同一个 A/B。

评分使用 1–5 分、不适用或待评；没有可信风格／参考依据时注明原因并选不适用，不把另一个候选假定为生成参考。记录设备、输出方式、系统音量和语言，以原始 1× 速度完整播放后再确认本人听审。实际媒体时长、至少 95% 连续播放覆盖和播放结束参与完成检查，跳播或较短的作者时长字段不能代替完整聆听。

两端使用 `@advjs/audio` 的共享项目听审 JSON：`advjs-private-voice-listening-session`。文件绑定原生项目 ID、take、asset、SHA 和实际朗读文本，可在同一项目的 Editor／Studio 间恢复。恢复保留评分与备注，并重新校验当前候选；旧播放证明和本人声明清空。错误项目、变化的媒体身份或不可用来源不能恢复为有效听审。

草稿保存在本机作者范围，退出或隐藏高级界面保留草稿并停止试听；导出 JSON 可在换浏览器或设备时手动恢复。草稿与评分不写入项目语音账本，不进入原生项目导出或玩家构建，也不自动采用配音。个人听审与模拟测试的 `standardMOS` 均保持 `null`。

### 准备匿名试听评分包

仓库提供独立、本机使用的听审工具。它读取已有 Editor／Studio 真实验收产物中的八份 WAV 和对应 provider manifest，不生成声音、不转码、不裁剪、不改变响度，也不发起云请求。输入须包含两端各自的 `design-audition`、`design-dialogue`、`base-audition`、`base-dialogue` 音频及同名 manifest；Base 的参考 SHA 和文本必须对应本端原始设计试听。输出目录必须为新的绝对路径，已有包不会被覆盖。

这是离线交接工具，保留原 `advjs-human-listening-review` 八段便携包协议；它与上述含项目身份的私有草稿有不同用途，不能直接混用。独立服务手动启动，停止进程后本机 URL 失效；保留的 ZIP 仍可离线打开，或按下方命令再次启动服务。

以下路径对应本机已完成验收的缓存；使用其他验收目录时替换两个变量。

```bash
LISTENING_EVIDENCE_ROOT="$HOME/Library/Caches/ADV.JS/local-qwen-cos-20261012/evidence"
LISTENING_PACKAGE_ROOT="$HOME/Library/Caches/ADV.JS/audio-quality-devices-20261012/listening-review"

node scripts/audio-listening-review.mjs --help
node scripts/audio-listening-review.mjs prepare \
  --evidence-root "$LISTENING_EVIDENCE_ROOT" \
  --output "$LISTENING_PACKAGE_ROOT"
node scripts/audio-listening-review.mjs serve \
  --package "$LISTENING_PACKAGE_ROOT" --port 8769
```

打开命令输出的本机 URL。服务只监听 `127.0.0.1`，只提供 HTML、公开 manifest 和八份匿名样本的 GET／HEAD／Range 读取；不提供写接口，也不提供揭盲文件、ZIP 或任意目录。`portable-listening.zip` 可复制后离线打开，保留包内目录结构。八项随机编号为 `S01`–`S08`，复制后逐字节核验 SHA；`archive-index.json` 记录文件哈希，`private-audit-map.json` 保存原始来源和匿名编号关系，应由组织听审的人保管，完成评分后再揭盲。

四组 A/B 各自对应同角色、同文本的设计／参考条件结果。Editor 和 Studio 的角色设计输入可能不同，不要求两组角色具有相同音色。匿名参考既标明真实 conditioning 来源，也区分仅供听感比对的样本；自然度可先盲听，再展开风格目标进行风格符合度评价。

### 人工填写与核验

听者记录设备、输出方式、系统音量、语言和环境，保持同一设备与音量，以原始 1× 速度听完各片段。随后填写自然度、清晰度、文本准确性、风格符合度、首尾完整性和参考一致性；没有依据时选择不适用或保留待评。八项共 48 个评分初始均为 `null`，页面不会自动填入听感或评分。

完成状态要求本人确认、必要环境信息、每项完整播放结束及至少 95% 的有效播放覆盖，并填写全部维度。导出 JSON 可保存部分草稿；恢复草稿会保留评分与备注，但清空播放记录和本人确认，需要重新实际试听。将下一条命令的 review 路径替换为浏览器导出的文件，在另一个终端核验：

```bash
node scripts/audio-listening-review.mjs validate-review \
  --package "$LISTENING_PACKAGE_ROOT" \
  --review /absolute/path/my-listening-review.json
```

核验同时检查匿名包版本、样本 SHA、评分范围、播放覆盖与状态。JSON 契约位于仓库 `scripts/audio-listening-review.schema.json`。自动化页面测试与模拟评分必须标记为 `simulation`，不计入真人听审或 MOS。个人主观听审也不会自动变成标准 MOS：`standardMOS` 保持 `null`，正式 MOS 仍需明确的人类研究设计和统计。模型成功返回、波形非静音或浏览器能播放均不能代替真人的声音质量判断。

## 后续阶段

1. 已实现基础：多 provider 协议、稳定作者音色、本地短句审核、逐句不可变 take 与显式对白绑定。运行时配置移除整个 `authoring`；Python、模型、作者档案与供应商函数不进入玩家配置。
2. 阶段二：当前已提供 OpenAI 统一适配器与无付费契约测试；MiniMax 官方合成／音色创建能力仍需独立核对和插件实现。真实云端请求与声音质量需另行验证。区分费用估算与实际用量，不静默重试收费请求。
3. 本地作者工作流已接入：持久任务计划与 Runner、Editor 与 Studio 章节／缺失／过期筛选、Editor 全范围选择及自动分批、字符／费用预算、fingerprint 媒体验证、30 天幂等恢复、本地应用数据 Store 和 Studio 私有离线队列。Editor 单个计划最多 5000 句，按 200 句窗口推进并保持整个计划的预算与恢复记录。非破坏式转码、Studio 认证服务与原生同步、持久后台发布准备和真实 COS SDK 上传已接入；实际云端部署、真实模型质量和 STS 环境须另外验收。供应商未提供查询接口时，未知请求仍不能直接重试。

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
