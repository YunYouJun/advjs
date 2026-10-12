import type { VoiceGenerationResolvedInput } from '@advjs/audio'
import type { CharacterVoiceProfile, RuntimeProgram, VoiceAuthoringService, VoiceAuthoringSnapshot } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import { createMemoryVoiceGenerationStore, createVoiceGenerationRunner, emptyVoiceGenerationStore, planVoiceGeneration, voiceGenerationInputFingerprint, voiceInputFingerprint } from '@advjs/audio'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportProject } from '../composables/useProjectExport'
import { prepareStudioVoiceJobInput, resolveStudioVoiceJobInput, reviewStudioVoiceJobLines, studioVoiceJobContext } from '../utils/voiceGeneration'
import { parseScopedVoiceJobs, voiceJobScopeKey } from '../utils/voiceGenerationStore'

const heroId = 'line_01900400-0000-7000-8000-000000000001'
const narratorId = 'line_01900400-0000-7000-8000-000000000002'
const scope = { accountId: 'author-one', projectId: 'native-project' }
const budget = { maxCharacters: 100, concurrency: 1, allowUnknownCost: true }
afterEach(() => vi.unstubAllGlobals())
function profile(): CharacterVoiceProfile {
  return { intent: { pace: 'slow' }, locales: { 'zh-CN': { providers: { 'fixture-provider': { voiceId: 'reviewed-voice', model: 'reviewed-model', source: 'system' } } } } }
}
function fixture() {
  const snapshot: VoiceAuthoringSnapshot = {
    revision: 'a'.repeat(64),
    ledger: { schemaVersion: 1, lines: {} },
    catalog: { schemaVersion: 2, id: 'native', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [] },
    pronunciation: { schemaVersion: 1, revision: 1, replacements: { ADV: '冒险' }, locales: {} },
    narratorProfile: profile(),
  }
  const program: RuntimeProgram = { schemaVersion: 2, id: 'native', hash: 'program', entry: { chapterId: 'intro', nodeId: 'hero' }, requiredPlugins: {}, chapters: {
    intro: { id: 'intro', title: 'Opening', entry: 'hero', order: ['hero', 'untagged'], nodes: { hero: { id: 'hero', kind: 'dialog', data: { lineId: heroId, speakerId: 'hero', text: 'ADV你好🙂' } }, untagged: { id: 'untagged', kind: 'narration', data: { text: 'No stable ID', speakerId: 'narrator' } } } },
    ending: { id: 'ending', entry: 'narrator', order: ['narrator'], nodes: { narrator: { id: 'narrator', kind: 'narration', data: { lineId: narratorId, speakerId: 'narrator', text: 'ADV结束' } } } },
  } }
  return { snapshot, context: studioVoiceJobContext(program, { hero: profile(), narrator: snapshot.narratorProfile }) }
}
async function reviewedPlan() {
  const { context, snapshot } = fixture()
  const input = await resolveStudioVoiceJobInput(context, snapshot, { lineId: heroId, locale: 'zh-CN', providerId: 'fixture-provider' })
  const plan = await planVoiceGeneration({ ...scope, snapshot, lines: [{ ...input, estimatedCost: null }], budget })
  return { context, snapshot, input, plan }
}

