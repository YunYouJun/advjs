import type { CreativeArtifact, CreativePartnerOutput, CreativeTeamRun } from '@advjs/agent'
import type { CharacterVoiceProfile, VoiceAuthoringSnapshot, VoiceRights } from '@advjs/types'
import type { IFileSystem } from './fs'
import { computeAgentProjectRevision, creativeArtifactExpectedFiles } from '@advjs/agent'
import { audioFingerprint, audioProjectMediaPath, createVoiceTakeEditPlan, createVoiceTakeSelectionPlan, prepareVoiceSpokenText, resolveVoiceSpokenText, serializeVoiceLedger, voiceInputFingerprint } from '@advjs/audio'
import { compileProject, planAdvAssetManifestUpsert } from '@advjs/core'
import { recoverCreativeMediaWrite } from './creativeMediaRecovery'
import { createStudioCreativeWorkspace } from './creativeTeamWorkspace'
import { commitStudioProjectFiles } from './nativeProjectMutation'
import { createStudioAudioService } from './projectAudio'

type VoiceDirection = Extract<CreativePartnerOutput, { kind: 'voice-direction' }>
export type CreativeVoiceLine = VoiceDirection['lines'][number]
export interface CreativeVoiceTarget {
  artifactId: string
  artifactFingerprint: string
  request: CreativeVoiceLine
  lineId: string
  sourceRevision: string
  locale: string
  snapshot: VoiceAuthoringSnapshot
  profileRevision: string
  providers: Array<{ id: string, voiceId: string, model: string, source: 'system' | 'recorded', rights?: VoiceRights }>
}
export interface CreativeVoiceReview {
  target: Pick<CreativeVoiceTarget, 'artifactId' | 'artifactFingerprint' | 'request' | 'lineId' | 'sourceRevision' | 'locale' | 'profileRevision'>
  beforeRevision: string
  afterRevision: string
  mediaPath: string
  data: ArrayBuffer
  sha256: string
  bytes: number
  duration: number
  sampleRate: number
  takeId: string
  attribution: string
  changes: Array<{ path: string, expected: string | null, content: string | null }>
}

function assertProposal(run: CreativeTeamRun, artifact: CreativeArtifact, files?: Readonly<Record<string, string>>) {
  if (run.tasks.some(task => ['running', 'reconcile_required'].includes(task.status)) || run.milestones?.some(item => item.status === 'prepared'))
    throw new Error('CREATIVE_VOICE_RECOVERY_REQUIRED')
  if (artifact.output?.kind !== 'voice-direction' || !['selected', 'adopted'].includes(artifact.status))
    throw new Error('CREATIVE_VOICE_PROPOSAL_CHANGED')
  for (const [path, expected] of Object.entries(files ? creativeArtifactExpectedFiles(artifact, run) : {})) {
    if ((files![path] ?? null) !== expected)
      throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
  }
}

export function assertCreativeVoiceReview(run: CreativeTeamRun, review: Omit<CreativeVoiceReview, 'data'>) {
  const artifact = run.artifacts.find(item => item.id === review.target.artifactId && item.fingerprint === review.target.artifactFingerprint)
  if (!artifact)
    throw new Error('CREATIVE_VOICE_PROPOSAL_CHANGED')
  assertProposal(run, artifact)
}

export async function recoverCreativeVoiceImport(fs: IFileSystem, run: CreativeTeamRun, review: Omit<CreativeVoiceReview, 'data'> & { data?: ArrayBuffer }, destination: 'before' | 'after', assertCurrent: () => void) {
  if (destination === 'after')
    assertCreativeVoiceReview(run, review)
  await recoverCreativeMediaWrite({ fs, projectId: run.plan.projectId, review, media: { sha256: review.sha256, bytes: review.bytes }, data: review.data, destination, mimeType: 'audio/wav', assertCurrent, acceptsPath: path => /^adv\/(?:assets(?:\.json|\/[\w./-]+\.json)|audio\/voice-ledger\.json)$/.test(path) && !path.split('/').some(part => ['.', '..', ''].includes(part)) })
}

