import type { IFileSystem } from '../utils/fs'
import { compileProject } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { createProjectFromTemplate, templateRegistry } from '../utils/projectTemplate'

function workspace(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial))
  const fs: Pick<IFileSystem, 'exists' | 'mkdir' | 'writeFile'> = {
    exists: async (path: string) => files.has(path),
    mkdir: async () => {},
    writeFile: async (path: string, content: string) => { files.set(path, content) },
  }
  return { fs, files }
}

describe('portable project files from Studio templates', () => {
  it('gives every product template the project config required by shared compilation', async () => {
    for (const template of templateRegistry) {
      const { fs, files } = workspace()
      await createProjectFromTemplate(fs, `template-${template.id}`, template.id)
      const compiled = await compileProject({ files: Object.fromEntries(files) }, { allowEmptyAssetManifest: true })
      expect(compiled.diagnostics.map(diagnostic => diagnostic.code), template.id).not.toContain('ADV_PROJECT_CONFIG_NOT_FOUND')
      expect(compiled.project.root).toBe('adv')
      expect(compiled.project.chapters.length, template.id).toBeGreaterThan(0)
    }
  })
  it('preserves an existing project config and its author extensions', async () => {
    const original = '{"schemaVersion":1,"id":"existing","root":"adv","format":"adv-md","custom":{"author":"keep"}}\n'
    const { fs, files } = workspace({ 'adv.config.json': original })
    await createProjectFromTemplate(fs, 'new-name')
    expect(files.get('adv.config.json')).toBe(original)
  })
})
