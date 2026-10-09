// @vitest-environment node

import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { runCheck } from '../../../packages/advjs/node/commands/check'
import { compileMarkdownProgram } from '../../../packages/core/src/compiler/markdown'

const fixtures = resolve(import.meta.dirname, '../../fixtures/diagnostics')
const roots: string[] = []

function project(fixture = 'valid') {
  const cwd = mkdtempSync(join(tmpdir(), 'advjs-static-check-'))
  roots.push(cwd)
  cpSync(join(fixtures, fixture), cwd, { recursive: true })
  return cwd
}

function write(cwd: string, file: string, content: string) {
  mkdirSync(join(cwd, file, '..'), { recursive: true })
  writeFileSync(join(cwd, file), content)
}

function replace(cwd: string, file: string, from: string, to: string) {
  write(cwd, file, readFileSync(join(cwd, file), 'utf8').replace(from, to))
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

const expectedCodes = [
  'ADV_RUNTIME_UNKNOWN_TARGET',
  'ADV_STATIC_UNREACHABLE_CHAPTER',
  'ADV_STATIC_MISSING_RESOURCE',
  'ADV_STATIC_UNKNOWN_VARIABLE',
  'ADV_STATIC_DEAD_END',
]

describe('adv check static authoring diagnostics', () => {
  it('accepts the minimal valid project', async () => {
    const result = await runCheck({ cwd: project() })
    expect(result.issues).toEqual([])
    expect(result.passed).toBe(true)
  })

  it('finds all five defects together, with actionable source locations', async () => {
    const result = await runCheck({ cwd: project('broken') })
    expect(result.passed).toBe(false)
    expect(result.issues.map(issue => issue.code).sort()).toEqual([...expectedCodes].sort())
    for (const issue of result.issues) {
      expect(issue.file).toMatch(/\.adv\.md$/u)
      expect(issue.line).toBeGreaterThan(0)
      expect(issue.column).toBeGreaterThan(0)
      expect(issue.suggestion!.length).toBeGreaterThan(20)
      expect(issue.certainty).toBe('certain')
    }
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ADV_STATIC_UNKNOWN_VARIABLE', line: 8 }))
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ADV_RUNTIME_UNKNOWN_TARGET', line: 15 }))
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ADV_STATIC_MISSING_RESOURCE', line: 5 }))
  })

  it('removes every diagnostic when its corresponding defect is repaired', async () => {
    const cwd = project('broken')
    const repairs: Array<[string[], () => void]> = [
      [['ADV_RUNTIME_UNKNOWN_TARGET', 'ADV_STATIC_UNREACHABLE_CHAPTER'], () => replace(cwd, 'adv/chapters/start.adv.md', 'missing#extra', 'extra')],
      [['ADV_STATIC_MISSING_RESOURCE'], () => replace(cwd, 'adv/chapters/start.adv.md', '/missing.svg', '/room.svg')],
      [['ADV_STATIC_UNKNOWN_VARIABLE'], () => replace(cwd, 'adv/chapters/start.adv.md', 'raedy', 'ready')],
      [['ADV_STATIC_DEAD_END'], () => write(cwd, 'adv/chapters/loop.adv.md', readFileSync(join(fixtures, 'valid/adv/chapters/loop.adv.md'), 'utf8'))],
    ]
    for (const [codes, repair] of repairs) {
      repair()
      const result = await runCheck({ cwd })
      expect(result.issues.map(issue => issue.code)).not.toEqual(expect.arrayContaining(codes))
      for (const code of codes)
        expect(result.issues.some(issue => issue.code === code)).toBe(false)
    }
    expect((await runCheck({ cwd })).issues).toEqual([])
  })

  it('does not mistake skipped choices, natural endings, or variable conditions for certain dead ends', async () => {
    const result = await compileMarkdownProgram({
      id: 'conditions',
      staticAnalysis: { variables: { enabled: true } },
      chapters: [{
        id: 'start',
        content: '## Loop {#loop}\n\n- [Repeat](#loop)\n\n  ```yaml\n  when: enabled\n  ```\n\n- Hidden\n\n  ```yaml\n  when: "false"\n  ```\n\nFinished.\n',
      }],
    })
    expect(result.diagnostics).toEqual([])
  })

  it('keeps an unconditional choice from inventing a fallthrough exit', async () => {
    const result = await compileMarkdownProgram({
      id: 'loop',
      staticAnalysis: {},
      chapters: [{ id: 'start', sourcePath: 'loop.adv.md', content: '## Loop {#loop}\n\n- [Repeat](#loop)\n\nUnreachable ending.' }],
    })
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_STATIC_DEAD_END' }))
  })

  it('marks dynamic targets and legacy scripts uncertain without inventing reachability errors', async () => {
    // eslint-disable-next-line no-template-curly-in-string -- Intentional author interpolation syntax.
    for (const content of ['- [Go](${destination})', '```js\nadv.go(destination)\n```']) {
      const result = await compileMarkdownProgram({
        id: 'dynamic',
        staticAnalysis: {},
        chapters: [{ id: 'start', sourcePath: 'start.adv.md', content }, { id: 'other', content: 'Other ending.' }],
      })
      expect(result.diagnostics.length).toBeGreaterThan(0)
      expect(result.diagnostics.every(item => item.severity === 'warning' && item.certainty === 'uncertain')).toBe(true)
      expect(result.program).toBeUndefined()
      // Runtime compilation continues to reject unsupported executable syntax.
      const runtime = await compileMarkdownProgram({ id: 'dynamic', chapters: [{ id: 'start', content }] })
      expect(runtime.program).toBeUndefined()
      expect(runtime.diagnostics.some(item => item.severity === 'error')).toBe(true)
    }
  })

  it('treats built-in action keys as declarations and host-provided variables as uncertain', async () => {
    const result = await compileMarkdownProgram({
      id: 'variables',
      staticAnalysis: {},
      chapters: [{ id: 'start', content: [
        '```yaml',
        'type: variables/increment',
        'key: count',
        '```',
        '```yaml',
        'type: when',
        'condition: count > 0',
        '```',
        'Counted.',
        '```yaml',
        'type: activity',
        'use: quiz/result',
        '```',
        '```yaml',
        'type: when',
        'condition: result.passed',
        '```',
        'Passed.',
      ].join('\n\n') }],
    })
    expect(result.diagnostics.some(item => item.severity === 'error')).toBe(false)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_STATIC_VARIABLE_UNCERTAIN', certainty: 'uncertain' }))
  })

  it('rejects unsafe action keys and constant expressions that always throw', async () => {
    const result = await compileMarkdownProgram({ id: 'invalid', staticAnalysis: {}, chapters: [{ id: 'start', content: [
      '```yaml',
      'type: variables/set',
      'key: player.__proto__.score',
      'value: 1',
      '```',
      '',
      '```yaml',
      'type: when',
      'condition: 1 / 0 > 1',
      '```',
      '',
      'Never.',
    ].join('\n') }] })
    expect(result.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining(['ADV_STATIC_INVALID_VARIABLE_PATH', 'ADV_STATIC_INVALID_CONSTANT_CONDITION']))
  })

  it('maps diagnostics to the actual file and line in a multi-file chapter', async () => {
    const cwd = project()
    write(cwd, 'adv/settings/game.json', JSON.stringify({ chapters: [{ id: 'start', sources: ['chapters/first.adv.md', 'chapters/second.adv.md'] }] }))
    write(cwd, 'adv/chapters/first.adv.md', 'Opening.\n')
    write(cwd, 'adv/chapters/second.adv.md', '## Second {#second}\n\n- [Missing](nowhere)\n')
    const result = await runCheck({ cwd })
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ADV_RUNTIME_UNKNOWN_TARGET', file: 'adv/chapters/second.adv.md', line: 3, column: 1 }))
  })

  it('checks configured public chapters even with a metadata-only settings file', async () => {
    const cwd = project()
    rmSync(join(cwd, 'adv.config.json'))
    write(cwd, 'adv/settings/game.json', '{ "title": "Public story" }')
    write(cwd, 'adv.config.ts', `export default {
      root: './adv',
      gameConfig: {
        variables: { ready: true },
        cover: '/missing-cover.svg',
        chapters: [{ id: 'public', nodes: [{ type: 'fountain', src: '/story.adv.md' }] }],
      },
    }`)
    write(cwd, 'public/story.adv.md', '```yaml\ntype: when\ncondition: ready\n```\n\n- [Missing](public#missing)\n')
    const result = await runCheck({ cwd })
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ADV_RUNTIME_UNKNOWN_TARGET', file: 'public/story.adv.md', line: 6 }))
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ADV_STATIC_MISSING_RESOURCE', file: 'adv.config.ts', line: 5 }))
    expect(result.issues.some(issue => issue.code === 'ADV_STATIC_UNKNOWN_VARIABLE')).toBe(false)
  })

  it('preserves inline Markdown dialogue text while compiling diagnostics', async () => {
    const result = await compileMarkdownProgram({ id: 'inline', staticAnalysis: {}, chapters: [{ id: 'start', content: '@Guide\nRead **carefully** and [continue](https://example.com).' }] })
    expect(result.diagnostics).toEqual([])
    expect(result.program?.chapters.start.nodes['node-0'].data?.text).toContain('carefully and continue')
  })

  it('checks resource catalogs with --root and does not crash on malformed settings', async () => {
    const cwd = project()
    write(cwd, 'adv/assets.json', JSON.stringify({ schemaVersion: 2, id: 'test', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'missing.svg' }] }))
    expect((await runCheck({ cwd, root: 'adv' })).issues).toContainEqual(expect.objectContaining({ code: 'ADV_STATIC_MISSING_RESOURCE', file: 'adv/assets.json' }))
    write(cwd, 'adv/settings/game.json', '{ "variables": [')
    const invalid = await runCheck({ cwd })
    expect(invalid.passed).toBe(false)
    expect(invalid.issues.some(issue => issue.category === 'syntax')).toBe(true)
  })

  it('checks local resources in Markdown, frontmatter, settings, split catalogs and variants', async () => {
    const cwd = project()
    write(cwd, 'adv/scenes/room.md', '---\nid: room\nsrc: /scene.svg\n---\n\n![diagram](./diagram.svg)\n')
    write(cwd, 'adv/assets.json', JSON.stringify({ schemaVersion: 2, id: 'test', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, includes: ['assets/images.json'] }, null, 2))
    write(cwd, 'adv/assets/images.json', JSON.stringify({ schemaVersion: 2, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg', variants: { large: { path: 'large.svg' } } }] }, null, 2))
    replace(cwd, 'adv/settings/game.json', '"ready": true', '"ready": true, "metadata": { "src": "not-a-resource" }')
    const result = await runCheck({ cwd })
    const resources = result.issues.filter(issue => issue.category === 'resource')
    expect(resources).toHaveLength(3)
    expect(resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: 'adv/scenes/room.md', line: 3 }),
      expect.objectContaining({ file: 'adv/scenes/room.md', line: 6 }),
      expect.objectContaining({ file: 'adv/assets/images.json' }),
    ]))
    write(cwd, 'public/scene.svg', '<svg/>')
    write(cwd, 'adv/scenes/diagram.svg', '<svg/>')
    write(cwd, 'public/large.svg', '<svg/>')
    expect((await runCheck({ cwd })).issues.filter(issue => issue.category === 'resource')).toEqual([])
  })

  it('handles encoded URLs and skips remote resources without fetching them', async () => {
    const cwd = project()
    write(cwd, 'public/a b.svg', '<svg/>')
    write(cwd, 'adv/chapters/start.adv.md', [
      '```yaml',
      '- type: background',
      '  url: /a%20b.svg?v=2#fragment',
      '- type: bgm',
      '  src: https://example.invalid/music.mp3',
      '- type: background',
      // eslint-disable-next-line no-template-curly-in-string -- Intentional author interpolation syntax.
      '  url: "${background}"',
      '```',
      '',
      '## Finish {#finish}',
    ].join('\n'))
    const result = await runCheck({ cwd })
    expect(result.issues.filter(issue => issue.category === 'resource')).toEqual([
      expect.objectContaining({ type: 'warning', code: 'ADV_STATIC_RESOURCE_UNCERTAIN', certainty: 'uncertain' }),
    ])
    expect(result.passed).toBe(true)
  })

  it('keeps checking other chapters when a file contains malformed YAML', async () => {
    const cwd = project('broken')
    write(cwd, 'adv/chapters/extra.adv.md', '```yaml\ntype: [\n```')
    const result = await runCheck({ cwd })
    expect(result.passed).toBe(false)
    expect(result.issues.some(issue => issue.code === 'ADV_RUNTIME_UNKNOWN_TARGET')).toBe(true)
    expect(result.issues.some(issue => issue.code === 'ADV_RUNTIME_PARSE_ERROR')).toBe(true)
    write(cwd, 'adv/scenes/broken.md', '---\nid: [\n---\n')
    expect((await runCheck({ cwd })).issues).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_INVALID_SCENE', file: 'adv/scenes/broken.md' }))
  })

  it('loads configured plugin capabilities and resource aliases without running plugin handlers', async () => {
    const cwd = project()
    rmSync(join(cwd, 'adv.config.json'))
    write(cwd, 'adv.config.ts', `export default {
      plugins: [{ name: 'quiz', version: '1', nodes: { result() { throw new Error('must not run') } } }],
      gameConfig: {
        bgm: { library: { theme: { src: 'https://example.invalid/music.mp3' } } },
        characters: [{ id: 'guide', name: 'Guide', tachies: { smile: { src: '/room.svg' } } }],
      },
    }`)
    write(cwd, 'adv/assets.json', JSON.stringify({ schemaVersion: 2, id: 'test', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'public/room.svg' }] }))
    write(cwd, 'adv/chapters/start.adv.md', '```yaml\n- type: bgm\n  name: theme\n- type: tachie\n  enter:\n    name: Guide\n    status: smile\n```\n\n```yaml\ntype: activity\nuse: quiz/result\n```\n\n## Finish {#finish}')
    const result = await runCheck({ cwd })
    expect(result.issues.filter(issue => issue.type === 'error')).toEqual([])
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'ADV_STATIC_FLOW_UNCERTAIN', certainty: 'uncertain' }))
  })

  it('ships executable CLI diagnostics and meaningful exit codes', () => {
    const cli = resolve(import.meta.dirname, '../../../packages/advjs/bin/adv.mjs')
    for (const [fixture, exitCode] of [['valid', 0], ['broken', 1]] as const) {
      const result = spawnSync(process.execPath, [cli, 'check', '--json'], {
        cwd: join(fixtures, fixture),
        encoding: 'utf8',
        timeout: 20000,
      })
      expect(result.status, result.stderr).toBe(exitCode)
      const envelope = JSON.parse(result.stdout)
      expect(envelope.ok).toBe(exitCode === 0)
      if (fixture === 'broken') {
        const issues = envelope.errors[0].details.diagnostics
        expect(issues.map((issue: { code: string }) => issue.code)).toEqual(expect.arrayContaining(expectedCodes))
        expect(issues.every((issue: { line: number, suggestion: string }) => issue.line > 0 && issue.suggestion)).toBe(true)
      }
    }
  }, 45000)
})
