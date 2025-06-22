import type { VirtualModuleTemplate } from './types'
import { existsSync, readFileSync } from 'node:fs'

import { join } from 'node:path'
import { toAtFS } from '../../resolver'

export const templateLocales: VirtualModuleTemplate = {
  id: '/@advjs/locales',
  async getContent({ roots }) {
    const imports: string[] = [
      'import { createDefu } from "defu"',
      'const messages = { "zh-CN": {}, en: {} }',
      `
  const replaceArrMerge = createDefu((obj, key, value) => {
    if (key && obj[key] && Array.isArray(obj[key]) && Array.isArray(value)) {
      obj[key] = value
      return true
    }
  })
  `,
    ]
    const languages = ['zh-CN', 'en']

    roots.forEach((root, i) => {
      languages.forEach((lang) => {
        const langYml = join(root, 'locales', `${lang}.yml`)

        // file not null
        if (existsSync(langYml) && readFileSync(langYml, 'utf-8')) {
          const varName = lang.replace('-', '') + i
          imports.push(`import ${varName} from "${toAtFS(langYml)}"`)
          // pre override next
          imports.push(`messages['${lang}'] = replaceArrMerge(${varName}, messages['${lang}'])`)
        }
      })
    })

    imports.push('export default messages')
    return imports.join('\n')
  },
}
