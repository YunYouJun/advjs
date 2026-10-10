# @advjs/plugin-qwen-tts

ADV.JS 的可选本地配音插件。它提供作者侧的 Qwen3-TTS 预览服务，将 Python 环境、模型缓存、生成记录和 WAV 存在当前项目的 `.advjs/voice/`。当前后端使用 MLX，仅支持 Apple Silicon Mac。

人物、台词、参考片段及模型版本由项目的 JSON 预设提供。插件不包含游戏人物，不自动上传或绑定音频，不进入播放器。

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
adv voice preview --character guide --offline
adv voice preview --character guide --text '欢迎回来。' --offline
adv voice preview --reference-mode icl --offline
```

先安装 [uv](https://docs.astral.sh/uv/getting-started/installation/)。`setup` 显式创建 Python 3.12 环境并安装随包锁定的依赖，不下载模型。`doctor` 只检查环境；`--list` 由 ADV.JS CLI 读取预设，不加载 Python 或模型。预览要求环境已经准备好，`--offline` 仅使用本地模型缓存；缓存不足时直接失败。

首次在线预览可下载预设指定的模型。模型必须固定到完整提交哈希，并提供权重 SHA-256；每次生成前校验文件，避免缓存损坏或意外换版本。BF16 1.7B 模型及音频 tokenizer 合计约 4.5 GB，实际内存取决于参考和台词长度，宜预留 16 GB 以上统一内存。模型源：[Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)、[MLX Audio](https://github.com/Blaizzy/mlx-audio)。

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

`reference.assetId` 解析到 ADV.JS 原生资源名录中的 `type: audio`、`kind: reference`、对应 `characterId` 条目。支持内联 `assets` 和分片 `includes`；本地文件优先使用条目的项目相对 `cachePath`，否则使用 `download.profile`（默认 `defaultProfile`）选定的项目 profile 根目录及 `path`。参考文件须为 24 kHz、单声道、16 位 PCM WAV，时长 3–20 秒；配置、资源名录及本地文件的 SHA-256 必须一致。分片、缓存路径及符号链接须留在项目内；profile 下的文件须留在对应缓存目录内。

`embedding-only` 从参考提取音色向量，忽略参考转写；`icl` 使用音色向量及参考音频编码／转写上下文，需要非空转写及 tokenizer 编码器。两种方式均须使用 Qwen Base 模型。人声分离和降噪属于参考准备步骤，可由项目独立处理并登记新资源版本。

VoiceDesign 人物使用 `description` 代替 `reference`，并指定 VoiceDesign 模型。同一预览批次不能混合参考和 VoiceDesign；可用 `--character` 选择其中一种。此后端没有同时向 Base 传递 VoiceDesign 描述或混合两个参考模式的参数。

## Node 服务

`createQwenTtsProvider()` 返回共享 `AdvVoiceProvider` 接口，提供 `doctor(context)`、`setup(context)`、`preview(request)`。传入绝对项目根目录，可通过 `AbortSignal` 取消子进程，通过 `onProgress` 接收日志。所有子进程使用独立参数数组，不经 shell 执行台词。

预览返回 `manifestPath` 及完整 JSON 生成记录。记录保留模型／运行时版本、参考来源、种子、文本、生成耗时、峰值内存、音频哈希和尺寸；结果为作者候选。存储插件负责上传，项目负责审核后选用。

随包包含 `python/preview.py` 和 `python/requirements.txt`，通过发布后的包可直接运行。其他作者侧处理工具可用 `import.meta.resolve('@advjs/plugin-qwen-tts/python/preview.py')` 定位校验模块；Python `prepare_reference(root, asset_manifest_path, character)` 可复用同一原生参考资源检查，无需导入 MLX。

## 通用作者模块阶段一

`createQwenTtsProvider()` 同时实现旧 `AdvVoiceProvider` 与新 `AdvVoiceSynthesisProvider`。旧配置和 `preview(request)` 保持兼容；新接口增加 `capabilities`、只读 `inspectPreset(request)` 与统一 `synthesize(request)`。Qwen 的 seed 42、500 字限制和参考模式由本适配器处理，不施加给其他新 provider。`synthesize` 额外返回统一音频候选，原始已保存 manifest 保持原格式。

本地环境 `doctor/setup` 是本插件能力，云端插件可以不提供。Qwen 暂不提供独立 `createVoice`：VoiceDesign 短句试音不能冒充永久供应商声音资源。稳定人物声音由作者档案与版本化参考预设管理；`--voice` 不改变旧的默认预设，也不把种子当作音色身份。

作者模块内置于 ADV.JS，当前不需要 `@advjs/plugin-tts`；未来可按维护需要拆为 `@advjs/voice`。人物档案、原生短句试听、版本检查与选用见[作者语音模块](../../docs/guide/authoring-voice.md)。本阶段仍不自动上传、登记或绑定候选，Python／模型／SDK不进入玩家配置。
