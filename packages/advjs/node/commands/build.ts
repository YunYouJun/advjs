import type { InlineConfig, ResolvedConfig } from 'vite'
import type { ResolvedAdvOptions } from '../options'
import { resolve } from 'node:path'
import fs from 'fs-extra'
import { build as viteBuild } from 'vite'
import setupIndexHtml from '../setups/indexHtml'
import { resolveViteConfigs } from './shared'

export async function build(
  options: ResolvedAdvOptions,
  viteConfig: InlineConfig = {},
) {
  const indexPath = resolve(options.userRoot, 'index.html')

  let originalIndexHTML: string | undefined
  if (fs.existsSync(indexPath))
    originalIndexHTML = await fs.readFile(indexPath, 'utf-8')

  await fs.writeFile(indexPath, setupIndexHtml(options), 'utf-8')
  let config: ResolvedConfig = undefined!

  try {
    const inlineConfig = await resolveViteConfigs(
      options,
      <InlineConfig>{
        plugins: [
          {
            name: 'resolve-config',
            configResolved(_config) {
              config = _config
            },
          },
        ],
        build: {
          emptyOutDir: true,
          chunkSizeWarningLimit: 2000,
          rollupOptions: {
            output: {
              manualChunks: {
                advjs: ['advjs'],
                advjs_core: ['@advjs/core'],
                advjs_client: ['@advjs/client'],
                advjs_parser: ['@advjs/parser'],
                pixijs: ['pixi.js'],
              },
            },
          },
        },
        ssr: {
          // TODO: workaround until they support native ESM
          noExternal: ['workbox-window', /vue-i18n/],
        },
      },
      viteConfig,
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

  // _redirects for SPA
  const redirectsPath = resolve(outDir, '_redirects')
  if (!fs.existsSync(redirectsPath))
    await fs.writeFile(redirectsPath, `${config.base}*    ${config.base}index.html   200\n`, 'utf-8')
}
