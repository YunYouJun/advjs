// @vitest-environment node

import type { ResolvedAdvOptions } from '@advjs/types'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { createConfigPlugin } from '../../../packages/advjs/node/vite/extendConfig'

it('builds a multi-package game with the ADV.JS production configuration', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-chunks-')))
  const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const options = {
    mode: 'build',
    env: 'app',
    build: { singlefile: false },
    data: { config: { features: {}, theme: 'default' } },
    plugins: [],
    roots: [repositoryRoot],
    userRoot: root,
    userWorkspaceRoot: repositoryRoot,
    clientRoot: join(repositoryRoot, 'packages/client'),
    cliRoot: join(repositoryRoot, 'packages/advjs'),
    themeRoot: join(repositoryRoot, 'themes/theme-default'),
  } as unknown as ResolvedAdvOptions

  try {
    for (const name of ['core', 'client', 'parser']) {
      const directory = join(root, 'packages', name)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, 'index.js'), `export const value = '${name}'`)
    }
    await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>')
    await writeFile(join(root, 'main.js'), `
      import { value as core } from './packages/core/index.js'
      import { value as client } from './packages/client/index.js'
      import { value as parser } from './packages/parser/index.js'
      console.log('fixture game', core, client, parser)
    `)
    const result = await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [createConfigPlugin(options)],
      build: { write: false },
    })
    const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output)

    expect(output.some(item => item.type === 'chunk' && item.code.includes('fixture game'))).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
