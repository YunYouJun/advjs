// @vitest-environment node
import type { AdvAssetManifest } from '@advjs/types'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { audioObjectKey } from '@advjs/audio'
import { describe, expect, it } from 'vitest'
import yargs from 'yargs'
import { installBuildCommand } from '../../../packages/advjs/node/cli/build'
import { advBuild } from '../../../packages/advjs/node/commands/build'
import { loadPublishedAudioManifest } from '../../../packages/advjs/node/commands/build/audio-release'

const hash = (source: string) => createHash('sha256').update(source).digest('hex')
const assetId = 'audio_019d137e-7abc-7000-8000-000000000009'

function publicManifest(): AdvAssetManifest {
  const variants = Object.fromEntries((['opus', 'aac'] as const).map(name => [name, {
    objectKey: audioObjectKey({ projectPrefix: 'fixture/project', kind: 'bgm', assetId, sha256: 'a'.repeat(64), extension: name === 'opus' ? 'webm' : 'm4a' }),
    sha256: 'a'.repeat(64),
    bytes: 20,
    mimeType: name === 'opus' ? 'audio/webm' : 'audio/mp4',
  }]))
  return { schemaVersion: 2, id: 'published-fixture', defaultProfile: 'public', profiles: { public: { provider: 'http', baseUrl: 'https://cdn.example.com/audio/' } }, release: { provider: 'tencent-cos', objectPrefix: 'fixture/project' }, assets: [{ id: assetId, type: 'audio', kind: 'bgm', sha256: 'b'.repeat(64), variants }] }
}

async function fromDocument(value: unknown) {
  const root = await mkdtemp(join(tmpdir(), 'advjs-public-manifest-'))
  try {
    const source = JSON.stringify(value)
    await writeFile(join(root, 'audio.json'), source)
    return await loadPublishedAudioManifest(root, { audioManifest: 'audio.json', audioManifestSha256: hash(source) })
  }
  finally { await rm(root, { recursive: true, force: true }) }
}

describe('explicit published audio manifest input', () => {
  it('keeps ordinary local builds opt-in and accepts a pinned local publication', async () => {
    expect(await loadPublishedAudioManifest('/does/not/exist', {})).toBeUndefined()
    expect(await fromDocument(publicManifest())).toMatchObject({ id: 'published-fixture', profiles: { public: { provider: 'http' } } })
  })

  it.each([
    ['non-public profile', (doc: AdvAssetManifest) => { doc.profiles.public = { provider: 'project', root: '/private' } }, 'PUBLIC_PROFILE_INVALID'],
    ['unprotected remote URL', (doc: AdvAssetManifest) => { doc.profiles.public!.baseUrl = 'http://cdn.example.com/' }, 'PUBLIC_URL_INVALID'],
    ['credential URL', (doc: AdvAssetManifest) => { doc.profiles.public!.baseUrl = 'https://secret@cdn.example.com/' }, 'PUBLIC_URL_INVALID'],
    ['signed or mutable URL', (doc: AdvAssetManifest) => { doc.profiles.public!.baseUrl = 'https://cdn.example.com/?token=secret' }, 'PUBLIC_URL_INVALID'],
    ['master path', (doc: AdvAssetManifest) => { doc.assets[0]!.path = 'voice/private-master.wav' }, 'ASSET_INVALID'],
    ['reference media', (doc: AdvAssetManifest) => { doc.assets[0]!.kind = 'reference' }, 'ASSET_INVALID'],
    ['variant traversal', (doc: AdvAssetManifest) => { doc.assets[0]!.variants!.opus!.objectKey = 'fixture/project/../private.webm' }, 'VARIANT_INVALID'],
    ['variant MIME mismatch', (doc: AdvAssetManifest) => { doc.assets[0]!.variants!.aac!.mimeType = 'audio/wav' }, 'VARIANT_INVALID'],
    ['variant byte count', (doc: AdvAssetManifest) => { doc.assets[0]!.variants!.opus!.bytes = 0 }, 'VARIANT_INVALID'],
    ['variant hash', (doc: AdvAssetManifest) => { doc.assets[0]!.variants!.opus!.sha256 = 'unverified' }, 'VARIANT_INVALID'],
    ['duplicate stable asset', (doc: AdvAssetManifest) => { doc.assets.push(structuredClone(doc.assets[0]!)) }, 'ASSET_DUPLICATE'],
  ] as const)('rejects %s even when the changed document is explicitly pinned', async (_name, mutate, code) => {
    const doc = publicManifest()
    mutate(doc)
    await expect(fromDocument(doc)).rejects.toThrow(code)
  })

  it('rejects oversized pinned local files before parsing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-public-manifest-'))
    try {
      const source = ' '.repeat(2 * 1024 * 1024 + 1)
      await writeFile(join(root, 'audio.json'), source)
      await expect(loadPublishedAudioManifest(root, { audioManifest: 'audio.json', audioManifestSha256: hash(source) })).rejects.toThrow('MANIFEST_LIMIT')
    }
    finally { await rm(root, { recursive: true, force: true }) }
  })

  it('rejects an unpinned ordinary build before loading or writing project files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-public-manifest-'))
    try {
      await expect(advBuild({ userRoot: root, audioManifest: 'audio.json' })).rejects.toThrow('MANIFEST_PIN_REQUIRED')
      expect(await readdir(root)).toEqual([])
    }
    finally { await rm(root, { recursive: true, force: true }) }
  })

  it('exposes both mandatory opt-in values in ordinary build CLI help', async () => {
    const cli = yargs().exitProcess(false)
    await installBuildCommand(cli)
    const output = await new Promise<string>((resolve, reject) => {
      cli.parse('build --help', (error, _args, result) => error ? reject(error) : resolve(result))
    })
    expect(output).toContain('--audio-manifest ')
    expect(output).toContain('--audio-manifest-sha256')
  })
})
