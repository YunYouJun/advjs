import type { VoiceAuthoringAdapter, VoiceAuthoringEditPlan, VoiceAuthoringService, VoiceAuthoringSnapshot, VoiceTake, VoiceTakeBindingInput, VoiceTakeImportInput, VoiceTakeSelectInput } from '@advjs/types'
import { audioFingerprint, canonicalAudioJson, voiceInputFingerprint } from './fingerprint'
import { assertAudioId, createAudioId } from './ids'
import { normalizeAudioLocale } from './locale'
import { activeAudioPronunciationDictionary, parseAudioPronunciationDictionary } from './pronunciation'
import { prepareVoiceSpokenText } from './spoken-text'
import { parseVoiceAlignment } from './voice-alignment'
import { assertVoiceSpeakerId, parseVoiceLedger, resolveVoiceTake, updateVoiceLedgerLine, validateVoiceRights } from './voice-ledger'
import { activeAudioVoiceProfiles, parseAudioVoiceProfiles } from './voice-profiles'

const HASH = /^[a-f0-9]{64}$/u

function assertRevision(snapshot: VoiceAuthoringSnapshot, revision: string) {
  if (!revision || snapshot.revision !== revision)
    throw new Error('VOICE_CONFLICT: The project audio documents changed; reload before applying')
}

function copySnapshot(snapshot: VoiceAuthoringSnapshot): VoiceAuthoringSnapshot {
  return { revision: snapshot.revision, ledger: parseVoiceLedger(snapshot.ledger), catalog: JSON.parse(JSON.stringify(snapshot.catalog)), ...(snapshot.pronunciation ? { pronunciation: parseAudioPronunciationDictionary(snapshot.pronunciation) } : {}), ...(snapshot.voiceProfiles ? { voiceProfiles: parseAudioVoiceProfiles(snapshot.voiceProfiles) } : {}), ...(snapshot.narratorProfile ? { narratorProfile: JSON.parse(canonicalAudioJson(snapshot.narratorProfile)) } : {}) }
}

/** Shared fingerprint of canonical project documents for hosts with in-memory files. */
export async function voiceAuthoringRevision(ledger: VoiceAuthoringSnapshot['ledger'], catalog: VoiceAuthoringSnapshot['catalog'], dictionary?: VoiceAuthoringSnapshot['pronunciation'], profiles?: VoiceAuthoringSnapshot['voiceProfiles']): Promise<string> {
  const pronunciation = activeAudioPronunciationDictionary(dictionary)
  const voiceProfiles = activeAudioVoiceProfiles(profiles)
  return await audioFingerprint({ ledger: parseVoiceLedger(ledger), catalog, ...(pronunciation ? { pronunciation } : {}), ...(voiceProfiles ? { voiceProfiles } : {}) })
}

