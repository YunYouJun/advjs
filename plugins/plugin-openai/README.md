# @advjs/plugin-openai

ADV.JS 的可选 OpenAI 集成。作者 TTS 使用独立 Node 入口 `@advjs/plugin-openai/voice`，实现内置 `AdvVoiceSynthesisProvider`，可与 Qwen 或第三方 Provider 一起注册。当前仓库实现不代表 npm 发布已完成。

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
    },
  },
})
```

预设是 `schemaVersion: 1` 的 JSON，包含受支持的 `model` 和 `characters`。人物字段为 `id`、`text`、内置 `voice`，以及可选 `name`、项目内 `card`、`instructions`、`speed`。完整预设、多个 Provider 路由和短句审核见[作者语音指南](../../docs/guide/authoring-voice.md)。

```bash
pnpm --filter @advjs/plugin-openai build
adv voice providers --json
adv voice doctor --provider openai-tts --json
adv voice preview --provider openai-tts --preset openai --list --json
```

导入 `./voice`、诊断和列举都不联网，也不要求密钥。实际合成从进程环境读取 `OPENAI_API_KEY`，或使用可信服务端注入的 `client`。不要把密钥写入预设或玩家配置。包根入口保留旧 `openai` 单例与 `createSpeechFromText()`，已有直接 SDK 用户可继续使用；规范作者链路应导入 `./voice`。

## 合成契约

- Provider ID：`openai-tts`；模型为 `gpt-4o-mini-tts`、`gpt-4o-mini-tts-2025-12-15`、`tts-1`、`tts-1-hd`。
- 只支持内置音色，不开放自定义声音创建／克隆；`tts-1` 和 `tts-1-hd` 拒绝 `instructions`。
- 文本上限 4096 字，语速 0.25–4；不支持 seed、reference mode、离线合成。
- 请求 24 kHz、单声道、16 位 PCM，封装 WAV；每份候选不超过 20 MiB。候选携带人物、实际文本、模型、供应商音色、时长、采样率、大小和 SHA-256。
- 独立任务写入 `.advjs/voice/previews/openai/<uuid>/`，不覆盖历史文件；失败、取消或预设变化清理本次部分文件。
- 网络请求传递 `AbortSignal` 并禁用 SDK 自动重试。未知请求结果可能已计费，取消或文件清理不能撤回云端账单；不提供批量任务恢复或幂等保证。
- 不自动登记资产、选用、绑定台词、转码或上传。构建和播放器不发起合成。

参数来源：[OpenAI Speech API](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)、[输出格式](https://developers.openai.com/api/docs/guides/text-to-speech#supported-output-formats)。发布包含此合成语音的游戏时，按 [OpenAI 官方指南](https://developers.openai.com/api/docs/guides/text-to-speech)向玩家说明声音由 AI 生成。

## 验证

```bash
pnpm vitest run plugins/plugin-openai/tests/voice.test.ts tests/unit/voice/voice-registry.test.ts
pnpm --filter @advjs/plugin-openai build
```

契约测试注入模拟客户端，不读取真实密钥或调用收费 API。真实账户权限、听感和网络链路需要在作者项目中另行验证。
