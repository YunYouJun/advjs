# @advjs/plugin-qwen-tts

ADV.JS 的可选本地配音插件。它提供作者侧的 Qwen3-TTS 预览服务，将 Python 环境、模型缓存、生成记录和 WAV 存在当前项目的 `.advjs/voice/`。当前后端使用 MLX，仅支持 Apple Silicon Mac。

人物、台词、参考片段及模型版本由项目的 JSON 预设提供。插件产出候选，不自动上传或选中对白配音；共享作者服务负责显式登记和绑定。Python、模型与插件均不进入播放器。

## 接入项目

```ts
import { createQwenTtsProvider } from '@advjs/plugin-qwen-tts'
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  authoring: {
    voice: {
      provider: createQwenTtsProvider(),
      presets: {
        reference: 'authoring/voices/reference.json',
      },
      defaultPreset: 'reference',
      defaultReferenceMode: 'embedding-only',
      assetManifest: 'adv/assets.json',
    },
  },
})
```

```bash
adv voice doctor
adv voice setup
adv voice preview --list
adv voice preview --character guide
adv voice preview --character guide --offline
adv voice preview --character guide --text '欢迎回来。' --offline
adv voice preview --reference-mode icl --offline
```

先安装 [uv](https://docs.astral.sh/uv/getting-started/installation/)。`setup` 显式创建 Python 3.12 环境并安装随包锁定的依赖，不下载模型；已有环境会检查实际依赖版本，缺包或版本错误时重新安装并核验，成功后才保存准备标记。健康环境直接复用。`doctor` 只检查环境；`--list` 读取预设，不加载 Python 或模型。预览要求环境已经准备好，`--offline` 仅使用本地模型缓存；缓存不足时直接失败。

首次在线预览可下载预设指定的模型。模型必须固定到完整提交哈希，并提供权重 SHA-256；每次生成前校验文件，避免缓存损坏或意外换版本。BF16 1.7B 模型及音频 tokenizer 合计约 4.5 GB，实际内存取决于参考和台词长度，宜预留 16 GB 以上统一内存。模型源：[Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)、[MLX Audio](https://github.com/Blaizzy/mlx-audio)。

因此插件支持在本机自动下载固定版本的模型并本地生成，但作者必须先配置模型预设、显式执行 `setup`，再启动一次在线生成。它不会在安装包、导入工厂、打开 Editor／Studio、`doctor` 或 `--list` 时自动装环境或下载权重，也不会自动选择模型或补写 revision／权重哈希。当前没有跨平台 GPU 后端；Intel Mac、Windows、Linux 不支持这个 MLX 实现。

仓库的 `pnpm e2e:qwen:prepare` 提供显式真实验收准备：在独立测试项目安装固定环境，配置已经锁定的 VoiceDesign／Base 模型，下载并逐文件校验，再用原创合成参考生成真实样本。`pnpm e2e:qwen:editor` 与 `pnpm e2e:qwen:studio` 按顺序使用同一缓存验收真实 UI／HTTP／Flow 播放；普通 CI 不运行模型。构建前置条件、测试目录与来源记录见[真实 Qwen 验收](../../docs/guide/authoring-voice.md#仓库真实-qwen-验收)，实际结果统一记录在[实现报告](../../docs/reports/2026-10-11-audio-runtime-implementation.md)。

## 项目预设

预设包含 `version`、`model`、`revision`、`weightSha256` 和 `characters`。可设置 `language`，默认 `Chinese`。人物必须有唯一的安全文件名 ID，以及 1–500 字的 `text`；`name`、`card` 可选。人物卡存在时记录其 SHA-256。

参考音色人物使用：

```json
{
  "id": "guide",
  "name": "向导",
  "text": "欢迎回来。",
  "reference": {
    "assetId": "guide-voice-reference-v1",
    "sha256": "填写参考 WAV 的完整小写 SHA-256",
    "text": "填写参考音频中实际说出的台词"
  }
}
```

`reference.assetId` 解析到 ADV.JS 原生资源名录中的 `type: audio`、`kind: reference` 条目。导入的参考可以尚未分配角色；填写 `characterId` 时必须匹配当前人物，不能使用显式属于另一角色的片段。支持内联 `assets` 和分片 `includes`；本地文件优先使用条目的项目相对 `cachePath`，否则使用 `download.profile`（默认 `defaultProfile`）选定的项目 profile 根目录及 `path`。参考文件须为 24 kHz、单声道、16 位 PCM WAV，时长 3–20 秒；配置、资源名录及本地文件的 SHA-256 必须一致。分片、缓存路径及符号链接须留在项目内；profile 下的文件须留在对应缓存目录内。

`embedding-only` 从参考提取音色向量，忽略参考转写；`icl` 使用音色向量及参考音频编码／转写上下文，需要非空转写及 tokenizer 编码器。两种方式均须使用 Qwen Base 模型。人声分离和降噪属于参考准备步骤，可由项目独立处理并登记新资源版本。

VoiceDesign 人物使用 `description` 代替 `reference`，并指定 VoiceDesign 模型。同一预览批次不能混合参考和 VoiceDesign；可用 `--character` 选择其中一种。此后端没有同时向 Base 传递 VoiceDesign 描述或混合两个参考模式的参数。

Editor／Studio 创建新的版本化设计时，插件按规范 locale 的语言部分派生 Qwen `language`，支持中文、英语、日语、韩语、德语、法语、俄语、葡萄牙语、西班牙语和意大利语；其他语言明确拒绝，不回退到中文。语言范围对应 [Qwen 官方模型说明](https://github.com/QwenLM/Qwen3-TTS#released-models-description-and-download)。VoiceDesign 保留原始描述，并将非空的年龄印象、性别表达、气质、说话风格、音高和语速偏好按固定顺序加入实际模型描述；这些是自然语言偏好，不保证精确声学参数。Base 继续使用已审核参考，不接收 VoiceDesign 指令。

已保存的旧不可变设计预设继续保留原字节及生成条件；新语言或意图变化须创建新版本，不能借同步悄悄改写历史音色。

## Node 服务

`createQwenTtsProvider()` 返回共享 `AdvVoiceProvider` 接口，提供 `doctor(context)`、`setup(context)`、`preview(request)`。传入绝对项目根目录，可通过 `AbortSignal` 取消子进程，通过 `onProgress` 接收日志。所有子进程使用独立参数数组，不经 shell 执行台词。

预览返回 `manifestPath` 及完整 JSON 生成记录。记录保留模型／运行时版本、参考来源、种子、文本、生成耗时、峰值内存、音频哈希和尺寸；结果为作者候选。存储插件负责上传，项目负责审核后选用。

随包包含 `python/preview.py` 和 `python/requirements.txt`，通过发布后的包可直接运行。其他作者侧处理工具可用 `import.meta.resolve('@advjs/plugin-qwen-tts/python/preview.py')` 定位校验模块；Python `prepare_reference(root, asset_manifest_path, character)` 可复用同一原生参考资源检查，无需导入 MLX。

## 通用作者模块阶段一

`createQwenTtsProvider()` 同时实现旧 `AdvVoiceProvider` 与新 `AdvVoiceSynthesisProvider`。旧配置和 `preview(request)` 保持兼容；新接口增加 `capabilities`、只读 `inspectPreset(request)` 与统一 `synthesize(request)`。Qwen 的 seed 42、500 字限制和参考模式由本适配器处理，不施加给其他新 provider。`synthesize` 额外返回统一音频候选，原始已保存 manifest 保持原格式。

本地环境 `doctor/setup` 是本插件能力，云端插件可以不提供。Qwen 暂不提供独立 `createVoice`：VoiceDesign 短句试音不能冒充永久供应商声音资源。稳定人物声音由作者档案与版本化参考预设管理；`--voice` 不改变旧的默认预设，也不把种子当作音色身份。

作者模块内置于 ADV.JS，当前不需要 `@advjs/plugin-tts`；未来可按维护需要拆为 `@advjs/voice`。人物档案、原生短句试听、版本检查与选用见[作者语音模块](../../docs/guide/authoring-voice.md)。

`preview` 仍只产出候选；`adv voice generate` 复用同一 Provider，在主机项目事务中复制不可变素材并登记未选 take，`adv voice bind` 才显式选择对白配音。账本为 `adv/audio/voice-ledger.json`，媒体登记在唯一原生 Asset Catalog 中；Editor 与 Studio 已使用相同协议管理、试听和选择 take，并提供整章／缺失／过期任务、角色与旁白音色、项目发音词典。本地 Editor 通过可信项目 bridge 运行现有预设；Studio 通过已认证的 Node 服务复用同一注册表、只读预设检查及持久任务协议。原生同步、本地转码和 COS 发布宿主已实现，生成、选用与发布分别需要显式操作；真实云端部署与 STS 验收单独记录。Python／模型／SDK 不进入玩家配置。

`synthesize` 的 `providerVoiceId` 固化本次真正使用的条件输入：参考模式为 `reference:<assetId>:<sha256>`，VoiceDesign 为 `design:<描述的sha256>`，不是作者档案 ID。参考模式登记正式 take 时需要 `source: cloned`、许可、权利主体和项目内真实同意记录；Node 服务在生成前检查这些输入。VoiceDesign 登记为 `source: designed`，仍不冒充可再次调用的永久供应商音色资源。程序接口与授权记录示例见[对白 take 与共享服务](../../docs/guide/authoring-voice.md#editor-与-studio-共享服务)。
