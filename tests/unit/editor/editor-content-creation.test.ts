// @vitest-environment node

import type { AdvProjectFileMap } from '@advjs/types'
import type { EditorProjectModel } from '../../../editor/core/app/adapters/browser/project'
import type { ContentCreationKind } from '../../../editor/core/app/utils/content-creation'
import { describe, expect, it } from 'vitest'
import { createEditorProjectModel } from '../../../editor/core/app/adapters/browser/project'
import { createBrowserProjectWorkspace } from '../../../editor/core/app/adapters/browser/workspace'
import {
  contentCreationIdError,
  contentCreationPlan,
  contentCreationTitleError,
} from '../../../editor/core/app/utils/content-creation'
import { compileProject } from '../../../packages/core/src/project'
import { parseSceneFrontmatterData } from '../../../packages/parser/src/scene'

const baseFiles: AdvProjectFileMap = {
  'adv.config.json': '{"root":"./adv","format":"adv-md"}\n',
  'adv/chapters/intro.adv.md': '# Intro\n\n> The original story.\n',
  'adv/settings/game.json': '{"title":"Original game","future":{"keep":true}}\n',
}

async function model(files: AdvProjectFileMap = baseFiles) {
  return createEditorProjectModel(await compileProject({ files }), files)
}

function plan(project: EditorProjectModel, kind: ContentCreationKind = 'chapter', id = 'next', title = 'New content', locale = 'en') {
  return contentCreationPlan(project, { kind, id, title, locale })
}

function apply(project: EditorProjectModel, result: ReturnType<typeof plan>) {
  const files = { ...project.files }
  for (const change of result.changes) {
    expect(files[change.path] ?? null).toBe(change.expected)
    expect(change.content).not.toBeNull()
    files[change.path] = change.content!
  }
  return files
}

// File System Access API fixture, including new files and rollback removal.
function browserDirectory(files: AdvProjectFileMap, failWrite: () => string | undefined = () => undefined) {
  function file(path: string) {
    return {
      kind: 'file' as const,
      name: path.split('/').at(-1)!,
      async getFile() {
        return { size: files[path].length, text: async () => files[path] }
      },
      async createWritable() {
        let next = files[path]
        return {
          async write(content: string | Blob) {
            next = typeof content === 'string' ? content : await content.text()
          },
          async close() {
            if (failWrite() === path)
              throw new Error('Simulated disk write failure')
            files[path] = next
          },
        }
      },
    }
  }
  function directory(path: string, name: string) {
    const prefix = path ? `${path}/` : ''
    return {
      kind: 'directory' as const,
      name,
      async getDirectoryHandle(child: string, options?: { create?: boolean }): Promise<ReturnType<typeof directory>> {
        const childPath = `${prefix}${child}`
        if (!options?.create && !Object.keys(files).some(candidate => candidate.startsWith(`${childPath}/`)))
          throw new Error(`Directory not found: ${childPath}`)
        return directory(childPath, child)
      },
      async getFileHandle(child: string, options?: { create?: boolean }) {
        const childPath = `${prefix}${child}`
        if (!(childPath in files)) {
          if (!options?.create)
            throw new Error(`File not found: ${childPath}`)
          files[childPath] = ''
        }
        return file(childPath)
      },
      async removeEntry(child: string) {
        delete files[`${prefix}${child}`]
      },
      async* values() {
        const children = new Set(Object.keys(files).filter(candidate => candidate.startsWith(prefix)).map(candidate => candidate.slice(prefix.length).split('/')[0]))
        for (const child of children) {
          const childPath = `${prefix}${child}`
          yield childPath in files ? file(childPath) : directory(childPath, child)
        }
      },
    }
  }
  return directory('', 'browser-project')
}