/** Register a reviewed synthesis result as a new immutable take, without selecting it. */
export async function createVoiceTakeEditPlan(snapshot: VoiceAuthoringSnapshot, input: VoiceTakeBindingInput & { expectedRevision: string }): Promise<VoiceAuthoringEditPlan> {
  assertRevision(snapshot, input.expectedRevision)
  assertAudioId(input.lineId, 'line')
  assertVoiceSpeakerId(input.speakerId)
  const locale = normalizeAudioLocale(input.locale)
  if (!HASH.test(input.voiceProfileRevision))
    throw new Error('Voice Profile revision must be a SHA-256 hash')
  const candidate = input.candidate
  if (candidate.provider === 'web-speech')
    throw new Error('Web Speech is preview-only and cannot be registered as a publishable Voice take')
  const prepared = await prepareVoiceSpokenText(input.displayText, { override: input.spokenText, locale, pronunciation: snapshot.pronunciation })
  const spokenText = prepared.text
  if (candidate.characterId !== input.speakerId || candidate.text !== spokenText || !candidate.provider || !candidate.model
    || !HASH.test(candidate.sha256) || !Number.isInteger(candidate.bytes) || candidate.bytes <= 0
    || !Number.isFinite(candidate.durationSeconds) || candidate.durationSeconds <= 0
    || !Number.isInteger(candidate.sampleRate) || candidate.sampleRate <= 0
    || !/^audio\/[\w.+-]+$/u.test(candidate.mimeType)) {
    throw new Error('Voice candidate must match the line speaker, spoken text and valid audio provenance')
  }
  const voiceId = input.providerVoiceId ?? candidate.providerVoiceId
  if (!voiceId?.trim())
    throw new Error('A take must freeze the actual provider voice ID')
  if (candidate.providerVoiceId && voiceId !== candidate.providerVoiceId)
    throw new Error('The actual provider voice ID cannot be replaced by an author identity')
  if (input.speakerId === 'narrator') {
    const profile = snapshot.narratorProfile
    const binding = profile?.locales?.[locale]?.providers[candidate.provider]
    if (!profile || !binding || binding.voiceId !== voiceId || binding.model !== candidate.model || binding.source !== input.source
      || await audioFingerprint(profile) !== input.voiceProfileRevision || canonicalAudioJson(binding.rights ?? null) !== canonicalAudioJson(input.rights ?? null)) {
      throw new Error('VOICE_PROFILE_MISMATCH: Narrator takes require the exact project voice profile and reviewed provenance')
    }
  }
  if (voiceId.startsWith('reference:') && input.source !== 'cloned')
    throw new Error('Reference-conditioned synthesis must retain its cloned source and rights metadata')
  if (voiceId.startsWith('design:') && input.source !== 'designed')
    throw new Error('Designed synthesis must retain its designed source')
  if (input.rights)
    validateVoiceRights(input.rights)
  if (input.source === 'cloned' && !input.rights)
    throw new Error('Cloned voices require a consent record and rights metadata')
  if (!input.assetPath || /^(?:[a-z]+:|\/|\\)/iu.test(input.assetPath) || input.assetPath.split(/[\\/]/u).some(part => part === '..' || part === '' || part === '.'))
    throw new Error('Voice asset path must be a project-relative immutable media path')
  const result = copySnapshot(snapshot)
  const parameters = { ...(input.parameters ?? {}), ...(candidate.revision === undefined ? {} : { modelRevision: candidate.revision }) }
  result.ledger = updateVoiceLedgerLine(result.ledger, input.lineId, {
    speakerId: input.speakerId,
    displayText: snapshot.ledger.lines[input.lineId]?.displayText ?? input.displayText,
    ...((snapshot.ledger.lines[input.lineId]?.spokenText ?? (snapshot.ledger.lines[input.lineId] ? undefined : input.spokenText)) === undefined ? {} : { spokenText: snapshot.ledger.lines[input.lineId]?.spokenText ?? input.spokenText! }),
  })
  const assetId = createAudioId('audio')
  const take: VoiceTake = {
    id: createAudioId('take'),
    assetId,
    sha256: candidate.sha256,
    providerId: candidate.provider,
    voiceId,
    model: candidate.model,
    ...(candidate.revision === undefined ? {} : { modelRevision: candidate.revision }),
    voiceProfileRevision: input.voiceProfileRevision,
    inputFingerprint: await voiceInputFingerprint({ spokenText, locale, speakerId: input.speakerId, providerId: candidate.provider, voiceId, model: candidate.model, voiceProfileRevision: input.voiceProfileRevision, parameters, ...(prepared.pronunciationRevision ? { pronunciationRevision: prepared.pronunciationRevision } : {}) }),
    ...(prepared.pronunciationRevision ? { pronunciationRevision: prepared.pronunciationRevision } : {}),
    spokenText,
    createdAt: input.createdAt ?? new Date().toISOString(),
    source: input.source,
    ...(input.rights === undefined ? {} : { rights: input.rights }),
    parameters,
    ...(candidate.voiceId === undefined ? {} : { projectVoiceId: candidate.voiceId }),
    ...(candidate.voiceVersion === undefined ? {} : { projectVoiceVersion: candidate.voiceVersion }),
    ...(candidate.alignment ? { alignment: parseVoiceAlignment(candidate.alignment, { text: spokenText, sha256: candidate.sha256, durationSeconds: candidate.durationSeconds }) } : {}),
  }
  const line = result.ledger.lines[input.lineId]!
  const binding = line.locales[locale] ?? { selectedTake: null, takes: [] }
  binding.displayText = input.displayText
  if (input.spokenText === undefined)
    delete binding.spokenText
  else
    binding.spokenText = input.spokenText
  binding.takes.push(take)
  line.locales[locale] = binding
  const asset = {
    id: assetId,
    type: 'audio' as const,
    kind: 'voice',
    path: input.assetPath,
    sha256: candidate.sha256,
    bytes: candidate.bytes,
    mimeType: candidate.mimeType,
    duration: candidate.durationSeconds,
    characterId: input.speakerId,
    state: 'candidate',
    source: { type: input.source === 'recorded' ? 'original' : 'generated', model: candidate.model, createdAt: take.createdAt },
    ...(input.rights ? { license: input.rights.license } : {}),
  }
  result.catalog.assets.push(asset)
  parseVoiceLedger(result.ledger)
  return { expectedRevision: input.expectedRevision, ledger: result.ledger, catalog: result.catalog, addedAssets: [asset], addedTakes: [take], media: [{ candidate, asset }] }
}

