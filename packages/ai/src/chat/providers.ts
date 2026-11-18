export interface AiProviderPreset {
  id: string
  name: string
  /** OpenAI-compatible base URL */
  baseURL: string
  /** Suggested model ids; any id the provider accepts works. The first one is the default. */
  models: string[]
  /** Local servers such as Ollama run without a key. */
  needsKey: boolean
  /** Where to create a key. */
  registrationUrl?: string
}

/** Providers a person can pick when they bring their own key. */
export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    needsKey: true,
    registrationUrl: 'https://platform.deepseek.com/',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-7B-Instruct'],
    needsKey: true,
    registrationUrl: 'https://cloud.siliconflow.cn/',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o'],
    needsKey: true,
    registrationUrl: 'https://platform.openai.com/',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['deepseek/deepseek-chat-v3-0324:free'],
    needsKey: true,
    registrationUrl: 'https://openrouter.ai/',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseURL: 'http://localhost:11434/v1',
    models: ['qwen2.5'],
    needsKey: false,
  },
]

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** A key may only travel over HTTPS, or stay on this machine. */
export function isAllowedBaseURL(baseURL: string): boolean {
  try {
    const url = new URL(baseURL)
    if (url.username || url.password)
      return false
    return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
  }
  catch {
    return false
  }
}
