import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'

/**
 * Detect initial locale from browser or localStorage.
 */
function getInitialLocale(): string {
  const saved = localStorage.getItem('advjs-studio-locale')
  if (saved)
    return saved

  const browserLang = navigator.language
  if (browserLang.startsWith('zh'))
    return 'zh-CN'

  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    'en': en,
    'zh-CN': zhCN,
  },
})

export default i18n
