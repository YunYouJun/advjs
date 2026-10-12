// @vitest-environment node

import { resolve } from 'node:path'
import { loadConfigFromFile } from 'vite'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')

describe('vrm deployment configuration', () => {
  it('loads the production Vite configuration without initializing the engine CLI', async () => {
    const result = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      resolve(root, 'editor/vrm/vite.config.ts'),
      resolve(root, 'editor/vrm'),
    )

    expect(result?.config.build?.rollupOptions?.external).toEqual([
      '@advjs/configs/adv',
      '@advjs/configs/game',
      '@advjs/configs/theme',
      '#advjs/runtime-plugins',
    ])
    expect(result?.dependencies).not.toContain(resolve(root, 'packages/advjs/node/options.ts'))
  }, 30_000)
})