describe('content creation input', () => {
  it.each([
    ['', 'empty'],
    ['  ', 'empty'],
    ['../escape', 'invalid'],
    ['a/b', 'invalid'],
    ['a\\b', 'invalid'],
    ['a:b', 'invalid'],
    ['_hidden', 'invalid'],
    ['-dash', 'invalid'],
    ['名字', 'invalid'],
    [' padded', 'invalid'],
    ['padded ', 'invalid'],
    ['trailing.', 'invalid'],
    ['nul', 'reserved'],
    ['CON.md', 'reserved'],
    ['LPT9', 'reserved'],
    ['constructor', 'reserved'],
    ['toString', 'reserved'],
    ['README', 'reserved'],
    ['a'.repeat(81), 'long'],
  ])('rejects the unsafe ID %j', (id, expected) => {
    expect(contentCreationIdError(id)).toBe(expected)
  })

  it('allows stable runtime identifiers and checks titles independently', () => {
    for (const id of ['chapter_01', 'chapter-2', 'chapter.v3', '0-intro', 'a'.repeat(80)])
      expect(contentCreationIdError(id)).toBeUndefined()
    expect(contentCreationTitleError('  ')).toBe('empty')
    expect(contentCreationTitleError('a'.repeat(121))).toBe('long')
    expect(contentCreationTitleError('line\nbreak')).toBe('invalid')
    expect(contentCreationTitleError('  雨夜：来信  ')).toBeUndefined()
  })
})

