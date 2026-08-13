// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import {
  ADV_CLI_COMMANDS,
  ADV_CLI_SCHEMA_VERSION,
  ADV_CONTENT_REVISION_ALGORITHM,
  ADV_CONTENT_REVISION_SCHEMA_VERSION,
  ADV_CRITICAL_DEPLOYMENT_RESOURCES,
  ADV_ERROR_CODES,
  ADV_LAUNCH_SUPPORT,
  ADV_NONDETERMINISTIC_FIELDS,
  calculateContentRevision,
  createCanonicalContentManifest,
} from '../../packages/advjs/node/cli/contracts'

const root = resolve(import.meta.dirname, '../..')

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8')) as unknown
}

interface CliContractIndex {
  schemaVersion: number
  schema: string
  examples: string
  commands: Record<string, {
    success: string
    failure: string
  }>
}

interface ContentRevisionFixture {
  schemaVersion: number
  algorithm: string
  nondeterministicFields: string[]
  criticalDeploymentResources: string[]
  goldenContentRevision: string
}

describe('launch CLI contracts', () => {
  it('exposes the complete frozen launch surface as machine-readable data', () => {
    const supportMatrix = readJson('tests/launch/contracts/support-matrix.json')

    expect(ADV_CLI_SCHEMA_VERSION).toBe(1)
    expect(ADV_CLI_COMMANDS).toEqual([
      'init',
      'check',
      'build',
      'editor',
      'agent.install',
      'assets',
      'doctor',
      'deploy',
      'deploy.artifact',
    ])
    expect(ADV_ERROR_CODES).toEqual([
      'ADV_USAGE',
      'ADV_VALIDATION',
      'ADV_BUILD',
      'ADV_EDITOR',
      'ADV_AUTH',
      'ADV_DEPLOY',
      'ADV_NETWORK',
      'ADV_INTERNAL',
    ])
    expect(ADV_LAUNCH_SUPPORT).toEqual({
      schemaVersion: 1,
      node: ['22.x', '24.x'],
      operatingSystems: [
        { name: 'ubuntu', tier: 'full', checks: ['launch-journey'] },
        { name: 'macos', tier: 'smoke', checks: ['packed-install', 'cli', 'editor-lifecycle', 'build'] },
        { name: 'windows', tier: 'smoke', checks: ['packed-install', 'cli', 'editor-lifecycle', 'build'] },
      ],
      packageManagers: [
        { name: 'npm', executors: ['npm', 'npx'] },
        { name: 'pnpm', version: '10.x', executors: ['pnpm', 'pnpm dlx'] },
      ],
      browsers: {
        supported: ['chromium-stable'],
        unsupported: ['firefox', 'safari'],
      },
      templates: ['default', 'galgame'],
      packages: {
        entrypoints: ['advjs', '@advjs/editor', '@advjs/mcp-server'],
        dependencyClosure: [
          '@advjs/assets',
          '@advjs/client',
          '@advjs/core',
          '@advjs/devtools',
          '@advjs/gui',
          '@advjs/parser',
          '@advjs/theme-default',
          '@advjs/types',
          '@advjs/unocss',
        ],
      },
      skills: {
        default: ['adv-create', 'adv-debug', 'adv-review', 'adv-art'],
        optional: ['adv-story', 'adv-adapt'],
        repositoryOnly: ['adv-hamster-demo'],
      },
      agentClients: ['codex', 'claude-code', 'cursor'],
    })
    expect(supportMatrix).toEqual(ADV_LAUNCH_SUPPORT)
  })

  it('enumerates success and failure schemas whose examples validate', () => {
    const index = readJson('tests/launch/contracts/cli-contracts.json') as CliContractIndex
    const schema = readJson(`tests/launch/contracts/${index.schema}`) as Record<string, unknown>
    const examples = readJson(`tests/launch/contracts/${index.examples}`) as Record<string, unknown>
    const ajv = new Ajv2020({ allErrors: true, strict: true })

    addFormats(ajv)
    ajv.addSchema(schema)

    expect(index.schemaVersion).toBe(ADV_CLI_SCHEMA_VERSION)
    expect(Object.keys(index.commands)).toEqual([...ADV_CLI_COMMANDS])
    expect(Object.keys(examples)).toEqual([...ADV_CLI_COMMANDS])

    for (const command of ADV_CLI_COMMANDS) {
      const variants = index.commands[command]
      expect(Object.keys(variants)).toEqual(['success', 'failure'])

      for (const outcome of ['success', 'failure'] as const) {
        const validate = ajv.getSchema(variants[outcome])
        const example = (examples[command] as Record<string, unknown>)[outcome]

        expect(validate, `${command}.${outcome} schema`).toBeTypeOf('function')
        expect(validate!(example), JSON.stringify(validate!.errors)).toBe(true)
      }
    }
  })

  it('keeps content revisions stable across key, path, and traversal order', () => {
    const fixture = readJson('tests/launch/contracts/content-revision.json') as ContentRevisionFixture
    const goldenProjectRoot = resolve(root, 'tests/launch/fixtures/golden-project')
    const files = [
      'adv/scenes/room.md',
      'adv/assets.json',
      'adv/chapters/chapter_01.adv.md',
      'adv/characters/xiaoyu.character.md',
      'adv.config.json',
    ].map(path => ({
      path,
      content: readFileSync(resolve(goldenProjectRoot, path), 'utf8'),
    }))
    const assetManifest = JSON.parse(files.find(file => file.path === 'adv/assets.json')!.content) as Record<string, unknown>
    const registeredAssets = [
      {
        id: 'character/xiaoyu/default',
        path: 'adv/assets/characters/xiaoyu.webp',
        sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      {
        id: 'background/room',
        path: 'adv/assets/backgrounds/room.webp',
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ]
    const canonicalInput = {
      projectFiles: files,
      assetManifest: {
        ...assetManifest,
        generatedAt: '2026-08-11T12:00:00.000Z',
      },
      registeredAssets,
    }
    const permutedInput = {
      projectFiles: [...files].reverse().map(file => ({
        content: file.content,
        path: file.path.replaceAll('/', '\\'),
      })),
      assetManifest: {
        updatedAt: '2099-01-01T00:00:00.000Z',
        assets: assetManifest.assets,
        profiles: assetManifest.profiles,
        defaultProfile: assetManifest.defaultProfile,
        id: assetManifest.id,
        schemaVersion: assetManifest.schemaVersion,
      },
      registeredAssets: [...registeredAssets].reverse().map(asset => ({
        sha256: asset.sha256,
        path: asset.path.replaceAll('/', '\\'),
        id: asset.id,
      })),
    }

    expect(fixture).toMatchObject({
      schemaVersion: ADV_CONTENT_REVISION_SCHEMA_VERSION,
      algorithm: ADV_CONTENT_REVISION_ALGORITHM,
      nondeterministicFields: ADV_NONDETERMINISTIC_FIELDS,
      criticalDeploymentResources: ADV_CRITICAL_DEPLOYMENT_RESOURCES,
    })
    expect(createCanonicalContentManifest(permutedInput)).toEqual(createCanonicalContentManifest(canonicalInput))
    expect(calculateContentRevision(canonicalInput)).toBe(fixture.goldenContentRevision)
    expect(calculateContentRevision(permutedInput)).toBe(fixture.goldenContentRevision)
  })

  it('pins one minimal Chinese request to its standard Markdown project', () => {
    const request = readFileSync(resolve(root, 'tests/launch/fixtures/golden-request.md'), 'utf8')
    const chapter = readFileSync(resolve(root, 'tests/launch/fixtures/golden-project/adv/chapters/chapter_01.adv.md'), 'utf8')

    for (const expected of ['《雨夜来信》', '小雨', '雨夜的房间', '二选一', 'ADV.JS 标准 Markdown'])
      expect(request).toContain(expected)

    expect(chapter).toContain('@小雨')
    expect(chapter.match(/^- /gmu)).toHaveLength(2)
    expect(chapter).toContain('未来自己的信')
  })
})
