export interface OfficialPluginText {
  'zh-CN': string
  'en': string
}

/** Maintained metadata only. Entries never import, install, or execute a plugin. */
export interface OfficialPluginDescriptor {
  id: string
  name: string
  packageName: string
  sourcePath: string
  summary: OfficialPluginText
  capabilities: OfficialPluginText
  platform: OfficialPluginText
  requirements: OfficialPluginText
  preparation: OfficialPluginText
}

export const officialPlugins: readonly OfficialPluginDescriptor[] = [
  {
    id: 'breeze-tts',
    name: 'Breeze TTS 2',
    packageName: '@advjs/plugin-breeze-tts',
    sourcePath: 'plugins/plugin-breeze-tts',
    summary: { 'zh-CN': '连接已部署的本机 Xinference 服务。', 'en': 'Connect to an existing local Xinference service.' },
    capabilities: { 'zh-CN': '中文描述音色、授权参考克隆、情绪指令；可选逐字对齐。', 'en': 'Chinese voice design, consented reference cloning, style instructions; optional forced alignment.' },
    platform: { 'zh-CN': 'Apple Silicon macOS 已验证；其他 Breeze 服务端平台尚未验收。', 'en': 'Verified on Apple Silicon macOS; other Breeze server platforms have not been validated.' },
    requirements: { 'zh-CN': '需单独准备 Xinference 与 Breeze 权重。本机 BF16 权重约 7.63 GB，验收设备为 32 GB 内存；这不是最低配置承诺。可选对齐权重另约 1.28 GB。', 'en': 'Prepare Xinference and Breeze weights separately. Tested BF16 weights use about 7.63 GB on a 32 GB RAM Mac; this is not a minimum specification. Optional alignment adds about 1.28 GB.' },
    preparation: { 'zh-CN': '在项目 adv.config.ts 注册 createBreezeTtsProvider() 和 JSON 预设；先加载 Breeze-TTS-2，默认服务 127.0.0.1:9997、UID breeze-bf16。适配器不安装环境或下载模型。', 'en': 'Register createBreezeTtsProvider() and a JSON preset in adv.config.ts. Load Breeze-TTS-2 first; defaults are 127.0.0.1:9997 and UID breeze-bf16. The adapter does not prepare environments or download models.' },
  },
  {
    id: 'qwen-tts',
    name: 'Qwen3-TTS · MLX',
    packageName: '@advjs/plugin-qwen-tts',
    sourcePath: 'plugins/plugin-qwen-tts',
    summary: { 'zh-CN': '使用项目独立的本地 MLX 环境合成。', 'en': 'Synthesize in an isolated, project-local MLX environment.' },
    capabilities: { 'zh-CN': '多语言描述音色与授权参考克隆；具体能力取决于 VoiceDesign / Base 模型。', 'en': 'Multilingual voice design and consented reference cloning; capabilities depend on the VoiceDesign or Base model.' },
    platform: { 'zh-CN': '仅 Apple Silicon macOS；此 MLX 后端不支持 Intel Mac、Windows 或 Linux。', 'en': 'Apple Silicon macOS only. This MLX backend does not support Intel Mac, Windows, or Linux.' },
    requirements: { 'zh-CN': '需要 uv 和隔离 Python 3.12 环境。BF16 1.7B 与 tokenizer 约 4.5 GB；建议预留 16 GB 以上统一内存。', 'en': 'Requires uv and an isolated Python 3.12 environment. BF16 1.7B weights plus tokenizer use about 4.5 GB; allow at least 16 GB unified memory.' },
    preparation: { 'zh-CN': '在 adv.config.ts 注册 createQwenTtsProvider()，固定预设模型修订与权重哈希；显式运行 adv voice setup，再按说明准备模型。状态检测只检查环境，不证明所选权重或音质。', 'en': 'Register createQwenTtsProvider() in adv.config.ts and pin the model revision and weight hash. Explicitly run adv voice setup, then prepare the model as documented. Diagnostics inspect the environment, not the selected weights or audio quality.' },
  },
  {
    id: 'openai-tts',
    name: 'OpenAI TTS',
    packageName: '@advjs/plugin-openai',
    sourcePath: 'plugins/plugin-openai',
    summary: { 'zh-CN': '通过可信 Node 宿主调用云端 Speech API。', 'en': 'Use the cloud Speech API through a trusted Node host.' },
    capabilities: { 'zh-CN': '内置音色、多语言；支持的模型可使用风格指令，不提供声音克隆。', 'en': 'Built-in voices and multilingual speech; supported models accept style instructions. Voice cloning is unavailable.' },
    platform: { 'zh-CN': 'macOS / Windows / Linux 的 Node 宿主；合成需要联网与可用账号。', 'en': 'Node hosts on macOS, Windows, or Linux. Synthesis requires network access and an eligible account.' },
    requirements: { 'zh-CN': '无需本地 GPU 或模型权重。密钥由宿主环境 OPENAI_API_KEY 或受信任客户端提供；实际生成可能计费。', 'en': 'No local GPU or model weights. Provide OPENAI_API_KEY in the host environment or inject a trusted client. Synthesis may incur charges.' },
    preparation: { 'zh-CN': '从 @advjs/plugin-openai/voice 导入 createOpenAiTtsProvider()，注册到 adv.config.ts 并配置内置音色预设。诊断只确认凭证是否配置，未验证远端服务、账号权限或额度。', 'en': 'Import createOpenAiTtsProvider() from @advjs/plugin-openai/voice and register it with a built-in voice preset in adv.config.ts. Diagnostics only check credential configuration; remote service access, permissions, and quota remain unverified.' },
  },
]

export function officialPluginText(text: OfficialPluginText, locale: string) {
  return locale === 'zh-CN' ? text['zh-CN'] : text.en
}

/** This immutable source snapshot contains all three adapters, even before merge. */
export function officialPluginSource(entry: OfficialPluginDescriptor) {
  return `https://github.com/YunYouJun/advjs/blob/65b5b6c0a151969489523e8eacc4516434915e73/${entry.sourcePath}/README.md`
}

export function officialPluginInstallCommands(entry: OfficialPluginDescriptor) {
  return [
    'cd /absolute/path/to/advjs',
    'pnpm install',
    'pnpm build:advjs',
    'pnpm editor:build',
    `pnpm --filter ${entry.packageName} build`,
    '',
    'cd /absolute/path/to/game',
    `pnpm add -D "link:/absolute/path/to/advjs/${entry.sourcePath}"`,
    '',
    'node /absolute/path/to/advjs/packages/advjs/bin/adv.mjs editor /absolute/path/to/game',
  ].join('\n')
}
