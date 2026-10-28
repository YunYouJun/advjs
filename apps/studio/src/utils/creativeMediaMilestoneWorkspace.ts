import type { CreativeArtifact, CreativeMediaEvidence, CreativeMilestoneIntent, CreativeMilestoneReview, CreativeProjectWorkspace, CreativeTeamRun } from '@advjs/agent'
import type { NormalizedAdvProject } from '@advjs/types'
import type { CreativeArtImportScope } from './creativeArtImportCache'
import type { CreativeMilestoneMediaCache } from './creativeMediaMilestoneCache'
import type { IFileSystem } from './fs'
import type { StudioNativeMedia } from './nativeProjectMutation'
import { assertCreativeSourcePath, computeAgentProjectRevision, creativeMediaCanonical, creativeMilestoneChanges, overlayCreativeMilestone } from '@advjs/agent'
import { audioFingerprint, audioProjectMediaPath, canonicalAudioJson, createAudioVoiceProfiles, parseAudioPronunciationDictionary, parseAudioVoiceProfiles, parseVoiceLedger, prepareVoiceSpokenText, voiceInputFingerprint } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { inspectCreativeImage } from './creativeImage'
import { creativeMilestoneMediaCache, creativeMilestoneRowArtifact } from './creativeMediaMilestoneCache'
import { creativeMediaSourceState } from './creativeMediaRecovery'
import { createStudioCreativeWorkspace } from './creativeTeamWorkspace'
import { inspectCreativeVoice } from './creativeVoiceImport'
import { commitStudioProjectFiles } from './nativeProjectMutation'