/** Verify ordinary generation provenance, then retain the server's immutable IDs. */
export async function createVoiceTakeImportPlan(snapshot: VoiceAuthoringSnapshot, input: VoiceTakeImportInput): Promise<VoiceAuthoringEditPlan> {
  assertAudioId(input.take.id, 'take')
  assertAudioId(input.asset.id, 'audio')
  if (input.take.assetId !== input.asset.id || input.asset.path !== input.assetPath)
    throw new Error('VOICE_IMPORT_IDENTITY_CHANGED')
  const generated = await createVoiceTakeEditPlan(snapshot, { ...input, createdAt: input.take.createdAt })
  const expectedTake = { ...generated.addedTakes[0]!, id: input.take.id, assetId: input.asset.id }
  const expectedAsset = { ...generated.addedAssets[0]!, id: input.asset.id }
  if (canonicalAudioJson(expectedTake) !== canonicalAudioJson(input.take) || canonicalAudioJson(expectedAsset) !== canonicalAudioJson(input.asset))
    throw new Error('VOICE_IMPORT_PROVENANCE_CHANGED')
  const existingTakes = Object.entries(snapshot.ledger.lines).flatMap(([lineId, line]) => Object.entries(line.locales).flatMap(([locale, binding]) => binding.takes.map(take => ({ lineId, locale, take }))))
  const collision = existingTakes.find(item => item.take.id === input.take.id)
  const assetCollision = snapshot.catalog.assets.find(asset => asset.id === input.asset.id)
  if (collision || assetCollision) {
    if (!collision || !assetCollision || collision.lineId !== input.lineId || collision.locale !== normalizeAudioLocale(input.locale)
      || canonicalAudioJson(collision.take) !== canonicalAudioJson(input.take) || canonicalAudioJson(assetCollision) !== canonicalAudioJson(input.asset)) {
      throw new Error('VOICE_IMPORT_IDENTITY_CHANGED')
    }
    return { expectedRevision: input.expectedRevision, ledger: snapshot.ledger, catalog: snapshot.catalog, addedAssets: [], addedTakes: [], media: [] }
  }
  if (snapshot.catalog.assets.some(asset => asset.path === input.asset.path))
    throw new Error('VOICE_IMPORT_IDENTITY_CHANGED')
  const oldAssetId = generated.addedAssets[0]!.id
  const oldTakeId = generated.addedTakes[0]!.id
  const binding = generated.ledger.lines[input.lineId]!.locales[normalizeAudioLocale(input.locale)]!
  binding.takes = binding.takes.map(take => take.id === oldTakeId ? JSON.parse(canonicalAudioJson(input.take)) : take)
  generated.catalog.assets = generated.catalog.assets.map(asset => asset.id === oldAssetId ? JSON.parse(canonicalAudioJson(input.asset)) : asset)
  return { ...generated, addedAssets: [input.asset], addedTakes: [input.take], media: [{ candidate: input.candidate, asset: input.asset }] }
}

