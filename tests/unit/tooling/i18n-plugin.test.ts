// @vitest-environment node

import type { ResolvedAdvOptions } from '@advjs/types'
import type { AdvPluginOptions } from '../../../packages/advjs/node/options/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ViteAdvPlugin } from '../../../packages/advjs/node/vite'
import advFramework from '../../../packages/vite-plugin-adv/src'

const { vueI18n } = vi.hoisted(() => ({
  vueI18n: vi.fn(() => ({ name: 'test:vue-i18n' })),
}))

vi.mock('@intlify/unplugin-vue-i18n/vite', () => ({ default: vueI18n }))
vi.mock('vite-plugin-vue-layouts-next', () => ({ default: () => [] }))
vi.mock('vue-router/vite', () => ({ default: () => [] }))
vi.mock('unplugin-vue-markdown/vite', () => ({ default: () => [] }))
vi.mock('../../../packages/advjs/node/utils/fs', () => ({ ensureDirSync: vi.fn() }))
vi.mock('../../../packages/advjs/node/vite/components', () => ({ createComponentsPlugin: () => [] }))
vi.mock('../../../packages/advjs/node/vite/devtools', () => ({ createDevToolsPlugins: () => [] }))
vi.mock('../../../packages/advjs/node/vite/extendConfig', () => ({ createConfigPlugin: () => [] }))
vi.mock('../../../packages/advjs/node/vite/loaders', () => ({
  createAdvLoader: () => [],
  createAdvVirtualLoader: () => [],
}))
vi.mock('../../../packages/advjs/node/vite/unocss', () => ({ createUnocssPlugin: () => [] }))
vi.mock('../../../packages/advjs/node/vite/vue', () => ({ createVuePlugin: () => [] }))

const options = {
  roots: ['/project'],
  theme: 'default',
  tempRoot: '/project/.adv',
  build: {},
} as ResolvedAdvOptions

beforeEach(() => {
  vi.clearAllMocks()
})

describe.each([
  ['standalone player', ViteAdvPlugin],
  ['embedded player', advFramework],
] as const)('%s locale compilation', (_label, createPlugins) => {
  it.each([
    ['omitted', {}],
    ['enabled', { i18n: true }],
  ] satisfies [string, AdvPluginOptions][])('adds one locale compiler when %s', async (_mode, pluginOptions) => {
    const plugins = await createPlugins(options, pluginOptions)

    expect(vueI18n).toHaveBeenCalledOnce()
    expect(vueI18n).toHaveBeenCalledWith(expect.objectContaining({
      runtimeOnly: true,
      compositionOnly: true,
      include: expect.arrayContaining(['/project/locales/**']),
    }))
    expect(plugins).toContainEqual({ name: 'test:vue-i18n' })
  })

  it('leaves locale compilation to the host when disabled', async () => {
    const plugins = await createPlugins(options, { i18n: false })

    expect(vueI18n).not.toHaveBeenCalled()
    expect(plugins).not.toContainEqual({ name: 'test:vue-i18n' })
  })
})
