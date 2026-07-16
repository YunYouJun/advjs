import type { AdvRuntimePluginReference } from '@advjs/types'
import type { VirtualModuleTemplate } from './types'
import { resolve } from 'node:path'
import { toAtFS } from '../resolver'

const exportNamePattern = /^[A-Za-z_$][\w$]*$/u
const activityNamePattern = /^[a-z][a-z0-9-]*$/u

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
    let activityRendererIndex = 0

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

      const activityRenderers = Object.entries(client.activities ?? {}).map(([activityName, renderer]) => {
        if (!activityNamePattern.test(activityName))
          throw new Error(`Invalid runtime activity renderer name: ${activityName}`)
        const rendererImportedName = renderer.export ?? 'default'
        if (rendererImportedName !== 'default' && !exportNamePattern.test(rendererImportedName))
          throw new Error(`Invalid runtime activity renderer export: ${rendererImportedName}`)
        const rendererLocalName = `__advActivityRenderer${activityRendererIndex++}`
        const rendererSource = JSON.stringify(moduleId(renderer.module, userRoot))
        imports.push(rendererImportedName === 'default'
          ? `import ${rendererLocalName} from ${rendererSource}`
          : `import { ${rendererImportedName} as ${rendererLocalName} } from ${rendererSource}`)
        return `${JSON.stringify(`${plugin.name}/${activityName}`)}:${rendererLocalName}`
      })

      const factory = `${localName}(${JSON.stringify(client.options ?? {})})`
      factories.push(activityRenderers.length
        ? `Object.assign(${factory},{"activityRenderers":{${activityRenderers.join(',')}}})`
        : factory)
    })

    return [...imports, `export default [${factories.join(',')}]`].join('\n')
  },
}
