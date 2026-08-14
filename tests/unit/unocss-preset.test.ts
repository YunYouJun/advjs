// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { presetAdv } from '../../packages/unocss/src'

const root = resolve(import.meta.dirname, '../..')

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('@advjs/unocss preset', () => {
  it('exposes only namespaced shared shortcuts', () => {
    const shortcuts = presetAdv().shortcuts as Array<[string, string]>
    const names = shortcuts.map(([name]) => name)

    expect(names).toContain('adv-btn')
    expect(names).not.toContain('btn')
    expect(names).not.toContain('icon-btn')
  })

  it('uses pnpm without unused runtime dependencies', () => {
    const packageJson = JSON.parse(read('packages/unocss/package.json'))

    expect(packageJson.scripts.prepublishOnly).toBe('pnpm run build')
    expect(packageJson.dependencies).toBeUndefined()
    expect(read('packages/unocss/build.config.ts')).not.toContain('defu')
  })

  it('keeps every ADV.JS UnoCSS application on Wind4 without duplicate resets', () => {
    const configs = [
      'apps/studio/uno.config.ts',
      'docs/uno.config.ts',
      'editor/core/uno.config.ts',
      'editor/vrm/unocss.config.ts',
      'packages/client/uno.config.ts',
      'packages/parser/playground/unocss.config.ts',
      'playground/uno.config.ts',
    ]
    const entrypoints = [
      'editor/core/nuxt.config.ts',
      'editor/vrm/src/main.ts',
      'packages/client/setup/main.ts',
      'packages/parser/playground/src/main.ts',
      'playground/src/main.ts',
    ]

    for (const config of configs) {
      expect(read(config), config).toContain('presetWind4')
      expect(read(config), config).not.toContain('presetWind3')
    }
    for (const entrypoint of entrypoints)
      expect(read(entrypoint), entrypoint).not.toContain('@unocss/reset')
  })
})
