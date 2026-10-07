import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { build } from 'vite'

/** Bundle Vite's raw imports so the host and renderer share template content. */
export async function buildProjectTemplates(repository) {
  const bundle = await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@advjs/template': resolve(repository, 'packages/advjs/template') } },
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve(repository, 'editor/core/app/templates/index.ts'), formats: ['es'] },
    },
  })
  const output = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(item => item.type === 'chunk' && item.isEntry)
  if (!output)
    throw new Error('Project templates did not produce an entry module')
  const module = await import(`data:text/javascript;base64,${Buffer.from(output.code).toString('base64')}`)
  return module.PROJECT_TEMPLATE_LIST
}
