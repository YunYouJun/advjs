// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCheck } from '../../../packages/advjs/node/commands/check'
import { resolveProjectContext } from '../../../packages/advjs/node/commands/context'
import { loadProject } from '../../../packages/advjs/node/project'
import {
  compileRuntimeChapterFiles,
  discoverRuntimeChapterFiles,
  resolveConfiguredRuntimeChapterFiles,
} from '../../../packages/advjs/node/runtime/project'

describe('runtime project loader', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-runtime-project-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('includes editable theme sources without executing theme configuration', async () => {
    await mkdir(join(directory, 'pages'))
    await mkdir(join(directory, 'components'))
    await mkdir(join(directory, 'styles'))
    const sources = {
      'pages/start.vue': '<template>Homepage</template>',
      'components/StartMenu.vue': '<template>Menu</template>',
      'styles/theme.scss': '.menu { color: gold; }',
      'theme.config.ts': 'throw new Error("must not execute for source discovery")',
    }
    for (const [path, content] of Object.entries(sources))
      await writeFile(join(directory, path), content)
    const project = await loadProject({ root: directory })
    expect(project.files).toMatchObject(sources)
    expect(project.filePaths).toEqual(expect.arrayContaining(Object.keys(sources)))
  })

  it('discovers numeric chapter folders with stable chapter ids', async () => {
    const chapters = join(directory, 'chapters')
    await mkdir(join(chapters, '1'), { recursive: true })
    await mkdir(join(chapters, '2'), { recursive: true })
    const one = join(chapters, '1', 'one.adv.md')
    const two = join(chapters, '2', 'two.adv.md')
    await writeFile(one, '第一章。')
    await writeFile(two, '第二章。')

    expect(await discoverRuntimeChapterFiles(one)).toEqual([
      { id: 'chapter-1', title: 'chapter-1', paths: [one] },
      { id: 'chapter-2', title: 'chapter-2', paths: [two] },
    ])
  })

  it('compiles all files and uses the requested chapter as program entry', async () => {
    const one = join(directory, 'one.adv.md')
    const two = join(directory, 'two.adv.md')
    await writeFile(one, [
      '## Start {#start}',
      '',
      '- [Go](chapter-2#result)',
    ].join('\n'))
    await writeFile(two, [
      '## Result {#result}',
      '',
      '抵达第二章。',
    ].join('\n'))

    const result = await compileRuntimeChapterFiles({
      id: 'project',
      entryChapterId: 'chapter-2',
      chapters: [
        { id: 'chapter-1', title: 'One', paths: [one] },
        { id: 'chapter-2', title: 'Two', paths: [two] },
      ],
    })

    expect(result.diagnostics).toEqual([])
    expect(result.program?.entry).toEqual({ chapterId: 'chapter-2', nodeId: 'result' })
    expect(result.program?.chapters['chapter-1'].nodes['node-1'].data?.options).toEqual([
      {
        id: 'choice-1',
        label: 'Go',
        target: { chapterId: 'chapter-2', nodeId: 'result' },
      },
    ])
  })

  it('maps configured fountain URLs to exact chapter ids', async () => {
    const publicRoot = join(directory, 'public')
    const one = join(publicRoot, 'md', 'chapters', '1', 'one.adv.md')
    const two = join(publicRoot, 'md', 'chapters', '2', 'two.adv.md')
    await mkdir(join(publicRoot, 'md', 'chapters', '1'), { recursive: true })
    await mkdir(join(publicRoot, 'md', 'chapters', '2'), { recursive: true })
    await writeFile(one, '第一章。')
    await writeFile(two, '第二章。')

    const result = resolveConfiguredRuntimeChapterFiles({
      cwd: directory,
      scriptPath: two,
      chapters: [
        { id: 'prologue', title: '序章', nodes: [{ id: 'one', type: 'fountain', src: '/md/chapters/1/one.adv.md' }] },
        { id: 'result', title: '结果', nodes: [{ id: 'two', type: 'fountain', src: '/md/chapters/2/two.adv.md' }] },
      ],
    })

    expect(result).toEqual({
      entryChapterId: 'result',
      chapters: [
        { id: 'prologue', title: '序章', paths: [one] },
        { id: 'result', title: '结果', paths: [two] },
      ],
    })
  })

  it('loads a standard project into one stable filesystem and compiler result', async () => {
    await mkdir(join(directory, 'adv', 'chapters'), { recursive: true })
    await mkdir(join(directory, 'adv', 'characters'), { recursive: true })
    await mkdir(join(directory, 'adv', 'scenes'), { recursive: true })
    await writeFile(join(directory, 'adv', 'scenes', 'room.md'), '---\nid: room\nname: 房间\n---\n')
    await writeFile(join(directory, 'adv', 'characters', 'aria.character.md'), '---\nid: aria\nname: 艾莉亚\n---\n')
    await writeFile(join(directory, 'adv', 'chapters', 'intro.adv.md'), '【房间】\n\n@艾莉亚\n你好。\n')
    await writeFile(join(directory, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv' }))

    const loaded = await loadProject({ root: directory })

    expect(loaded.root).toBe(directory)
    expect(loaded.config).toEqual({ format: 'json', path: 'adv.config.json' })
    expect(loaded.virtualFiles).toEqual([])
    expect(Object.keys(loaded.files)).toEqual([
      'adv.config.json',
      'adv/chapters/intro.adv.md',
      'adv/characters/aria.character.md',
      'adv/scenes/room.md',
    ])
    expect(loaded.result.diagnostics).toEqual([])
    expect(loaded.result.project.program?.entry.chapterId).toBe('intro')

    const check = await runCheck({ cwd: directory })
    const context = await resolveProjectContext(join(directory, 'adv'))
    expect(check.compilation).toEqual(loaded.result)
    expect(context.compilation).toEqual(loaded.result)
  })

  it('recognizes adv.config.ts through an explicit module compatibility layer', async () => {
    await mkdir(join(directory, 'story', 'chapters'), { recursive: true })
    await writeFile(join(directory, 'story', 'chapters', 'intro.adv.md'), '模块配置项目。\n')
    await writeFile(join(directory, 'adv.config.ts'), 'export default { format: \'adv-md\', root: \'./story\' }\n')

    const loaded = await loadProject({ root: directory })

    expect(loaded.config).toEqual({ format: 'module', path: 'adv.config.ts' })
    expect(loaded.virtualFiles).toEqual(['adv.config.json'])
    expect(loaded.files['adv.config.json']).toBe('{"format":"adv-md","root":"./story"}')
    expect(loaded.result.project.root).toBe('story')
    expect(loaded.result.diagnostics).toEqual([])
  })

  it('identifies JSON evaluated from an inline module game config as virtual despite navigation paths', async () => {
    await mkdir(join(directory, 'adv', 'chapters'), { recursive: true })
    await writeFile(join(directory, 'adv', 'chapters', 'intro.adv.md'), '> Existing story.\n')
    const source = 'export default { root: "adv", gameConfig: { title: "Inline game", chapters: [{ id: "intro", sources: ["chapters/intro.adv.md"] }] } }\n'
    await writeFile(join(directory, 'adv.config.ts'), source)

    const loaded = await loadProject({ root: directory })

    expect(loaded.virtualFiles).toEqual(['adv.config.json', 'game.config.json'])
    // Navigation exposes the evaluated JSON as well, so filePaths alone cannot
    // prove that a configuration is editable source.
    expect(loaded.filePaths).toContain('game.config.json')
    expect(JSON.parse(loaded.files['game.config.json'])).toMatchObject({ title: 'Inline game' })
    expect(loaded.result.project.chapters.map(chapter => chapter.id)).toEqual(['intro'])
    expect(loaded.result.diagnostics).toEqual([])
    expect(await readFile(join(directory, 'adv.config.ts'), 'utf8')).toBe(source)
    await expect(readFile(join(directory, 'game.config.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('identifies an evaluated game.config.ts as virtual while keeping physical adv JSON editable', async () => {
    await mkdir(join(directory, 'adv', 'chapters'), { recursive: true })
    await writeFile(join(directory, 'adv', 'chapters', 'intro.adv.md'), '> Existing story.\n')
    const advSource = '{ "root": "adv", "future": { "keep": true } }\n'
    const gameSource = 'export default { title: "Module game", chapters: [{ id: "intro", sources: ["chapters/intro.adv.md"] }] }\n'
    await writeFile(join(directory, 'adv.config.json'), advSource)
    await writeFile(join(directory, 'game.config.ts'), gameSource)

    const loaded = await loadProject({ root: directory })

    expect(loaded.virtualFiles).toEqual(['game.config.json'])
    expect(loaded.files['adv.config.json']).toBe(advSource)
    expect(JSON.parse(loaded.files['game.config.json']).title).toBe('Module game')
    expect(loaded.result.diagnostics).toEqual([])
    expect(await readFile(join(directory, 'game.config.ts'), 'utf8')).toBe(gameSource)
    await expect(readFile(join(directory, 'game.config.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps physical root and content JSON game configurations nonvirtual with their authored bytes', async () => {
    await mkdir(join(directory, 'adv', 'chapters'), { recursive: true })
    await mkdir(join(directory, 'adv', 'settings'), { recursive: true })
    await writeFile(join(directory, 'adv', 'chapters', 'intro.adv.md'), '> Existing story.\n')
    const sources = {
      'adv.config.json': '{ "root": "adv" }\n',
      'game.config.json': '{\n  "title": "Root metadata",\n  "future": { "keep": true }\n}\n',
      'adv/settings/game.json': '{\n  "title": "Content metadata",\n  "chapters": [{"id":"intro","sources":["chapters/intro.adv.md"]}]\n}\n',
    }
    for (const [path, source] of Object.entries(sources))
      await writeFile(join(directory, path), source)

    const loaded = await loadProject({ root: directory })

    expect(loaded.virtualFiles).toEqual([])
    expect(loaded.files).toMatchObject(sources)
    expect(loaded.result.sourceMap.gameConfig).toBe('adv/settings/game.json')
    expect(loaded.result.project.game.title).toBe('Content metadata')
    expect(loaded.result.diagnostics).toEqual([])
  })

  it('marks settings merged for static analysis as virtual without changing the physical settings file', async () => {
    await mkdir(join(directory, 'adv', 'chapters'), { recursive: true })
    await mkdir(join(directory, 'adv', 'settings'), { recursive: true })
    await writeFile(join(directory, 'adv', 'chapters', 'intro.adv.md'), '> Existing story.\n')
    await writeFile(join(directory, 'adv.config.ts'), 'export default { root: "adv", gameConfig: { chapters: [{ id: "intro", sources: ["chapters/intro.adv.md"] }], variables: { visits: 0 }, entryChapterId: "intro" } }\n')
    const settingsSource = '{\n  "title": "Authored metadata",\n  "future": { "preserve": true }\n}\n'
    await writeFile(join(directory, 'adv', 'settings', 'game.json'), settingsSource)

    const regular = await loadProject({ root: directory })
    expect(regular.virtualFiles).not.toContain('adv/settings/game.json')
    expect(regular.files['adv/settings/game.json']).toBe(settingsSource)

    const checked = await loadProject({ root: directory, staticAnalysis: true })
    expect(checked.virtualFiles).toEqual(expect.arrayContaining(['adv.config.json', 'game.config.json', 'adv/settings/game.json']))
    expect(JSON.parse(checked.files['adv/settings/game.json'])).toEqual({
      title: 'Authored metadata',
      future: { preserve: true },
      chapters: [{ id: 'intro', sources: ['chapters/intro.adv.md'] }],
      variables: { visits: 0 },
      entryChapterId: 'intro',
    })
    expect(checked.result.diagnostics).toEqual([])
    expect(await readFile(join(directory, 'adv', 'settings', 'game.json'), 'utf8')).toBe(settingsSource)
  })

  it('rejects project content symlinks that escape the real project root', async () => {
    const external = await mkdtemp(join(tmpdir(), 'advjs-runtime-external-'))
    await writeFile(join(external, 'escaped.adv.md'), '不应读取。\n')
    await writeFile(join(directory, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv' }))
    await mkdir(join(directory, 'adv', 'chapters'), { recursive: true })
    await symlink(join(external, 'escaped.adv.md'), join(directory, 'adv', 'chapters', 'escaped.adv.md'))

    try {
      await expect(loadProject({ root: directory })).rejects.toMatchObject({
        code: 'ADV_PROJECT_UNSAFE_SYMLINK',
      })
    }
    finally {
      await rm(external, { recursive: true, force: true })
    }
  })

  it('rejects an adv config symlink that escapes the real project root', async () => {
    const external = await mkdtemp(join(tmpdir(), 'advjs-config-external-'))
    const externalConfig = join(external, 'adv.config.json')
    await writeFile(externalConfig, JSON.stringify({ format: 'adv-md', root: './adv' }))
    await symlink(externalConfig, join(directory, 'adv.config.json'))

    try {
      await expect(loadProject({ root: directory })).rejects.toMatchObject({
        code: 'ADV_PROJECT_UNSAFE_SYMLINK',
      })
    }
    finally {
      await rm(external, { recursive: true, force: true })
    }
  })
})
