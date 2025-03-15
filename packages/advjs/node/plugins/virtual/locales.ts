import type { VirtualModuleTemplate } from './types'
import { existsSync, readFileSync } from 'node:fs'

import { toAtFS } from '../../resolver'

export const templateLocales: VirtualModuleTemplate = {
  id: '/@advjs/locales',
  async getContent({ roots }) {
    const imports: string[] = [
      'const messages = { "zh-CN": {}, en: {} }',
    ]
    const languages = ['zh-CN', 'en']

    roots.forEach((root, i) => {
      languages.forEach((lang) => {
        const langYml = `${root}/locales/${lang}.yml`
        // file not null
        if (existsSync(langYml) && readFileSync(langYml, 'utf-8')) {
          const varName = lang.replace('-', '') + i
          imports.push(`import ${varName} from "${toAtFS(langYml)}"`)
          imports.push(`Object.assign(messages['${lang}'], ${varName})`)
        }
      })
    })

    imports.push('export default messages')
    return imports.join('\n')
  },
}