describe('studio shared voice job planning', () => {
  it('filters an explicit role or line before inspecting a mixed-speaker chapter', async () => {
    const { context, snapshot } = fixture()
    const otherId = 'line_01900400-0000-7000-8000-000000000010'
    const secondHeroId = 'line_01900400-0000-7000-8000-000000000011'
    context.lines.push({ chapterId: 'intro', lineId: otherId, speakerId: 'unconfigured', displayText: 'Other role' }, { chapterId: 'intro', lineId: secondHeroId, speakerId: 'hero', displayText: 'Second hero line' })
    const prepareInput = vi.fn(async (input: VoiceGenerationResolvedInput) => input)
    const options = { chapterId: 'intro', locale: 'zh-CN', providerId: 'fixture-provider', mode: 'chapter' as const, prepareInput }
    const scoped = await reviewStudioVoiceJobLines(context, snapshot, { ...options, speakerId: 'hero', lineId: heroId })
    expect(scoped.blocked).toEqual([])
    expect(scoped.lines.map(line => line.lineId)).toEqual([heroId])
    expect(prepareInput).toHaveBeenCalledOnce()
    expect((await reviewStudioVoiceJobLines(context, snapshot, { ...options, speakerId: 'hero' })).lines.map(line => line.lineId)).toEqual([heroId, secondHeroId])
    expect((await reviewStudioVoiceJobLines(context, snapshot, options)).blocked).toEqual([{ lineId: otherId, code: 'AUDIO_JOB_PROFILE_REQUIRED' }])
    prepareInput.mockClear()
    expect(await reviewStudioVoiceJobLines(context, snapshot, { ...options, speakerId: 'hero', lineId: otherId })).toEqual({ lines: [], blocked: [] })
    expect(prepareInput).not.toHaveBeenCalled()
  })
  it('uses edited source dialogue instead of a generated ledger snapshot, preserving exact-locale translations and speech overrides', async () => {
    const { context, snapshot } = fixture()
    snapshot.ledger.lines[heroId] = { speakerId: 'hero', displayText: '旧原文', locales: { 'zh-CN': { selectedTake: null, takes: [], displayText: '旧原文', spokenText: '作者明确口语' }, 'en': { selectedTake: null, takes: [], displayText: 'Explicit English translation' } } }
    context.lines[0]!.displayText = '编辑后的最新剧本'
    context.profiles.hero!.locales!.en = context.profiles.hero!.locales!['zh-CN']!
    const source = await resolveStudioVoiceJobInput(context, snapshot, { lineId: heroId, locale: 'zh-CN', providerId: 'fixture-provider' })
    expect(source.displayText).toBe('编辑后的最新剧本')
    expect(source.spokenText).toBe('作者明确口语')
    expect((await resolveStudioVoiceJobInput(context, snapshot, { lineId: heroId, locale: 'en', providerId: 'fixture-provider' })).displayText).toBe('Explicit English translation')
  })
  it('uses inspected Node-equivalent preset parameters for fingerprints and refuses identity changes or credentials', async () => {
    const { input, snapshot, context } = await reviewedPlan()
    const parameters = { preset: 'reviewed-preset', presetSha256: 'c'.repeat(64), modelRevision: 'pinned-model-revision', referenceAssetId: 'reference/approved', referenceSha256: 'd'.repeat(64), seed: 42, referenceMode: 'embedding-only', speed: 1 }
    const prepared = await prepareStudioVoiceJobInput(input, snapshot, { prepare: async resolved => ({ ...resolved, parameters }) })
    const nodeFingerprint = await voiceInputFingerprint({ spokenText: '冒险你好🙂', locale: input.locale, speakerId: input.speakerId, providerId: input.providerId, voiceId: input.voiceId, model: input.model, voiceProfileRevision: input.voiceProfileRevision, parameters })
    const withoutDictionary = { ...snapshot, pronunciation: undefined }
    const plainInput = { ...input, displayText: '冒险你好🙂', pronunciation: undefined }
    const nodeEquivalent = await prepareStudioVoiceJobInput(plainInput, withoutDictionary, { prepare: async resolved => ({ ...resolved, parameters }) })
    expect(await voiceGenerationInputFingerprint(nodeEquivalent)).toBe(nodeFingerprint)
    expect(prepared.parameters).toEqual(parameters)
    expect(input.parameters).toBeUndefined()
    await expect(prepareStudioVoiceJobInput(input, snapshot, { prepare: async resolved => ({ ...resolved, voiceId: 'unreviewed-voice' }) })).rejects.toThrow('IDENTITY_CHANGED')
    await expect(prepareStudioVoiceJobInput(input, snapshot, { prepare: async resolved => ({ ...resolved, parameters: { apiKey: 'private' } }) })).rejects.toThrow('Credentials')
    const hash = await voiceGenerationInputFingerprint(prepared)
    const take = { id: 'take_01900400-0000-7000-8000-000000000007', assetId: 'audio_01900400-0000-7000-8000-000000000008', sha256: 'b'.repeat(64), providerId: input.providerId, voiceId: input.voiceId, model: input.model, voiceProfileRevision: input.voiceProfileRevision, inputFingerprint: hash, spokenText: '冒险你好🙂', createdAt: '2026-10-11T08:00:00.000Z', source: 'system' as const }
    snapshot.ledger.lines[heroId] = { speakerId: 'hero', displayText: input.displayText, locales: { 'zh-CN': { selectedTake: take.id, takes: [take] } } }
    const options = { chapterId: 'intro', locale: input.locale, providerId: input.providerId, mode: 'stale' as const }
    expect((await reviewStudioVoiceJobLines(context, snapshot, options)).lines).toHaveLength(1)
    expect((await reviewStudioVoiceJobLines(context, snapshot, { ...options, prepareInput: resolved => prepareStudioVoiceJobInput(resolved, snapshot, { prepare: async checked => ({ ...checked, parameters }) }) })).lines).toHaveLength(0)
  })
  it('uses native chapter IDs, project narrator profiles and dictionary fingerprints without persisting prose', async () => {
    const { context, snapshot } = fixture()
    expect(context.unidentifiedLines).toBe(1)
    const reviewed = await reviewStudioVoiceJobLines(context, snapshot, { chapterId: 'ending', locale: 'zh-CN', providerId: 'fixture-provider', mode: 'chapter' })
    expect(reviewed.blocked).toEqual([])
    expect(reviewed.lines.map(line => [line.lineId, line.speakerId])).toEqual([[narratorId, 'narrator']])
    expect(reviewed.lines[0]!.spokenText).toBeUndefined()
    const planned = await planVoiceGeneration({ ...scope, snapshot, lines: reviewed.lines.map(input => ({ ...input, estimatedCost: null })), budget })
    expect(planned.summary.characters).toBe(4)
    const serialized = JSON.stringify(planned)
    for (const forbidden of ['ADV结束', 'pronunciation', 'replacements', 'displayText', 'spokenText', 'credentials'])
      expect(serialized).not.toContain(forbidden)
    const old = planned.tasks[0]!.inputFingerprint
    snapshot.pronunciation!.revision++
    snapshot.pronunciation!.replacements.ADV = '文字冒险'
    const changed = await resolveStudioVoiceJobInput(context, snapshot, { lineId: narratorId, locale: 'zh-CN', providerId: 'fixture-provider' })
    expect(await voiceGenerationInputFingerprint(changed)).not.toBe(old)
  })

  it('reviews missing/stale selections and immutable cache reuse separately without choosing a take', async () => {
    const { context, snapshot, input } = await reviewedPlan()
    const hash = await voiceGenerationInputFingerprint(input)
    const take = { id: 'take_01900400-0000-7000-8000-000000000003', assetId: 'audio_01900400-0000-7000-8000-000000000004', sha256: 'b'.repeat(64), providerId: input.providerId, voiceId: input.voiceId, model: input.model, voiceProfileRevision: input.voiceProfileRevision, inputFingerprint: hash, spokenText: '冒险你好🙂', createdAt: '2026-10-11T08:00:00.000Z', source: 'system' as const }
    snapshot.ledger.lines[heroId] = { speakerId: 'hero', displayText: input.displayText, locales: { 'zh-CN': { selectedTake: take.id, takes: [take] } } }
    snapshot.catalog.assets.push({ id: take.assetId, type: 'audio', kind: 'voice', sha256: take.sha256, path: 'voice/cached.wav' })
    const options = { chapterId: 'intro', locale: 'zh-CN', providerId: input.providerId }
    expect((await reviewStudioVoiceJobLines(context, snapshot, { ...options, mode: 'missing' })).lines).toEqual([])
    expect((await reviewStudioVoiceJobLines(context, snapshot, { ...options, mode: 'stale' })).lines).toEqual([])
    const original = JSON.stringify(snapshot)
    const plan = await planVoiceGeneration({ ...scope, snapshot, lines: [{ ...input, estimatedCost: null }], budget: { ...budget, allowUnknownCost: false } })
    expect(plan.summary).toMatchObject({ cacheHits: 1, newGenerations: 0, characters: 0 })
    expect(JSON.stringify(snapshot)).toBe(original)
    context.profiles.hero!.locales!['zh-CN']!.providers[input.providerId]!.voiceId = 'new-reviewed-voice'
    expect((await reviewStudioVoiceJobLines(context, snapshot, { ...options, mode: 'stale' })).lines).toHaveLength(1)
    expect((await reviewStudioVoiceJobLines(context, snapshot, { ...options, locale: 'en', mode: 'chapter' })).blocked).toEqual([{ lineId: heroId, code: 'AUDIO_JOB_PROFILE_REQUIRED' }])
  })

  it('rejects unknown prices and excessive reviewed limits before a provider can dispatch', async () => {
    const { snapshot, input } = await reviewedPlan()
    await expect(planVoiceGeneration({ ...scope, snapshot, lines: [{ ...input, estimatedCost: null }], budget: { ...budget, allowUnknownCost: false } })).rejects.toThrow('UNKNOWN_COST')
    await expect(planVoiceGeneration({ ...scope, snapshot, lines: [{ ...input, estimatedCost: null }], budget: { ...budget, maxCharacters: 4 } })).rejects.toThrow('CHARACTER_LIMIT')
  })

  it('cancels an in-flight request into unknown state and never resynthesizes after reload/resume without a query seam', async () => {
    const { input, snapshot, plan } = await reviewedPlan()
    const store = createMemoryVoiceGenerationStore()
    let began!: () => void
    const dispatched = new Promise<void>(resolve => began = resolve)
    const execute = vi.fn(async (_input: VoiceGenerationResolvedInput, context: { signal: AbortSignal }) => {
      began()
      await new Promise<void>((_resolve, reject) => context.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }))
      throw new Error('Unreachable')
    })
    const authoring = { read: async () => snapshot } as VoiceAuthoringService
    const runner = createVoiceGenerationRunner({ store, authoring, resolve: async () => input, execute })
    await runner.enqueue(plan)
    const active = runner.run(plan.id)
    await dispatched
    await runner.cancel(plan.id)
    expect((await active).tasks[0]!.status).toBe('unknown')
    const restored = createMemoryVoiceGenerationStore(parseScopedVoiceJobs(await store.read(), scope))
    const afterReload = createVoiceGenerationRunner({ store: restored, authoring, resolve: async () => input, execute })
    await afterReload.resume(plan.id)
    await expect(afterReload.retry(plan.id)).rejects.toThrow('QUERY_REQUIRED')
    expect((await afterReload.run(plan.id)).tasks[0]!.status).toBe('unknown')
    expect(execute).toHaveBeenCalledOnce()
    expect(JSON.stringify(await restored.read())).not.toContain(input.displayText)
  })
})

