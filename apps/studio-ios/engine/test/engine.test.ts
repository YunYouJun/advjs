import type { GoldenCase } from '../golden/cases'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildEngine, findForbiddenGlobals } from '../build'
import { createGoldenCases, runGoldenCases } from '../golden/cases'
import { loadEngineSandbox } from '../golden/sandbox'
import { call, ENGINE_API_VERSION } from '../src/index'
import { ENGINE_SIZE_BUDGET_BYTES, repoRoot } from '../workspace'

const EXPECTED_OPERATIONS = [
  'assets.normalizeManifest',
  'assets.readManifest',
  'chapter.parseAst',
  'content.parse',
  'content.stringify',
  'engine.info',
  'host.selfTest',
  'package.inspect',
  'package.plan',
  'project.applyPatches',
  'project.authoringProgram',
  'project.compile',
  'project.fixReferences',
  'project.fromTemplate',
  'project.index',
  'project.legacyChapters',
  'project.playerConfig',
  'project.slug',
  'project.templates',
  'project.validate',
]

function frontmatterKeys(source: string): string[] {
  const match = /^---\n([\s\S]*?)\n---/u.exec(source.trimStart())
  const data = match ? yaml.load(match[1]) : {}
  return data && typeof data === 'object' ? Object.keys(data) : []
}

function body(source: string): string {
  const match = /^---\n[\s\S]*?\n---([\s\S]*)$/u.exec(source.trimStart())
  return (match ? match[1] : source).trim()
}

let cases: GoldenCase[]
let expected: Record<string, string>

beforeAll(async () => {
  cases = await createGoldenCases(call)
  expected = await runGoldenCases(call, cases)
})

describe('engine bundle', () => {
  it('keeps Node, DOM and missing JavaScriptCore globals out of the closure', async () => {
    const debug = await buildEngine({ minify: false })
    expect(findForbiddenGlobals(debug.code)).toEqual([])
    expect(debug.packages.map(item => item.name)).not.toContain('vue')
  })

  it('stays within the size budget', async () => {
    const engine = await buildEngine()
    expect(engine.bytes).toBeLessThanOrEqual(ENGINE_SIZE_BUDGET_BYTES)
  })

  it('returns byte-identical responses in a JavaScriptCore-like sandbox', async () => {
    const sandbox = loadEngineSandbox((await buildEngine()).code)
    const bundled = await runGoldenCases(sandbox.call, cases)
    const mismatches = cases.filter(item => bundled[item.name] !== expected[item.name]).map(item => item.name)
    expect(mismatches).toEqual([])
    // Only the prelude's documented shims and the entry point leak into the global scope.
    expect(sandbox.globals.filter(name => !name.startsWith('__zod_'))).toEqual(
      ['AdvEngine', 'TextDecoder', 'TextEncoder', 'atob', 'btoa', 'crypto', 'structuredClone'],
    )
  })
})

describe('engine contract', () => {
  it('publishes a stable, versioned operation list', () => {
    const info = JSON.parse(expected.info)
    expect(info).toEqual({
      ok: true,
      apiVersion: ENGINE_API_VERSION,
      result: { apiVersion: 1, operations: EXPECTED_OPERATIONS, plugins: { 'star-map': '1.0.0', 'civilization': '1.0.0' } },
    })
  })

  it('answers every golden case, failing only the deliberate error cases', () => {
    const failures = cases.filter(item => !JSON.parse(expected[item.name]).ok).map(item => item.name)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.every(name => name.startsWith('error:'))).toBe(true)
    expect(cases.filter(item => item.name.startsWith('error:')).every(item => failures.includes(item.name))).toBe(true)
  })

  it('reports errors with stable codes only', () => {
    const codes = Object.fromEntries(cases
      .filter(item => item.name.startsWith('error:'))
      .map(item => [item.name, JSON.parse(expected[item.name]).error.code]))
    expect(codes).toEqual({
      'error:unknown-operation': 'ENGINE_UNKNOWN_OPERATION',
      'error:prototype-operation': 'ENGINE_UNKNOWN_OPERATION',
      'error:invalid-json': 'ENGINE_INVALID_JSON',
      'error:non-object': 'ENGINE_INVALID_INPUT',
      'error:array': 'ENGINE_INVALID_INPUT',
      'error:missing-files': 'ENGINE_INVALID_INPUT',
      'error:file-not-text': 'ENGINE_INVALID_INPUT',
      'error:content-type': 'ENGINE_INVALID_INPUT',
      'error:content-invalid': 'ENGINE_CONTENT_INVALID',
      'error:yaml-invalid': 'ENGINE_CONTENT_INVALID',
      'error:project-format': 'ENGINE_PROJECT_INVALID',
      'error:game-settings': 'ENGINE_PROJECT_INVALID',
      'error:package-manifest-missing': 'ENGINE_CONTENT_INVALID',
      'error:package-manifest-json': 'ENGINE_CONTENT_INVALID',
      'error:package-manifest-fields': 'ENGINE_CONTENT_INVALID',
    })
  })
})

