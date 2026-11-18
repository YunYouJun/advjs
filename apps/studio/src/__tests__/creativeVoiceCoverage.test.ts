import type { CreativePlaytestReport } from '@advjs/agent'
import type { CharacterVoiceProfile } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { computeAgentProjectRevision, creativePlaytestFindings, runCreativePlaytest } from '@advjs/agent'
import { audioFingerprint, createVoiceLedger, createVoiceTakeEditPlan, createVoiceTakeSelectionPlan } from '@advjs/audio'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createStudioCreativeWorkspace } from '../utils/creativeTeamWorkspace'
import { readCreativeVoiceCoverage } from '../utils/creativeVoiceCoverage'

beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Blob', NodeBlob)
})
afterAll(() => vi.unstubAllGlobals())

const lineId = 'line_01900400-0000-7000-8000-000000000001'
const secondId = 'line_01900400-0000-7000-8000-000000000002'
const narratorId = 'line_01900400-0000-7000-8000-000000000003'
const profile: CharacterVoiceProfile = { intent: { speakingStyle: '平静' }, locales: { 'zh-CN': { providers: { system: { voiceId: 'Tingting', model: 'macos-say', source: 'system' } } } } }
const json = (value: unknown) => JSON.stringify(value)
async function fixture(format: 'flow' | 'adv-md' = 'adv-md') {
  const path = `adv/chapters/intro.${format === 'flow' ? 'chapter.json' : 'adv.md'}`
  const catalog = { schemaVersion: 2 as const, id: 'coverage', defaultProfile: 'local', profiles: { local: { provider: 'project' as const, root: 'adv/assets' } }, assets: [] }
  const files: Record<string, string> = {
    'adv.config.json': json({ schemaVersion: 1, id: 'coverage', root: 'adv', format }),
    'adv/settings/game.json': json({ entryChapterId: 'intro', locale: 'zh-CN' }),
    'adv/characters/lin.character.md': `---\nid: lin\nname: 林\nvoiceProfile: ${json(profile)}\n---\n角色`,
    'adv/assets.json': json(catalog),
    [path]: format === 'flow'
      ? json({ schemaVersion: 1, id: 'intro', title: '配音清单', nodes: [{ id: 'start', type: 'dialogues', dialogues: [{ speakerId: 'lin', text: '列车来了。', lineId }, { speakerId: 'lin', text: '方案未列出的对白。', lineId: secondId }] }, { id: 'narration', type: 'narration', text: '雨停了。', lineId: narratorId }] })
      : `# 车站 {#start}\n\n@lin\n列车来了。 {#${lineId}}\n\n@lin\n方案未列出的对白。 {#${secondId}}\n\n> 雨停了。 {#${narratorId}}`,
  }
  const blobs = new Map<string, Blob>()
  const fs = {
    collectAllFiles: vi.fn(async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) }))),
    exists: async (path: string) => path in files || blobs.has(path),
    readFile: async (path: string) => files[path],
    readBlob: vi.fn(async (path: string) => {
      const blob = blobs.get(path)
      if (!blob)
        throw new Error('Real project bytes missing')
      return blob
    }),
    writeFile: vi.fn(),
    writeBlob: vi.fn(),
    deleteFile: vi.fn(),
  } as unknown as IFileSystem
  async function register(selected = false) {
    // Explicit hash/availability fixture only. Never decoded, played or claimed as speech.
    const blob = new Blob(['unit availability bytes, not spoken audio'])
    const sha256 = await audioFingerprint('unused')
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), value => value.toString(16).padStart(2, '0')).join('')
    const snapshot = { revision: sha256, catalog, ledger: createVoiceLedger() }
    const plan = await createVoiceTakeEditPlan(snapshot, { expectedRevision: sha256, lineId, speakerId: 'lin', locale: 'zh-CN', displayText: '列车来了。', voiceProfileRevision: await audioFingerprint(profile), assetPath: 'voice/coverage.wav', source: 'system', candidate: { id: 'fixture', characterId: 'lin', text: '列车来了。', path: 'fixture.wav', sha256: digest, bytes: blob.size, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 22050, provider: 'system', providerVoiceId: 'Tingting', model: 'macos-say' } })
    files['adv/assets.json'] = json(plan.catalog)
    files['adv/audio/voice-ledger.json'] = json(selected ? createVoiceTakeSelectionPlan({ ...snapshot, ...plan }, { expectedRevision: sha256, lineId, locale: 'zh-CN', takeId: plan.addedTakes[0]!.id }).ledger : plan.ledger)
    blobs.set('adv/assets/voice/coverage.wav', blob)
    return { plan, blob }
  }
  return { fs, files, path, blobs, register }
}