/** Match the compiler's actual source location and stable line identity, never an inferred prose index. */
export async function readCreativeVoiceTargets(fs: IFileSystem, run: CreativeTeamRun, artifactId: string, assertCurrent: () => void) {
  const source = await createStudioCreativeWorkspace(fs, run.plan.projectId, { assertCurrent }).snapshot()
  const artifact = run.artifacts.find(item => item.id === artifactId)
  if (!artifact)
    throw new Error('CREATIVE_VOICE_PROPOSAL_CHANGED')
  assertProposal(run, artifact, source.files)
  const compilation = await compileProject({ files: source.files }, { allowEmptyAssetManifest: true })
  if (compilation.diagnostics.some(item => item.severity === 'error') || !compilation.project.program)
    throw new Error('CREATIVE_VOICE_COMPILE_FAILED')
  const snapshot = await createStudioAudioService(fs).read()
  const profiles: Record<string, CharacterVoiceProfile | undefined> = { ...Object.fromEntries(compilation.project.characters.map(item => [item.id, item.voiceProfile])), narrator: snapshot.narratorProfile }
  const output = artifact.output as VoiceDirection
  const nodes = Object.values(compilation.project.program.chapters).flatMap(chapter => Object.values(chapter.nodes).map(node => ({ node, source: compilation.sourceMap.nodes?.[`${chapter.id}#${node.id}`] })))
  const targets: CreativeVoiceTarget[] = []
  for (const request of output.lines) {
    const sourceLines = source.files[request.path]?.split('\n') ?? []
    // Canonical @speaker dialogue maps to its directive line; the output contract
    // points at the following spoken-text line. Both must describe the same node.
    const matches = nodes.filter(({ node, source }) => ['dialog', 'narration'].includes(node.kind)
      && source?.path === request.path
      && (source.line === request.line || (node.kind === 'dialog' && source.line === request.line - 1 && sourceLines[source.line - 1]?.trim().startsWith('@')))
      && sourceLines[request.line - 1]?.includes(request.text)
      && node.data?.speakerId === request.speakerId && node.data?.text === request.text && typeof node.data?.lineId === 'string')
    if (matches.length !== 1)
      throw new Error('CREATIVE_VOICE_LINE_UNRESOLVED')
    const profile = profiles[request.speakerId]
    const locale = String(compilation.project.game.locale ?? 'zh-CN')
    const providers = Object.entries(profile?.locales?.[locale]?.providers ?? {}).flatMap(([id, binding]) => binding.model && ['system', 'recorded'].includes(binding.source) ? [{ id, voiceId: binding.voiceId, model: binding.model, source: binding.source as 'system' | 'recorded', ...(binding.rights ? { rights: binding.rights } : {}) }] : [])
    targets.push({ artifactId, artifactFingerprint: artifact.fingerprint, request, lineId: String(matches[0]!.node.data!.lineId), sourceRevision: source.revision, locale, snapshot, profileRevision: profile ? await audioFingerprint(profile) : '', providers })
  }
  assertCurrent()
  return targets
}

/** Decode actual WAV samples locally. Decoding does not start playback or send audio anywhere. */
export async function inspectCreativeVoice(file: File): Promise<{ data: ArrayBuffer, sha256: string, duration: number, sampleRate: number }> {
  if (!file.size || file.size > 32 * 1024 * 1024)
    throw new Error('CREATIVE_VOICE_FILE_INVALID')
  const data = await file.arrayBuffer()
  const header = new TextDecoder('ascii').decode(data.slice(0, 12))
  if (!header.startsWith('RIFF') || header.slice(8) !== 'WAVE')
    throw new Error('CREATIVE_VOICE_FILE_INVALID')
  const view = new DataView(data)
  let sampleRate = 0
  for (let offset = 12; offset + 8 <= data.byteLength;) {
    const size = view.getUint32(offset + 4, true)
    if (offset + 8 + size > data.byteLength)
      throw new Error('CREATIVE_VOICE_FILE_INVALID')
    if (new TextDecoder('ascii').decode(data.slice(offset, offset + 4)) === 'fmt ' && size >= 16) {
      sampleRate = view.getUint32(offset + 12, true)
      if (![1, 2].includes(view.getUint16(offset + 10, true)))
        throw new Error('CREATIVE_VOICE_FILE_INVALID')
    }
    offset += 8 + size + size % 2
  }
  if (sampleRate < 8000 || sampleRate > 192000)
    throw new Error('CREATIVE_VOICE_FILE_INVALID')
  const context = new AudioContext({ sampleRate })
  try {
    const decoded = await context.decodeAudioData(data.slice(0))
    if (!(decoded.duration > 0 && decoded.duration <= 120) || decoded.numberOfChannels > 2 || decoded.length * decoded.numberOfChannels > 24000000)
      throw new Error('CREATIVE_VOICE_FILE_INVALID')
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0')).join('')
    return { data, sha256, duration: decoded.duration, sampleRate: decoded.sampleRate }
  }
  finally {
    await context.close()
  }
}

