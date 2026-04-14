import type { AiConfig } from '../stores/useAiSettingsStore'
import type { TtsSettings } from './ttsClient'
import { AI_PROVIDERS } from '../stores/useAiSettingsStore'

/**
 * Per-character AI config overrides.
 * Only defined fields override the global config; undefined = use global.
 * Stored in IndexedDB, NOT in .character.md.
 */
export interface CharacterAiOverride {
  providerId?: string
  model?: string
  temperature?: number
  maxTokens?: number
  // Per-character TTS voice overrides
  ttsProvider?: string
  ttsVoice?: string
  ttsModel?: string
  ttsSpeed?: number
}

export interface ResolvedAiConfig {
  baseURL: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

/**
 * Resolve the effective AI config for a character by merging global config with
 * per-character overrides.
 *
 * Rules:
 * - If override field is defined, use it
 * - If override changes provider, use the override provider's baseURL
 * - apiKey always comes from global config (per-character keys not supported yet)
 */
export function resolveCharacterAiConfig(
  globalConfig: AiConfig,
  globalBaseURL: string,
  globalModel: string,
  override?: CharacterAiOverride,
): ResolvedAiConfig {
  if (!override) {
    return {
      baseURL: globalBaseURL,
      apiKey: globalConfig.apiKey,
      model: globalModel,
      temperature: globalConfig.temperature,
      maxTokens: globalConfig.maxTokens,
    }
  }

  // Resolve provider/baseURL
  let baseURL = globalBaseURL
  if (override.providerId && override.providerId !== globalConfig.providerId) {
    if (override.providerId === 'custom') {
      baseURL = globalConfig.customBaseURL || globalBaseURL
    }
    else {
      const provider = AI_PROVIDERS.find(p => p.id === override.providerId)
      if (provider)
        baseURL = provider.baseURL
    }
  }

  return {
    baseURL,
    apiKey: globalConfig.apiKey,
    model: override.model ?? globalModel,
    temperature: override.temperature ?? globalConfig.temperature,
    maxTokens: override.maxTokens ?? globalConfig.maxTokens,
  }
}

/**
 * Resolve the effective TTS settings for a character by merging global TTS
 * config with per-character overrides.
 *
 * Rules:
 * - If override TTS field is defined, use it
 * - apiKey and customBaseURL always come from global config
 */
export function resolveCharacterTtsSettings(
  globalConfig: AiConfig,
  override?: CharacterAiOverride,
): TtsSettings {
  return {
    provider: override?.ttsProvider ?? globalConfig.ttsProvider,
    voice: override?.ttsVoice ?? globalConfig.ttsVoice,
    model: override?.ttsModel ?? globalConfig.ttsModel,
    speed: override?.ttsSpeed ?? globalConfig.ttsSpeed,
    apiKey: globalConfig.ttsApiKey,
    customBaseURL: globalConfig.ttsCustomBaseURL,
  }
}
