import type { AdvEntryOptions, ResolvedAdvOptions } from '@advjs/types'
import type { InlineConfig, ResolvedConfig } from 'vite'
import path, { resolve } from 'node:path'
import fs from 'fs-extra'
import { mergeConfig, build as viteBuild } from 'vite'
import { printInfo } from '../../cli/utils'
import { resolveOptions } from '../../options'
import setupIndexHtml from '../../setups/indexHtml'
import { resolveViteConfigs } from '../shared'

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

export async function advBuild(entryOptions: AdvEntryOptions) {
  const options = await resolveOptions(entryOptions, 'build')

  printInfo(options)

  const mergedViteConfig = mergeConfig({
    base: options.base || '/',
    build: {
      outDir: path.resolve(options.userRoot, options.outDir || 'dist'),
    },
  }, entryOptions.vite || {})
  await build(options, mergedViteConfig)
}