describe('source content creation plans', () => {
  it.each(['world', 'scene', 'chapter'] as const)('creates a compilable %s template in Chinese and English', async (kind) => {
    const project = await model()
    for (const locale of ['zh-CN', 'en']) {
      const result = plan(project, kind, 'next', '标题 "quoted" --- [link](url) # @person <tag>', locale)
      expect(result.changes[0]).toMatchObject({ expected: null })
      expect(result.changes[0].content).toContain(locale === 'en'
        ? kind === 'chapter' ? 'Write the story here.' : kind === 'scene' ? 'Describe this scene' : 'Describe the world'
        : kind === 'chapter' ? '从这里写下故事。' : kind === 'scene' ? '描述场景' : '描述故事世界')
      const files = apply(project, result)
      const compiled = await compileProject({ files })
      expect(compiled.diagnostics).toEqual([])
      expect(compiled.project.entryChapterId).toBe('intro')
      if (kind === 'scene') {
        expect(parseSceneFrontmatterData(files[result.path]).name).toBe('标题 "quoted" --- [link](url) # @person <tag>')
        expect(compiled.project.scenes.find(scene => scene.id === 'next')?.name).toBe('标题 "quoted" --- [link](url) # @person <tag>')
      }
    }
  })

  it('uses the compiled content root and does not mutate the source project', async () => {
    const project = await model({
      'adv.config.json': '{"root":"./content/story/","format":"fountain"}',
      'content/story/chapters/intro.adv.md': '> Existing story.\n',
      'content/story/settings/game.json': '{"title":"Custom root"}',
    })
    const before = JSON.stringify(project)
    expect(plan(project, 'scene', 'garden', 'Garden').path).toBe('content/story/scenes/garden.md')
    expect(plan(project, 'world').path).toBe('content/story/world.md')
    const result = plan(project, 'chapter')
    expect(result.path).toBe('content/story/chapters/next.adv.md')
    expect((await compileProject({ files: apply(project, result) })).diagnostics).toEqual([])
    expect(JSON.stringify(project)).toBe(before)
  })

  it('opens existing world files without validating an unused title or rewriting them', async () => {
    const project = await model({ ...baseFiles, 'adv/World.md': '# Already authored\n' })
    expect(plan(project, 'world', '', '')).toEqual({ path: 'adv/World.md', changes: [] })
    expect(project.files['adv/World.md']).toBe('# Already authored\n')
  })

  it('rejects exact, case-equivalent and binary navigation paths', async () => {
    const project = await model({ ...baseFiles, 'adv/scenes/Garden.md': '---\nid: other\n---\n' })
    expect(() => plan(project, 'scene', 'garden')).toThrow(/file already exists/u)
    expect(() => plan(project, 'chapter', 'intro')).toThrow(/file already exists/u)
    project.filePaths = [...Object.keys(project.files), 'ADV/SCENES/POND.MD']
    expect(() => plan(project, 'scene', 'pond')).toThrow(/file already exists/u)
  })

  it('rejects semantic scene IDs even when the existing filename differs', async () => {
    const project = await model({ ...baseFiles, 'adv/scenes/an-old-name.md': '---\nid: Garden\nname: Garden\n---\n' })
    expect(() => plan(project, 'scene', 'garden')).toThrow(/ID already exists/u)
  })

  it('rejects nested and unlisted chapter IDs without overwriting content', async () => {
    const project = await model({
      ...baseFiles,
      'adv/settings/game.json': '{"chapters":[{"id":"intro","sources":["chapters/intro.adv.md"]}]}',
      'adv/chapters/Next/scene.adv.md': '> An unlisted chapter.\n',
    })
    expect(project.compilation.project.chapters.map(chapter => chapter.id)).toEqual(['intro'])
    expect(() => plan(project, 'chapter', 'next')).toThrow(/ID already exists/u)
  })

  it('appends to explicit chapters and preserves entry, unknown fields and unrelated bytes', async () => {
    const source = '{\n  "chapters": [{"id":"intro","sources":["chapters/intro.adv.md"],"futureChapter":{"keep":true}}],\n  "entryChapterId": "intro",\n  "future": { "spelling": "keep exactly" }\n}\n'
    const project = await model({ ...baseFiles, 'adv/settings/game.json': source })
    const result = plan(project, 'chapter', 'arrival', 'Arrival')
    expect(result.changes[1]).toMatchObject({ path: 'adv/settings/game.json', expected: source })
    expect(result.changes[1].content).toContain('"future": { "spelling": "keep exactly" }')
    const files = apply(project, result)
    const game = JSON.parse(files['adv/settings/game.json'])
    expect(game.chapters).toEqual([
      { id: 'intro', sources: ['chapters/intro.adv.md'], futureChapter: { keep: true } },
      { id: 'arrival', title: 'Arrival', sources: ['chapters/arrival.adv.md'] },
    ])
    expect(game.entryChapterId).toBe('intro')
    expect((await compileProject({ files })).diagnostics).toEqual([])
  })

  it('retains automatically discovered chapters when an explicit list is empty', async () => {
    const project = await model({ ...baseFiles, 'adv/settings/game.json': '{"chapters":[],"future":42}' })
    const result = plan(project, 'chapter', 'arrival')
    const files = apply(project, result)
    const compiled = await compileProject({ files })
    expect(compiled.project.chapters.map(chapter => chapter.id)).toEqual(['intro', 'arrival'])
    expect(compiled.project.entryChapterId).toBe('intro')
    expect(JSON.parse(files['adv/settings/game.json']).future).toBe(42)
    expect(compiled.diagnostics).toEqual([])
  })

  it('pins the existing entry only when automatic discovery would change it', async () => {
    const project = await model()
    const earlier = plan(project, 'chapter', 'arrival')
    const files = apply(project, earlier)
    expect(JSON.parse(files['adv/settings/game.json']).entryChapterId).toBe('intro')
    expect((await compileProject({ files })).project.entryChapterId).toBe('intro')
    expect(plan(project, 'chapter', 'later').changes).toHaveLength(1)
    expect(JSON.parse(project.files['adv/settings/game.json']).entryChapterId).toBeUndefined()
  })

  it('creates JSON settings with CAS when a previously implicit entry needs preserving', async () => {
    const project = await model({ 'adv.config.json': baseFiles['adv.config.json'], 'adv/chapters/intro.adv.md': baseFiles['adv/chapters/intro.adv.md'] })
    const result = plan(project, 'chapter', 'arrival')
    expect(result.changes[1]).toMatchObject({ path: 'adv/settings/game.json', expected: null })
    const compiled = await compileProject({ files: apply(project, result) })
    expect(compiled.project.entryChapterId).toBe('intro')
    expect(compiled.diagnostics).toEqual([])
  })

  it.each([true, false])('freezes inferred chapter IDs before changing automatic discovery order (game config: %s)', async (withGameConfig) => {
    const project = await model({
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/序章.adv.md': '> The original opening.\n',
      'adv/chapters/終章/ending.adv.md': '> The original ending.\n',
      ...(withGameConfig ? { 'adv/settings/game.json': '{"future":{"keep":true}}\n' } : {}),
    })
    const originalChapters = project.compilation.project.chapters
    expect(originalChapters.map(chapter => chapter.id)).toEqual(['chapter-1', 'chapter-2'])
    const result = plan(project, 'chapter', 'arrival')
    expect(result.changes[1].expected).toBe(withGameConfig ? project.files['adv/settings/game.json'] : null)
    const files = apply(project, result)
    const game = JSON.parse(files['adv/settings/game.json'])
    expect(game.chapters).toEqual([
      ...originalChapters,
      { id: 'arrival', title: 'New content', sources: ['chapters/arrival.adv.md'] },
    ])
    const compiled = await compileProject({ files })
    expect(compiled.project.chapters.slice(0, 2)).toEqual(originalChapters)
    expect(compiled.project.entryChapterId).toBe(project.compilation.project.entryChapterId)
    expect(compiled.project.program!.chapters['chapter-1'].nodes).toEqual(project.compilation.project.program!.chapters['chapter-1'].nodes)
    expect(compiled.diagnostics).toEqual([])
    if (withGameConfig)
      expect(game.future).toEqual({ keep: true })
  })

  it('respects sourceMap game config precedence and leaves other config files untouched', async () => {
    const project = await model({
      ...baseFiles,
      'adv/settings/game.json': '{"chapters":[{"id":"intro","sources":["chapters/intro.adv.md"]}]}',
      'game.config.json': '{"chapters":[{"id":"ignored","sources":["chapters/ignored.adv.md"]}],"future":"untouched"}',
    })
    const result = plan(project)
    expect(result.changes.map(change => change.path)).toEqual(['adv/chapters/next.adv.md', 'adv/settings/game.json'])
    expect(apply(project, result)['game.config.json']).toBe(project.files['game.config.json'])
  })

  it('supports the content-root game.config.json location', async () => {
    const project = await model({
      'adv.config.json': '{"root":"story","entryChapterId":"intro"}',
      'story/chapters/intro.adv.md': '> Existing story.\n',
      'story/game.config.json': '{"chapters":[{"id":"intro","sources":["chapters/intro.adv.md"]}],"future":true}',
    })
    const result = plan(project, 'chapter', 'arrival')
    expect(result.changes[1].path).toBe('story/game.config.json')
    const files = apply(project, result)
    expect(JSON.parse(files['story/game.config.json']).future).toBe(true)
    expect((await compileProject({ files })).project.entryChapterId).toBe('intro')
    expect((await compileProject({ files })).diagnostics).toEqual([])
  })

  it('does not modify executable or synthetic game config files', async () => {
    const project = await model({
      'adv.config.json': '{"root":"adv"}',
      'game.config.json': '{"chapters":[{"id":"intro","sources":["chapters/intro.adv.md"]}]}',
      'adv/chapters/intro.adv.md': '> Existing story.\n',
    })
    project.filePaths = Object.keys(project.files)
    project.virtualFiles = ['adv.config.json', 'game.config.json']
    expect(() => plan(project, 'chapter')).toThrow(/executable configuration/u)
    expect(plan(project, 'world').changes).toHaveLength(1)
    expect(plan(project, 'scene').changes).toHaveLength(1)
  })

  it('reports malformed game configuration rather than changing discovery semantics', async () => {
    for (const config of ['{"chapters":"not an array"}', '{"chapters":[null]}', '{invalid', '[]']) {
      const project = await model({ ...baseFiles, 'adv/settings/game.json': config })
      expect(() => plan(project)).toThrow(/configuration/u)
    }
  })

  it('rejects invalid roots and configuration even when the compiler has fallen back', async () => {
    for (const root of ['../outside', '/absolute', '\\absolute', '.', '', '.git/content', 'C:\\outside', 42]) {
      const project = await model({ ...baseFiles, 'adv.config.json': JSON.stringify({ root }) })
      expect(() => plan(project, 'scene')).toThrow(/content directory/u)
    }
    const invalid = await model({ ...baseFiles, 'adv.config.json': '{invalid' })
    expect(() => plan(invalid, 'world')).toThrow(/valid JSON object/u)
    const missing = await model({ 'adv/chapters/intro.adv.md': '> Story\n' })
    expect(() => plan(missing)).toThrow(/configuration is missing/u)
    const mismatch = await model()
    mismatch.compilation.project.root = 'different'
    expect(() => plan(mismatch)).toThrow(/does not match/u)
  })

  it('rejects legacy and Flow projects with localized messages', async () => {
    const legacy = await model({ 'adv.config.json': '{"format":"flow"}', 'adv/index.adv.json': '{}' })
    expect(() => plan(legacy)).toThrow(/standard Markdown/u)
    expect(() => plan(legacy, 'scene', 'room', '房间', 'zh-CN')).toThrow(/标准 Markdown/u)
    const project = await model()
    expect(() => plan(project, 'chapter', '../escape')).toThrow(/ID must start/u)
    expect(() => plan(project, 'chapter', '../escape', '章节', 'zh-CN')).toThrow(/标识/u)
    expect(() => plan(project, 'chapter', 'safe', 'line\nbreak')).toThrow(/control characters/u)
  })
})

