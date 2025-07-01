import type { UserModule } from '@advjs/client/types'
import { createI18n } from 'vue-i18n'

// Import i18n resources
// https://vitejs.dev/guide/features.html#glob-import
//
// Don't need this? Try vitesse-lite: https://github.com/antfu/vitesse-lite
// const messages = Object.fromEntries(
//   Object.entries(import.meta.globEager('../../locales/*.y(a)?ml')).map(
//     ([key, value]) => {
//       const yaml = key.endsWith('.yaml')
//       return [key.slice(14, yaml ? -5 : -4), value.default]
//     },
//   ),
// )

// @ts-expect-error virtual
import messages from '/@advjs/locales'

const i18n = createI18n({
  legacy: false,
  locale: navigator.language === 'zh-CN' ? 'zh-CN' : 'en',
  messages,
})

export const $t = i18n.global.t

export const install: UserModule = ({ app }) => {
  app.use(i18n)
}
