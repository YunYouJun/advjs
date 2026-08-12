// @vitest-environment node

import { readdir, readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compileEditorProject,
  readBrowserProjectFiles,
} from '../../editor/core/app/adapters/browser/project'

const repositoryRoot = resolve(import.meta.dirname, '../..')

async function readFixtureFiles(root: string, directory = root, files: Record<string, string> = {}) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory())
      await readFixtureFiles(root, path, files)
    else
      files[relative(root, path).replaceAll('\\', '/')] = await readFile(path, 'utf8')
  }
  return files
}

function fakeDirectory(name: string, children: Record<string, string | ReturnType<typeof fakeDirectory>>) {
  return {
    kind: 'directory' as const,
    name,
    async* values() {
      for (const [childName, child] of Object.entries(children).reverse()) {
        if (typeof child === 'string') {
          yield {
            kind: 'file' as const,
            name: childName,
            async getFile() {
              return { size: child.length, text: async () => child }
            },
          }
        }
        else {
          yield child
        }
      }
    },
  }
}

describe('editor standard project adapter', () => {
  for (const template of ['template', 'template-galgame']) {
    it(`opens the ${template} Markdown project without a legacy JSON entry`, async () => {
      const root = resolve(repositoryRoot, 'packages/advjs', template)
      const model = await compileEditorProject({
        files: await readFixtureFiles(root),
        id: template,
      })

      expect(model.mode).toBe('standard-markdown')
      expect(model.migrationNotice).toBeUndefined()
      expect(model.compilation.diagnostics.filter(item => item.severity === 'error')).toEqual([])
      expect(model.compilation.project.chapters.length).toBeGreaterThan(0)
      expect(model.compilation.project.characters.length).toBeGreaterThan(0)
      expect(model.compilation.project.scenes.length).toBeGreaterThan(0)
      expect(model.previewConfig.chapters).toHaveLength(model.compilation.project.chapters.length)
      expect(model.previewConfig.chapters[0].nodes[0]).toMatchObject({
        type: 'fountain',
      })
      expect(model.previewConfig.chapters[0].nodes[0].src).toMatch(/^data:text\/markdown/u)
    })
  }

  it('reads File System Access handles into a stable project-relative map', async () => {
    const handle = fakeDirectory('demo', {
      'adv': fakeDirectory('adv', {
        chapters: fakeDirectory('chapters', {
          'chapter.adv.md': '# Chapter\n',
        }),
      }),
      'adv.config.json': '{"root":"adv"}',
      'cover.png': 'binary-placeholder',
      'node_modules': fakeDirectory('node_modules', { 'ignored.js': 'ignored' }),
    })

    expect(await readBrowserProjectFiles(handle)).toEqual({
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/chapter.adv.md': '# Chapter\n',
      'cover.png': '',
    })
  })

  it('shows an explicit migration notice for legacy JSON-only projects', async () => {
    const model = await compileEditorProject({
      files: {
        'adv.config.json': '{"format":"flow"}',
        'adv/index.adv.json': '{"chapters":[]}',
      },
      id: 'legacy',
    })

    expect(model.mode).toBe('legacy-json')
    expect(model.migrationNotice).toContain('index.adv.json')
    expect(model.compilation.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_EDITOR_LEGACY_JSON',
      severity: 'warning',
    }))
  })
})
