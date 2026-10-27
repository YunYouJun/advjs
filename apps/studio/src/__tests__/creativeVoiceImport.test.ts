import type { CreativeVoiceImportCache, CreativeVoiceImportEntry } from '../utils/creativeVoiceImportCache'
import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { computeAgentProjectRevision, createCreativeTeamRun } from '@advjs/agent'
import { resolveVoiceReviewRows, voiceReviewContextFromProgram } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { flushPromises, mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { useCreativeVoiceImport } from '../composables/useCreativeVoiceImport'
import { commitCreativeVoiceImport, inspectCreativeVoice, readCreativeVoiceTargets, reviewCreativeVoiceImport } from '../utils/creativeVoiceImport'
import { createStudioAudioService } from '../utils/projectAudio'

beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('File', NodeFile)
})

const lineId = 'line_01900400-0000-7000-8000-000000000001'

const text = '列车还没有到，我们再等一会儿。'

describe('durable creative voice registration', () => {
  async function sessionFixture() {
    const f = await fixture()
    const run = shallowRef(f.run)
    const saved = new Map<string, CreativeVoiceImportEntry>()
    const cache: CreativeVoiceImportCache = {
      list: vi.fn(async scope => [...saved.values()].filter(item => item.accountId === scope.accountId && item.projectId === scope.projectId && item.runId === scope.runId).map(item => structuredClone(item))),
      save: vi.fn(async (entry) => { saved.set(entry.id, structuredClone(entry)) }),
      discard: vi.fn(async (entry) => { saved.delete(entry.id) }),
    }
    let session!: ReturnType<typeof useCreativeVoiceImport>
    const changed = vi.fn()
    async function open() {
      const wrapper = mount(defineComponent({ setup() {
        session = useCreativeVoiceImport({ run: () => run.value, host: async () => ({ fs: f.fs, assertCurrent: current }), cache, changed })
        return () => h('div')
      } }))
      await flushPromises()
      await vi.waitFor(() => expect(session.loading.value).toBe(false))
      return wrapper
    }
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', 'source', current)
    return { ...f, run, saved, cache, changed, open, review, session: () => session }
  }
  it('keeps a reviewed candidate across reopen, then acknowledges an uncertain completed write without registering again', async () => {
    const f = await sessionFixture()
    let page = await f.open()
    expect(await f.session().stage(f.review)).toBe(true)
    const id = f.session().rows.value[0]!.id
    expect(f.files).toEqual(f.before)
    page.unmount()
    page = await f.open()
    expect(f.session().rows.value[0]!.review.data).toEqual(f.audio.data)
    vi.mocked(f.cache.save).mockImplementationOnce(async (entry) => {
      f.saved.set(entry.id, structuredClone(entry))
    }).mockRejectedValueOnce(new Error('ack failed'))
    expect(await f.session().register(id)).toBe(false)
    expect(f.saved.get(id)!.state).toBe('registering')
    const writes = vi.mocked(f.fs.writeFile).mock.calls.length
    page.unmount()
    page = await f.open()
    expect(f.session().inspections.value[id]).toBe('after')
    expect(f.fs.writeFile).toHaveBeenCalledTimes(writes)
    expect(await f.session().reconcile(id)).toBe(true)
    expect(f.saved.get(id)).toMatchObject({ state: 'registered', review: { data: undefined } })
    expect(f.fs.writeFile).toHaveBeenCalledTimes(writes)
    expect((await createStudioAudioService(f.fs).read()).ledger.lines[lineId]!.locales['zh-CN']!.takes).toHaveLength(1)
    page.unmount()
  })
  it('recovers a durably partial registration or restores the exact original files while keeping the audio', async () => {
    for (const destination of ['after', 'before'] as const) {
      const f = await sessionFixture()
      let page = await f.open()
      await f.session().stage(f.review)
      const id = f.session().rows.value[0]!.id
      const row = f.saved.get(id)!
      f.saved.set(id, { ...row, state: 'registering' })
      f.files[f.review.changes[0]!.path] = f.review.changes[0]!.content!
      f.blobs.set(f.review.mediaPath, new Blob([f.audio.data]))
      page.unmount()
      const writes = vi.mocked(f.fs.writeFile).mock.calls.length
      page = await f.open()
      expect(f.session().inspections.value[id]).toBe('partial')
      expect(f.fs.writeFile).toHaveBeenCalledTimes(writes)
      expect(await (destination === 'after' ? f.session().register(id) : f.session().restore(id))).toBe(true)
      if (destination === 'after')
        expect((await createStudioAudioService(f.fs).read()).ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
      else
        expect(f.files).toEqual(f.before)
      expect(f.blobs.size).toBe(1)
      page.unmount()
    }
  })
  it('does not write project bytes if the intent cannot be saved or a late scope no longer owns the operation', async () => {
    const f = await sessionFixture()
    const page = await f.open()
    await f.session().stage(f.review)
    const id = f.session().rows.value[0]!.id
    vi.mocked(f.cache.save).mockRejectedValueOnce(new Error('private storage full'))
    expect(await f.session().register(id)).toBe(false)
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
    vi.mocked(f.cache.save).mockImplementationOnce(async (entry) => {
      f.saved.set(entry.id, structuredClone(entry))
      f.run.value = { ...f.run.value, accountId: 'another-account' }
      await flushPromises()
    })
    expect(await f.session().register(id)).toBe(false)
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
    expect(f.session().rows.value).toEqual([])
    page.unmount()
  })
  it('abandons an unwritten intent without overwriting unrelated edits and refuses to abandon changed binding files', async () => {
    for (const bindingChanged of [false, true]) {
      const f = await sessionFixture()
      let page = await f.open()
      await f.session().stage(f.review)
      const id = f.session().rows.value[0]!.id
      f.saved.set(id, { ...f.saved.get(id)!, state: 'registering' })
      f.files[bindingChanged ? f.review.changes[0]!.path : 'adv/chapters/intro.adv.md'] = 'author edit'
      const edited = { ...f.files }
      page.unmount()
      page = await f.open()
      expect(f.session().inspections.value[id]).toBe('conflict')
      expect(await f.session().abandon(id)).toBe(!bindingChanged)
      expect(f.saved.get(id)!.state).toBe(bindingChanged ? 'registering' : 'abandoned')
      expect(f.files).toEqual(edited)
      expect(f.fs.writeFile).not.toHaveBeenCalled()
      page.unmount()
    }
  })
})
afterAll(() => vi.unstubAllGlobals())
async function fixture(format: 'adv-md' | 'flow' = 'adv-md') {
  const files: Record<string, string> = {
    'adv.config.json': '{"schemaVersion":1,"id":"voice-import","root":"adv","format":"adv-md"}',
    'adv/settings/game.json': '{"entryChapterId":"intro","locale":"zh-CN"}',
    'adv/assets.json': '{"schemaVersion":2,"id":"voice-import","defaultProfile":"local","profiles":{"local":{"provider":"project","root":"adv/assets"}},"includes":[]}',
    'adv/characters/lin.character.md': '---\nid: lin\nname: 林\nvoiceProfile:\n  intent:\n    speakingStyle: 平静\n  locales:\n    zh-CN:\n      providers:\n        local-system:\n          voiceId: Tingting\n          model: macos-say\n          source: system\n---\n角色。',
    'adv/chapters/intro.adv.md': `# 等车 {#start}\n\n@lin\n${text} {#${lineId}}`,
  }
  if (format === 'flow') {
    files['adv.config.json'] = '{"schemaVersion":1,"root":"adv","format":"flow"}'
    delete files['adv/chapters/intro.adv.md']
    files['adv/chapters/intro.chapter.json'] = JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Flow 实际台词', nodes: [{ id: 'station', type: 'dialogues', dialogues: [{ speakerId: 'lin', text, lineId: 'line_01900400-0000-7000-8000-000000000002' }, { speaker: '林', text, lineId }] }, { id: 'narration', type: 'narration', text: '灯亮了。', lineId: 'line_01900400-0000-7000-8000-000000000003' }] }, null, 2)
  }
  const before = { ...files }
  const blobs = new Map<string, Blob>()
  const fs = {
    exists: async (path: string) => path in files || blobs.has(path),
    readFile: async (path: string) => files[path]!,
    collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) })),
    readBlob: async (path: string) => blobs.get(path)!,
    writeFile: vi.fn(async (path: string, content: string) => { files[path] = content }),
    writeBlob: vi.fn(async (path: string, blob: Blob) => { blobs.set(path, blob) }),
    deleteFile: vi.fn(async (path: string) => {
      delete files[path]
      blobs.delete(path)
    }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  const revision = await computeAgentProjectRevision(files)
  const run = createCreativeTeamRun({ id: 'voice-run', accountId: 'author', now: 0, plan: { protocolVersion: 1, projectId: 'voice-import', projectRevision: revision, goal: '真实对白回流', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [{ id: 'voice', partner: 'voice-director', capability: 'direct-voice', dependsOn: [], sourcePaths: Object.keys(files), instruction: '配音方案', expectedOutput: '对白交接' }] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'voice', status: 'completed', attempt: 1, artifactIds: ['voice1'] }]
  run.artifacts = [{ id: 'voice1', runId: run.id, taskId: 'voice', partner: 'voice-director', projectId: run.plan.projectId, kind: 'voice-direction', source: { projectId: run.plan.projectId, revision, files: before, upstream: [] }, fingerprint: 'voice-fingerprint', summary: '配音交接', output: { kind: 'voice-direction', summary: '配音交接', cast: [{ speakerId: 'lin', designBrief: '平静', performance: '稍慢' }, { speakerId: 'narrator', designBrief: '独立旁白', performance: '中性' }], dictionary: [], lines: [format === 'flow' ? { path: 'adv/chapters/intro.chapter.json', lineId, speakerId: 'lin', text, instruction: '第二句的稳定身份' } : { path: 'adv/chapters/intro.adv.md', line: 4, speakerId: 'lin', text, instruction: '轻声邀请同伴继续等待' }] }, changes: [], reviewCapabilities: ['voice-take'], status: 'selected' }]
  const data = new TextEncoder().encode('unit transaction bytes, not speech acceptance').buffer
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0')).join('')
  return { fs, files, before, blobs, run, audio: { data, sha256, duration: 4, sampleRate: 22050 } }
}
function current() {}

describe('creative voice return to the canonical authoring ledger', () => {
  it('returns a repeated Flow dialogue by its literal ID, imports to the canonical ledger and retains the second compiled address', async () => {
    const f = await fixture('flow')
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    expect(target).toMatchObject({ lineId, address: 'intro#station.dialog-2', request: { path: 'adv/chapters/intro.chapter.json', lineId }, providers: [{ id: 'local-system' }] })
    expect(target.request.line).toBeUndefined()
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', 'Unit transaction bytes only, not real speech', current)
    expect(f.files).toEqual(f.before)
    await commitCreativeVoiceImport(f.fs, f.run, review, current)
    const snapshot = await createStudioAudioService(f.fs).read()
    expect(Object.keys(snapshot.ledger.lines)).toEqual([lineId])
    expect(snapshot.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
    const result = await compileProject({ files: f.files })
    expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    const rows = await resolveVoiceReviewRows(snapshot, voiceReviewContextFromProgram(result.project.program, { lin: result.project.characters[0]!.voiceProfile }))
    expect(rows[0]!.takes[0]!.stale).toBe(false)
    f.files['adv/chapters/intro.chapter.json'] = f.files['adv/chapters/intro.chapter.json']!.replaceAll(text, '列车已经到了。')
    await expect(readCreativeVoiceTargets(f.fs, f.run, 'voice1', current)).rejects.toThrow('SOURCE_CHANGED')
  })

  it('refuses a globally duplicated compiled line identity instead of guessing a Flow row', async () => {
    const f = await fixture('flow')
    f.files['adv/chapters/other.chapter.json'] = JSON.stringify({ schemaVersion: 1, id: 'other', title: '另一个章节', nodes: [{ id: 'dialogue', type: 'dialogues', dialogues: [{ speakerId: 'lin', text, lineId }] }] })
    await expect(readCreativeVoiceTargets(f.fs, f.run, 'voice1', current)).rejects.toThrow(/LINE_UNRESOLVED|COMPILE_FAILED/)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
  })

  it('matches compiler source, speaker, text and stable line identity and refuses a stale or unresolved proposal', async () => {
    const f = await fixture()
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    expect(target).toMatchObject({ lineId, locale: 'zh-CN', providers: [{ id: 'local-system', voiceId: 'Tingting', model: 'macos-say', source: 'system' }] })
    const output = f.run.artifacts[0]!.output!
    if (output.kind === 'voice-direction')
      (output.lines[0] as { line: number }).line = 3
    await expect(readCreativeVoiceTargets(f.fs, f.run, 'voice1', current)).rejects.toThrow('LINE_UNRESOLVED')
    f.files['adv/chapters/intro.adv.md'] += '\n'
    await expect(readCreativeVoiceTargets(f.fs, f.run, 'voice1', current)).rejects.toThrow('SOURCE_CHANGED')
  })
  it('reviews without writes, persists an unselected take, reopens it and marks it stale after a text change', async () => {
    const f = await fixture()
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', '外部实际制作，人工回流', current)
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
    await commitCreativeVoiceImport(f.fs, f.run, review, current)
    const snapshot = await createStudioAudioService(f.fs).read()
    expect(snapshot.ledger.lines[lineId]!.locales['zh-CN']).toMatchObject({ selectedTake: null, takes: [{ id: review.takeId, providerId: 'local-system', parameters: { attribution: '外部实际制作，人工回流', creativeArtifactId: 'voice1' } }] })
    expect(f.blobs.get(review.mediaPath)?.size).toBe(f.audio.data.byteLength)
    expect(f.fs.flush).toHaveBeenCalled()
    const { project } = await compileProject({ files: f.files })
    const context = voiceReviewContextFromProgram(project.program, { lin: project.characters[0]!.voiceProfile })
    expect((await resolveVoiceReviewRows(snapshot, context))[0]!.takes[0]!.stale).toBe(false)
    f.files['adv/chapters/intro.adv.md'] = f.files['adv/chapters/intro.adv.md']!.replace(text, '列车已经到了，我们走吧。')
    const changed = await compileProject({ files: f.files })
    expect((await resolveVoiceReviewRows(snapshot, voiceReviewContextFromProgram(changed.project.program, context.profiles)))[0]!.takes[0]!.stale).toBe(true)
    await expect(commitCreativeVoiceImport(f.fs, f.run, review, current)).rejects.toThrow('SOURCE_CHANGED')
  })
  it('refuses unbound provider claims and guards the whole project between review and commit', async () => {
    const f = await fixture()
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    await expect(reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'invented-cloud', 'source', current)).rejects.toThrow('PROFILE_REQUIRED')
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', 'source', current)
    f.files['adv/settings/game.json'] += '\n'
    await expect(commitCreativeVoiceImport(f.fs, f.run, review, current)).rejects.toThrow('SOURCE_CHANGED')
    expect(f.blobs.size).toBe(0)
  })
  it('rolls back catalog, ledger and bytes if durable persistence fails', async () => {
    const f = await fixture()
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', 'source', current)
    vi.mocked(f.fs.flush!).mockRejectedValueOnce(new Error('disk unavailable'))
    await expect(commitCreativeVoiceImport(f.fs, f.run, review, current)).rejects.toThrow('disk unavailable')
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
  })
  it('durably persists existing voice selection and restores it when persistence fails', async () => {
    const f = await fixture()
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', 'source', current)
    await commitCreativeVoiceImport(f.fs, f.run, review, current)
    const service = createStudioAudioService(f.fs)
    const snapshot = await service.read()
    const before = { ...f.files }
    vi.mocked(f.fs.flush!).mockRejectedValueOnce(new Error('disk unavailable'))
    await expect(service.select({ lineId, locale: 'zh-CN', takeId: review.takeId, expectedRevision: snapshot.revision })).rejects.toThrow('disk unavailable')
    expect(f.files).toEqual(before)
    const selected = await service.select({ lineId, locale: 'zh-CN', takeId: review.takeId, expectedRevision: snapshot.revision })
    expect(selected.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBe(review.takeId)
    expect(f.fs.flush).toHaveBeenCalledTimes(4)
  })
  it('rejects an invalid WAV container before opening the browser decoder', async () => {
    await expect(inspectCreativeVoice(new File(['fake'], 'voice.wav', { type: 'audio/wav' }))).rejects.toThrow('FILE_INVALID')
    await expect(inspectCreativeVoice({ size: 33 * 1024 * 1024 } as File)).rejects.toThrow('FILE_INVALID')
  })
  it('keeps narrator casting separate and requires its exact configured provenance', async () => {
    const f = await fixture()
    const profile = { intent: { speakingStyle: '独立旁白' }, locales: { 'zh-CN': { providers: { 'narrator-recording': { voiceId: 'author-narrator', model: 'external-recording', source: 'recorded' } } } } }
    f.files['adv/audio/voice-profiles.json'] = JSON.stringify({ schemaVersion: 1, revision: 1, narrator: profile })
    f.files['adv/chapters/intro.adv.md'] = `# 旁白 {#start}\n\n> ${text} {#${lineId}}`
    const artifact = f.run.artifacts[0]!
    artifact.source = { ...artifact.source, files: { ...f.files }, revision: await computeAgentProjectRevision(f.files) }
    if (artifact.output?.kind === 'voice-direction')
      Object.assign(artifact.output.lines[0]!, { path: 'adv/chapters/intro.adv.md', line: 3, speakerId: 'narrator' })
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    expect(target.providers.map(item => item.id)).toEqual(['narrator-recording'])
    await expect(reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', 'source', current)).rejects.toThrow('PROFILE_REQUIRED')
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'narrator-recording', '作者外部录音', current)
    await commitCreativeVoiceImport(f.fs, f.run, review, current)
    const snapshot = await createStudioAudioService(f.fs).read()
    expect(snapshot.ledger.lines[lineId]).toMatchObject({ speakerId: 'narrator', locales: { 'zh-CN': { selectedTake: null, takes: [{ source: 'recorded', voiceId: 'author-narrator', model: 'external-recording' }] } } })
  })
  it('requires recovery for an in-flight task and refuses a changed proposal after review', async () => {
    const f = await fixture()
    const target = (await readCreativeVoiceTargets(f.fs, f.run, 'voice1', current))[0]!
    const review = await reviewCreativeVoiceImport(f.fs, f.run, target, f.audio, 'local-system', 'source', current)
    f.run.tasks[0]!.status = 'reconcile_required'
    await expect(commitCreativeVoiceImport(f.fs, f.run, review, current)).rejects.toThrow('RECOVERY_REQUIRED')
    f.run.tasks[0]!.status = 'completed'
    f.run.artifacts[0]!.status = 'stale'
    await expect(commitCreativeVoiceImport(f.fs, f.run, review, current)).rejects.toThrow('PROPOSAL_CHANGED')
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
  })
})
