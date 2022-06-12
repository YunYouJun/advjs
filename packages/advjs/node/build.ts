import { resolve } from 'path'
import fs from 'fs-extra'
import type { InlineConfig, ResolvedConfig } from 'vite'
import { resolveConfig, build as viteBuild } from 'vite'
import { ViteAdvPlugin } from './plugins/preset'
import { getIndexHtml, mergeViteConfigs } from './common'
import type { ResolvedAdvOptions } from './options'

export async function build(
  options: ResolvedAdvOptions,
  viteConfig: InlineConfig = {},
) {
  const indexPath = resolve(options.userRoot, 'index.html')
  const rawConfig = await resolveConfig({}, 'build')
  const pluginOptions = rawConfig.advjs || {}

  let originalIndexHTML: string | undefined
  if (fs.existsSync(indexPath))
    originalIndexHTML = await fs.readFile(indexPath, 'utf-8')

  await fs.writeFile(indexPath, await getIndexHtml(options), 'utf-8')
  let config: ResolvedConfig = undefined!

  try {
    const inlineConfig = await mergeViteConfigs(
      options,
      viteConfig,
      <InlineConfig>({
        root: options.userRoot,
        plugins: [
          await ViteAdvPlugin(options, pluginOptions),
          {
            name: 'resolve-config',
            configResolved(_config) {
              config = _config
            },
          },
        ],
        build: {
          chunkSizeWarningLimit: 2000,
        },
      }),
      'build',
    )

    await viteBuild(inlineConfig)
  }
  finally {
    if (originalIndexHTML != null)
      await fs.writeFile(indexPath, originalIndexHTML, 'utf-8')
    else
      await fs.unlink(indexPath)
  }

  const outDir = resolve(options.userRoot, config.build.outDir)

  // copy index.html to 404.html for GitHub Pages
  await fs.copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
  // _redirects for SPA
  const redirectsPath = resolve(outDir, '_redirects')
  if (!fs.existsSync(redirectsPath))
    await fs.writeFile(redirectsPath, `${config.base}*    ${config.base}index.html   200\n`, 'utf-8')
}
