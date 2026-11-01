import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { editorBundledPlugins } from '../../../editor/core/bundled-plugins'

describe('trusted bundled editor plugin inputs', () => {
  it('keeps stock catalogs empty and accepts only explicit existing local modules', () => {
    const plugin = editorBundledPlugins()
    const load = plugin.load as (id: string) => string | undefined
    expect(load('\0virtual:advjs-editor-bundled-plugins')).toContain('export default []')
    expect(load('unrelated')).toBeUndefined()
    for (const entries of ['{}', '["https://example.com/plugin.js"]', '["relative.js"]', '["/missing-plugin-entry.js"]', '[3]'])
      expect(() => editorBundledPlugins(entries)).toThrow('absolute local')
    const root = mkdtempSync(join(tmpdir(), 'advjs-bundled-'))
    try {
      const file = join(root, 'plugin.mjs')
      writeFileSync(file, 'export default {}')
      const custom = editorBundledPlugins(JSON.stringify([file]))
      expect((custom.load as typeof load)('\0virtual:advjs-editor-bundled-plugins')).toContain(JSON.stringify(file))
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})
