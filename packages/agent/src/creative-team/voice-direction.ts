import type { CreativeFileChange } from './contracts'
import type { CreativePartnerOutput } from './outputs'
import { JSON_SCHEMA, load } from 'js-yaml'

/** Provider-neutral voice intent only; supplier identities and rights are never proposed here. */
export interface CreativeVoiceIntent {
  ageImpression?: string
  genderExpression?: string
  temperament?: string[]
  speakingStyle?: string
  pitch?: 'low' | 'medium' | 'high'
  pace?: 'slow' | 'medium' | 'fast'
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('CREATIVE_VOICE_SETTINGS_INVALID')
  return value as Record<string, unknown>
}
export function parseCreativeVoiceIntent(value: unknown): CreativeVoiceIntent {
  const source = object(value)
  if (Object.keys(source).some(key => !['ageImpression', 'genderExpression', 'temperament', 'speakingStyle', 'pitch', 'pace'].includes(key)))
    throw new TypeError('CREATIVE_VOICE_INTENT_AUTHORITY')
  for (const field of ['ageImpression', 'genderExpression', 'speakingStyle']) {
    if (source[field] !== undefined && (typeof source[field] !== 'string' || !source[field].trim() || source[field].length > 4000))
      throw new TypeError('CREATIVE_VOICE_INTENT_INVALID')
  }
  if (source.temperament !== undefined && (!Array.isArray(source.temperament) || source.temperament.length > 16 || source.temperament.some(item => typeof item !== 'string' || !item.trim() || item.length > 160)))
    throw new TypeError('CREATIVE_VOICE_INTENT_INVALID')
  if ((source.pitch !== undefined && !['low', 'medium', 'high'].includes(String(source.pitch))) || (source.pace !== undefined && !['slow', 'medium', 'fast'].includes(String(source.pace))))
    throw new TypeError('CREATIVE_VOICE_INTENT_INVALID')
  return JSON.parse(JSON.stringify(source)) as CreativeVoiceIntent
}
export function creativeVoiceLocale(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || Intl.getCanonicalLocales(value)[0] !== value)
    throw new TypeError('CREATIVE_VOICE_LOCALE_INVALID')
  return value
}
export function assertCreativeDictionaryTerms(entries: readonly { term: string, pronunciation: string }[]) {
  if (new Set(entries.map(item => item.term)).size !== entries.length)
    throw new TypeError('CREATIVE_VOICE_DICTIONARY_DUPLICATE')
  for (const { term, pronunciation } of entries) {
    if ([term, pronunciation].some(value => !value.trim() || value !== value.normalize('NFC') || /[<>\n\r\t]/u.test(value) || /\{\{[^}]*\}\}|\$\{[^}]*\}/u.test(value)) || ['__proto__', 'prototype', 'constructor'].includes(term))
      throw new TypeError('CREATIVE_VOICE_DICTIONARY_LITERAL_REQUIRED')
  }
}
function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) >= Number.MAX_SAFE_INTEGER)
    throw new TypeError('CREATIVE_VOICE_SETTINGS_INVALID')
  return Number(value) + 1
}
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export function isCreativeVoiceSettingsPath(path: string): boolean {
  return /^adv\/(?:audio\/(?:pronunciation|voice-profiles)\.json|characters\/[a-z][\w-]*\.character\.md)$/i.test(path)
}

/** Finite locale dictionary + intent patches; existing providers, rights and prose survive unchanged. */
export function creativeVoiceDirectionFileChanges(output: Extract<CreativePartnerOutput, { kind: 'voice-direction' }>, files: Readonly<Record<string, string>>): CreativeFileChange[] {
  // Legacy plans are suggestions until an explicit language is supplied for adoption.
  if (!output.locale)
    return []
  const locale = creativeVoiceLocale(output.locale)
  const changes: CreativeFileChange[] = []
  function change(path: string, value: unknown) {
    const after = json(value)
    if (after !== files[path])
      changes.push({ path, before: files[path] ?? null, after })
  }
  if (output.dictionary.length) {
    assertCreativeDictionaryTerms(output.dictionary)
    const path = 'adv/audio/pronunciation.json'
    const original = files[path] ? object(JSON.parse(files[path])) : { schemaVersion: 1, revision: 0, replacements: {}, locales: {} }
    if (original.schemaVersion !== 1 || Object.keys(original).some(key => !['schemaVersion', 'revision', 'replacements', 'locales'].includes(key)))
      throw new TypeError('CREATIVE_VOICE_SETTINGS_INVALID')
    const locales = object(original.locales)
    const binding = locales[locale] === undefined ? { replacements: {} } : object(locales[locale])
    const previous = object(binding.replacements)
    const replacements = Object.fromEntries(output.dictionary.map(item => [item.term, item.pronunciation]))
    if (Object.entries(replacements).some(([term, value]) => previous[term] !== value))
      change(path, { ...original, revision: revision(original.revision), locales: { ...locales, [locale]: { ...binding, replacements: { ...previous, ...replacements } } } })
  }
  for (const cast of output.cast) {
    if (!cast.intent || !Object.keys(cast.intent).length)
      continue
    const intent = parseCreativeVoiceIntent(cast.intent)
    if (cast.speakerId === 'narrator') {
      const path = 'adv/audio/voice-profiles.json'
      const original = files[path] ? object(JSON.parse(files[path])) : { schemaVersion: 1, revision: 0 }
      if (original.schemaVersion !== 1 || Object.keys(original).some(key => !['schemaVersion', 'revision', 'narrator'].includes(key)))
        throw new TypeError('CREATIVE_VOICE_SETTINGS_INVALID')
      const profile = original.narrator === undefined ? { intent: {} } : object(original.narrator)
      const previous = object(profile.intent)
      if (Object.entries(intent).some(([field, value]) => JSON.stringify(previous[field]) !== JSON.stringify(value)))
        change(path, { ...original, revision: revision(original.revision), narrator: { ...profile, intent: { ...previous, ...intent } } })
    }
    else {
      if (!/^[a-z][\w-]*$/i.test(cast.speakerId))
        throw new TypeError('CREATIVE_VOICE_SPEAKER_INVALID')
      const path = `adv/characters/${cast.speakerId}.character.md`
      const content = files[path]
      const header = content?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
      if (!header)
        throw new TypeError('CREATIVE_VOICE_CHARACTER_REQUIRED')
      const data = object(load(header[1], { schema: JSON_SCHEMA }))
      if (data.id !== cast.speakerId)
        throw new TypeError('CREATIVE_VOICE_SPEAKER_INVALID')
      const profile = data.voiceProfile === undefined ? { intent: {} } : object(data.voiceProfile)
      const previous = object(profile.intent)
      if (Object.entries(intent).some(([field, value]) => JSON.stringify(previous[field]) !== JSON.stringify(value))) {
        changes.push({ path, before: content!, after: `---\n${JSON.stringify({ ...data, voiceProfile: { ...profile, intent: { ...previous, ...intent } } }, null, 2)}\n---\n${content!.slice(header[0].length)}` })
      }
    }
  }
  return changes
}
