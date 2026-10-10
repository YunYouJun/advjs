// @vitest-environment node
import type { AdvConfig } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readVoiceSample, runVoiceSamples, runVoiceSelect } from '../../../packages/advjs/node/commands/voice-library'
import { createEditorBridge } from '../../../packages/advjs/node/editor'

let root: string
let config: Partial<AdvConfig>
let fragment: { schemaVersion: number, assets: Array<Record<string, unknown>> }
let bridge: Awaited<ReturnType<typeof createEditorBridge>> | undefined

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-voice-library-')))
  await mkdir(join(root, 'adv/cache'), { recursive: true })
  const bytes = Buffer.alloc(48)
  bytes.write('RIFF', 0)
  bytes.write('WAVE', 8)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(join(root, 'adv/cache/sample.wav'), bytes)
  fragment = { schemaVersion: 2, assets: ['first', 'second'].map(id => ({ id, type: 'audio', kind: 'voice', characterId: 'hero', state: 'candidate', cachePath: 'adv/cache/sample.wav', sha256, bytes: bytes.length, mimeType: 'audio/wav' })) }
  await writeFile(join(root, 'adv/audio.json'), JSON.stringify(fragment))
  await writeFile(join(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'voice-test', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/cache' } }, includes: ['audio.json'] }))
  await writeFile(join(root, 'library.json'), JSON.stringify({ schemaVersion: 1, evidence: { keep: true }, voices: [{ id: 'hero-voice', characterId: 'hero', version: 'v1', label: 'Hero', extra: 'keep', implementations: { mock: { preset: 'short' } } }] }))
  config = { authoring: { voice: { library: 'library.json', assetManifest: 'adv/assets.json', presets: { short: 'short.json' }, defaultPreset: 'short' } } }
})
afterEach(async () => {
  await bridge?.stop()
  await rm(root, { recursive: true, force: true })
})

describe('native audio sample selection', () => {
  it('lists native includes without cached media and verifies cachePath, hash, and size only on reading', async () => {
    const before = await readFile(join(root, 'library.json'), 'utf8')
    await rm(join(root, 'adv/cache/sample.wav'))
    expect(await runVoiceSamples({ root, config })).toMatchObject({ voices: [{ id: 'hero-voice' }], samples: [{ assetId: 'first' }, { assetId: 'second' }] })
    await expect(readVoiceSample({ root, config }, 'first')).rejects.toMatchObject({ code: 'ADV_VALIDATION', message: 'Voice sample has no local cache; prepare it through the project asset workflow' })
    expect(await readFile(join(root, 'library.json'), 'utf8')).toBe(before)
  })

  it('preserves unknown fields, requires a fresh revision and explicit replacement, and never rewrites media or assets', async () => {
    const assets = await readFile(join(root, 'adv/audio.json'), 'utf8')
    const initial = await runVoiceSamples({ root, config })
    const selected = await runVoiceSelect({ root, config, voiceId: 'hero-voice', assetId: 'first', expectedRevision: initial.revision! })
    expect(selected.voices[0]?.selectedSample).toMatchObject({ assetId: 'first' })
    const saved = JSON.parse(await readFile(join(root, 'library.json'), 'utf8'))
    expect(saved).toMatchObject({ evidence: { keep: true }, voices: [{ extra: 'keep' }] })
    await expect(runVoiceSelect({ root, config, voiceId: 'hero-voice', assetId: 'second', expectedRevision: initial.revision!, replaceSelected: true })).rejects.toThrow('VOICE_CONFLICT')
    await expect(runVoiceSelect({ root, config, voiceId: 'hero-voice', assetId: 'second', expectedRevision: selected.revision! })).rejects.toThrow('replaceSelected')
    await runVoiceSelect({ root, config, voiceId: 'hero-voice', assetId: 'second', expectedRevision: selected.revision!, replaceSelected: true })
    expect(await readFile(join(root, 'adv/audio.json'), 'utf8')).toBe(assets)
  })

  it('refuses different characters, corrupt media, rejected samples, and escaping symlinks', async () => {
    const initial = await runVoiceSamples({ root, config })
    const options = { root, config, voiceId: 'hero-voice', assetId: 'first', expectedRevision: initial.revision! }
    fragment.assets[0]!.characterId = 'other'
    await writeFile(join(root, 'adv/audio.json'), JSON.stringify(fragment))
    await expect(runVoiceSelect(options)).rejects.toThrow('different character')
    fragment.assets[0]!.characterId = 'hero'
    fragment.assets[0]!.state = 'rejected'
    await writeFile(join(root, 'adv/audio.json'), JSON.stringify(fragment))
    await expect(runVoiceSelect(options)).rejects.toThrow('Rejected')
    await writeFile(join(root, 'adv/cache/sample.wav'), 'corrupt')
    await expect(readVoiceSample({ root, config }, 'first')).rejects.toThrow('size differs')
    await rm(join(root, 'adv/cache/sample.wav'))
    await symlink('/etc/hosts', join(root, 'adv/cache/sample.wav'))
    await expect(readVoiceSample({ root, config }, 'first')).rejects.toThrow('outside the project')
    expect((await runVoiceSamples({ root, config })).voices[0]).not.toHaveProperty('selectedSample')
  })

  it('uses the authenticated local bridge for listing, audio and conflict-checked selection', async () => {
    await mkdir(join(root, 'public'))
    await writeFile(join(root, 'public/index.html'), '<html></html>')
    await writeFile(join(root, 'adv.config.ts'), `export default ${JSON.stringify(config)}`)
    bridge = await createEditorBridge({ projectRoot: root, publicRoot: join(root, 'public'), port: 0 })
    const ready = await bridge.start()
    const origin = new URL(ready.url).origin
    const headers = { authorization: `Bearer ${bridge.token}` }
    expect((await fetch(`${origin}/__advjs/api/voice-library`)).status).toBe(401)
    const snapshot = await (await fetch(`${origin}/__advjs/api/voice-library`, { headers })).json()
    const audio = await fetch(`${origin}/__advjs/api/voice-audio?assetId=first`, { headers })
    expect(audio.headers.get('content-type')).toBe('audio/wav')
    expect((await audio.arrayBuffer()).byteLength).toBe(48)
    const select = await fetch(`${origin}/__advjs/api/voice-selection`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ voiceId: 'hero-voice', assetId: 'first', expectedRevision: snapshot.revision }) })
    expect(select.status).toBe(200)
    const stale = await fetch(`${origin}/__advjs/api/voice-selection`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ voiceId: 'hero-voice', assetId: 'second', expectedRevision: snapshot.revision }) })
    expect(stale.status).toBe(409)
    const escaping = await fetch(`${origin}/__advjs/api/voice-audio?assetId=../../private.wav`, { headers })
    expect(escaping.status).toBe(400)
  })
})
