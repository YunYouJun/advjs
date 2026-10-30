import type { CreativeAdoptionJournalEntry } from '../src/creative-team/adoption'
import type { CreativeTeamClient } from '../src/creative-team/client'
import type { CreativeArtifact, CreativeMilestoneIntent, CreativeTeamRun } from '../src/creative-team/contracts'
import type { CreativeMediaCandidateRequest, CreativeMediaEvidence } from '../src/creative-team/media'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { planAdvAssetManifestUpsert } from '@advjs/core'
import { dump, load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { CreativeMilestoneCoordinator, reviewCreativeMilestone } from '../src/creative-team/adoption'
import { invalidateCreativeArtifacts } from '../src/creative-team/candidates'
import { compatibleCreativeMediaArtifacts, creativeMediaCanonical, parseCreativeMediaCandidateRequest, prepareCreativeMediaCandidate } from '../src/creative-team/media'
import { creativeArtifactExpectedFiles, overlayCreativeMilestone, prepareCreativeMilestone } from '../src/creative-team/milestones'
import { createCreativeTeamRun, reduceCreativeTeamRun } from '../src/creative-team/orchestration'
import { parseCreativePartnerOutput } from '../src/creative-team/outputs'
import { parseCreativeTeamRun } from '../src/creative-team/responses'
import { computeAgentProjectRevision } from '../src/proposals/review'

const golden = JSON.parse(readFileSync(new URL('./fixtures/creative-media-author-host.json', import.meta.url), 'utf8'))
const fingerprint = (value: unknown) => createHash('sha256').update(creativeMediaCanonical(value)).digest('hex')
async function project(files: Record<string, string>, id: string) {
  return { id, files, revision: await computeAgentProjectRevision(files) }
}
async function fixture(kind: 'image' | 'voice') {
  const input = structuredClone(golden[kind])
  const baseline = await project(input.before, input.id)
  const partner = kind === 'image' ? 'art-director' : 'voice-director'
  const capability = kind === 'image' ? 'direct-art' : 'direct-voice'
  const run = createCreativeTeamRun({ id: 'media-run', accountId: 'author', now: 0, plan: { protocolVersion: 1, projectId: baseline.id, projectRevision: baseline.revision, goal: '真实宿主媒体协议 fixture', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [{ id: 'media-owner', partner, capability, dependsOn: [], sourcePaths: Object.keys(baseline.files), instruction: 'Media direction', expectedOutput: 'Reviewed media' }] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'media-owner', status: 'completed', attempt: 1, artifactIds: ['direction'] }]
  const parent: CreativeArtifact = { id: 'direction', runId: run.id, taskId: 'media-owner', partner, projectId: baseline.id, kind: kind === 'image' ? 'art-direction' : 'voice-direction', source: { projectId: baseline.id, revision: baseline.revision, files: baseline.files, upstream: [] }, fingerprint: 'direction-v1', summary: 'Frozen direction fixture', changes: [], reviewCapabilities: kind === 'image' ? [] : ['voice-take'], status: 'selected', output: kind === 'image'
    ? { kind: 'art-direction', summary: 'Frozen art', style: 'Existing source verification', requests: [{ assetId: input.assetId, kind: 'portrait', characterId: 'xiaoyun', width: 619, height: 619, prompt: 'Original media', constraints: [] }, { assetId: 'character/xiaoyun/happy', kind: 'expression', characterId: 'xiaoyun', expression: 'happy', width: 619, height: 619, prompt: 'Protocol-only alias, no expression-quality claim', constraints: [] }] }
    : { kind: 'voice-direction', summary: 'Frozen voice', cast: [{ speakerId: 'lin', designBrief: 'System voice', performance: 'Calm' }, { speakerId: 'narrator', designBrief: 'Separate narrator', performance: 'Unproduced' }], dictionary: [], lines: [{ path: 'adv/chapters/intro.adv.md', line: 4, speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', instruction: 'Calm' }] } }
  run.artifacts = [parent]
  const request: CreativeMediaCandidateRequest = { artifactId: parent.id, fingerprint: parent.fingerprint, project: baseline, writes: input.writes ?? input.registrationWrites, target: kind === 'image' ? { kind, assetId: input.assetId } : { kind, assetId: input.assetId, lineId: input.lineId, locale: input.locale, takeId: input.takeId, phase: 'registered' }, reason: 'Author reviewed actual host media' }
  return { input, run, request, parent, baseline }
}
function register(run: CreativeTeamRun, request: CreativeMediaCandidateRequest, id = 'media-one') {
  const prepared = prepareCreativeMediaCandidate(run, request, fingerprint)
  return reduceCreativeTeamRun(run, { type: 'register-media', artifact: { ...prepared, id, fingerprint: fingerprint(prepared) }, decisionId: `${id}-decision`, reason: request.reason, requestFingerprint: fingerprint(request) }, 1)
}
async function adopt(run: CreativeTeamRun, baseline: CreativeMediaCandidateRequest['project'], artifactId = 'media-one') {
  const artifact = run.artifacts.find(item => item.id === artifactId)!
  const request = { operation: 'adopt' as const, project: baseline, artifacts: [{ artifactId, fingerprint: artifact.fingerprint }], reason: 'Adopt reviewed media' }
  const prepared = prepareCreativeMilestone(run, request)
  const intent: CreativeMilestoneIntent = { id: `${artifactId}-intent`, operation: 'adopt', status: 'prepared', artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: baseline.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: fingerprint(request), reason: request.reason, at: 2 }
  const next = reduceCreativeTeamRun(reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent }, 2), { type: 'resolve-milestone', milestoneId: intent.id, status: 'confirmed', files: prepared.files }, 3)
  return { run: next, project: await project(prepared.files, baseline.id) }
}

describe('immutable author-host media and shared milestone anchors', () => {
  it.each(['image', 'voice'] as const)('keeps an independent %s candidate usable across unrelated saved chapter edits', async (kind) => {
    const f = await fixture(kind)
    const unrelatedPath = kind === 'image' ? 'adv/chapters/intro.adv.md' : 'adv/chapters/unrelated.adv.md'
    f.baseline.files[unrelatedPath] ??= '# Another chapter\n\nUnrelated saved text.\n'
    f.baseline.revision = await computeAgentProjectRevision(f.baseline.files)
    f.run.plan.projectRevision = f.baseline.revision
    f.parent.source = { ...f.parent.source, revision: f.baseline.revision, files: Object.fromEntries(Object.entries(f.baseline.files).filter(([path]) => path !== unrelatedPath && (kind === 'voice' || path === 'adv.config.json' || path.includes('/characters/')))) }
    f.run.plan.tasks[0]!.sourcePaths = Object.keys(f.parent.source.files)
    const registered = register(f.run, f.request)
    const registeredMedia = registered.artifacts.at(-1)!
    const current = await project({ ...f.baseline.files, [unrelatedPath]: `${f.baseline.files[unrelatedPath]}\nAuthor changed an unrelated chapter.\n` }, f.baseline.id)
    const refreshed = reduceCreativeTeamRun(registered, { type: 'refresh-facts', files: current.files }, 4)
    expect(refreshed.artifacts.find(item => item.id === f.parent.id)!.status).toBe('selected')
    expect(refreshed.artifacts.at(-1)!.status).toBe('selected')
    expect(refreshed.artifacts.at(-1)!.fingerprint).toBe(registeredMedia.fingerprint)
    expect(refreshed.artifacts.at(-1)!.source.revision).toBe(f.baseline.revision)
    const adopted = await adopt(refreshed, current)
    expect(adopted.project.files[unrelatedPath]).toBe(current.files[unrelatedPath])
    const independentFiles = { ...adopted.project.files, [unrelatedPath]: `${current.files[unrelatedPath]}\nAnother unrelated edit.\n` }
    const independent = reduceCreativeTeamRun(adopted.run, { type: 'refresh-facts', files: independentFiles }, 5)
    expect(independent.artifacts.at(-1)!.status).toBe('adopted')
    const relevantPath = kind === 'image' ? 'adv/characters/xiaoyun.character.md' : 'adv/chapters/intro.adv.md'
    const relevantFiles = { ...independentFiles, [relevantPath]: `${independentFiles[relevantPath]}\nChanged relevant source.\n` }
    const stale = reduceCreativeTeamRun(independent, { type: 'refresh-facts', files: relevantFiles }, 6)
    expect(stale.artifacts.find(item => item.id === f.parent.id)!.status).toBe('stale')
    expect(stale.artifacts.at(-1)!.status).toBe('stale')
    for (const change of registeredMedia.changes)
      expect(relevantFiles[change.path]).toBe(adopted.project.files[change.path])
    expect(f.request.project.files).toEqual(f.baseline.files)
    expect(stale.chargedMicroPoints).toBe(0)
  })

  it('freezes actual browser image metadata without changing source or fees and parses the new provenance', async () => {
    const f = await fixture('image')
    const next = register(f.run, f.request)
    expect(next.artifacts.at(-1)).toMatchObject({ kind: 'media-adoption', status: 'selected', media: { verification: 'author-host', sha256: '0013ad9b2e00141cfc089e4bbb8a299f3dd26d6f81f0f159d04557682420d9e1', bytes: 39460 } })
    expect(f.request.project.files).toEqual(golden.image.before)
    expect(next.chargedMicroPoints).toBe(0)
    expect(next.tasks[0]!.status).toBe('completed')
    expect(parseCreativeTeamRun(next, { accountId: 'author', projectId: f.baseline.id })).toEqual(next)
    const confirmed = await adopt(next, f.baseline)
    expect(confirmed.project.files).toEqual(golden.image.after)
    expect(confirmed.run.artifacts[0]!.status).toBe('selected')
    for (const [name, content] of Object.entries(creativeArtifactExpectedFiles(confirmed.run.artifacts[0]!, confirmed.run)))
      expect(confirmed.project.files[name] ?? null).toEqual(content)
    expect(confirmed.run.status).not.toBe('completed')
  })
  it('keeps every read catalog fragment in the media dependency set even when it is not written', async () => {
    const f = await fixture('image')
    f.baseline.files['adv/assets.json'] = JSON.stringify({ schemaVersion: 2, id: f.baseline.id, defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, includes: ['assets/existing.json'] })
    f.baseline.files['adv/assets/existing.json'] = '{"schemaVersion":2,"assets":[]}'
    f.baseline.revision = await computeAgentProjectRevision(f.baseline.files)
    f.parent.source = { ...f.parent.source, revision: f.baseline.revision, files: { 'adv.config.json': f.baseline.files['adv.config.json']!, 'adv/assets.json': f.baseline.files['adv/assets.json'], 'adv/characters/xiaoyun.character.md': f.baseline.files['adv/characters/xiaoyun.character.md']! } }
    const asset = JSON.parse(golden.image.after['adv/assets/other.json']).assets[0]
    f.request.writes = planAdvAssetManifestUpsert({ files: f.baseline.files, rootPath: 'adv/assets.json', catalogId: f.baseline.id, asset }).writes
    const run = register(f.run, f.request)
    const candidate = run.artifacts.at(-1)!
    expect(candidate.changes.some(item => item.path === 'adv/assets/existing.json')).toBe(false)
    expect(candidate.source.files['adv/assets/existing.json']).toBe(f.baseline.files['adv/assets/existing.json'])
    const files = { ...f.baseline.files, 'adv/assets/existing.json': '{"schemaVersion":2,"assets":[],"note":"Changed catalog metadata"}' }
    const refreshed = reduceCreativeTeamRun(run, { type: 'refresh-facts', files }, 4)
    expect(refreshed.artifacts[0]!.status).toBe('selected')
    expect(refreshed.artifacts.at(-1)!.status).toBe('stale')
  })
  it('expires a voice candidate when its independently read consent record changes', async () => {
    const f = await fixture('voice')
    const path = 'adv/characters/lin.character.md'
    const profile = (load(f.baseline.files[path]!.split('---')[1]!) as { voiceProfile: { locales: Record<string, { providers: Record<string, Record<string, unknown>> }> } }).voiceProfile
    const rights = { license: 'author-fixture', subject: 'fixture-speaker', consentRecord: 'adv/consents/speaker.md' }
    profile.locales['zh-CN']!.providers['local-system']!.rights = rights
    f.baseline.files[path] = `---\n${dump({ id: 'lin', name: '林', voiceProfile: profile }).trimEnd()}\n---\nVoice profile fixture.\n`
    f.parent.source = { ...f.parent.source, files: { ...f.baseline.files } }
    f.baseline.files[rights.consentRecord] = '# Recorded permission fixture\n'
    f.baseline.revision = await computeAgentProjectRevision(f.baseline.files)
    const ledger = JSON.parse(f.request.writes['adv/audio/voice-ledger.json']!)
    const take = ledger.lines[f.input.lineId].locales['zh-CN'].takes[0]
    take.rights = rights
    take.voiceProfileRevision = fingerprint(profile)
    take.inputFingerprint = fingerprint({ spokenText: take.spokenText, locale: 'zh-CN', speakerId: 'lin', providerId: take.providerId, voiceId: take.voiceId, model: take.model, voiceProfileRevision: take.voiceProfileRevision, parameters: take.parameters })
    f.request.writes = { ...f.request.writes, 'adv/audio/voice-ledger.json': JSON.stringify(ledger) }
    const run = register(f.run, f.request)
    expect(run.artifacts.at(-1)!.source.files[rights.consentRecord]).toBe(f.baseline.files[rights.consentRecord])
    const files = { ...f.baseline.files, [rights.consentRecord]: '# Permission withdrawn fixture\n' }
    const refreshed = reduceCreativeTeamRun(run, { type: 'refresh-facts', files }, 4)
    expect(refreshed.artifacts[0]!.status).toBe('selected')
    expect(refreshed.artifacts.at(-1)!.status).toBe('stale')
  })
  it('keeps an independent adopted image current when another binding changes', async () => {
    const f = await fixture('image')
    const first = await adopt(register(f.run, f.request), f.baseline)
    const catalog = JSON.parse(first.project.files['adv/assets/other.json']!)
    const alias = { ...catalog.assets[0], id: 'character/xiaoyun/happy', expression: 'happy' }
    const writes = planAdvAssetManifestUpsert({ files: first.project.files, rootPath: 'adv/assets.json', catalogId: first.project.id, asset: alias }).writes
    const secondRequest = { ...f.request, project: first.project, target: { kind: 'image' as const, assetId: alias.id }, writes }
    const second = await adopt(register(first.run, secondRequest, 'media-two'), first.project, 'media-two')
    expect(second.run.artifacts.filter(item => item.kind === 'media-adoption').map(item => item.status)).toEqual(['adopted', 'adopted'])
    expect(second.run.milestones!.at(-1)!.anchors).toContain('media-one')
    const unrelatedFiles = { ...second.project.files, 'adv/audio/pronunciation.json': '{"schemaVersion":1,"revision":1,"replacements":{},"locales":{}}' }
    const unrelated = invalidateCreativeArtifacts(second.run.artifacts, unrelatedFiles, second.run)
    expect(unrelated.filter(item => item.media).map(item => item.status)).toEqual(['adopted', 'adopted'])
    expect(compatibleCreativeMediaArtifacts(second.run, unrelatedFiles)).toEqual(['media-one', 'media-two'])
    const altered = JSON.parse(second.project.files['adv/assets/other.json']!)
    altered.assets.find((item: { id: string }) => item.id === f.input.assetId).characterId = 'another-character'
    expect(compatibleCreativeMediaArtifacts(second.run, { ...second.project.files, 'adv/assets/other.json': JSON.stringify(altered) })).not.toContain('media-one')
  })
  it('preserves a fully realized image direction across another media owner while expiring ordinary catalog readers', async () => {
    const f = await fixture('image')
    if (f.parent.output?.kind !== 'art-direction')
      throw new Error('Expected art direction')
    const otherRequest = f.parent.output.requests[1]!
    f.parent.output = { ...f.parent.output, requests: [f.parent.output.requests[0]!] }
    const first = await adopt(register(f.run, f.request), f.baseline)
    const task = { ...first.run.plan.tasks[0]!, id: 'other-owner' }
    const other: CreativeArtifact = { ...structuredClone(f.parent), id: 'other-direction', taskId: task.id, source: { ...f.parent.source, revision: first.project.revision, files: first.project.files }, output: { ...f.parent.output, requests: [otherRequest] } }
    const reader: CreativeArtifact = { ...structuredClone(other), id: 'catalog-reader', taskId: 'catalog-reader', kind: 'chapter', output: undefined }
    const run = { ...first.run, plan: { ...first.run.plan, tasks: [...first.run.plan.tasks, task, { ...task, id: reader.taskId }] }, tasks: [...first.run.tasks, { taskId: task.id, status: 'completed' as const, attempt: 1, artifactIds: [other.id] }, { taskId: reader.taskId, status: 'completed' as const, attempt: 1, artifactIds: [reader.id] }], artifacts: [...first.run.artifacts, other, reader] }
    const catalog = JSON.parse(first.project.files['adv/assets/other.json']!)
    const alias = { ...catalog.assets[0], id: otherRequest.assetId, expression: 'happy' }
    const manifest = JSON.parse(first.project.files['adv/assets.json']!)
    const writes = { 'adv/assets.json': JSON.stringify({ ...manifest, includes: [...manifest.includes, 'assets/another.json'] }), 'adv/assets/another.json': JSON.stringify({ schemaVersion: 2, assets: [alias] }) }
    const request = { ...f.request, artifactId: other.id, project: first.project, target: { kind: 'image' as const, assetId: alias.id }, writes }
    const second = await adopt(register(run, request, 'media-two'), first.project, 'media-two')
    expect(second.run.artifacts.find(item => item.id === f.parent.id)!.status).toBe('selected')
    expect(second.run.artifacts.filter(item => item.media).map(item => item.status)).toEqual(['adopted', 'adopted'])
    expect(second.run.artifacts.find(item => item.id === reader.id)!.status).toBe('stale')
    const character = 'adv/characters/xiaoyun.character.md'
    const changed = invalidateCreativeArtifacts(second.run.artifacts, { ...second.project.files, [character]: `${second.project.files[character]}\nChanged character text.` }, second.run)
    expect(changed.find(item => item.id === f.parent.id)!.status).toBe('stale')
    expect(changed.find(item => item.id === 'media-one')!.status).toBe('stale')
  })
  it('accepts scene binding changes while preserving unknown frontmatter and the exact body', async () => {
    const f = await fixture('image')
    const scenePath = 'adv/scenes/station.md'
    f.baseline.files[scenePath] = '---\nid: station\nname: Station\nnote: "literal --- delimiter"\ncustom:\n  keep: true\nsrc: old.webp\n---\nKeep this body exactly.\n'
    f.baseline.revision = await computeAgentProjectRevision(f.baseline.files)
    f.parent.source = { ...f.parent.source, files: { ...f.baseline.files }, revision: f.baseline.revision }
    if (f.parent.output?.kind === 'art-direction')
      f.parent.output = { ...f.parent.output, requests: [{ assetId: 'scene/station', kind: 'background', sceneId: 'station', width: 619, height: 619, prompt: 'Background protocol fixture', constraints: [] }] }
    const original = JSON.parse(golden.image.after['adv/assets/other.json']).assets[0]
    const { characterId: _characterId, expression: _expression, ...base } = original
    const asset = { ...base, id: 'scene/station', kind: 'background', sceneId: 'station' }
    const writes = planAdvAssetManifestUpsert({ files: f.baseline.files, rootPath: 'adv/assets.json', catalogId: f.baseline.id, asset }).writes
    writes[scenePath] = `---\n${dump({ id: 'station', name: 'Station', note: 'literal --- delimiter', custom: { keep: true }, type: 'image', assetId: 'scene/station' }).trimEnd()}\n---\nKeep this body exactly.\n`
    const request = { ...f.request, project: f.baseline, target: { kind: 'image' as const, assetId: asset.id }, writes }
    expect(prepareCreativeMediaCandidate(f.run, request, fingerprint).changes.some(item => item.path === scenePath)).toBe(true)
    expect(() => prepareCreativeMediaCandidate(f.run, { ...request, writes: { ...writes, [scenePath]: `${writes[scenePath]}Changed body.` } }, fingerprint)).toThrow('INVALID_BINDING')
  })
  it('registers a take for the exact repeated Flow row instead of another identical sentence', async () => {
    const f = await fixture('voice')
    const md = 'adv/chapters/intro.adv.md'
    const path = 'adv/chapters/intro.chapter.json'
    delete f.baseline.files[md]
    f.baseline.files['adv.config.json'] = JSON.stringify({ schemaVersion: 1, root: 'adv', format: 'flow' })
    f.baseline.files[path] = JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Flow 精确回流', nodes: [{ id: 'station', type: 'dialogues', dialogues: [{ speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', lineId: 'line_01900400-0000-7000-8000-000000000002' }, { speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', lineId: f.input.lineId }] }] }, null, 2)
    f.baseline.revision = await computeAgentProjectRevision(f.baseline.files)
    f.parent.source = { ...f.parent.source, files: { ...f.baseline.files }, revision: f.baseline.revision }
    if (f.parent.output?.kind !== 'voice-direction')
      throw new Error('Expected voice fixture')
    f.parent.output = { ...f.parent.output, lines: [{ path, lineId: f.input.lineId, speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', instruction: 'Only the second stable row' }] }
    const next = register(f.run, f.request)
    const adopted = await adopt(next, f.baseline)
    expect(adopted.run.artifacts.at(-1)!.media!.target).toMatchObject({ kind: 'voice', lineId: f.input.lineId })
    expect(adopted.project.files[path]).toBe(f.baseline.files[path])
    const forged = structuredClone(f.request)
    if (forged.target.kind !== 'voice')
      throw new Error('Expected voice target')
    const id = 'line_01900400-0000-7000-8000-000000000002'
    const ledger = JSON.parse(forged.writes['adv/audio/voice-ledger.json']!)
    ledger.lines[id] = ledger.lines[f.input.lineId]
    delete ledger.lines[f.input.lineId]
    forged.writes = { ...forged.writes, 'adv/audio/voice-ledger.json': JSON.stringify(ledger) }
    forged.target = { ...forged.target, lineId: id }
    expect(() => register(f.run, forged)).toThrow('CREATIVE_MEDIA_INVALID_VOICE')
  })

  it('freezes the real unselected take, then anchors its independent selected binding', async () => {
    const f = await fixture('voice')
    const first = await adopt(register(f.run, f.request), f.baseline)
    expect(first.project.files).toEqual(golden.voice.registered)
    const selection = { ...f.request, project: first.project, writes: golden.voice.selectionWrites, target: { ...f.request.target, kind: 'voice' as const, assetId: f.input.assetId, lineId: f.input.lineId, locale: f.input.locale, takeId: f.input.takeId, phase: 'selected' as const } }
    const second = await adopt(register(first.run, selection, 'voice-selection'), first.project, 'voice-selection')
    expect(second.project.files).toEqual(golden.voice.adopted)
    expect(second.run.artifacts.find(item => item.id === 'media-one')!.status).toBe('adopted')
    expect(second.run.artifacts.find(item => item.id === 'voice-selection')!.media?.target).toMatchObject({ kind: 'voice', phase: 'selected' })
    expect(second.run.milestones!.at(-1)!.anchors).toContain('media-one')
    const changedFiles = { ...second.project.files, 'adv/audio/pronunciation.json': '{"schemaVersion":1,"revision":1,"replacements":{"列车":"火车"},"locales":{}}' }
    const changed = invalidateCreativeArtifacts(second.run.artifacts, changedFiles, second.run)
    expect(changed.map(item => item.status)).toEqual(['stale', 'stale', 'stale'])
    expect(compatibleCreativeMediaArtifacts(second.run, changedFiles)).toEqual([])
  })
  it('requires binary host authority at adoption and after-snapshot recovery', async () => {
    const f = await fixture('image')
    let run = register(f.run, f.request)
    let files = { ...f.baseline.files }
    let entry: CreativeAdoptionJournalEntry | undefined
    let writes = 0
    let confirmations = 0
    let binaryPresent = false
    let verified: readonly CreativeMediaEvidence[] = []
    const unavailable = async (): Promise<never> => {
      throw new Error('Unexpected model action')
    }
    const client: CreativeTeamClient = { availability: unavailable, list: unavailable, start: unavailable, decide: unavailable, refreshFacts: unavailable, editCandidate: unavailable, recordPlaytest: unavailable, getPlaytest: unavailable, get: async () => structuredClone(run), async milestone(_projectId, _runId, command, id) {
      if (command.type === 'prepare') {
        const prepared = prepareCreativeMilestone(run, command.request)
        run = reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent: { id, operation: 'adopt', status: 'prepared', artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: command.request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: 'protocol-fixture', reason: command.request.reason, at: 2 } }, 2)
      }
      else {
        if (command.type === 'confirm')
          confirmations += 1
        run = reduceCreativeTeamRun(run, { type: 'resolve-milestone', milestoneId: command.milestoneId, status: command.type === 'confirm' ? 'confirmed' : 'abandoned', files: command.project.files }, 3)
      }
      return structuredClone(run)
    } }
    const workspace = { snapshot: async () => ({ projectId: f.baseline.id, files, revision: await computeAgentProjectRevision(files) }), capabilities: ['create-source', 'modify-source', 'delete-source', 'catalog-media', 'voice-take', 'candidate-preview'] as const, async commit(changes: Parameters<typeof overlayCreativeMilestone>[1]) {
      writes += 1
      files = overlayCreativeMilestone(files, changes)
      return workspace.snapshot()
    } }
    const journal = { load: async () => entry, save: async (value: CreativeAdoptionJournalEntry) => {
      entry = structuredClone(value)
    } }
    const options = { scope: { accountId: 'author', projectId: f.baseline.id, runId: run.id }, client, journal, assertCurrent() {} }
    const request = { operation: 'adopt' as const, project: f.baseline, artifacts: [{ artifactId: 'media-one', fingerprint: run.artifacts.at(-1)!.fingerprint }], reason: 'Review actual host image' }
    const review = await reviewCreativeMilestone(run, request)
    await expect(new CreativeMilestoneCoordinator({ ...options, workspace }).begin(run, request, review)).rejects.toThrow('MEDIA_VERIFIER_REQUIRED')
    expect(run.milestones).toBeUndefined()
    expect(writes).toBe(0)
    // The protocol fixture simulates a binary re-read. Actual decoding/player evidence lives in Studio browser tests.
    const host = { ...workspace, async verifyMedia(_files: Readonly<Record<string, string>>, evidence: readonly CreativeMediaEvidence[]) {
      verified = evidence
      if (!binaryPresent)
        throw new Error('binary missing or changed')
    } }
    const coordinator = () => new CreativeMilestoneCoordinator({ ...options, workspace: host })
    await expect(coordinator().begin(run, request, review)).rejects.toThrow('binary missing')
    expect(writes).toBe(1)
    expect(confirmations).toBe(0)
    const recovered = await coordinator().recover()
    expect(recovered?.projectState).toBe('after')
    expect(confirmations).toBe(0)
    await expect(coordinator().resume(recovered!.entry)).rejects.toThrow('binary missing')
    binaryPresent = true
    await coordinator().resume(recovered!.entry)
    expect(verified[0]).toMatchObject({ verification: 'author-host', sha256: '0013ad9b2e00141cfc089e4bbb8a299f3dd26d6f81f0f159d04557682420d9e1' })
    expect(writes).toBe(1)
    expect(confirmations).toBe(1)
    binaryPresent = false
    await expect(coordinator().resume(recovered!.entry)).rejects.toThrow('binary missing')
  })
  it('refuses self-certified authority, source/script edits, unrelated assets and changed profiles', async () => {
    const f = await fixture('image')
    expect(() => parseCreativeMediaCandidateRequest({ ...f.request, verification: 'verified-managed' })).toThrow('INVALID_AUTHORITY')
    expect(() => parseCreativePartnerOutput('media-adoption' as never, { kind: 'media-adoption' }, { projectId: f.baseline.id, projectRevision: f.baseline.revision, files: f.baseline.files, characterIds: [], limits: f.run.plan.limits })).toThrow()
    expect(() => prepareCreativeMediaCandidate(f.run, { ...f.request, writes: { ...f.request.writes, 'adv/chapters/injected.adv.md': 'Do not allow a media operation to write prose' } }, fingerprint)).toThrow('INVALID_WRITES')
    const root = JSON.parse(f.request.writes['adv/assets.json']!)
    root.profiles.local.root = '../outside'
    expect(() => prepareCreativeMediaCandidate(f.run, { ...f.request, writes: { ...f.request.writes, 'adv/assets.json': JSON.stringify(root) } }, fingerprint)).toThrow('PROFILE_CHANGED')
    const voice = await fixture('voice')
    const ledger = JSON.parse(voice.request.writes['adv/audio/voice-ledger.json']!)
    ledger.lines[voice.input.lineId].locales['zh-CN'].takes[0].voiceId = 'invented-provider-voice'
    expect(() => prepareCreativeMediaCandidate(voice.run, { ...voice.request, writes: { ...voice.request.writes, 'adv/audio/voice-ledger.json': JSON.stringify(ledger) } }, fingerprint)).toThrow('VOICE_PROFILE_CHANGED')
  })
})
