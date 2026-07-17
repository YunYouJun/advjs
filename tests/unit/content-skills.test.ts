import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'adv-content-skill-'))
  temporaryDirectories.push(directory)
  return directory
}

function readSkill(name: string) {
  return readFileSync(resolve(root, 'skills', name, 'SKILL.md'), 'utf8')
}

function readFrontmatterKeys(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/u)
  if (!match)
    return []

  return match[1]
    .split('\n')
    .filter(line => /^[a-z][a-z0-9_-]*:/u.test(line))
    .map(line => line.slice(0, line.indexOf(':')))
    .sort()
}

function runJsonScript(script: string, args: string[]) {
  const result = spawnSync(process.execPath, [resolve(root, script), ...args], {
    cwd: root,
    encoding: 'utf8',
  })

  return {
    exitCode: result.status,
    json: JSON.parse(result.stdout || '{}'),
    stderr: result.stderr,
  }
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const validSha256 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

function createValidAssetManifest() {
  return {
    schemaVersion: 1,
    publicBaseUrl: 'https://assets.example.com/',
    objectPrefix: 'games/example/v1/',
    characters: [
      {
        id: 'hero',
        requiredExpressions: ['default'],
      },
    ],
    assets: [
      {
        id: 'character:hero/default',
        kind: 'character',
        characterId: 'hero',
        expression: 'default',
        url: `https://assets.example.com/games/example/v1/characters/hero/default.${validSha256.slice(0, 12)}.webp`,
        sha256: validSha256,
        width: 1024,
        height: 2048,
        bytes: 240000,
        source: {
          type: 'generated',
          model: 'example-model',
          promptVersion: 'v1',
          createdAt: '2026-07-17',
        },
        license: 'CC BY-NC-SA 4.0',
      },
      {
        id: 'background:observatory',
        kind: 'background',
        url: `https://assets.example.com/games/example/v1/backgrounds/observatory.${validSha256.slice(0, 8)}.webp`,
        sha256: validSha256,
        width: 1920,
        height: 1080,
        bytes: 180000,
        source: {
          type: 'generated',
          model: 'example-model',
          promptVersion: 'v1',
          createdAt: '2026-07-17',
        },
        license: 'CC BY-NC-SA 4.0',
      },
    ],
  }
}

describe('adv content Skills', () => {
  it('publishes modern metadata and isolates hamster constants', () => {
    const skillNames = ['adv-adapt', 'adv-art', 'adv-hamster-demo']

    for (const name of skillNames) {
      const skill = readSkill(name)
      const metadata = readFileSync(resolve(root, 'skills', name, 'agents/openai.yaml'), 'utf8')

      expect(readFrontmatterKeys(skill)).toEqual(['description', 'name'])
      expect(metadata).toContain(`$${name}`)

      if (name === 'adv-hamster-demo') {
        expect(skill).toContain('demo/hamster')
        expect(skill).toContain('cos.advjs.yunle.fun')
        expect(skill).toContain('games/hamster/v1/')
      }
      else {
        expect(skill).not.toContain('cos.advjs.yunle.fun')
        expect(skill).not.toContain('games/hamster/v1/')
      }
    }
  })

  it('keeps the hamster Skill scoped to the approved composition contract', () => {
    const skill = readSkill('adv-hamster-demo')
    const contract = readFileSync(resolve(root, 'skills/adv-hamster-demo/references/demo-contract.md'), 'utf8')
    const content = `${skill}\n${contract}`

    for (const expected of [
      'A+',
      'adv-adapt',
      'adv-art',
      'adv-debug',
      'adv-review',
      'demo/hamster',
      'games/hamster/v1/',
      'hamster',
      'the-common-hamster',
    ])
      expect(content).toContain(expected)

    expect(content).toMatch(/禁止[^\n]*凭证/u)
    expect(content).toMatch(/禁止[^\n]*latest\//u)
  })

  it('audits complete source coverage', () => {
    const directory = createTemporaryDirectory()
    const chapters = join(directory, 'chapters')
    const manifest = join(directory, 'adaptation.json')
    mkdirSync(chapters)
    writeJson(manifest, {
      schemaVersion: 1,
      adaptationMode: 'canonical-plus',
      sources: [{
        id: 'work',
        title: '示例作品',
        order: 1,
        url: 'https://example.com/work',
        license: 'CC BY-NC-SA 4.0',
        sections: [
          { id: 'opening', title: '开端', required: true },
          { id: 'appendix', title: '附录', required: false },
        ],
      }],
    })
    writeFileSync(join(chapters, '01.adv.md'), '<!-- source:work/opening -->\n\n正文\n', 'utf8')

    const result = runJsonScript('skills/adv-adapt/scripts/audit-coverage.mjs', [manifest, chapters])

    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
    expect(result.json).toMatchObject({
      required: 1,
      covered: 1,
      coveragePercent: 100,
      missing: [],
      duplicates: [],
      unknown: [],
    })
  })

  it.each([
    {
      name: 'missing required sections',
      chapter: '没有来源锚点\n',
      expectedKey: 'missing',
      expectedValue: 'work/opening',
    },
    {
      name: 'duplicate source anchors',
      chapter: '<!-- source:work/opening -->\n<!-- source:work/opening -->\n',
      expectedKey: 'duplicates',
      expectedValue: 'work/opening',
    },
    {
      name: 'unknown source anchors',
      chapter: '<!-- source:work/opening -->\n<!-- source:work/unknown -->\n',
      expectedKey: 'unknown',
      expectedValue: 'work/unknown',
    },
  ])('rejects $name', ({ chapter, expectedKey, expectedValue }) => {
    const directory = createTemporaryDirectory()
    const chapters = join(directory, 'chapters')
    const manifest = join(directory, 'adaptation.json')
    mkdirSync(chapters)
    writeJson(manifest, {
      schemaVersion: 1,
      adaptationMode: 'canonical-plus',
      sources: [{
        id: 'work',
        title: '示例作品',
        order: 1,
        url: 'https://example.com/work',
        license: 'CC BY-NC-SA 4.0',
        sections: [{ id: 'opening', title: '开端', required: true }],
      }],
    })
    writeFileSync(join(chapters, '01.adv.md'), chapter, 'utf8')

    const result = runJsonScript('skills/adv-adapt/scripts/audit-coverage.mjs', [manifest, chapters])

    expect(result.exitCode).toBe(1)
    expect(result.json[expectedKey]).toContain(expectedValue)
  })

  it('accepts a complete immutable asset manifest', () => {
    const directory = createTemporaryDirectory()
    const manifest = join(directory, 'assets.json')
    writeJson(manifest, createValidAssetManifest())

    const result = runJsonScript('skills/adv-art/scripts/audit-assets.mjs', [manifest])

    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
    expect(result.json).toMatchObject({
      assetCount: 2,
      countsByKind: {
        background: 1,
        character: 1,
      },
      errors: [],
    })
  })

  it.each([
    {
      name: 'URLs outside the configured prefix',
      mutate: (manifest: ReturnType<typeof createValidAssetManifest>) => {
        manifest.assets[0].url = `https://other.example.com/characters/hero/default.${validSha256.slice(0, 12)}.webp`
      },
      expected: 'outside publicBaseUrl/objectPrefix',
    },
    {
      name: 'object names without a content hash',
      mutate: (manifest: ReturnType<typeof createValidAssetManifest>) => {
        manifest.assets[0].url = 'https://assets.example.com/games/example/v1/characters/hero/default.webp'
      },
      expected: 'content hash',
    },
    {
      name: 'duplicate logical IDs',
      mutate: (manifest: ReturnType<typeof createValidAssetManifest>) => {
        manifest.assets[1].id = manifest.assets[0].id
      },
      expected: 'duplicate asset id',
    },
    {
      name: 'missing licenses',
      mutate: (manifest: ReturnType<typeof createValidAssetManifest>) => {
        manifest.assets[0].license = ''
      },
      expected: 'license',
    },
    {
      name: 'missing required expressions',
      mutate: (manifest: ReturnType<typeof createValidAssetManifest>) => {
        manifest.characters[0].requiredExpressions.push('sad')
      },
      expected: 'hero/sad',
    },
  ])('rejects $name', ({ mutate, expected }) => {
    const directory = createTemporaryDirectory()
    const manifestPath = join(directory, 'assets.json')
    const manifest = createValidAssetManifest()
    mutate(manifest)
    writeJson(manifestPath, manifest)

    const result = runJsonScript('skills/adv-art/scripts/audit-assets.mjs', [manifestPath])

    expect(result.exitCode).toBe(1)
    expect(result.json.errors.join('\n')).toContain(expected)
  })
})