describe('private Studio voice job boundaries', () => {
  it('retains native Opus and AAC variant bytes in project exports', async () => {
    const variants = ['adv/assets/variants/voice.webm', 'adv/assets/variants/voice.opus', 'adv/assets/variants/voice.aac']
    const source = new Uint8Array([79, 112, 117, 115])
    const fetchMedia = vi.fn(async () => ({ blob: async () => new Blob([source]) }))
    vi.stubGlobal('fetch', fetchMedia)
    vi.stubGlobal('URL', { revokeObjectURL: vi.fn() })
    const fs = { exists: async () => false, collectAllFiles: async () => [], listFilesByExts: async (_root: string, extensions: string[]) => variants.filter(path => extensions.some(extension => path.endsWith(extension))), readBlobUrl: async (path: string) => `blob:${path}` } as unknown as IFileSystem
    const zip = await import('jszip').then(async module => module.default.loadAsync(await exportProject(fs, 'Variants')))
    for (const path of variants)
      expect(Array.from(await zip.file(path)!.async('uint8array'))).toEqual([...source])
    expect(fetchMedia).toHaveBeenCalledTimes(3)
  })

  it('isolates unambiguous account/project keys and refuses foreign or prose-bearing records', async () => {
    expect(voiceJobScopeKey({ accountId: 'a:b', projectId: 'c' })).not.toBe(voiceJobScopeKey({ accountId: 'a', projectId: 'b:c' }))
    const { plan } = await reviewedPlan()
    const document = { ...emptyVoiceGenerationStore(), jobs: { [plan.id]: plan } }
    expect(parseScopedVoiceJobs(document, scope).jobs[plan.id]).toEqual(plan)
    expect(() => parseScopedVoiceJobs(document, { ...scope, accountId: 'another-author' })).toThrow('SCOPE_MISMATCH')
    expect(() => parseScopedVoiceJobs(document, { ...scope, projectId: 'another-project' })).toThrow('SCOPE_MISMATCH')
    expect(() => parseScopedVoiceJobs({ ...document, jobs: { [plan.id]: { ...plan, prompt: 'sensitive dialogue' } } }, scope)).toThrow('STORE_INVALID')
  })

  it('exports only native project files and never includes private queued tasks', async () => {
    const { plan } = await reviewedPlan()
    const privateStore = createMemoryVoiceGenerationStore()
    await privateStore.mutate(document => document.jobs[plan.id] = plan)
    const fs = { exists: async () => false, collectAllFiles: async (root = '') => root === 'authoring/voices/designs' ? [] : [{ path: 'adv/chapters/intro.adv.md', content: '@Hero\nA project line' }], listFilesByExts: async () => [] } as unknown as IFileSystem
    const output = await exportProject(fs, 'Native project')
    const zip = await import('jszip').then(module => module.default.loadAsync(output))
    expect(Object.keys(zip.files).filter(path => !path.endsWith('/'))).toEqual(['adv/chapters/intro.adv.md', 'manifest.json'])
    expect(await zip.file('adv/chapters/intro.adv.md')!.async('string')).not.toContain(plan.id)
    expect((await privateStore.read()).jobs[plan.id]).toEqual(plan)
  })
})
