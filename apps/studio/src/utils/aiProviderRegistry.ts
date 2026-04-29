import type { StudioPlugin } from './pluginTypes'

/**
 * AI Provider Plugin — extends StudioPlugin with LLM-specific fields.
 *
 * Mirrors the existing `AiProviderPreset` interface but adds plugin metadata.
 */
export interface AiProviderPlugin extends StudioPlugin {
  type: 'ai-provider'
  /** OpenAI-compatible base URL */
  baseURL: string
  /** Available model identifiers */
  models: string[]
  /** Whether this provider requires an API key (defaults to true) */
  needsKey?: boolean
  /** URL for users to register and get an API key */
  registrationUrl?: string
}

// --- Registry ---

const aiProviderRegistry = new Map<string, AiProviderPlugin>()

export function registerAiProvider(provider: AiProviderPlugin): void {
  aiProviderRegistry.set(provider.id, provider)
}

export function getAiProvider(id: string): AiProviderPlugin | undefined {
  return aiProviderRegistry.get(id)
}

export function listAiProviders(): AiProviderPlugin[] {
  return [...aiProviderRegistry.values()]
}

export function unregisterAiProvider(id: string): boolean {
  return aiProviderRegistry.delete(id)
}

// --- Built-in providers (auto-registered on module load) ---

const builtins: AiProviderPlugin[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'ai-provider',
    version: '1.0.0',
    description: 'DeepSeek AI — affordable high-quality LLM',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    registrationUrl: 'https://platform.deepseek.com/',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    type: 'ai-provider',
    version: '1.0.0',
    description: 'SiliconFlow — multi-model cloud platform',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3', 'THUDM/glm-4-9b-chat'],
    registrationUrl: 'https://cloud.siliconflow.cn/',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'ai-provider',
    version: '1.0.0',
    description: 'OpenAI GPT models',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini'],
    registrationUrl: 'https://platform.openai.com/',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'ai-provider',
    version: '1.0.0',
    description: 'OpenRouter — unified API for 100+ models',
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat-v3-0324:free'],
    registrationUrl: 'https://openrouter.ai/',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'ai-provider',
    version: '1.0.0',
    description: 'Ollama — run LLMs locally',
    baseURL: 'http://localhost:11434/v1',
    models: ['llama3', 'qwen2.5', 'deepseek-r1'],
    needsKey: false,
  },
  {
    id: 'custom',
    name: 'Custom',
    type: 'ai-provider',
    version: '1.0.0',
    description: 'Custom OpenAI-compatible endpoint',
    baseURL: '',
    models: [],
  },
]

for (const provider of builtins)
  registerAiProvider(provider)
