import type { EditorLocalePreference } from '../utils/editor-locale'
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { isEditorLocalePreference, resolveEditorLocale } from '../utils/editor-locale'

export function useEditorLocale() {
  const { locale, setLocale, locales } = useI18n()
  const storedPreference = useStorage<string>('advjs:editor:locale', 'auto', undefined, { writeDefaults: false })
  const savedLocale = computed<EditorLocalePreference>(() => isEditorLocalePreference(storedPreference.value) ? storedPreference.value : 'auto')

  function browserLanguages(): readonly string[] {
    return typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  }

  async function initLocale(): Promise<void> {
    const code = resolveEditorLocale(savedLocale.value, browserLanguages())
    if (code !== locale.value)
      await setLocale(code)
  }

  async function changeLocale(preference: EditorLocalePreference): Promise<void> {
    await setLocale(resolveEditorLocale(preference, browserLanguages()))
    storedPreference.value = preference
  }

  const availableLocales = computed(() => {
    return locales.value.map((l) => {
      if (typeof l === 'string')
        return { code: l, name: l }
      return { code: l.code, name: l.name || l.code }
    })
  })

  return { locale, locales, availableLocales, savedLocale, initLocale, changeLocale }
}
