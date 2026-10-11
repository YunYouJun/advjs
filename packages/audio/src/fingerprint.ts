import type { JsonObject, JsonValue } from '@advjs/types'
import { normalizeAudioLocale } from './locale'

const SENSITIVE = /^(?:api[-_]?key|access[-_]?token|token|password|secret|credentials?|authorization|signed[-_]?url)$/iu

/** Stable JSON encoding rejects non-JSON values and sensitive authoring fields. */
export function canonicalAudioJson(value: unknown): string {
  const ancestors = new WeakSet<object>()
  function encode(input: unknown): string {
    if (input === null || typeof input === 'boolean' || typeof input === 'string') {
      if (typeof input === 'string' && /[?&](?:X-Amz-Signature|X-Amz-Credential|x-cos-signature|q-signature|signature|sig)=/iu.test(input))
        throw new Error('Signed URLs cannot be stored in audio project files')
      return JSON.stringify(input)
    }
    if (typeof input === 'number' && Number.isFinite(input))
      return JSON.stringify(input)
    if (input && typeof input === 'object') {
      if (ancestors.has(input))
        throw new Error('Audio project files cannot contain circular values')
      ancestors.add(input)
    }
    if (Array.isArray(input)) {
      const result = `[${Array.from(input, encode).join(',')}]`
      ancestors.delete(input)
      return result
    }
    if (input && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype) {
      const result = `{${Object.keys(input).sort().map((key) => {
        if (SENSITIVE.test(key))
          throw new Error('Credentials cannot be stored in audio project files')
        return `${JSON.stringify(key)}:${encode((input as Record<string, unknown>)[key])}`
      }).join(',')}}`
      ancestors.delete(input)
      return result
    }
    throw new Error('Audio project files must contain only JSON values')
  }
  return encode(value)
}

export async function audioFingerprint(value: JsonValue | unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalAudioJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export interface VoiceFingerprintInput {
  spokenText: string
  locale: string
  speakerId: string
  providerId: string
  voiceId: string
  model: string
  voiceProfileRevision: string
  pronunciationRevision?: string
  parameters?: JsonObject
}

export async function voiceInputFingerprint(input: VoiceFingerprintInput): Promise<string> {
  return await audioFingerprint({ ...input, spokenText: input.spokenText.normalize('NFC'), locale: normalizeAudioLocale(input.locale), parameters: input.parameters ?? {} })
}