describe('complete saved-project voice inventory', () => {
  it('locates an actually unmarked dialogue and inspects changed candidate prose without adopting it', async () => {
    const f = await fixture()
    delete f.files['adv/assets.json']
    f.files[f.path] = f.files[f.path]!.replace(`{#${secondId}}`, '')
    const workspace = createStudioCreativeWorkspace(f.fs, 'coverage')
    const source = await workspace.snapshot()
    const unresolved = await workspace.inspectVoiceCoverage!(source)
    const unmarked = unresolved.rows.find(row => row.source?.path === f.path && row.source.line === 6)
    expect(unmarked, JSON.stringify(unresolved.rows)).toMatchObject({ status: 'unresolved', speakerId: 'lin' })
    expect(unmarked?.lineId).toBeUndefined()
    await f.register(true)
    const baseline = await workspace.snapshot()
    const candidateFiles = { ...baseline.files, [f.path]: baseline.files[f.path]!.replace('列车来了。', '列车已经开走。') }
    const changed = await workspace.inspectVoiceCoverage!({ ...baseline, files: candidateFiles, revision: await computeAgentProjectRevision(candidateFiles) })
    expect(changed.rows.find(row => row.lineId === lineId)?.status).toBe('stale')
    expect(changed.snapshotRevision).not.toBe(baseline.revision)
    expect(f.files[f.path]).toBe(baseline.files[f.path])
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it.each(['adv-md', 'flow'] as const)('records independent %s missing, unselected, matching, stale and missing-byte evidence from real source/ledger reads', async (format) => {
    const f = await fixture(format)
    delete f.files['adv/assets.json']
    const workspace = createStudioCreativeWorkspace(f.fs, 'coverage')
    const records: CreativePlaytestReport[] = []
    async function inspect() {
      const source = await workspace.snapshot()
      const report = await runCreativePlaytest({ project: { id: 'coverage', files: source.files, revision: source.revision }, scenarios: [{ id: 'end', expectedEnding: 'intro#start', choices: [] }] }, { inspectVoiceCoverage: workspace.inspectVoiceCoverage })
      expect(report.program, JSON.stringify(report.diagnostics)).toBeDefined()
      expect(report.voiceCoverage?.snapshotRevision).toBe(report.snapshotRevision)
      records.push(report)
      return report
    }
    const missing = await inspect()
    expect(missing.voiceCoverage?.rows.filter(row => row.status === 'missing')).toHaveLength(3)
    expect(creativePlaytestFindings(missing).filter(item => item.kind === 'voice')).toHaveLength(3)
    await f.register()
    expect((await inspect()).voiceCoverage?.rows.find(row => row.lineId === lineId)?.status).toBe('unselected')
    await f.register(true)
    const matching = await inspect()
    const selected = matching.voiceCoverage?.rows.find(row => row.lineId === lineId)
    expect(selected).toMatchObject({ status: 'ready', selected: { sha256: expect.stringMatching(/^[a-f0-9]{64}$/) } })
    expect(creativePlaytestFindings(matching).filter(item => item.kind === 'voice')).toHaveLength(2)
    const ledger = f.files['adv/audio/voice-ledger.json']
    f.files[f.path] = f.files[f.path]!.replace('列车来了。', '列车已经开走。')
    expect((await inspect()).voiceCoverage?.rows.find(row => row.lineId === lineId)?.status).toBe('stale')
    f.blobs.clear()
    expect((await inspect()).voiceCoverage?.rows.find(row => row.lineId === lineId)?.status).toBe('unavailable')
    expect(f.files['adv/audio/voice-ledger.json']).toBe(ledger)
    expect(records[2]!.unverified).toContain('audio-playback')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })

  it.each(['adv-md', 'flow'] as const)('lists all %s dialogue and independent narration, including lines absent from any plan or ledger', async (format) => {
    const f = await fixture(format)
    delete f.files['adv/assets.json']
    const before = json(f.files)
    const result = await readCreativeVoiceCoverage(f.fs, 'coverage', () => {})
    expect(result.complete).toBe(true)
    expect(result.locale).toBe('zh-CN')
    expect(result.rows).toHaveLength(3)
    expect(result.rows.every(row => row.status === 'missing' && row.path === f.path)).toBe(true)
    expect(result.rows.find(row => row.lineId === secondId)).toMatchObject({ text: '方案未列出的对白。', speakerId: 'lin', profileMissing: false })
    expect(result.rows.find(row => row.speakerId === 'narrator')).toMatchObject({ text: '雨停了。', profileMissing: true })
    expect(json(f.files)).toBe(before)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('distinguishes unselected, current selected, missing and corrupt project bytes without changing selection', async () => {
    const f = await fixture()
    await f.register()
    expect((await readCreativeVoiceCoverage(f.fs, 'coverage', () => {})).rows[0]!.status).toBe('unselected')
    const { blob } = await f.register(true)
    const ledger = f.files['adv/audio/voice-ledger.json']
    expect((await readCreativeVoiceCoverage(f.fs, 'coverage', () => {})).rows[0]!.status).toBe('ready')
    f.blobs.clear()
    expect((await readCreativeVoiceCoverage(f.fs, 'coverage', () => {})).rows[0]!.status).toBe('unavailable')
    f.blobs.set('adv/assets/voice/coverage.wav', new Blob(['corrupt']))
    expect((await readCreativeVoiceCoverage(f.fs, 'coverage', () => {})).rows[0]!.status).toBe('unavailable')
    f.blobs.set('adv/assets/voice/coverage.wav', blob)
    expect(f.files['adv/audio/voice-ledger.json']).toBe(ledger)
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })

  it('marks selected audio stale after prose, dictionary or intent changes while retaining historical takes', async () => {
    for (const input of ['prose', 'dictionary', 'intent']) {
      const f = await fixture('flow')
      await f.register(true)
      const ledger = f.files['adv/audio/voice-ledger.json']
      if (input === 'prose')
        f.files[f.path] = f.files[f.path]!.replace('列车来了。', '列车已经开走。')
      else if (input === 'dictionary')
        f.files['adv/audio/pronunciation.json'] = json({ schemaVersion: 1, revision: 1, replacements: {}, locales: {} })
      else
        f.files['adv/characters/lin.character.md'] = f.files['adv/characters/lin.character.md']!.replace('平静', '激动')
      const result = await readCreativeVoiceCoverage(f.fs, 'coverage', () => {})
      expect(result.rows[0]!.status).toBe('stale')
      expect(f.files['adv/audio/voice-ledger.json']).toBe(ledger)
      expect(f.blobs.size).toBe(1)
    }
  })

  it('refuses late results after source or account scope changes during actual media reads', async () => {
    const f = await fixture()
    await f.register(true)
    const read = vi.mocked(f.fs.readBlob).getMockImplementation()!
    vi.mocked(f.fs.readBlob).mockImplementationOnce(async (path) => {
      f.files['adv/world.md'] = '作者在检查时保存了新设定。'
      return read(path)
    })
    await expect(readCreativeVoiceCoverage(f.fs, 'coverage', () => {})).rejects.toThrow('SOURCE_CHANGED')
    await expect(readCreativeVoiceCoverage(f.fs, 'coverage', () => {
      throw new Error('account changed')
    })).rejects.toThrow('account changed')
  })
})
