/** SPIKE: offline player entry for WKWebView. */
import { createPinia } from 'pinia'
import gameMessages from 'virtual:advjs-game-locales'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import NativePlayer from './NativePlayer.vue'
import 'virtual:uno.css'

const i18n = createI18n({
  legacy: false,
  locale: navigator.language.startsWith('zh') ? 'zh-CN' : 'en',
  fallbackLocale: 'en',
  messages: gameMessages,
})

createApp(NativePlayer)
  .use(createPinia())
  .use(i18n)
  .mount('#app')
