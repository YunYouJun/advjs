import { useStorage } from '@vueuse/core'

export function useEditorLocale() {
  const { locale, setLocale, locales } = useI18n()
  const savedLocale = useStorage<'en' | 'zh-CN'>('advjs:editor:locale', 'en')
  const onboarded = useStorage('advjs:editor:onboarded', false)

  async function initLocale() {
    if (!import.meta.client)
      return
    if (savedLocale.value !== 'en' && savedLocale.value !== 'zh-CN')
      savedLocale.value = 'en'
    const host = window.advDesktop
    if (host) {
      const preferences = await host.preferences()
      if (preferences.locale)
        savedLocale.value = preferences.locale
      onboarded.value = preferences.onboarded || onboarded.value
      // Migrate preferences remembered by an older, origin-bound Editor.
      if (!preferences.locale || preferences.onboarded !== onboarded.value)
        await host.setPreferences({ locale: savedLocale.value, onboarded: onboarded.value })
    }
    if (savedLocale.value !== locale.value)
      await setLocale(savedLocale.value)
  }

  async function changeLocale(code: 'en' | 'zh-CN') {
    savedLocale.value = code
    await Promise.all([setLocale(code), window.advDesktop?.setPreferences({ locale: code })])
  }

  async function completeOnboarding(code?: 'en' | 'zh-CN') {
    if (code)
      await changeLocale(code)
    await window.advDesktop?.setPreferences({ onboarded: true })
    onboarded.value = true
  }

  const availableLocales = computed(() => {
    return locales.value.map((l) => {
      if (typeof l === 'string')
        return { code: l, name: l }
      return { code: l.code, name: l.name || l.code }
    })
  })

  return { locale, locales, availableLocales, savedLocale, onboarded, initLocale, changeLocale, completeOnboarding }
}
