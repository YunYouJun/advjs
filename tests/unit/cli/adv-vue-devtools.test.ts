// @vitest-environment node
import type { AdvConfig, ResolvedAdvOptions } from '@advjs/types'
import type { AdvServerOptions } from '../../../packages/advjs/node/options'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createServer } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { loadAdvConfig } from '../../../packages/advjs/node/config'
import { createDevToolsPlugins } from '../../../packages/advjs/node/vite/devtools'

function options(root: string, config: AdvConfig, mode: ResolvedAdvOptions['mode'] = 'dev') {
  return {
    mode,
    userRoot: root,
    clientRoot: root,
    data: { config, gameConfig: {} } as ResolvedAdvOptions['data'],
  }
}

describe('vue DevTools project switch', () => {
  it.each([
    { name: 'default off', vue: undefined, tools: true, enabled: false, adv: true },
    { name: 'explicit off', vue: false, tools: true, enabled: false, adv: true },
    { name: 'explicit on', vue: true, tools: true, enabled: true, adv: true },
    { name: 'managed player preview', vue: true, tools: false, enabled: false, adv: false },
    { name: 'editor enables Vue only', vue: false, tools: { adv: false, vue: true }, enabled: true, adv: false },
    { name: 'editor disables Vue despite project config', vue: true, tools: { adv: false, vue: false }, enabled: false, adv: false },
  ] satisfies { name: string, vue?: boolean, tools: AdvServerOptions['devtools'], enabled: boolean, adv: boolean }[])('$name controls the injected toolbar', async ({ vue, tools, enabled, adv }) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-tools-')))
    let server: Awaited<ReturnType<typeof createServer>> | undefined
    try {
      // Vue Inspector deliberately skips NODE_ENV=test; exercise a real dev server.
      vi.stubEnv('NODE_ENV', 'development')
      await writeFile(join(root, 'adv.config.json'), JSON.stringify(vue === undefined ? {} : { devtools: { vue } }))
      await writeFile(join(root, 'main.ts'), 'export const game = true\n')
      const { config } = await loadAdvConfig({ userRoot: root })
      expect(config.devtools?.vue).toBe(vue ?? false)
      const plugins = await createDevToolsPlugins(options(root, config), { devtools: tools })
      server = await createServer({
        configFile: false,
        root,
        plugins,
        logLevel: 'silent',
        server: { middlewareMode: true, hmr: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      })
      const entry = await server.transformRequest('/main.ts')
      expect(entry?.code.includes('vite-plugin-vue-devtools/')).toBe(enabled)
      expect(entry?.code.includes('vite-plugin-vue-inspector/')).toBe(enabled)
      const html = await server.transformIndexHtml('/', '<html><head></head><body>Game</body></html>')
      expect(html.includes('/__advjs_devtools/runtime.js')).toBe(adv)
    }
    finally {
      await server?.close()
      vi.unstubAllEnvs()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('omits both toolchains in a player build even when Vue DevTools is enabled', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-tools-build-')))
    try {
      await writeFile(join(root, 'main.ts'), 'document.body.textContent = "Game"\n')
      await writeFile(join(root, 'index.html'), '<html><head></head><body><script type="module" src="/main.ts"></script></body></html>')
      const { config } = await loadAdvConfig({ userRoot: root, advConfig: { devtools: { vue: true } } })
      const plugins = await createDevToolsPlugins(options(root, config, 'build'), { devtools: { adv: true, vue: true } })
      const result = await build({ configFile: false, root, plugins, logLevel: 'silent', build: { write: false } })
      if (!('output' in result))
        throw new Error('Expected an in-memory player build')
      const output = result.output.map(item => item.type === 'chunk' ? item.code : item.source).join('\n')
      expect(output).not.toContain('vue-devtools')
      expect(output).not.toContain('vue-inspector')
      expect(output).not.toContain('__advjs_devtools')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
