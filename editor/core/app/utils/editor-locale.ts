export type EditorLocale = 'en' | 'zh-CN'
export type EditorLocalePreference = EditorLocale | 'auto'

/** Keep unsupported or stale stored preferences in automatic mode. */
export function isEditorLocalePreference(value: unknown): value is EditorLocalePreference {
  return value === 'auto' || value === 'en' || value === 'zh-CN'
}

/** Use the first supported browser language, with English as the fallback. */
export function resolveEditorLocale(preference: unknown, languages: readonly string[]): EditorLocale {
  if (preference === 'en' || preference === 'zh-CN')
    return preference
  for (const language of languages) {
    const base = language.trim().toLowerCase().split(/[-_]/u)[0]
    if (base === 'zh')
      return 'zh-CN'
    if (base === 'en')
      return 'en'
  }
  return 'en'
}
