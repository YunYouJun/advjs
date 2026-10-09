// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createProjectDirectory, findProjectTemplate, parseProjectCreationInput, suggestProjectFolder } from '../../../apps/desktop/src/project-creation'
import { compileEditorProject } from '../../../editor/core/app/adapters/browser/project'
import markdown from '../../../editor/core/app/templates/adv-md'
import blank from '../../../editor/core/app/templates/blank'
import flow from '../../../editor/core/app/templates/flow'
import example from '../../../editor/core/app/templates/rainy-letter'
import starter from '../../../editor/core/app/templates/starter'

describe('desktop project creation', () => {
  it.each([starter, blank, markdown, flow])('stores a Chinese display name independently from the English $meta.id folder', async (template) => {
    const temporary = await mkdtemp(resolve(tmpdir(), 'advjs-create-name-'))
    const name = '雨夜 "我的故事" $&'
    const root = resolve(temporary, 'rainy-letter')
    try {
      await createProjectDirectory(template, root, name)
      const config = template === flow ? 'game.config.json' : 'adv/settings/game.json'
      expect(JSON.parse(await readFile(resolve(root, config), 'utf8')).title).toBe(name)
      expect(await readFile(resolve(root, 'README.md'), 'utf8')).toContain(name)
    }
    finally { await rm(temporary, { recursive: true, force: true }) }
  })

  it('validates cross-platform folder names and keeps native directory authority out of renderer input', () => {
    expect(parseProjectCreationInput({ name: '  雨夜来信  ', folderName: 'rainy-letter' })).toEqual({ name: '雨夜来信', folderName: 'rainy-letter' })
    expect(parseProjectCreationInput({ name: '雨夜来信', folderName: '中文项目' }).folderName).toBe('中文项目')
    for (const folderName of ['', '..', '../outside', 'a/b', 'a\\b', '/absolute', 'a:', 'a.', ' name', 'a\0b', 'CON', 'nul.txt', 'LPT1', 'a'.repeat(81)])
      expect(() => parseProjectCreationInput({ name: '游戏', folderName })).toThrow('Invalid')
    for (const input of [undefined, [], { name: '', folderName: 'game' }, { name: 'a\nb', folderName: 'game' }, { name: 'a'.repeat(121), folderName: 'game' }, { name: '游戏', folderName: 'game', directory: '/tmp/arbitrary' }])
      expect(() => parseProjectCreationInput(input)).toThrow('Invalid')
  })

  it('suggests an unused English folder without creating it, including existing files and symlinks', async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), 'advjs-create-default-'))
    try {
      expect(await suggestProjectFolder(resolve(temporary, 'not-created'), 'starter')).toBe('hello-advjs')
      await mkdir(resolve(temporary, 'hello-advjs'))
      await writeFile(resolve(temporary, 'hello-advjs-2'), 'keep')
      await symlink(resolve(temporary, 'hello-advjs'), resolve(temporary, 'hello-advjs-3'), 'dir')
      expect(await suggestProjectFolder(temporary, 'starter')).toBe('hello-advjs-4')
      expect(await readFile(resolve(temporary, 'hello-advjs-2'), 'utf8')).toBe('keep')
    }
    finally { await rm(temporary, { recursive: true, force: true }) }
  })

  it.each([starter, example, blank])('creates a compilable standard project from $meta.id, including escaped project names', async (template) => {
    const temporary = await mkdtemp(resolve(tmpdir(), 'advjs-create-'))
    const name = '项目 "雨夜" $&'
    const root = resolve(temporary, name)
    try {
      await createProjectDirectory(template, root)
      const files = Object.fromEntries(await Promise.all(template.files.filter(file => !file.encoding).map(async file => [file.name, await readFile(resolve(root, file.name), 'utf8')])) as [string, string][])
      const project = await compileEditorProject({ id: 'example', files })
      expect(project.mode).toBe('standard-markdown')
      expect(project.migrationNotice).toBeUndefined()
      expect(project.compilation.diagnostics.filter(item => item.severity === 'error')).toEqual([])
      expect(project.compilation.project.chapters).toHaveLength(template === starter ? 3 : 1)
      if (template === starter) {
        expect(JSON.parse(files['adv/settings/game.json']!).title).toBe(name)
        expect(project.compilation.project.characters[0]!.avatar).toBe('/img/characters/xiaoyun.webp')
        expect(project.compilation.project.scenes).toHaveLength(1)
        expect(await readFile(resolve(root, 'public/img/characters/xiaoyun.webp'))).toEqual(await readFile(resolve(import.meta.dirname, '../../../demo/starter/public/img/characters/xiaoyun.webp')))
        expect(project.compilation.project.chapters.map(chapter => chapter.id).sort()).toEqual(['ending', 'hello', 'letter'])
        for (const chapterId of ['hello', 'letter', 'ending']) {
          expect(files[`adv/chapters/${chapterId}.adv.md`]).toBe(await readFile(resolve(import.meta.dirname, `../../../demo/starter/public/md/chapters/${chapterId}.adv.md`), 'utf8'))
        }
        expect(Object.values(project.compilation.project.program!.chapters).flatMap(chapter => Object.values(chapter.nodes)).some(node => node.kind === 'choices')).toBe(true)
      }
      if (template === example) {
        expect(JSON.parse(files['adv/settings/game.json']!).title).toBe(name)
        expect(project.compilation.project.characters).toHaveLength(1)
        expect(project.compilation.project.scenes).toHaveLength(2)
        expect(project.compilation.project.assets?.assets).toHaveLength(2)
        for (const scene of project.compilation.project.scenes) {
          const asset = project.compilation.project.assets!.assets.find(asset => asset.id === scene.assetId)!
          expect(files[`adv/assets/${asset.path}`]).toContain('<svg')
        }
      }
    }
    finally { await rm(temporary, { recursive: true, force: true }) }
  })

  it('rejects existing directories, files and symlinks without modifying their content', async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), 'advjs-create-'))
    const root = resolve(temporary, 'existing')
    try {
      await mkdir(root)
      await writeFile(resolve(root, 'README.md'), 'Keep this content')
      await symlink(root, resolve(temporary, 'alias'), 'dir')
      await writeFile(resolve(temporary, 'file'), 'Keep this file')
      for (const path of [root, resolve(temporary, 'alias'), resolve(temporary, 'file')])
        await expect(createProjectDirectory(example, path)).rejects.toThrow('已存在')
      expect(await readFile(resolve(root, 'README.md'), 'utf8')).toBe('Keep this content')
      expect(await readFile(resolve(temporary, 'file'), 'utf8')).toBe('Keep this file')
    }
    finally { await rm(temporary, { recursive: true, force: true }) }
  })

  it('allows only one concurrent creator for a destination and rejects unknown template IDs', async () => {
    expect(() => findProjectTemplate([example, blank], '__proto__')).toThrow('Unknown project template')
    expect(() => findProjectTemplate([example, blank], {})).toThrow('Unknown project template')
    const temporary = await mkdtemp(resolve(tmpdir(), 'advjs-create-'))
    try {
      const root = resolve(temporary, 'new')
      const results = await Promise.allSettled([createProjectDirectory(example, root), createProjectDirectory(blank, root)])
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    }
    finally { await rm(temporary, { recursive: true, force: true }) }
  })
})