/** Review an unselected take with the existing ledger planner and canonical asset catalog. */
export async function reviewCreativeVoiceImport(fs: IFileSystem, run: CreativeTeamRun, target: CreativeVoiceTarget, audio: Awaited<ReturnType<typeof inspectCreativeVoice>>, providerId: string, attribution: string, assertCurrent: () => void): Promise<CreativeVoiceReview> {
  const current = (await readCreativeVoiceTargets(fs, run, target.artifactId, assertCurrent)).find(item => item.lineId === target.lineId)
  const provider = current?.providers.find(item => item.id === providerId)
  if (!current || current.artifactFingerprint !== target.artifactFingerprint || JSON.stringify(current.request) !== JSON.stringify(target.request) || !provider || !attribution.trim() || attribution.length > 1000)
    throw new Error('CREATIVE_VOICE_PROFILE_REQUIRED')
  const source = await createStudioCreativeWorkspace(fs, run.plan.projectId, { assertCurrent }).snapshot()
  if (source.revision !== current.sourceRevision)
    throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
  if (provider.rights) {
    const path = provider.rights.consentRecord
    if (path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())) || !Object.hasOwn(source.files, path))
      throw new Error('CREATIVE_VOICE_CONSENT_REQUIRED')
  }
  const ledgerLine = current.snapshot.ledger.lines[current.lineId]
  const override = ledgerLine?.locales[current.locale]?.spokenText ?? ledgerLine?.spokenText
  const spokenText = resolveVoiceSpokenText(current.request.text, { override, locale: current.locale, pronunciation: current.snapshot.pronunciation })
  const plan = await createVoiceTakeEditPlan(current.snapshot, {
    lineId: current.lineId,
    speakerId: current.request.speakerId,
    locale: current.locale,
    displayText: current.request.text,
    ...(override === undefined ? {} : { spokenText: override }),
    expectedRevision: current.snapshot.revision,
    voiceProfileRevision: current.profileRevision,
    assetPath: `voice/creative/${crypto.randomUUID()}.wav`,
    source: provider.source,
    ...(provider.rights ? { rights: provider.rights } : {}),
    parameters: { attribution: attribution.trim(), creativeArtifactId: current.artifactId, performanceInstruction: current.request.instruction },
    candidate: { id: crypto.randomUUID(), characterId: current.request.speakerId, text: spokenText, path: 'manual-import.wav', sha256: audio.sha256, bytes: audio.data.byteLength, mimeType: 'audio/wav', durationSeconds: audio.duration, sampleRate: audio.sampleRate, provider: provider.id, providerVoiceId: provider.voiceId, model: provider.model },
  })
  const asset = plan.addedAssets[0]!
  const catalog = planAdvAssetManifestUpsert({ files: source.files, rootPath: 'adv/assets.json', catalogId: run.plan.projectId, asset, replaceExisting: false })
  const writes = { ...catalog.writes, 'adv/audio/voice-ledger.json': serializeVoiceLedger(plan.ledger) }
  assertCurrent()
  const targetReference = { artifactId: current.artifactId, artifactFingerprint: current.artifactFingerprint, request: current.request, lineId: current.lineId, sourceRevision: current.sourceRevision, locale: current.locale, profileRevision: current.profileRevision }
  return { target: targetReference, beforeRevision: source.revision, afterRevision: await computeAgentProjectRevision({ ...source.files, ...writes }), mediaPath: audioProjectMediaPath(catalog.manifest, asset), ...audio, bytes: audio.data.byteLength, takeId: plan.addedTakes[0]!.id, attribution: attribution.trim(), changes: Object.entries(writes).map(([path, content]) => ({ path, expected: source.files[path] ?? null, content })) }
}

