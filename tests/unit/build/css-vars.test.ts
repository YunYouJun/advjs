// @vitest-environment node

import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, it } from 'vitest'

it('minifies AGUI styles with valid light and dark code color references', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-css-vars-')))
  const source = fileURLToPath(new URL('../../../packages/gui/client/styles/css-vars.scss', import.meta.url)).replaceAll('\\', '/')

  try {
    await writeFile(join(root, 'index.html'), '<link rel="stylesheet" href="/styles.scss">')
    await writeFile(join(root, 'styles.scss'), `@use "${source}";`)
    const result = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      build: { write: false, cssMinify: 'lightningcss' },
    })
    const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output)
    const asset = output.find(item => item.type === 'asset' && item.fileName.endsWith('.css'))
    if (!asset || asset.type !== 'asset')
      throw new Error('Expected a CSS build asset')
    const css = String(asset.source)

    expect(css).toMatch(/--agui-c-text-light-code:\s*var\(--agui-c-indigo-soft\)/)
    expect(css).toMatch(/--agui-c-text-dark-code:\s*var\(--agui-c-indigo-light\)/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
