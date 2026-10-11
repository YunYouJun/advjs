/** Authoring-only project dictionary, never part of the player publication. */
export interface AudioPronunciationDictionary {
  schemaVersion: 1
  /** Increased by revision-checked saves; zero is the absent-document default. */
  revision: number
  replacements: Record<string, string>
  /** Exact canonical BCP 47 keys; no language fallback. */
  locales: Record<string, { replacements: Record<string, string> }>
}