describe('browser workspace content creation', () => {
  const explicitFiles = () => ({
    ...baseFiles,
    'adv/settings/game.json': '{"chapters":[{"id":"intro","sources":["chapters/intro.adv.md"]}],"future":{"keep":true}}\n',
  })

  it('writes the plan through the real browser workspace and recompiles the saved files', async () => {
    const files = explicitFiles()
    const root = browserDirectory(files)
    const workspace = createBrowserProjectWorkspace(root)
    const result = plan((await workspace.snapshot()).project, 'chapter', 'arrival', 'Arrival')
    const saved = await workspace.writeFiles!(result.changes)
    expect(saved.project.files).toEqual(files)
    expect(saved.project.compilation.project.chapters.map(chapter => chapter.id)).toEqual(['intro', 'arrival'])
    expect(saved.project.compilation.project.entryChapterId).toBe('intro')
    expect(saved.project.compilation.diagnostics).toEqual([])
    expect(JSON.parse(files['adv/settings/game.json']).future).toEqual({ keep: true })
    const chapters = await (await root.getDirectoryHandle('adv')).getDirectoryHandle('chapters')
    expect(await (await (await chapters.getFileHandle('arrival.adv.md')).getFile()).text()).toBe(result.changes[0].content)
  })

  it('refuses a plan if another writer creates its target before the commit', async () => {
    const files = explicitFiles()
    const workspace = createBrowserProjectWorkspace(browserDirectory(files))
    const result = plan((await workspace.snapshot()).project, 'chapter', 'arrival')
    const originalConfig = files['adv/settings/game.json']
    files[result.path] = '# External authored chapter\n'
    await expect(workspace.writeFiles!(result.changes)).rejects.toThrow(/External changes conflict/u)
    expect(files[result.path]).toBe('# External authored chapter\n')
    expect(files['adv/settings/game.json']).toBe(originalConfig)
  })

  it('removes the newly written chapter if its config update fails and supports a retry', async () => {
    const files = explicitFiles()
    const original = { ...files }
    let failure: string | undefined = 'adv/settings/game.json'
    const workspace = createBrowserProjectWorkspace(browserDirectory(files, () => failure))
    const result = plan((await workspace.snapshot()).project, 'chapter', 'arrival')
    await expect(workspace.writeFiles!(result.changes)).rejects.toThrow(/disk write failure/u)
    expect(files).toEqual(original)
    failure = undefined
    const saved = await workspace.writeFiles!(result.changes)
    expect(saved.project.compilation.project.chapters.map(chapter => chapter.id)).toEqual(['intro', 'arrival'])
    expect(saved.project.compilation.diagnostics).toEqual([])
  })
})
