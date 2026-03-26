import { useStorage } from '@vueuse/core'

export function useEditorLocale() {
  const { locale, setLocale, locales } = useI18n()
  const savedLocale = useStorage('advjs:editor:locale', 'en')

  function initLocale() {
    if (savedLocale.value && savedLocale.value !== locale.value)
      setLocale(savedLocale.value)
  }

  function changeLocale(code: string) {
    setLocale(code)
    savedLocale.value = code
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
