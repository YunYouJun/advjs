import type { AudioPronunciationDictionary } from '@advjs/types'
import { canonicalAudioJson } from './fingerprint'
import { normalizeAudioLocale } from './locale'

export const AUDIO_PRONUNCIATION_PATH = 'adv/audio/pronunciation.json'
export const audioPronunciationLimits = { entries: 512, keyCharacters: 128, replacementCharacters: 256, totalCharacters: 16384, textCharacters: 65536 } as const

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error('AUDIO_PRONUNCIATION_INVALID: Expected a plain dictionary object')
  return value as Record<string, unknown>
}

export function createAudioPronunciationDictionary(): AudioPronunciationDictionary {
  return { schemaVersion: 1, revision: 0, replacements: {}, locales: {} }
}

/** Literal bounded replacements cannot invoke regex, SSML, or runtime variables. */
export function parseAudioPronunciationDictionary(value: unknown): AudioPronunciationDictionary {
  if (typeof value === 'string') {
    if (value.length > 131072)
      throw new Error('AUDIO_PRONUNCIATION_LIMIT')
    value = JSON.parse(value)
  }
  canonicalAudioJson(value)
  const source = object(value)
  if (Object.keys(source).some(key => !['schemaVersion', 'revision', 'replacements', 'locales'].includes(key)) || source.schemaVersion !== 1 || !Number.isSafeInteger(source.revision) || Number(source.revision) < 0)
    throw new Error('AUDIO_PRONUNCIATION_INVALID: Expected schemaVersion 1 and a nonnegative revision')
  let entries = 0
  let characters = 0
  function replacements(input: unknown): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(object(input))) {
      if (!key.trim() || key !== key.normalize('NFC') || typeof value !== 'string' || !value.trim() || value !== value.normalize('NFC')
        || /[<>\n\r\t]/u.test(key + value) || /\{\{[^}]*\}\}|\$\{[^}]*\}/u.test(key + value)
        || ['__proto__', 'prototype', 'constructor'].includes(key)) {
        throw new Error('AUDIO_PRONUNCIATION_INVALID: Replacements must be literal NFC prose')
      }
      entries++
      characters += Array.from(key).length + Array.from(value).length
      if (entries > audioPronunciationLimits.entries || characters > audioPronunciationLimits.totalCharacters || Array.from(key).length > audioPronunciationLimits.keyCharacters || Array.from(value).length > audioPronunciationLimits.replacementCharacters)
        throw new Error('AUDIO_PRONUNCIATION_LIMIT')
      result[key] = value
    }
    return result
  }
  const global = replacements(source.replacements)
  const locales: AudioPronunciationDictionary['locales'] = {}
  const localeEntries = Object.entries(object(source.locales))
  if (localeEntries.length > 64)
    throw new Error('AUDIO_PRONUNCIATION_LIMIT')
  for (const [locale, value] of localeEntries) {
    if (normalizeAudioLocale(locale) !== locale)
      throw new Error('AUDIO_PRONUNCIATION_LOCALE_INVALID: Dictionary locales must be canonical and exact')
    const binding = object(value)
    if (Object.keys(binding).some(key => key !== 'replacements'))
      throw new Error('AUDIO_PRONUNCIATION_INVALID')
    locales[locale] = { replacements: replacements(binding.replacements) }
  }
  return { schemaVersion: 1, revision: Number(source.revision), replacements: global, locales }
}

export function serializeAudioPronunciationDictionary(value: AudioPronunciationDictionary): string {
  return `${JSON.stringify(parseAudioPronunciationDictionary(value), null, 2)}\n`
}

/** The absent document preserves old fingerprints; a saved document is versioned. */
export function activeAudioPronunciationDictionary(value?: AudioPronunciationDictionary): AudioPronunciationDictionary | undefined {
  const dictionary = parseAudioPronunciationDictionary(value ?? createAudioPronunciationDictionary())
  return dictionary.revision || Object.keys(dictionary.replacements).length || Object.keys(dictionary.locales).length ? dictionary : undefined
}

export function audioPronunciationReplacements(dictionary: AudioPronunciationDictionary | undefined, locale: string): Record<string, string> {
  const parsed = parseAudioPronunciationDictionary(dictionary ?? createAudioPronunciationDictionary())
  return { ...parsed.replacements, ...parsed.locales[normalizeAudioLocale(locale)]?.replacements }
}
