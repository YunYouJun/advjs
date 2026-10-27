# @advjs/plugin-breeze-tts

通过已加载模型的本地 Xinference 服务，把 Breeze TTS 2 接入 ADV.JS 原生音色设计、候选试听和对白配音流程。本包是 Node 作者侧供应商适配器，复用 Editor / Studio 的创作界面；不包含模型权重或另一套前端。

## 接入现有项目

在本工作区执行 `pnpm --filter @advjs/plugin-breeze-tts build` 后链接该包到作者项目。此处不声明 npm 已发布。

将 [examples/breeze.json](./examples/breeze.json) 复制到项目的 `authoring/voices/breeze.json`，再把 [examples/adv.config.ts](./examples/adv.config.ts) 中的 `authoring.voice` 合入项目现有配置。已有供应商时，追加到 `providers`，并用 `presetProviders: { breeze: 'breeze-tts' }` 指定新预设的归属；保留其他供应商及其映射。

```ts
import { createBreezeTtsProvider } from '@advjs/plugin-breeze-tts'
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  authoring: {
    voice: {
      providers: [createBreezeTtsProvider()],
      defaultProvider: 'breeze-tts',
      presets: { breeze: 'authoring/voices/breeze.json' },
      defaultPreset: 'breeze',
    },
  },
})
```

默认连接 `http://127.0.0.1:9997`，模型 UID 为 `breeze-bf16`。部署位置不同的本机服务通过工厂选项 `baseUrl` 和 `modelUid` 配置；只接受 HTTP 回环地址，不接受设计预设指定服务地址、认证信息或远程权重。服务须已加载 `Breeze-TTS-2`。适配器不会安装 Python、启动服务、加载模型或下载权重。

```bash
adv voice doctor --provider breeze-tts
adv voice preview --provider breeze-tts --preset breeze --list
adv editor .
```

导入、列出预设和音色设计保存不调用推理。`doctor` 只读取服务中已加载模型的描述；确认生成后才调用 `/v1/audio/speech`。模型扩展参数通过 Xinference 的序列化 `kwargs` 字段传递。

## 在创作界面试听

1. 进入「音频 → 音色设计」，新建音色并选择角色或旁白、Breeze 预设。
2. 在「音色描述」填写音色；通过「说话风格」描述开心、悲伤、严肃等情绪，也可填写气质、年龄印象、性别表达、音高和语速。
3. 保存版本，输入试听文本，沿用现有审核计划和确认生成操作。
4. 试听候选，登记并选用样本，再显式应用到角色。对白生成、逐句审核和游戏播放继续使用原有流程。

设计来源支持 `designed` 和 `cloned`，设计入口支持 `zh` 语言区域。音色情绪、音高和语速都转换为自然语言 `instruct`，实际表现由模型决定；不把它们当作数值声学保证。API 的固定 `voice: S0` 是 Breeze 的说话人标签，不是项目音色身份。

预设的 `seed` 默认为 `42`，`cfgScale` 默认为 `4`；通用 CLI 的显式 seed 优先。字符上限为每句 500 字。`instruct` 可提供公共方向，各角色的 `description` 附加其后；两者合计最多 4096 字符。CFG 和 seed 保存在可信 JSON 预设中，现有面板负责音色与情绪描述。流式输出关闭，API `speed` 固定为 `1`，定性语速通过指令传递。

## 克隆参考声音

1. 在「音频 → 音频资源」把「导入用途」设为「声音参考 · Reference」，导入录音。建议先使用安静、单人、自然语调的 15–25 秒 WAV；该时长是录制建议，不是模型硬性上限。
2. 转到「音色设计」，新建音色，选角色和 Breeze 预设，将音色来源改为「授权参考音色」，选择刚导入的参考。
3. 填写完整准确的「参考文本」，再填写使用许可、声音主体和项目内的同意记录路径。已有创作协议会检查该记录真实存在；自己的录音也使用同一原生登记流程。
4. 保存版本，再创建审核计划、确认生成、试听、登记和选用样本，最后应用到角色。应用后，后续对白任务使用同一份参考条件。

「项目同意文件」是项目内的 JSON 或文本记录，例如 `authoring/rights/my-voice.json`，可写明声音主体、来源、允许用途和对应参考资源。真实验收用的是本轮生成的原创虚构声音，未使用真人录音。

