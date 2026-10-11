// @vitest-environment node
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { toPlayerConfig } from '../../../packages/advjs/node/config/player'
import { createEditorBridge } from '../../../packages/advjs/node/editor'
import { loadProject } from '../../../packages/advjs/node/project'

const roots: string[] = []
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const takeId = 'take_019d137e-7abc-7000-8000-000000000001'
const assetId = 'audio_019d137e-7abc-7000-8000-000000000001'
const consentPath = 'authoring/rights/original-synthetic.json'
const consent = 'PRIVATE-ORIGINAL-SYNTHETIC-AUTHORIZATION'
const digest = 'a'.repeat(64)

async function project(selected = false) {
  const root = await mkdtemp(join(tmpdir(), 'advjs-consent-loader-'))
  roots.push(root)
  const rights = { license: 'Original synthetic test permission', subject: 'Fictional voice', consentRecord: consentPath }
  const profile = { locales: { 'zh-CN': { providers: { 'fixture-tts': { voiceId: 'reference:original', model: 'fixture-model', source: 'cloned', rights } } } } }
  const files = {
    'adv.config.json': { id: 'consent-loader', format: 'flow', root: 'adv' },
    'adv/settings/game.json': { title: 'Consent', characters: [{ id: 'hero', name: 'Hero', voiceProfile: profile }] },
    'adv/chapters/intro.chapter.json': { schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [{ id: 'hello', type: 'dialogues', dialogues: [{ speakerId: 'hero', text: '你好。', lineId }] }] },
    'adv/assets.json': { schemaVersion: 2, id: 'consent-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [{ id: assetId, type: 'audio', kind: 'voice', path: 'voice.wav', sha256: digest }] },
    'adv/audio/voice-ledger.json': { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '你好。', locales: { 'zh-CN': { selectedTake: selected ? takeId : null, takes: [{ id: takeId, assetId, sha256: digest, providerId: 'fixture-tts', voiceId: 'reference:original', model: 'fixture-model', voiceProfileRevision: digest, inputFingerprint: digest, spokenText: '你好。', source: 'cloned', rights, parameters: { preset: 'PRIVATE-PROVIDER-PARAMETER' }, createdAt: '2026-10-11T08:00:00.000Z' }] } } } } },
  }
  for (const [path, value] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), JSON.stringify(value))
  }
  await mkdir(join(root, 'authoring/rights'), { recursive: true })
  await mkdir(join(root, 'public/media'), { recursive: true })
  await writeFile(join(root, consentPath), consent)
  await writeFile(join(root, 'authoring/unreferenced-secret.json'), 'PRIVATE-UNREFERENCED-SECRET')
  await writeFile(join(root, 'index.html'), '<main>Editor</main>')
  return root
}

afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true })
})

describe('native referenced voice consent discovery', () => {
  it('includes unselected-take and current-profile consent in the finite Editor snapshot without scanning private authoring files', async () => {
    const root = await project()
    const bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: root, publicRoot: root })
    try {
      const ready = await bridge.start()
      const response = await fetch(new URL('/__advjs/api/project', ready.url), { headers: { authorization: `Bearer ${bridge.token}` } })
      expect(response.status).toBe(200)
      const loaded = await response.json()
      expect(loaded.files[consentPath]).toBe(consent)
      expect(loaded.files['authoring/unreferenced-secret.json']).toBeUndefined()
      expect(loaded.result.diagnostics.filter((issue: any) => issue.severity === 'error')).toEqual([])
      const ledgerPath = join(root, 'adv/audio/voice-ledger.json')
      await rm(ledgerPath)
      expect((await loadProject({ root })).files[consentPath]).toBe(consent)
    }
    finally { await bridge.stop() }
  })

  it('compiles a selected cloned voice for ordinary native export while keeping consent and provider parameters out of player resources', async () => {
    const root = await project(true)
    const loaded = await loadProject({ root })
    expect(loaded.result.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
    expect(loaded.result.project.program?.schemaVersion).toBe(2)
    // No byte identity is invented: this export check uses the hash of these actual test bytes.
    const bytes = new Uint8Array([1, 2, 3, 4])
    const { createHash } = await import('node:crypto')
    const actual = createHash('sha256').update(bytes).digest('hex')
    const catalog = JSON.parse(await readFile(join(root, 'adv/assets.json'), 'utf8'))
    catalog.assets[0].sha256 = actual
    await writeFile(join(root, 'adv/assets.json'), JSON.stringify(catalog))
    const ledger = JSON.parse(await readFile(join(root, 'adv/audio/voice-ledger.json'), 'utf8'))
    ledger.lines[lineId].locales['zh-CN'].takes[0].sha256 = actual
    await writeFile(join(root, 'adv/audio/voice-ledger.json'), JSON.stringify(ledger))
    await writeFile(join(root, 'public/media/voice.wav'), bytes)
    const prepared = await prepareProjectGame(await loadProject({ root }))
    expect(prepared.resources.size).toBe(1)
    expect([...prepared.resources.values()][0]).toEqual(Buffer.from(bytes))
    const player = JSON.stringify(toPlayerConfig({ gameConfig: prepared.game }))
    for (const privateValue of [consentPath, consent, 'PRIVATE-PROVIDER-PARAMETER', '"voiceProfile"', 'consentRecord'])
      expect(player).not.toContain(privateValue)
  })

  it('rejects referenced documents outside the real project root and documents beyond the finite size limit', async () => {
    const root = await project()
    const outside = await mkdtemp(join(tmpdir(), 'advjs-consent-outside-'))
    roots.push(outside)
    await writeFile(join(outside, 'consent.json'), consent)
    await rm(join(root, consentPath))
    await symlink(join(outside, 'consent.json'), join(root, consentPath))
    await expect(loadProject({ root })).rejects.toMatchObject({ code: 'ADV_PROJECT_UNSAFE_SYMLINK' })
    await rm(join(root, consentPath))
    await writeFile(join(root, consentPath), 'x'.repeat(64 * 1024 + 1))
    await expect(loadProject({ root })).rejects.toThrow('exceeds 64 KiB')
  })

  it('keeps missing or noncanonical consent fail-closed instead of reading an unrelated private file', async () => {
    const root = await project(true)
    await rm(join(root, consentPath))
    const missing = await loadProject({ root })
    expect(missing.result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_VOICE_CONSENT_REQUIRED' }))
    expect(missing.result.project.program).toBeUndefined()
    const ledgerPath = join(root, 'adv/audio/voice-ledger.json')
    const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'))
    ledger.lines[lineId].locales['zh-CN'].takes[0].rights.consentRecord = 'authoring/./unreferenced-secret.json'
    await writeFile(ledgerPath, JSON.stringify(ledger))
    const invalid = await loadProject({ root })
    expect(invalid.files['authoring/./unreferenced-secret.json']).toBeUndefined()
    expect(invalid.result.project.program).toBeUndefined()
  })
})
