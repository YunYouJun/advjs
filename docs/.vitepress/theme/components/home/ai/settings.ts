import type { AiProviderPreset, ChatEndpoint } from '../../../../../../packages/ai/src'
import { AI_PROVIDER_PRESETS, isAllowedBaseURL } from '../../../../../../packages/ai/src'

/**
 * Where the visitor's provider settings live. Only this tab (`sessionStorage`) unless they tick
 * "remember on this device" (`localStorage`). Never in the URL, logs, saves or exports.
 */
export const SETTINGS_KEY = 'advjs:home-ai'

export const CUSTOM_PROVIDER = 'custom'

export interface AiSettings extends ChatEndpoint {
  providerId: string
}

export interface StoredAiSettings extends AiSettings {
  remember: boolean
}

export type SettingsProblem = 'baseURL' | 'model' | 'apiKey'

export const providers: readonly AiProviderPreset[] = AI_PROVIDER_PRESETS

export function presetOf(providerId: string): AiProviderPreset | undefined {
  return providers.find(provider => provider.id === providerId)
}

export function defaultSettings(): AiSettings {
  const [first] = providers
  return { providerId: first.id, baseURL: first.baseURL, model: first.models[0], apiKey: '' }
}

/** Storage can be missing or throw (privacy modes, blocked site data); treat that as empty. */
function storage(kind: 'local' | 'session'): Storage | undefined {
  try {
    return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage
  }
  catch {
    return undefined
  }
}

function parse(raw: string | null | undefined): AiSettings | undefined {
  if (!raw)
    return
  try {
    const value = JSON.parse(raw)
    if (typeof value?.providerId === 'string' && typeof value.baseURL === 'string' && typeof value.model === 'string' && typeof value.apiKey === 'string')
      return { providerId: value.providerId, baseURL: value.baseURL, model: value.model, apiKey: value.apiKey }
  }
  catch {}
}

export function loadSettings(): StoredAiSettings | undefined {
  for (const [kind, remember] of [['session', false], ['local', true]] as const) {
    try {
      const settings = parse(storage(kind)?.getItem(SETTINGS_KEY))
      if (settings)
        return { ...settings, remember }
    }
    catch {}
  }
}

export function clearSettings(): void {
  for (const kind of ['session', 'local'] as const) {
    try {
      storage(kind)?.removeItem(SETTINGS_KEY)
    }
    catch {}
  }
}

export function saveSettings(settings: AiSettings, remember: boolean): void {
  clearSettings()
  const { providerId, baseURL, model, apiKey } = settings
  try {
    storage(remember ? 'local' : 'session')?.setItem(SETTINGS_KEY, JSON.stringify({ providerId, baseURL: baseURL.trim(), model: model.trim(), apiKey: apiKey.trim() }))
  }
  catch {}
}

export function checkSettings(settings: AiSettings): SettingsProblem | undefined {
  if (!isAllowedBaseURL(settings.baseURL.trim()))
    return 'baseURL'
  if (!settings.model.trim())
    return 'model'
  if (presetOf(settings.providerId)?.needsKey !== false && !settings.apiKey.trim())
    return 'apiKey'
}

/** The host the key will be sent to, shown before anything is sent. */
export function hostOf(baseURL: string): string {
  try {
    return new URL(baseURL.trim()).host
  }
  catch {
    return ''
  }
}

export function endpointOf(settings: AiSettings): ChatEndpoint {
  return { baseURL: settings.baseURL.trim(), apiKey: settings.apiKey.trim(), model: settings.model.trim() }
}