type MediaArtifact = CreativeArtifact & { media: CreativeMediaEvidence }
/** Real browser media + existing project transaction, shared by the unified milestone UI. */
export function createStudioCreativeMediaWorkspace(options: {
  fs: IFileSystem
  scope: CreativeArtImportScope
  run: () => CreativeTeamRun
  assertCurrent: () => void
  cache?: CreativeMilestoneMediaCache
  inspectImage?: typeof inspectCreativeImage
  inspectVoice?: typeof inspectCreativeVoice
}): CreativeProjectWorkspace {
  const { fs, scope, assertCurrent } = options
  const cache = options.cache ?? creativeMilestoneMediaCache
  const base = createStudioCreativeWorkspace(fs, scope.projectId, { assertCurrent })
  function currentRun() {
    assertCurrent()
    const run = options.run()
    if (run.id !== scope.runId || run.accountId !== scope.accountId || run.plan.projectId !== scope.projectId)
      throw new Error('CREATIVE_PROJECT_MISMATCH')
    return run
  }
  function artifacts(ids: readonly string[]): MediaArtifact[] {
    return currentRun().artifacts.filter((item): item is MediaArtifact => ids.includes(item.id) && item.kind === 'media-adoption' && Boolean(item.media))
  }
  async function compile(files: Readonly<Record<string, string>>) {
    const result = await compileProject({ id: scope.projectId, files }, { allowEmptyAssetManifest: true })
    assertCurrent()
    if (result.diagnostics.some(item => item.severity === 'error'))
      throw new Error('CREATIVE_COMPILE_FAILED')
    return result.project
  }
  function assetFor(project: NormalizedAdvProject, evidence: CreativeMediaEvidence) {
    const asset = project.assets?.assets.find(item => item.id === evidence.target.assetId)
    if (!project.assets || !asset || asset.sha256 !== evidence.sha256 || asset.bytes !== evidence.bytes || asset.mimeType !== evidence.mimeType || audioProjectMediaPath(project.assets, asset) !== evidence.mediaPath)
      throw new Error('CREATIVE_MEDIA_BINDING_CHANGED')
    if (evidence.target.kind === 'image') {
      const parent = currentRun().artifacts.find(item => item.id === evidence.parent.artifactId && item.fingerprint === evidence.parent.fingerprint)
      const request = parent?.output?.kind === 'art-direction' ? parent.output.requests.find(item => item.assetId === evidence.target.assetId) : undefined
      if (!request || asset.type !== 'image' || (request.kind === 'background'
        ? asset.kind !== 'background' || asset.sceneId !== request.sceneId || project.scenes.find(item => item.id === request.sceneId)?.assetId !== asset.id
        : asset.kind !== 'character' || asset.characterId !== request.characterId || asset.expression !== (request.kind === 'expression' ? request.expression : 'default'))) {
        throw new Error('CREATIVE_MEDIA_BINDING_CHANGED')
      }
    }
    return asset
  }
  async function verifyBlob(project: NormalizedAdvProject, files: Readonly<Record<string, string>>, evidence: CreativeMediaEvidence, blob: Blob) {
    const asset = assetFor(project, evidence)
    if (blob.size !== evidence.bytes)
      throw new Error('CREATIVE_MEDIA_BYTES_CHANGED')
    if (evidence.target.kind === 'image') {
      const { image } = await (options.inspectImage ?? inspectCreativeImage)(blob)
      if (image.sha256 !== evidence.sha256 || image.mimeType !== evidence.mimeType || image.width !== asset.width || image.height !== asset.height)
        throw new Error('CREATIVE_MEDIA_BYTES_CHANGED')
    }
    else {
      const target = evidence.target
      const ledger = parseVoiceLedger(JSON.parse(files['adv/audio/voice-ledger.json'] ?? '{}'))
      const binding = ledger.lines[target.lineId]?.locales[target.locale]
      const take = binding?.takes.find(item => item.id === target.takeId)
      if (asset.type !== 'audio' || asset.kind !== 'voice' || !take || take.assetId !== asset.id || take.sha256 !== evidence.sha256 || (target.phase === 'selected' && binding?.selectedTake !== take.id))
        throw new Error('CREATIVE_MEDIA_BINDING_CHANGED')
      const line = ledger.lines[target.lineId]!
      const nodes = Object.values(project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).filter(node => ['dialog', 'narration'].includes(node.kind) && node.data?.lineId === target.lineId && node.data.speakerId === line.speakerId)
      const displayText = binding?.displayText ?? line.displayText
      const profile = line.speakerId === 'narrator' ? parseAudioVoiceProfiles(files['adv/audio/voice-profiles.json'] ?? createAudioVoiceProfiles()).narrator : project.characters.find(item => item.id === line.speakerId)?.voiceProfile
      const provider = profile?.locales?.[target.locale]?.providers?.[take.providerId]
      const pronunciation = files['adv/audio/pronunciation.json'] ? parseAudioPronunciationDictionary(files['adv/audio/pronunciation.json']) : undefined
      const prepared = await prepareVoiceSpokenText(displayText, { override: binding?.spokenText ?? line.spokenText, locale: target.locale, pronunciation })
      if (nodes.length !== 1 || nodes[0]!.data?.text !== displayText || !profile || !provider || provider.voiceId !== take.voiceId || provider.model !== take.model || provider.source !== take.source
        || canonicalAudioJson(provider.rights ?? null) !== canonicalAudioJson(take.rights ?? null) || await audioFingerprint(profile) !== take.voiceProfileRevision
        || await voiceInputFingerprint({ spokenText: prepared.text, locale: target.locale, speakerId: line.speakerId, providerId: take.providerId, voiceId: take.voiceId, model: take.model, voiceProfileRevision: take.voiceProfileRevision, parameters: take.parameters, ...(prepared.pronunciationRevision ? { pronunciationRevision: prepared.pronunciationRevision } : {}) }) !== take.inputFingerprint) {
        throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
      }
      if (take.rights && !Object.hasOwn(files, take.rights.consentRecord))
        throw new Error('CREATIVE_MEDIA_CONSENT_REQUIRED')
      const audio = await (options.inspectVoice ?? inspectCreativeVoice)(new File([blob], 'creative-media.wav', { type: 'audio/wav' }))
      if (audio.sha256 !== evidence.sha256 || Math.abs(audio.duration - (asset.duration ?? 0)) > 0.001)
        throw new Error('CREATIVE_MEDIA_BYTES_CHANGED')
    }
    assertCurrent()
  }
  async function verifyMedia(files: Readonly<Record<string, string>>, evidence: readonly CreativeMediaEvidence[]) {
    currentRun()
    const all = [...new Map(evidence.map(item => [creativeMediaCanonical(item), item])).values()]
    const project = await compile(files)
    for (const item of all) {
      const blob = await fs.readBlob(item.mediaPath)
      assertCurrent()
      await verifyBlob(project, files, item, blob)
    }
  }
  async function stagedMedia(selected: readonly MediaArtifact[], files: Readonly<Record<string, string>>): Promise<StudioNativeMedia[]> {
    const candidates = await cache.list(scope)
    const project = await compile(files)
    const media = new Map<string, StudioNativeMedia>()
    for (const artifact of selected) {
      const evidence = artifact.media
      const row = candidates.find(item => creativeMilestoneRowArtifact(item, currentRun()) === artifact.id)
      let blob: Blob
      if (await fs.exists(evidence.mediaPath)) {
        blob = await fs.readBlob(evidence.mediaPath)
      }
      else {
        const data = row?.kind === 'image' ? row.entry.data : row?.entry.review.data
        if (!data || !row?.entry.managed || row.entry.managed.request.project.revision !== artifact.source.revision)
          throw new Error('CREATIVE_MEDIA_RECOVERY_BYTES_REQUIRED')
        blob = new Blob([data], { type: evidence.mimeType })
      }
      assertCurrent()
      await verifyBlob(project, files, evidence, blob)
      const previous = media.get(evidence.mediaPath)
      if (previous && (previous.sha256 !== evidence.sha256 || previous.bytes !== evidence.bytes))
        throw new Error('CREATIVE_MEDIA_BYTES_CHANGED')
      media.set(evidence.mediaPath, { path: evidence.mediaPath, blob, sha256: evidence.sha256, bytes: evidence.bytes })
    }
    return [...media.values()]
  }
  async function inspectRecovery(review: CreativeMilestoneReview) {
    if (review.projectId !== scope.projectId)
      throw new Error('CREATIVE_PROJECT_MISMATCH')
    const snapshot = await base.snapshot()
    const changes = review.changes.map(item => ({ path: item.path, expected: item.before, content: item.after }))
    const state = await creativeMediaSourceState(snapshot.files, snapshot.revision, { beforeRevision: review.baselineRevision, afterRevision: review.candidateRevision, changes })
    if (state === 'conflict')
      return state
    for (const artifact of artifacts(review.artifactIds).filter(item => item.changes.every(change => review.changes.some(reviewed => reviewed.path === change.path && reviewed.before === change.before && reviewed.after === change.after)))) {
      if (await fs.exists(artifact.media.mediaPath)) {
        try {
          const project = await compile(review.files)
          await verifyBlob(project, review.files, artifact.media, await fs.readBlob(artifact.media.mediaPath))
        }
        catch {
          assertCurrent()
          return 'conflict'
        }
      }
      else if (state === 'after') {
        return 'partial'
      }
    }
    assertCurrent()
    return state
  }
  async function acknowledge(intent: CreativeMilestoneIntent) {
    currentRun()
    const snapshot = await base.snapshot()
    if (snapshot.revision !== (intent.status === 'confirmed' ? intent.afterRevision : intent.beforeRevision))
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    await cache.acknowledge(scope, intent)
    assertCurrent()
  }
  const workspace: CreativeProjectWorkspace = {
    snapshot: base.snapshot,
    inspectVoiceCoverage: base.inspectVoiceCoverage,
    capabilities: ['create-source', 'modify-source', 'delete-source', 'candidate-preview', 'voice-settings', 'catalog-media', 'voice-take'],
    verifyMedia,
    inspectRecovery,
    acknowledge,
    async commit(changes, expectedRevision, intent) {
      const media = intent ? artifacts(intent.artifacts.map(item => item.artifactId)) : []
      if (!media.length)
        return base.commit(changes, expectedRevision)
      const before = await base.snapshot()
      if (before.revision !== expectedRevision || !intent || JSON.stringify(changes) !== JSON.stringify(creativeMilestoneChanges(currentRun(), intent)))
        throw new Error('CREATIVE_SOURCE_CONFLICT')
      const files = overlayCreativeMilestone(before.files, changes)
      const staged = intent.operation === 'adopt' ? await stagedMedia(media, files) : []
      await cache.claim(scope, currentRun(), intent)
      assertCurrent()
      await commitStudioProjectFiles(fs, changes.map(item => ({ path: item.path, expected: item.before, content: item.after })), {
        media: staged,
        assertCurrent,
        acceptsPath(path) {
          assertCreativeSourcePath(path)
          return true
        },
        async validateCurrent() {
          if ((await base.snapshot()).revision !== expectedRevision)
            throw new Error('CREATIVE_SOURCE_CONFLICT')
        },
        async validateAfter() {
          if ((await base.snapshot()).revision !== intent.afterRevision)
            throw new Error('CREATIVE_COMMIT_INCOMPLETE')
          await verifyMedia(files, intent.operation === 'adopt' ? media.map(item => item.media) : [])
        },
      })
      return base.snapshot()
    },
    async recover(review, destination, intent) {
      currentRun()
      const actual = await inspectRecovery(review)
      if (actual === 'conflict' || intent.beforeRevision !== review.baselineRevision || intent.afterRevision !== review.candidateRevision || JSON.stringify(creativeMilestoneChanges(currentRun(), intent)) !== JSON.stringify(review.changes))
        throw new Error('CREATIVE_SOURCE_CONFLICT')
      const snapshot = await base.snapshot()
      const files = { ...review.files }
      if (destination === 'before') {
        for (const change of review.changes) {
          if (change.before === null)
            delete files[change.path]
          else
            files[change.path] = change.before
        }
      }
      const revision = destination === 'after' ? review.candidateRevision : review.baselineRevision
      if (await computeAgentProjectRevision(files) !== revision)
        throw new Error('CREATIVE_REVIEW_CHANGED')
      await compile(files)
      const media = artifacts(review.artifactIds)
      const staged = destination === 'after' && intent.operation === 'adopt' ? await stagedMedia(media, files) : []
      await cache.claim(scope, currentRun(), intent)
      assertCurrent()
      await commitStudioProjectFiles(fs, review.changes.map(item => ({ path: item.path, expected: snapshot.files[item.path] ?? null, content: destination === 'after' ? item.after : item.before })), {
        media: staged,
        assertCurrent,
        acceptsPath(path) {
          assertCreativeSourcePath(path)
          return true
        },
        async validateCurrent() {
          if ((await base.snapshot()).revision !== snapshot.revision || await inspectRecovery(review) === 'conflict')
            throw new Error('CREATIVE_SOURCE_CONFLICT')
        },
        async validateAfter() {
          if ((await base.snapshot()).revision !== revision)
            throw new Error('CREATIVE_COMMIT_INCOMPLETE')
          if (media.length)
            await verifyMedia(files, destination === 'after' && intent.operation === 'adopt' ? media.map(item => item.media) : [])
        },
      })
      return base.snapshot()
    },
  }
  return workspace
}
