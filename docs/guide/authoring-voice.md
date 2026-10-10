# 作者语音模块

ADV.JS 内置通用作者协议、CLI 和本地 Editor 短句审核界面，供应商按需安装。阶段一已接入 Qwen MLX；MiniMax 与其他云端供应商尚未接入。当前实现不包含整章批量生成、自动上传、对白绑定或正式选角。

不额外要求安装 `@advjs/plugin-tts`。将来需要独立发布维护时可拆为 `@advjs/voice`：范围包含音色身份、试听与选用，不只处理文本转语音。此包名目前是维护规划，尚无新包或 npm 发布。

## 接入与兼容

```ts
export default {
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
}
```

旧 `provider: createQwenTtsProvider()`、预设文件和 `doctor|setup|preview` 命令继续可用。多个 provider 的 ID 必须唯一；`--provider` 显式选择优先，其次是 `presetProviders`、`defaultProvider` 和旧单 provider。不会因失败自动切换供应商。

新适配器实现 `AdvVoiceSynthesisProvider`：声明 `capabilities`，提供只读 `inspectPreset` 与统一 `synthesize`。`doctor`、本地 `setup`、独立 `createVoice` 是可选操作；云服务不必提供 Python 目录。声音创建与短句合成分别调用，合成不会隐式创建供应商声音资源。Qwen 当前只声明合成，VoiceDesign 试音不是永久供应商音色创建。

适配器负责模型／后端能力、文本长度、模式和种子。Qwen 继续使用 500 字上限、seed 42 与 Base 的 `icl|embedding-only`，这些要求不施加给新云端适配器。旧 `AdvVoiceProvider` 的兼容路径保留历史限制，待各旧插件迁移后再移除。供应商扩展参数仍由预设与适配器校验，不静默忽略不支持的模式。

合成保留供应商原始 manifest，并返回统一候选：人物、文本、provider、模型／修订、项目相对文件、MIME、采样率、时长、大小、哈希及可选音色版本。通用服务复核文件、人物和文本，计算输入指纹；预设在执行期间变化或任务取消后，不报告成功。候选不自动登记到资源清单。

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

已有背景图片的 `assets ingest|accept` 继续只处理背景图；本阶段选用已按原生媒体流程登记的短句。新合成的文件仍先由存储／资源流程登记，再进入试听。模型插件不承担存储上传，不创建平行音频格式或绑定协议。

## 后续阶段

1. 阶段一：多 provider 协议、Qwen 兼容、稳定作者音色与已有短句的本地试听／选用。运行时配置移除整个 `authoring`；Python、模型、档案与供应商函数不进入玩家配置。当前不新增剧情音频绑定。
2. 阶段二：核对 MiniMax 官方合成／音色创建能力，建立独立供应商插件；先跑无付费契约测试，再按授权验证少量云端请求。区分费用估算与实际用量，不静默重试收费请求。
3. 阶段三：复用原生资源及对白协议建立已选音频绑定、过期检测、单句重生成和批量任务；先验证取消、失败、恢复与缓存，再开放整章生成。

阶段二事实核对入口：[MiniMax 同步合成](https://platform.minimax.io/docs/api-reference/speech-t2a-http)与 [Qwen 官方源码](https://github.com/QwenLM/Qwen3-TTS)。本阶段没有联网核对新的 MiniMax 能力，也没有声明其接入完成。
