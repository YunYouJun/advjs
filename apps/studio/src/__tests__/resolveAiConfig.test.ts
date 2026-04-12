import type { AiConfig } from '../stores/useAiSettingsStore'
import { describe, expect, it } from 'vitest'
import { resolveCharacterAiConfig } from '../utils/resolveAiConfig'

function makeGlobalConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    providerId: 'deepseek',
    apiKey: 'sk-global',
    model: 'deepseek-chat',
    customBaseURL: '',
    customModel: '',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: '',
    imageProvider: 'none',
    imageApiKey: '',
    imageModel: '',
    ttsProvider: 'web-speech',
    ttsApiKey: '',
    ttsModel: '',
    ttsVoice: '',
    ttsSpeed: 1.0,
    ttsCustomBaseURL: '',
    embeddingEnabled: false,
    embeddingProvider: 'same',
    embeddingApiKey: '',
    embeddingModel: '',
    embeddingCustomBaseURL: '',
    ...overrides,
  }
}

describe('resolveCharacterAiConfig', () => {
  it('returns global config when no override', () => {
    const global = makeGlobalConfig()
    const result = resolveCharacterAiConfig(global, 'https://api.deepseek.com/v1', 'deepseek-chat')
    expect(result.baseURL).toBe('https://api.deepseek.com/v1')
    expect(result.apiKey).toBe('sk-global')
    expect(result.model).toBe('deepseek-chat')
    expect(result.temperature).toBe(0.7)
    expect(result.maxTokens).toBe(2048)
  })

  it('overrides temperature and maxTokens', () => {
    const global = makeGlobalConfig()
    const result = resolveCharacterAiConfig(global, 'https://api.deepseek.com/v1', 'deepseek-chat', {
      temperature: 0.9,
      maxTokens: 4096,
    })
    expect(result.temperature).toBe(0.9)
    expect(result.maxTokens).toBe(4096)
    expect(result.model).toBe('deepseek-chat') // unchanged
  })

  it('overrides model only', () => {
    const global = makeGlobalConfig()
    const result = resolveCharacterAiConfig(global, 'https://api.deepseek.com/v1', 'deepseek-chat', {
      model: 'deepseek-reasoner',
    })
    expect(result.model).toBe('deepseek-reasoner')
    expect(result.baseURL).toBe('https://api.deepseek.com/v1')
  })

  it('switches provider and resolves baseURL', () => {
    const global = makeGlobalConfig()
    const result = resolveCharacterAiConfig(global, 'https://api.deepseek.com/v1', 'deepseek-chat', {
      providerId: 'openai',
    })
    expect(result.baseURL).toBe('https://api.openai.com/v1')
    expect(result.apiKey).toBe('sk-global') // always from global
  })

  it('uses customBaseURL when switching to custom provider', () => {
    const global = makeGlobalConfig({ customBaseURL: 'https://custom.api.com/v1' })
    const result = resolveCharacterAiConfig(global, 'https://api.deepseek.com/v1', 'deepseek-chat', {
      providerId: 'custom',
    })
    expect(result.baseURL).toBe('https://custom.api.com/v1')
  })

  it('keeps global baseURL when override provider matches global', () => {
    const global = makeGlobalConfig()
    const result = resolveCharacterAiConfig(global, 'https://api.deepseek.com/v1', 'deepseek-chat', {
      providerId: 'deepseek',
      temperature: 0.5,
    })
    expect(result.baseURL).toBe('https://api.deepseek.com/v1')
    expect(result.temperature).toBe(0.5)
  })
})
