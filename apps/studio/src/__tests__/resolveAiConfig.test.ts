import type { AiConfig } from '../stores/useAiSettingsStore'
import { describe, expect, it } from 'vitest'
import { resolveCharacterAiConfig, resolveCharacterTtsSettings } from '../utils/resolveAiConfig'

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

describe('resolveCharacterTtsSettings', () => {
  it('returns global TTS settings when no override', () => {
    const global = makeGlobalConfig({
      ttsProvider: 'openai',
      ttsVoice: 'alloy',
      ttsModel: 'tts-1',
      ttsSpeed: 1.0,
      ttsApiKey: 'sk-tts',
      ttsCustomBaseURL: '',
    })
    const result = resolveCharacterTtsSettings(global)
    expect(result.provider).toBe('openai')
    expect(result.voice).toBe('alloy')
    expect(result.model).toBe('tts-1')
    expect(result.speed).toBe(1.0)
    expect(result.apiKey).toBe('sk-tts')
  })

  it('overrides voice only', () => {
    const global = makeGlobalConfig({
      ttsProvider: 'openai',
      ttsVoice: 'alloy',
      ttsModel: 'tts-1',
      ttsSpeed: 1.0,
    })
    const result = resolveCharacterTtsSettings(global, { ttsVoice: 'nova' })
    expect(result.provider).toBe('openai')
    expect(result.voice).toBe('nova')
    expect(result.model).toBe('tts-1')
    expect(result.speed).toBe(1.0)
  })

  it('overrides provider and voice together', () => {
    const global = makeGlobalConfig({
      ttsProvider: 'web-speech',
      ttsVoice: '',
    })
    const result = resolveCharacterTtsSettings(global, {
      ttsProvider: 'openai',
      ttsVoice: 'shimmer',
    })
    expect(result.provider).toBe('openai')
    expect(result.voice).toBe('shimmer')
  })

  it('overrides speed only', () => {
    const global = makeGlobalConfig({ ttsSpeed: 1.0 })
    const result = resolveCharacterTtsSettings(global, { ttsSpeed: 1.5 })
    expect(result.speed).toBe(1.5)
    expect(result.provider).toBe('web-speech') // unchanged from default
  })

  it('apiKey always comes from global', () => {
    const global = makeGlobalConfig({ ttsApiKey: 'sk-global-tts' })
    const result = resolveCharacterTtsSettings(global, {
      ttsProvider: 'doubao',
      ttsVoice: 'zh_female_tianmeixiaoyuan',
    })
    expect(result.apiKey).toBe('sk-global-tts')
  })

  it('returns global when override has no TTS fields', () => {
    const global = makeGlobalConfig({
      ttsProvider: 'openai',
      ttsVoice: 'echo',
      ttsModel: 'tts-1-hd',
      ttsSpeed: 0.8,
    })
    // Override only has AI fields, no TTS fields
    const result = resolveCharacterTtsSettings(global, { temperature: 0.9 })
    expect(result.provider).toBe('openai')
    expect(result.voice).toBe('echo')
    expect(result.model).toBe('tts-1-hd')
    expect(result.speed).toBe(0.8)
  })
})