describe('content round trips', () => {
  async function source(name: string) {
    return readFile(resolve(repoRoot, name.slice(name.indexOf(':') + 1)), 'utf8')
  }

  it('returns every unchanged document byte for byte', async () => {
    const unchanged = cases.filter(item => item.name.startsWith('stringify-unchanged:'))
    expect(unchanged.length).toBeGreaterThan(60)
    for (const item of unchanged)
      expect(JSON.parse(expected[item.name]).result, item.name).toBe(await source(item.name))
  })

  it('keeps unknown frontmatter keys and bodies when authors edit fields', async () => {
    const edited = cases.filter(item => item.name.startsWith('stringify-edited:'))
    for (const item of edited) {
      const original = await source(item.name)
      const output: string = JSON.parse(expected[item.name]).result
      for (const key of frontmatterKeys(original))
        expect(frontmatterKeys(output), `${item.name} lost ${key}`).toContain(key)
      if (!item.name.endsWith('.character.md'))
        expect(body(output), item.name).toBe(body(original))
    }
  })

  it('keeps unknown character sections and author preamble', () => {
    const output: string = JSON.parse(expected['stringify-edited:apps/studio-ios/engine/fixtures/round-trip/adv/characters/xiaoyun.character.md']).result
    expect(output).toContain('favoriteSnack: 葵花籽')
    expect(output).toContain('作者在标题之前写的说明，任何客户端都应保留。')
    expect(output).toContain('## 灵感来源\n\n一个未知小节，任何客户端都应保留。')
    expect(output).toContain('## 性格\n\n改写后的性格。')
    expect(output).toContain('targetId: ghost')
    expect(output).toContain('smile:\n    src: assets/characters/xiaoyun-smile.webp')
  })
})

describe('project operations', () => {
  it('indexes a snapshot with the same discovery rules as Studio', () => {
    const index = JSON.parse(expected['index:round-trip']).result
    expect(index.chapters.map((chapter: { file: string }) => chapter.file)).toEqual(['adv/chapters/one.adv.md', 'adv/chapters/two.adv.md'])
    expect(index.characters.map((character: { id: string }) => character.id)).toEqual(['hamster', 'xiaoyun'])
    // An asset manifest replaces document-based audio, as in Studio.
    expect(index.audios).toEqual([{ file: 'adv/assets.json#bgm/theme', name: 'Theme', assetId: 'bgm/theme', duration: 20, tags: ['night'] }])
  })

  it('validates with located issues and repairs broken links', () => {
    const validation = JSON.parse(expected['validate:round-trip']).result
    expect(validation.passed).toBe(false)
    expect(validation.issues).toContainEqual({ type: 'error', category: 'character', file: 'adv/chapters/two.adv.md', message: '陌生人' })
    const fixed = JSON.parse(expected['fix:round-trip']).result
    expect(Object.keys(fixed.writes).sort()).toEqual(['adv/characters/xiaoyun.character.md', 'adv/locations/home.md', 'adv/scenes/balcony.md'])
    expect(fixed.writes['adv/locations/home.md']).not.toContain('attic')
    expect(fixed.writes['adv/locations/home.md']).toContain('mapPin')
  })

  it('locates authoring diagnostics in the unsaved buffer', () => {
    const result = JSON.parse(expected['authoring-override:round-trip']).result
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_UNKNOWN_TARGET',
      file: 'adv/chapters/one.adv.md',
      line: 3,
    }))
  })

  it('normalizes music source pages without WHATWG URL', () => {
    const manifest = JSON.parse(expected['manifest:round-trip']).result
    expect(manifest.path).toBe('adv/assets.json')
    expect(manifest.manifest.assets.find((asset: { id: string }) => asset.id === 'bgm/theme').music.source.url).toBe('https://suno.com/song/round-trip')
  })

  it('maps legacy chapter folders like the CLI', () => {
    const legacy = JSON.parse(expected['legacy:hamster-public-md']).result
    expect(legacy.chapters.length).toBeGreaterThan(0)
    expect(Object.keys(legacy.files)).toContain('adv/settings/game.json')
    expect(JSON.parse(expected['compile:hamster-public-md']).ok).toBe(true)
  })

  it('creates projects from the shared templates', () => {
    const templates = JSON.parse(expected.templates).result
    expect(templates.templates).toEqual(['visual-novel-starter', 'school-romance', 'mystery-detective', 'fantasy-adventure', 'modern-urban'])
    for (const id of [...templates.templates, templates.quickStart]) {
      const files = JSON.parse(expected[`template:${id}`]).result.files
      expect(Object.keys(files)).toContain('README.md')
      expect(files['README.md']).toContain('# 星海 Story 1')
      expect(Object.keys(files).some(path => path.endsWith('.adv.md'))).toBe(true)
    }
    expect(expected['template:unknown-template']).toBe(expected['template:visual-novel-starter'])
  })

  it('derives slugs like Web Studio', () => {
    expect(JSON.parse(expected['slug:mixed']).result).toEqual({ slug: 'my-星海-story', valid: true })
    expect(JSON.parse(expected['slug:symbols']).result).toEqual({ slug: '', valid: false })
  })

  it('plans portable packages with the Web manifest and safe paths only', () => {
    const plan = JSON.parse(expected['package:round-trip']).result
    expect(plan.manifest).toEqual({
      name: '往返样例',
      version: '1.0.0',
      exportedAt: '2026-10-21T00:00:00.000Z',
      stats: { characters: 2, chapters: 2, scenes: 2, audios: 1, knowledge: 0 },
    })
    const paths = plan.entries.map((entry: { path: string }) => entry.path)
    expect(paths).toContain('adv.config.json')
    expect(paths).toContain('adv/assets/characters.json')
    expect(paths).toContain('adv/assets/bgm/theme.m4a')
    expect(paths.every((path: string) => path === 'adv.config.json' || path.startsWith('adv/'))).toBe(true)
    const inspected = JSON.parse(expected['package-inspect:valid']).result
    expect(inspected.unsafePaths).toEqual(['../escape.md', '/absolute.md', 'adv/.git/config', 'adv\\windows.md', 'C:/drive.md', 'adv//empty.md'])
  })
})
