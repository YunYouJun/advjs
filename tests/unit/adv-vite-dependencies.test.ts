// @vitest-environment node

import type { ResolvedAdvOptions } from '@advjs/types'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import { describe, expect, it } from 'vitest'
import { createConfigPlugin } from '../../packages/advjs/node/vite/extendConfig'

const repositoryRoot = resolve(import.meta.dirname, '../..')

describe('adv renderer dependency resolution', () => {
  it('shares the client renderer when the project installs a different PixiJS version', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'advjs-vite-dependencies-'))
    const clientRoot = resolve(repositoryRoot, 'packages/client')
    const projectPixiRoot = join(projectRoot, 'node_modules/pixi.js')
    await mkdir(projectPixiRoot, { recursive: true })
    await writeFile(join(projectPixiRoot, 'package.json'), JSON.stringify({
      name: 'pixi.js',
      version: '7.0.0',
      type: 'module',
      exports: './index.js',
    }))
    await writeFile(join(projectPixiRoot, 'index.js'), 'export const VERSION = "7.0.0"\n')
    const options = {
      env: 'plugin',
      mode: 'dev',
      userRoot: projectRoot,
      userWorkspaceRoot: projectRoot,
      clientRoot,
      cliRoot: resolve(repositoryRoot, 'packages/advjs'),
      themeRoot: resolve(repositoryRoot, 'themes/theme-default'),
      roots: [],
      plugins: [],
      build: { singlefile: true },
      data: { config: { theme: 'default', features: { babylon: false } } },
    } as unknown as ResolvedAdvOptions
    const server = await createServer({
      configFile: false,
      root: projectRoot,
      plugins: [createConfigPlugin(options)],
      server: { middlewareMode: true, hmr: false },
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    })
    try {
      const resolver = server.environments.client.pluginContainer
      const fromClient = await resolver.resolveId('pixi.js', join(clientRoot, 'pixi/game.ts'))
      const fromProject = await resolver.resolveId('pixi.js', join(projectRoot, 'main.ts'))
      expect(fromClient).not.toBeNull()
      expect(fromProject?.id).toBe(fromClient?.id)
      expect(fromProject?.id).not.toContain(projectPixiRoot)
      const helper = await resolver.resolveId('@advjs/client/composables/useAdvMotionPreference', join(options.themeRoot, 'pages/start.vue'))
      expect(helper?.id).toBe(join(clientRoot, 'composables/useAdvMotionPreference.ts'))
    }
    finally {
      await server.close()
      await rm(projectRoot, { recursive: true, force: true })
    }
  })
})
