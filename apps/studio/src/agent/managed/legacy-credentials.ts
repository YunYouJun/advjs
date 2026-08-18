const LEGACY_AI_STORAGE_KEYS = [
  'advjs-studio-ai',
] as const

/** Removes legacy browser BYOK data without reading, parsing, logging, or uploading it. */
export function clearLegacyStudioAiCredentials(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  for (const key of LEGACY_AI_STORAGE_KEYS)
    storage.removeItem(key)
}