/** The candidate remains unselected; audition and adoption use the existing voice review workspace. */
export async function commitCreativeVoiceImport(fs: IFileSystem, run: CreativeTeamRun, review: CreativeVoiceReview, assertCurrent: () => void) {
  await commitStudioProjectFiles(fs, review.changes, {
    assertCurrent,
    acceptsPath: path => /^adv\/(?:assets(?:\.json|\/[\w./-]+\.json)|audio\/voice-ledger\.json)$/.test(path) && !path.split('/').some(part => ['.', '..', ''].includes(part)),
    media: { path: review.mediaPath, blob: new Blob([review.data], { type: 'audio/wav' }), sha256: review.sha256, bytes: review.data.byteLength },
    async validateCurrent() {
      const source = await createStudioCreativeWorkspace(fs, run.plan.projectId, { assertCurrent }).snapshot()
      if (source.revision !== review.beforeRevision)
        throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
      const artifact = run.artifacts.find(item => item.id === review.target.artifactId && item.fingerprint === review.target.artifactFingerprint)
      if (!artifact)
        throw new Error('CREATIVE_VOICE_PROPOSAL_CHANGED')
      assertProposal(run, artifact, source.files)
    },
  })
}

/** Prepare the independent selected-take binding after audition, retaining its exact input provenance. */
export async function reviewCreativeVoiceSelection(fs: IFileSystem, run: CreativeTeamRun, imported: Omit<CreativeVoiceReview, 'data'>, assertCurrent: () => void) {
  const current = (await readCreativeVoiceTargets(fs, run, imported.target.artifactId, assertCurrent)).find(item => item.lineId === imported.target.lineId)
  if (!current || current.artifactFingerprint !== imported.target.artifactFingerprint || current.locale !== imported.target.locale || JSON.stringify(current.request) !== JSON.stringify(imported.target.request) || current.profileRevision !== imported.target.profileRevision)
    throw new Error('CREATIVE_VOICE_PROFILE_REQUIRED')
  const line = current.snapshot.ledger.lines[current.lineId]
  const binding = line?.locales[current.locale]
  const take = binding?.takes.find(item => item.id === imported.takeId)
  const provider = current.providers.find(item => item.id === take?.providerId && item.voiceId === take.voiceId && item.model === take.model)
  const prepared = await prepareVoiceSpokenText(current.request.text, { override: binding?.spokenText ?? line?.spokenText, locale: current.locale, pronunciation: current.snapshot.pronunciation })
  if (!take || !provider || take.voiceProfileRevision !== current.profileRevision || take.inputFingerprint !== await voiceInputFingerprint({ spokenText: prepared.text, locale: current.locale, speakerId: current.request.speakerId, providerId: take.providerId, voiceId: take.voiceId, model: take.model, voiceProfileRevision: current.profileRevision, parameters: take.parameters, ...(prepared.pronunciationRevision ? { pronunciationRevision: prepared.pronunciationRevision } : {}) }))
    throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
  const source = await createStudioCreativeWorkspace(fs, run.plan.projectId, { assertCurrent }).snapshot()
  if (source.revision !== current.sourceRevision)
    throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
  const plan = createVoiceTakeSelectionPlan(current.snapshot, { expectedRevision: current.snapshot.revision, lineId: current.lineId, locale: current.locale, takeId: take.id, replaceSelected: true })
  const content = serializeVoiceLedger(plan.ledger)
  const path = 'adv/audio/voice-ledger.json'
  const afterRevision = await computeAgentProjectRevision({ ...source.files, [path]: content })
  if (afterRevision === source.revision)
    throw new Error('CREATIVE_EMPTY_MILESTONE')
  assertCurrent()
  return { ...imported, target: { artifactId: current.artifactId, artifactFingerprint: current.artifactFingerprint, request: current.request, lineId: current.lineId, sourceRevision: source.revision, locale: current.locale, profileRevision: current.profileRevision }, beforeRevision: source.revision, afterRevision, changes: [{ path, expected: source.files[path] ?? null, content }] }
}
