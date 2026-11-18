import type { CreativePartnerOutput } from '../src'
import { prepareVoiceSpokenText } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, createCreativeTeamRun, creativeOutputFileChanges, overlayCreativeMilestone, parseCreativePartnerOutput, parseCreativeTeamAvailability, prepareCreativeCandidateEdit, reduceCreativeTeamRun, reviewCreativeMilestone } from '../src'

const profile = { intent: { pitch: 'low', temperament: ['耐心'], speakingStyle: '平静' }, locales: { 'zh-CN': { providers: { system: { voiceId: 'Tingting', source: 'system', model: 'macos-say', rights: { license: 'existing', subject: 'system', consentRecord: 'adv/audio/consent.json' } } } } } }
const body = '# 林\n\n作者正文保持逐字节不变。\n'
const files = {
  'adv.config.json': '{"schemaVersion":1,"id":"voice-settings","root":"adv","format":"adv-md"}',
  'adv/settings/game.json': '{"entryChapterId":"intro","locale":"zh-CN"}',
  'adv/characters/lin.character.md': `---\nid: lin\nname: 林\ncustom: {"keep":true}\nvoiceProfile: ${JSON.stringify(profile)}\n---\n${body}`,
  'adv/chapters/intro.adv.md': '# 等车 {#start}\n\n@lin\n列车还没有到。 {#line_01900400-0000-7000-8000-000000000001}',
  'adv/audio/consent.json': '{"license":"existing record"}',
}
const context = { projectId: 'voice-settings', projectRevision: 'source', files, characterIds: ['lin'], limits: { maxTasks: 1, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 100 } }
const plan: Extract<CreativePartnerOutput, { kind: 'voice-direction' }> = { kind: 'voice-direction', summary: '词典与声音意图', cast: [{ speakerId: 'lin', designBrief: '冷静', performance: '轻声' }, { speakerId: 'narrator', designBrief: '独立旁白', performance: '从容' }], dictionary: [{ term: '列车', pronunciation: '火车' }], lines: [{ path: 'adv/chapters/intro.adv.md', line: 4, speakerId: 'lin', text: '列车还没有到。', instruction: '等待' }] }

