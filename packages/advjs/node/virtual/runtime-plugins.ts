import type { AdvRuntimePluginReference } from '@advjs/types'
import type { VirtualModuleTemplate } from './types'
import { resolve } from 'node:path'
import { toAtFS } from '../resolver'

const exportNamePattern = /^[A-Za-z_$][\w$]*$/u

function moduleId(value: string, userRoot: string): string {
  return value.startsWith('.') ? toAtFS(resolve(userRoot, value)) : value
}

export const templateRuntimePlugins: VirtualModuleTemplate = {
  id: '/@advjs/runtime-plugins',
  getContent({ data, userRoot }) {
    const plugins = (data.config.plugins ?? []).filter((plugin): plugin is AdvRuntimePluginReference => (
      'version' in plugin && typeof plugin.version === 'string'
    ))
    const imports: string[] = []
    const factories: string[] = []

    plugins.forEach((plugin) => {
      const client = plugin.client
      if (!client)
        return
      const index = factories.length
      const localName = `__advRuntimePlugin${index}`
      const importedName = client.export ?? 'default'
      if (importedName !== 'default' && !exportNamePattern.test(importedName))
        throw new Error(`Invalid runtime plugin client export: ${importedName}`)
      const source = JSON.stringify(moduleId(client.module, userRoot))
      imports.push(importedName === 'default'
        ? `import ${localName} from ${source}`
        : `import { ${importedName} as ${localName} } from ${source}`)
      factories.push(`${localName}(${JSON.stringify(client.options ?? {})})`)
    })

    return [...imports, `export default [${factories.join(',')}]`].join('\n')
  },
}
