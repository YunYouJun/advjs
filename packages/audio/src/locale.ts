/** Project files use canonical BCP 47. Runtime resolution never guesses a locale. */
export function normalizeAudioLocale(value: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.includes('_'))
    throw new Error('Audio locale must be a BCP 47 language tag')
  try {
    const [canonical] = Intl.getCanonicalLocales(value)
    if (!canonical)
      throw new Error('empty locale')
    return canonical
  }
  catch {
    throw new Error(`Invalid audio locale: ${value}`)
  }
}

export const normalizeLocale = normalizeAudioLocale
