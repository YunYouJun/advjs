import type { AudioPronunciationDictionary } from '@advjs/types'
import { audioFingerprint } from './fingerprint'
import { activeAudioPronunciationDictionary, audioPronunciationLimits, audioPronunciationReplacements, parseAudioPronunciationDictionary } from './pronunciation'

export interface SpokenTextOptions {
  override?: string
  pronunciation?: Record<string, string>
}

/** Deterministic authoring text. Unresolved variables require an explicit override. */
export function normalizeSpokenText(displayText: string, options: SpokenTextOptions = {}): string {
  let text = options.override ?? displayText
  if (typeof text !== 'string' || Array.from(text).length > audioPronunciationLimits.textCharacters)
    throw new Error('AUDIO_PRONUNCIATION_LIMIT: Spoken text exceeds the bounded authoring limit')
  if (options.override === undefined && /\{\{[^}]+\}\}|\$\{[^}]+\}/u.test(text))
    throw new Error('Dialogue with runtime variables needs an explicit spoken-text override')
  text = text
    .replace(/\s*\{#line_[^}]+\}\s*$/u, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]+>/gu, '')
    .replace(/[*_~`]/gu, '')
    .replace(/^\s*>\s?/gmu, '')
    .replace(/[ \t]+/gu, ' ')
    .replace(/\s*\n\s*/gu, '\n')
    .trim()
    .normalize('NFC')
  if (options.override === undefined && options.pronunciation) {
    const replacements = parseAudioPronunciationDictionary({ schemaVersion: 1, revision: 0, replacements: options.pronunciation, locales: {} }).replacements
    const keys = Object.keys(replacements).sort((left, right) => right.length - left.length || (left < right ? -1 : left > right ? 1 : 0))
    if (keys.length) {
      const pattern = keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')
      text = text.replace(new RegExp(pattern, 'gu'), key => replacements[key]!)
    }
  }
  if (Array.from(text).length > audioPronunciationLimits.textCharacters)
    throw new Error('AUDIO_PRONUNCIATION_LIMIT: Dictionary expansion exceeds the spoken-text limit')
  if (!text)
    throw new Error('Spoken text must not be empty')
  return text
}
export function resolveVoiceSpokenText(displayText: string, options: { override?: string, locale: string, pronunciation?: AudioPronunciationDictionary }): string {
  return normalizeSpokenText(displayText, { override: options.override, pronunciation: audioPronunciationReplacements(options.pronunciation, options.locale) })
}

/** The same resolved prose and dictionary identity feed providers and take fingerprints. */
export async function prepareVoiceSpokenText(displayText: string, options: { override?: string, locale: string, pronunciation?: AudioPronunciationDictionary }): Promise<{ text: string, pronunciationRevision?: string }> {
  const pronunciation = activeAudioPronunciationDictionary(options.pronunciation)
  return { text: resolveVoiceSpokenText(displayText, options), ...(options.override === undefined && pronunciation ? { pronunciationRevision: await audioFingerprint(pronunciation) } : {}) }
}
