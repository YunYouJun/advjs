// @vitest-environment node

import type { AdvProjectFileMap } from '@advjs/types'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileProject } from '../../src/project'

const repositoryRoot = resolve(import.meta.dirname, '../../../..')

async function readFileMap(directory: string): Promise<AdvProjectFileMap> {
  const files: AdvProjectFileMap = {}

  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory())
        await walk(path)
      else if (entry.isFile())
        files[relative(directory, path).replaceAll('\\', '/')] = await readFile(path, 'utf8')
    }
  }

  await walk(directory)
  return files
}

describe('compileProject', () => {
  for (const [template, counts] of [
    ['template', { chapters: 3, characters: 3, scenes: 3 }],
    ['template-galgame', { chapters: 1, characters: 3, scenes: 3 }],
  ] as const) {
    it(`compiles and normalizes the ${template} project from file contents`, async () => {
      const files = await readFileMap(resolve(repositoryRoot, 'packages/advjs', template))
      const result = await compileProject({ files, id: template })

      expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([])
      expect(result.project).toMatchObject({
        schemaVersion: 1,
        id: template,
        format: 'adv-md',
        root: 'adv',
      })
      expect(result.project.chapters).toHaveLength(counts.chapters)
      expect(result.project.characters).toHaveLength(counts.characters)
      expect(result.project.scenes).toHaveLength(counts.scenes)
      expect(result.project.program?.entry.chapterId).toBe(result.project.entryChapterId)
      expect(Object.keys(result.sourceMap.chapters)).toEqual(result.project.chapters.map(chapter => chapter.id))
    })
  }

  it('reports missing content references and unknown plugins in stable order', async () => {
    const result = await compileProject({
      id: 'invalid-project',
      files: {
        'adv.config.json': JSON.stringify({ format: 'adv-md', root: './adv' }),
        'adv/settings/game.json': JSON.stringify({
          requiredPlugins: { 'missing-plugin': '1.0.0' },
        }),
        'adv/chapters/intro.adv.md': '【未知场景，白天，内景】\n\n@未知角色\n你好。\n',
      },
    }, { plugins: {} })

    expect(result.project.program).toBeUndefined()
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'ADV_PROJECT_UNKNOWN_CHARACTER',
      'ADV_PROJECT_UNKNOWN_PLUGIN',
      'ADV_PROJECT_UNKNOWN_SCENE',
    ])
    expect(result.diagnostics.every(diagnostic => diagnostic.path)).toBe(true)
  })

  it('honors explicit multi-chapter sources and entry while preserving bounded extensions', async () => {
    const result = await compileProject({
      id: 'multi-project',
      files: {
        'adv.config.json': JSON.stringify({
          format: 'adv-md',
          root: './adv',
          customConfig: { enabled: true },
          generatedAt: 'not deterministic',
        }),
        'adv/settings/game.json': JSON.stringify({
          title: 'Multi chapter',
          entryChapterId: 'second',
          chapters: [
            { id: 'first', title: 'First', sources: ['chapters/01.adv.md'] },
            { id: 'second', title: 'Second', sources: ['chapters/02.adv.md'] },
          ],
          customGame: { route: 'beta' },
          builtAt: 'not deterministic',
        }),
        'adv/chapters/01.adv.md': '> First chapter\n',
        'adv/chapters/02.adv.md': '> Second chapter\n',
        'adv/assets.json': JSON.stringify({
          schemaVersion: 2,
          id: 'multi-assets',
          defaultProfile: 'local',
          profiles: { local: { provider: 'project', root: 'public' } },
          assets: [{ id: 'background/room', kind: 'background', type: 'image', path: 'room.webp' }],
        }),
      },
    })

    expect(result.diagnostics).toEqual([])
    expect(result.project.entryChapterId).toBe('second')
    expect(result.project.program?.entry.chapterId).toBe('second')
    expect(result.project.chapters.map(chapter => chapter.id)).toEqual(['first', 'second'])
    expect(result.project.assets?.assets[0].id).toBe('background/room')
    expect(result.project.extensions).toEqual({
      config: { customConfig: { enabled: true } },
      game: { customGame: { route: 'beta' } },
    })
    expect(result.sourceMap).toMatchObject({
      config: 'adv.config.json',
      gameConfig: 'adv/settings/game.json',
      assets: 'adv/assets.json',
      chapters: {
        first: ['adv/chapters/01.adv.md'],
        second: ['adv/chapters/02.adv.md'],
      },
    })
  })

  it('keeps the browser project compiler free of Node built-in imports', async () => {
    const projectDirectory = resolve(repositoryRoot, 'packages/core/src/project')
    const files = await readdir(projectDirectory)
    const sources = await Promise.all(
      files.filter(file => file.endsWith('.ts')).map(async file => ({
        file: basename(file),
        source: await readFile(join(projectDirectory, file), 'utf8'),
      })),
    )
    expect(sources).not.toEqual([])
    for (const { file, source } of sources)
      expect(source, file).not.toMatch(/(?:from\s+|import\s*)['"]node:/u)
  })

  it('bundles the project compiler for browsers without Node built-ins', async () => {
    const { build } = await import('vite')
    const output = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'reject-node-builtins',
        resolveId(id) {
          if (id.startsWith('node:'))
            throw new Error(`Browser project compiler imported ${id}`)
        },
      }],
      build: {
        write: false,
        target: 'es2022',
        lib: {
          entry: resolve(repositoryRoot, 'packages/core/src/project/index.ts'),
          formats: ['es'],
        },
      },
    })
    const outputs = Array.isArray(output) ? output : [output]
    const code = outputs.flatMap(result => 'output' in result ? result.output : [])
      .flatMap(item => 'code' in item ? [item.code] : [])
      .join('\n')

    expect(code).toContain('compileProject')
    expect(code).not.toContain('__vite-browser-external')
    expect(code).not.toMatch(/(?:from\s+|import\s*)['"]node:/u)
  }, 30_000)
})