Breeze 只支持「参考音频与文本」（`icl`），不支持「仅声音特征」（`embedding-only`）；Editor 按供应商的 `referenceModes` 能力声明显示选项。克隆仍可用「说话风格」等现有意图字段调整表达，没有额外方向时使用“保持参考音色，自然清晰地说话。”。实际相似度和情绪表现需要试听判断。

参考录音必须是项目原生目录中已经登记为 `audio / reference` 的素材。适配器复用共享目录解析与媒体路径规则，核对角色归属、文件大小和 SHA-256，再通过 multipart 的 `prompt_speech` 上传原始字节，把完整逐字稿放入 `kwargs.prompt_text`。不接受任意文件路径或远程 URL 充当参考，素材分片目录也可使用。生成后再次校验参考，执行期间变化的结果不会被保留。

这是参考条件驱动的合成，不会训练、创建或保存供应商侧永久声音资源，因此 `voiceCreation` 仍为 `false`；项目音色身份、版本、参考录音和已选样本由 ADV.JS 保存。

## 候选与可复现信息

输出保存在项目 `.advjs/voice/previews/breeze/<run>/`，包含 WAV 与 manifest。适配器验证单声道 24 kHz PCM16、文件长度和 WAV 分块，记录真实时长、采样率、大小、SHA-256、指令、seed、CFG 和模型 UID。描述设计的供应商音色 ID 是实际组合指令的哈希；克隆使用 `reference:<assetId>:<sha256>`，逐字稿、指令和生成参数另外进入输入指纹。它们独立于项目音色 ID / 版本。

Xinference 的注册元数据可能指向另一份量化权重，不能据此断言实际加载文件的修订。本适配器记录 `Breeze-TTS-2` 与 UID，不把注册修订冒充实际权重修订；BF16 路径与权重校验由本地模型部署负责。相同 UID 被服务端换权重后，应建立新音色版本并重新生成。

失败、取消或执行期间预设变化会清理本次未完成的候选目录，不自动重试。取消 HTTP 请求不保证推理后端立即停止运算。生成候选不会自动登记素材、绑定对白或覆盖已选 take，后续操作由共享作者服务处理。模型许可独立于本包 MPL-2.0；使用生成音频前按所部署模型的许可确认用途。

## 逐字时间轴与本地资源维护

可选配置 `alignment: { python, modelPath, revision }`，复用已安装的 MLX-Audio 环境与本地 `Qwen3-ForcedAligner-0.6B-8bit`。帮助脚本随包分发，离线对齐准确文本和音频，输出中文逐字、英文逐词时间戳。合成成功但对齐失败时保留 WAV，并在 manifest 的 `alignmentWarnings` 中记录失败；不会用平均分配时间代替真实对齐。

模型返回零时长的单元时跳过这些单元，其余有效时间戳仍可使用；manifest 记录 `VOICE_ALIGNMENT_PARTIAL` 与未定位字数，Editor 显示相同提示。无效、倒序或与媒体身份不符的时间轴仍被拒绝。

本机验证使用 [MLX-Audio 的强制对齐实现](https://github.com/Blaizzy/mlx-audio/blob/main/mlx_audio/stt/models/qwen3_asr/README.md)和[MLX 权重](https://huggingface.co/mlx-community/Qwen3-ForcedAligner-0.6B-8bit)，固定修订 `0e1a68e91d815300c7c9754b2a7639378b23db15`；权重约 1.27 GB，不创建第二个 Python 环境。模型须由操作者预先准备，插件不自动下载。

可信 Node 配置可提供 `installation`，登记缓存、环境、模型、保护目录和占用检查，供 Editor「供应商与清理」选择。默认保留所有参考录音和已完成配音；复用现有停止服务回调后才可清理在用资源。项目停用状态写入 `.advjs/voice/provider-state.json`，不影响已登记音频的试听和播放。npm 包通过界面给出的包管理器命令单独移除。完整流程见[作者语音指南](https://advjs.org/guide/authoring-voice)。

## 验证

```bash
pnpm exec vitest run plugins/plugin-breeze-tts/tests/provider.test.ts
ADVJS_REAL_BREEZE=1 pnpm exec playwright test --config tests/fixtures/audio/editor-real-breeze.playwright.config.ts
```

真实验收使用已构建的 `editor/core/dist` 和已启动的本地 Breeze 服务，不下载模型。测试在任务独占临时项目运行，退出时清理临时项目与状态；使用 `ADVJS_BREEZE_ARTIFACTS` 指定保留截图、音频和验收摘要的位置。普通测试不会自动调用真实模型。
