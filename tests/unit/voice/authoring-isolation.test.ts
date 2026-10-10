// @vitest-environment node
import type { ResolvedAdvOptions } from '@advjs/types'
import type { PluginContext } from 'rollup'
import type { HmrContext } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { templateConfigs } from '../../../packages/advjs/node/virtual/configs'
import { templateData } from '../../../packages/advjs/node/virtual/data'
import { createAdvVirtualLoader } from '../../../packages/advjs/node/vite/loaders'
import { compileProject } from '../../../packages/core/src/project/compile'

const authoring = {
  voice: {
    library: 'private-voice-library.json',
    presets: { private: 'private-voice-preset.json' },
    defaultPreset: 'private',
    provider: { id: 'private-provider', preview: vi.fn() },
  },
}

describe('author-only voice isolation', () => {
  it('omits authoring from the project extension projection while keeping source files editable', async () => {
    const source = JSON.stringify({ id: 'voice-test', format: 'adv-md', root: './adv', authoring })
    const files = { 'adv.config.json': source, 'adv/chapters/start.adv.md': '# Start\n\nHello.\n' }
    const result = await compileProject({ files })
    expect(result.project.extensions.config).not.toHaveProperty('authoring')
    expect(JSON.stringify(result.project)).not.toContain('private-voice')
    expect(files['adv.config.json']).toBe(source)
  })

  it.each(['build', 'dev'])('removes service configuration from virtual player modules in %s mode', async (mode) => {
    const config = { format: 'adv-md', root: './adv', authoring }
    const options = { data: { config }, mode } as unknown as ResolvedAdvOptions
    const context = {} as PluginContext
    for (const template of [...templateConfigs, templateData]) {
      const emitted = await template.getContent.call(context, options)
      expect(emitted).not.toContain('authoring')
      expect(emitted).not.toContain('private-voice')
      expect(emitted).not.toContain('private-provider')
    }
    expect(config.authoring).toBe(authoring)
    expect(authoring.voice.provider.preview).not.toHaveBeenCalled()
  })

  it('removes authoring from hot updates while retaining the server configuration', async () => {
    const config = { format: 'adv-md', root: './adv', features: { babylon: false }, authoring }
    const options = { data: { config, raw: 'Before' }, mode: 'dev' } as unknown as ResolvedAdvOptions
    const newData = { ...options.data, raw: 'After' }
    const send = vi.fn()
    const loader = createAdvVirtualLoader(options, { loadData: async () => newData })
    const handleHotUpdate = typeof loader.handleHotUpdate === 'function'
      ? loader.handleHotUpdate
      : loader.handleHotUpdate!.handler
    const context = {
      file: '/project/adv/chapters/start.adv.md',
      read: async () => 'After',
      server: { ws: { send }, moduleGraph: { getModuleById: () => undefined } },
    } as unknown as HmrContext

    await handleHotUpdate.call({} as PluginContext, context)

    expect(send).toHaveBeenCalledOnce()
    const message = send.mock.calls[0]![0]
    expect(message).toMatchObject({ type: 'custom', event: 'advjs:update', data: { data: { raw: 'After' } } })
    expect(message.data.data.config).not.toHaveProperty('authoring')
    expect(JSON.stringify(message)).not.toContain('private-voice')
    expect(JSON.stringify(message)).not.toContain('private-provider')
    expect(options.data.config.authoring).toBe(authoring)
    expect(newData.config.authoring).toBe(authoring)
    expect(authoring.voice.provider.preview).not.toHaveBeenCalled()
  })
})