describe('reviewed voice direction source proposals', () => {
  it('keeps old plans as suggestions and rejects provider authority inside intent', () => {
    expect(creativeOutputFileChanges(parseCreativePartnerOutput('voice-direction', plan, context), files)).toEqual([])
    expect(() => parseCreativePartnerOutput('voice-direction', { ...plan, locale: 'zh-CN', cast: [{ ...plan.cast[0], intent: { providers: { forged: { voiceId: 'made-up' } } } }, plan.cast[1]] }, context)).toThrow('AUTHORITY')
    expect(() => parseCreativePartnerOutput('voice-direction', { ...plan, locale: 'zh_cn' }, context)).toThrow()
    const availability = parseCreativeTeamAvailability({ protocolVersion: 1, enabled: false, capabilities: [], maxConcurrentTasks: 1, serviceVersion: 'unit', media: { image: 'manual-import', voice: 'manual-import' }, authoring: { candidateEdits: true, milestoneAdoption: true, voiceDirectionEdits: true } })
    expect(availability.authoring?.voiceDirectionEdits).toBe(true)
  })

  it('merges only the reviewed locale and intent while preserving provider rights, other languages, unknown fields and exact prose', async () => {
    const originalDictionary = { schemaVersion: 1, revision: 7, replacements: { ADV: '冒险' }, locales: { 'en': { replacements: { station: 'station' } }, 'zh-CN': { replacements: { 车站: '车站' } } } }
    const originalNarrator = { schemaVersion: 1, revision: 3, narrator: profile }
    const source = { ...files, 'adv/audio/pronunciation.json': JSON.stringify(originalDictionary), 'adv/audio/voice-profiles.json': JSON.stringify(originalNarrator) }
    const output = parseCreativePartnerOutput('voice-direction', { ...plan, locale: 'zh-CN', cast: plan.cast.map(cast => ({ ...cast, intent: { speakingStyle: cast.performance, pace: 'slow' } })) }, { ...context, files: source })
    const changes = creativeOutputFileChanges(output, source)
    expect(changes.map(item => item.path)).toEqual(['adv/audio/pronunciation.json', 'adv/characters/lin.character.md', 'adv/audio/voice-profiles.json'])
    const after = overlayCreativeMilestone(source, changes)
    expect(source['adv/characters/lin.character.md']).toBe(files['adv/characters/lin.character.md'])
    expect(after['adv/characters/lin.character.md']!.endsWith(body)).toBe(true)
    const compiled = await compileProject({ files: after }, { allowEmptyAssetManifest: true })
    expect(compiled.diagnostics.filter(item => item.severity === 'error')).toEqual([])
    expect(compiled.project.characters[0]!.voiceProfile).toEqual({ ...profile, intent: { ...profile.intent, speakingStyle: '轻声', pace: 'slow' } })
    expect(after['adv/characters/lin.character.md']).toContain('"keep": true')
    const dictionary = JSON.parse(after['adv/audio/pronunciation.json']!)
    expect(dictionary).toEqual({ ...originalDictionary, revision: 8, locales: { ...originalDictionary.locales, 'zh-CN': { replacements: { 车站: '车站', 列车: '火车' } } } })
    expect((await prepareVoiceSpokenText('ADV 列车', { locale: 'zh-CN', pronunciation: dictionary })).text).toBe('冒险 火车')
    expect(JSON.parse(after['adv/audio/voice-profiles.json']!)).toEqual({ ...originalNarrator, revision: 4, narrator: { ...profile, intent: { ...profile.intent, speakingStyle: '从容', pace: 'slow' } } })
    expect(changes.some(item => /voice-ledger|assets/.test(item.path))).toBe(false)
  })

  it('creates an immutable author revision, preserves costs and compiles it through the existing milestone without writing saved sources', async () => {
    const revision = await computeAgentProjectRevision(files)
    let run = createCreativeTeamRun({ id: 'voice-run', accountId: 'author', now: 0, plan: { protocolVersion: 1, projectId: context.projectId, projectRevision: revision, goal: '配音方案', limits: context.limits, tasks: [{ id: 'voice', partner: 'voice-director', capability: 'direct-voice', dependsOn: [], sourcePaths: Object.keys(files), instruction: '词典与声音意图', expectedOutput: '受审写回' }] } })
    run.status = 'awaiting_review'
    run.chargedMicroPoints = 30
    run.tasks = [{ taskId: 'voice', attempt: 1, artifactIds: ['original'], status: 'completed' }]
    run.artifacts = [{ id: 'original', fingerprint: 'v1', runId: run.id, projectId: context.projectId, taskId: 'voice', partner: 'voice-director', kind: 'voice-direction', summary: plan.summary, output: plan, changes: [], reviewCapabilities: ['voice-take'], source: { projectId: context.projectId, revision, files, upstream: [] }, status: 'selected' }]
    const prepared = prepareCreativeCandidateEdit(run, { artifactId: 'original', fingerprint: 'v1', reason: '确认字面词典', output: { ...plan, locale: 'zh-CN' } }, { revision, files })
    run = reduceCreativeTeamRun(run, { type: 'edit-candidate', artifact: { ...prepared, id: 'author-plan', fingerprint: 'v2' }, decisionId: 'edit', reason: '确认字面词典', requestFingerprint: 'edit-1' }, 1)
    expect(run.artifacts[0]!.status).toBe('stale')
    expect(run.chargedMicroPoints).toBe(30)
    expect(run.toolCalls).toBe(0)
    run = reduceCreativeTeamRun(run, { type: 'select', taskId: 'voice', artifactIds: ['author-plan'], decisionId: 'select', reason: '供采用审阅' }, 2)
    const review = await reviewCreativeMilestone(run, { operation: 'adopt', project: { id: context.projectId, revision, files }, artifacts: [{ artifactId: 'author-plan', fingerprint: 'v2' }], reason: '写入已审阅词典' })
    expect(review.changes.map(item => item.path)).toEqual(['adv/audio/pronunciation.json'])
    const changed = { ...run, artifacts: run.artifacts.map(artifact => artifact.id === 'author-plan' ? { ...artifact, changes: artifact.changes.map(change => ({ ...change, after: change.after!.replace('火车', '飞机') })) } : artifact) }
    await expect(reviewCreativeMilestone(changed, { operation: 'adopt', project: { id: context.projectId, revision, files }, artifacts: [{ artifactId: 'author-plan', fingerprint: 'v2' }], reason: '拒绝输出范围之外的文件内容' })).rejects.toThrow('VOICE_SETTINGS_INVALID')
    expect(files).not.toHaveProperty('adv/audio/pronunciation.json')
    expect(() => prepareCreativeCandidateEdit(run, { artifactId: 'author-plan', fingerprint: 'v2', reason: '不覆盖作者新词典', output: { ...plan, locale: 'zh-CN' } }, { revision: 'new', files: { ...files, 'adv/audio/pronunciation.json': '{}' } })).toThrow('SOURCE_CONFLICT')
  })

  it('rejects duplicate or executable dictionary prose and missing characters instead of guessing a source', () => {
    for (const dictionary of [[...plan.dictionary, ...plan.dictionary], [{ term: '<speak>', pronunciation: '伪指令' }], [{ term: '词语', pronunciation: ['$', '{secret}'].join('') }]])
      expect(() => parseCreativePartnerOutput('voice-direction', { ...plan, locale: 'zh-CN', dictionary }, context)).toThrow()
    expect(() => creativeOutputFileChanges({ ...plan, locale: 'zh-CN', cast: [{ speakerId: 'absent', designBrief: 'x', performance: 'y', intent: { pace: 'slow' } }] }, files)).toThrow('CHARACTER_REQUIRED')
  })

  it('does not reformat or increment a dictionary when all proposed values already match', () => {
    const dictionary = { schemaVersion: 1, revision: 7, replacements: {}, locales: { 'zh-CN': { replacements: { 列车: '火车' } } } }
    expect(creativeOutputFileChanges({ ...plan, locale: 'zh-CN' }, { ...files, 'adv/audio/pronunciation.json': JSON.stringify(dictionary) })).toEqual([])
  })
})
