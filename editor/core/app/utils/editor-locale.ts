export type EditorLocale = 'en' | 'zh-CN'

/** Only web first visits consult the browser; desktop preferences stay authoritative. */
export function resolveEditorLocale(saved: unknown, languages: readonly string[] = []): EditorLocale {
  if (saved === 'en' || saved === 'zh-CN')
    return saved
  for (const language of languages) {
    if (/^zh(?:-|$)/iu.test(language))
      return 'zh-CN'
    if (/^en(?:-|$)/iu.test(language))
      return 'en'
  }
  return 'en'
}
