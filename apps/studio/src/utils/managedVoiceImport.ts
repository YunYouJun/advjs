import type { VoiceGenerationResolvedInput, VoiceGenerationTask } from '@advjs/audio'
import type { VoiceAuthoringService, VoiceAuthoringSnapshot } from '@advjs/types'
import type { HostedVoiceReceipt } from '../../../../packages/advjs/shared/hosted-audio'
import type { IFileSystem } from './fs'
import type { ManagedVoiceClient } from './managedVoiceClient'
import { assertAudioId, canonicalAudioJson, resolveVoiceSpokenText, verifyVoiceCandidateBytes, voiceGenerationInputFingerprint } from '@advjs/audio'

/** A remote result is imported locally, preserving identity and never selecting it. */
export async function importHostedVoiceReceipt(options: {
  client: ManagedVoiceClient
  fs: IFileSystem
  authoring: VoiceAuthoringService
  task: VoiceGenerationTask
  receipt: HostedVoiceReceipt
  resolve: (task: VoiceGenerationTask, snapshot: VoiceAuthoringSnapshot) => Promise<VoiceGenerationResolvedInput>
  assertCurrent: () => void
  signal?: AbortSignal
}) {
  const { task, receipt, authoring, fs, client } = options
  assertAudioId(receipt.take.id, 'take')
  assertAudioId(receipt.asset.id, 'audio')
  if (receipt.taskId !== task.id || receipt.lineId !== task.lineId || receipt.locale !== task.locale || receipt.speakerId !== task.speakerId || receipt.inputFingerprint !== task.inputFingerprint
    || receipt.take.inputFingerprint !== task.inputFingerprint || receipt.take.assetId !== receipt.asset.id || receipt.take.sha256 !== receipt.asset.sha256
    || receipt.candidate.sha256 !== receipt.take.sha256 || receipt.candidate.provider !== task.providerId || receipt.candidate.model !== task.model
    || receipt.candidate.providerVoiceId !== task.voiceId || receipt.asset.kind !== 'voice' || receipt.asset.type !== 'audio') {
    throw new Error('AUDIO_SERVICE_RECEIPT_INVALID')
  }
  if (!authoring.importTake)
    throw new Error('AUDIO_SERVICE_IMPORT_UNAVAILABLE')
  const before = await authoring.read()
  const stored = before.ledger.lines[task.lineId]?.locales[task.locale]?.takes.find(take => take.id === receipt.take.id)
  if (stored) {
    const asset = before.catalog.assets.find(asset => asset.id === stored.assetId)
    if (canonicalAudioJson(stored) !== canonicalAudioJson(receipt.take) || !asset || asset.path !== receipt.asset.path || asset.sha256 !== receipt.asset.sha256 || asset.bytes !== receipt.asset.bytes)
      throw new Error('VOICE_IMPORT_IDENTITY_CHANGED')
    if (!authoring.verifyTake)
      throw new Error('VOICE_AUDIO_VERIFICATION_REQUIRED')
    await authoring.verifyTake({ lineId: task.lineId, locale: task.locale, takeId: stored.id })
    options.assertCurrent()
    return before
  }
  async function currentInput() {
    const snapshot = await authoring.read()
    const input = await options.resolve(task, snapshot)
    const inspected = await client.prepare(input, snapshot, options.signal)
    if (await voiceGenerationInputFingerprint(inspected) !== task.inputFingerprint)
      throw new Error('AUDIO_JOB_INPUT_CHANGED')
    options.assertCurrent()
    return { snapshot, input: inspected }
  }
  const initial = await currentInput()
  const existing = initial.snapshot.ledger.lines[task.lineId]?.locales[task.locale]?.takes.find(take => take.id === receipt.take.id)
  const stage = `adv/audio/.staging/hosted/${receipt.take.id}.bin`
  if (!existing) {
    const bytes = await client.media(receipt.mediaUrl, receipt.candidate.bytes, options.signal)
    await verifyVoiceCandidateBytes(receipt.candidate, bytes)
    options.assertCurrent()
    await fs.writeBlob(stage, new Blob([bytes], { type: receipt.candidate.mimeType }))
  }
  try {
    const { snapshot, input } = await currentInput()
    const text = resolveVoiceSpokenText(input.displayText, { override: input.spokenText, locale: input.locale, pronunciation: snapshot.pronunciation })
    const candidate = { ...receipt.candidate, characterId: task.speakerId, text, path: stage }
    return await authoring.importTake({ ...input, assetPath: receipt.asset.path!, candidate, take: receipt.take, asset: receipt.asset, expectedRevision: snapshot.revision })
  }
  finally {
    if (!existing && await fs.exists(stage))
      await fs.deleteFile(stage)
  }
}