/** Selection is an independent author action; stale takes may be deliberately retained. */
export function createVoiceTakeSelectionPlan(snapshot: VoiceAuthoringSnapshot, input: VoiceTakeSelectInput): VoiceAuthoringEditPlan {
  assertRevision(snapshot, input.expectedRevision)
  assertAudioId(input.lineId, 'line')
  const locale = normalizeAudioLocale(input.locale)
  const result = copySnapshot(snapshot)
  const binding = result.ledger.lines[input.lineId]?.locales[locale]
  if (!binding)
    throw new Error('Unknown Voice ledger line or locale')
  if (input.takeId !== null) {
    assertAudioId(input.takeId, 'take')
    const take = binding.takes.find(item => item.id === input.takeId)
    if (!take)
      throw new Error('Unknown Voice take for this line and locale')
    const asset = result.catalog.assets.find(asset => asset.id === take.assetId)
    if (asset?.state === 'rejected')
      throw new Error('Rejected Voice takes cannot be selected')
    const checked = { ...result.ledger, lines: { ...result.ledger.lines, [input.lineId]: { ...result.ledger.lines[input.lineId]!, locales: { ...result.ledger.lines[input.lineId]!.locales, [locale]: { ...binding, selectedTake: take.id } } } } }
    resolveVoiceTake(checked, { lineId: input.lineId, locale, assets: result.catalog.assets })
  }
  if (binding.selectedTake !== null && binding.selectedTake !== input.takeId && !input.replaceSelected)
    throw new Error('VOICE_CONFLICT: Replacing or clearing the selected take requires replaceSelected')
  binding.selectedTake = input.takeId
  return { expectedRevision: input.expectedRevision, ledger: parseVoiceLedger(result.ledger), catalog: result.catalog, addedAssets: [], addedTakes: [], media: [] }
}

/** One service contract for CLI, native Editor and browser Studio adapters. */
export function createVoiceAuthoringService(adapter: VoiceAuthoringAdapter): VoiceAuthoringService {
  return {
    read: adapter.read,
    verifyTake: adapter.verifyTake,
    async synthesize(input, signal) {
      assertAudioId(input.lineId, 'line')
      assertVoiceSpeakerId(input.speakerId)
      signal?.throwIfAborted()
      if (!adapter.synthesize)
        throw new Error('This host has no native synthesis adapter; inspect or import existing candidates')
      const snapshot = await adapter.read()
      if (input.expectedRevision !== undefined)
        assertRevision(snapshot, input.expectedRevision)
      if (input.speakerId === 'narrator' && !Object.keys(snapshot.narratorProfile?.locales?.[normalizeAudioLocale(input.locale)]?.providers ?? {}).length)
        throw new Error('VOICE_PROFILE_MISMATCH: Configure the project narrator for this exact locale before synthesis')
      const text = (await prepareVoiceSpokenText(input.displayText, { override: input.spokenText, locale: input.locale, pronunciation: snapshot.pronunciation })).text
      const result = await adapter.synthesize({ lineId: input.lineId, locale: normalizeAudioLocale(input.locale), speakerId: input.speakerId, text }, signal)
      signal?.throwIfAborted()
      if (result.candidates.length !== 1 || result.candidates[0]?.characterId !== input.speakerId || result.candidates[0]?.text !== text)
        throw new Error('The synthesis result does not match the dialogue line')
      return result
    },
    async register(input) {
      const snapshot = await adapter.read()
      return await adapter.commit(await createVoiceTakeEditPlan(snapshot, input))
    },
    async importTake(input) {
      const snapshot = await adapter.read()
      const plan = await createVoiceTakeImportPlan(snapshot, input)
      if (!plan.addedTakes.length) {
        if (!adapter.verifyTake)
          throw new Error('VOICE_AUDIO_VERIFICATION_REQUIRED')
        await adapter.verifyTake({ lineId: input.lineId, locale: normalizeAudioLocale(input.locale), takeId: input.take.id })
        const current = await adapter.read()
        assertRevision(current, input.expectedRevision)
        return current
      }
      return await adapter.commit(plan)
    },
    async select(input) {
      const snapshot = await adapter.read()
      return await adapter.commit(createVoiceTakeSelectionPlan(snapshot, input))
    },
  }
}
