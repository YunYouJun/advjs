import type { AdvAssetEntry, AdvAssetManifest, AdvVoiceCandidate, AudioPronunciationDictionary, AudioVoiceProfiles, RuntimeProgram, VoiceAuthoringAdapter, VoiceTake } from '@advjs/types'
import { createVoiceAuthoringService, voiceAuthoringRevision } from './authoring'
import { assertAudioId } from './ids'
import { normalizeAudioLocale } from './locale'
import { AUDIO_PRONUNCIATION_PATH, createAudioPronunciationDictionary, parseAudioPronunciationDictionary, serializeAudioPronunciationDictionary } from './pronunciation'
import { createProjectAudioResourceService } from './resources'
import { parseVoiceLedger, serializeVoiceLedger, VOICE_LEDGER_PATH } from './voice-ledger'
import { AUDIO_VOICE_PROFILES_PATH, createAudioVoiceProfiles, parseAudioVoiceProfiles, serializeAudioVoiceProfiles } from './voice-profiles'

export interface AudioProjectFileChange {
  path: string
  expected: string | null
  content: string | null
}

export interface AudioProjectMedia {
  /** Existing bounded project file. Hosts re-read it before copying bytes. */
  candidate: Pick<AdvVoiceCandidate, 'path' | 'sha256' | 'bytes'>
  asset: AdvAssetEntry
  /** Verify-only registrations retain an already persisted immutable master. */
  operation?: 'copy' | 'verify'
}

/** Hosts supply one revision-checked project transaction, including verified media. */
export interface AudioProjectFilePort {
  read: () => Promise<{ files: Record<string, string>, catalog: AdvAssetManifest, program?: RuntimeProgram }>
  commit: (changes: AudioProjectFileChange[], media: AudioProjectMedia[]) => Promise<void>
  /** Read native bytes through the same bounded host file API as media imports. */
  readMedia?: (path: string) => Promise<ArrayBuffer>
  synthesize?: VoiceAuthoringAdapter['synthesize']
  /** Re-read persisted media, hash and profile boundaries before adopting a take. */
  verifySelection?: (take: VoiceTake, asset: AdvAssetEntry, catalog: AdvAssetManifest) => Promise<void>
}

function verifyConsentRecord(take: VoiceTake, files: Record<string, string>) {
  if (!take.rights)
    return
  const path = take.rights.consentRecord
  const segments = path.split('/')
  if (path.includes('\\') || path.includes(':') || segments.some(segment => !segment || segment === '.' || segment === '..' || ['.git', 'node_modules'].includes(segment.toLowerCase())))
    throw new Error('VOICE_CONSENT_RECORD_INVALID: Consent records must use canonical project document paths')
  if (!Object.hasOwn(files, path) || typeof files[path] !== 'string')
    throw new Error('VOICE_CONSENT_RECORD_MISSING: The project consent record must exist before registering or selecting a take')
}

/** Editor and Studio share this serialization and conflict protocol. */
export function createProjectAudioService(port: AudioProjectFilePort) {
  async function read() {
    const { files, catalog: sourceCatalog } = await port.read()
    const catalog = JSON.parse(JSON.stringify(sourceCatalog)) as AdvAssetManifest
    const ledger = parseVoiceLedger(files[VOICE_LEDGER_PATH] ? JSON.parse(files[VOICE_LEDGER_PATH]) : { schemaVersion: 1, lines: {} })
    const pronunciation = parseAudioPronunciationDictionary(files[AUDIO_PRONUNCIATION_PATH] ?? createAudioPronunciationDictionary())
    const voiceProfiles = parseAudioVoiceProfiles(files[AUDIO_VOICE_PROFILES_PATH] ?? createAudioVoiceProfiles())
    return { ledger, catalog, pronunciation, voiceProfiles, ...(voiceProfiles.narrator ? { narratorProfile: voiceProfiles.narrator } : {}), revision: await voiceAuthoringRevision(ledger, catalog, pronunciation, voiceProfiles) }
  }
  const voice = createVoiceAuthoringService({
    read,
    synthesize: port.synthesize,
    async verifyTake(input) {
      assertAudioId(input.lineId, 'line')
      assertAudioId(input.takeId, 'take')
      const current = await port.read()
      const ledger = parseVoiceLedger(current.files[VOICE_LEDGER_PATH] ? JSON.parse(current.files[VOICE_LEDGER_PATH]) : { schemaVersion: 1, lines: {} })
      const take = ledger.lines[input.lineId]?.locales[normalizeAudioLocale(input.locale)]?.takes.find(take => take.id === input.takeId)
      const asset = current.catalog.assets.find(asset => asset.id === take?.assetId)
      if (!take || !asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.sha256 !== take.sha256 || asset.state === 'rejected')
        throw new Error('VOICE_AUDIO_CHANGED: Cached media differs from its immutable take')
      verifyConsentRecord(take, current.files)
      if (!port.verifySelection)
        throw new Error('VOICE_AUDIO_VERIFICATION_REQUIRED: This host must verify immutable take media')
      await port.verifySelection(take, asset, current.catalog)
    },
    async commit(plan) {
      const current = await port.read()
      current.catalog = JSON.parse(JSON.stringify(current.catalog)) as AdvAssetManifest
      const ledger = parseVoiceLedger(current.files[VOICE_LEDGER_PATH] ? JSON.parse(current.files[VOICE_LEDGER_PATH]) : { schemaVersion: 1, lines: {} })
      const pronunciation = parseAudioPronunciationDictionary(current.files[AUDIO_PRONUNCIATION_PATH] ?? createAudioPronunciationDictionary())
      const voiceProfiles = parseAudioVoiceProfiles(current.files[AUDIO_VOICE_PROFILES_PATH] ?? createAudioVoiceProfiles())
      if (await voiceAuthoringRevision(ledger, current.catalog, pronunciation, voiceProfiles) !== plan.expectedRevision)
        throw new Error('VOICE_CONFLICT: Reload the project before applying audio changes')
      for (const take of plan.addedTakes)
        verifyConsentRecord(take, current.files)
      for (const [lineId, line] of Object.entries(plan.ledger.lines)) {
        for (const [locale, binding] of Object.entries(line.locales)) {
          if (!binding.selectedTake || binding.selectedTake === ledger.lines[lineId]?.locales[locale]?.selectedTake)
            continue
          const take = binding.takes.find(take => take.id === binding.selectedTake)
          const asset = plan.catalog.assets.find(asset => asset.id === take?.assetId)
          if (!take || !asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.sha256 !== take.sha256)
            throw new Error('VOICE_AUDIO_CHANGED: Selected media differs from its immutable take')
          verifyConsentRecord(take, current.files)
          if (!port.verifySelection)
            throw new Error('VOICE_AUDIO_VERIFICATION_REQUIRED: This host must verify selected take media')
          await port.verifySelection(take, asset, plan.catalog)
        }
      }
      const changes: AudioProjectFileChange[] = []
      if (plan.addedAssets.length) {
        const root = JSON.parse(current.files['adv/assets.json'] ?? '{}') as { includes?: string[], assets?: unknown[] }
        if (root.includes) {
          const path = 'adv/assets/audio.json'
          const fragment = current.files[path] ? JSON.parse(current.files[path]) : { schemaVersion: 2, assets: [] }
          fragment.assets.push(...plan.addedAssets)
          changes.push({ path, expected: current.files[path] ?? null, content: `${JSON.stringify(fragment, null, 2)}\n` })
          if (!root.includes.includes('assets/audio.json')) {
            root.includes.push('assets/audio.json')
            changes.push({ path: 'adv/assets.json', expected: current.files['adv/assets.json'] ?? null, content: `${JSON.stringify(root, null, 2)}\n` })
          }
        }
        else {
          changes.push({ path: 'adv/assets.json', expected: current.files['adv/assets.json'] ?? null, content: `${JSON.stringify({ ...root, assets: [...(root.assets ?? []), ...plan.addedAssets] }, null, 2)}\n` })
        }
      }
      changes.push({ path: VOICE_LEDGER_PATH, expected: current.files[VOICE_LEDGER_PATH] ?? null, content: serializeVoiceLedger(plan.ledger) })
      changes.push({ path: AUDIO_PRONUNCIATION_PATH, expected: current.files[AUDIO_PRONUNCIATION_PATH] ?? null, content: current.files[AUDIO_PRONUNCIATION_PATH] ?? null })
      changes.push({ path: AUDIO_VOICE_PROFILES_PATH, expected: current.files[AUDIO_VOICE_PROFILES_PATH] ?? null, content: current.files[AUDIO_VOICE_PROFILES_PATH] ?? null })
      await port.commit(changes, plan.media)
      return await read()
    },
  })
  async function readPronunciation() {
    const snapshot = await read()
    return { dictionary: snapshot.pronunciation, revision: snapshot.revision }
  }
  async function savePronunciation(input: { expectedRevision: string, dictionary: AudioPronunciationDictionary }) {
    const current = await port.read()
    const ledger = parseVoiceLedger(current.files[VOICE_LEDGER_PATH] ?? { schemaVersion: 1, lines: {} })
    const dictionary = parseAudioPronunciationDictionary(current.files[AUDIO_PRONUNCIATION_PATH] ?? createAudioPronunciationDictionary())
    const proposed = parseAudioPronunciationDictionary(input.dictionary)
    const voiceProfiles = parseAudioVoiceProfiles(current.files[AUDIO_VOICE_PROFILES_PATH] ?? createAudioVoiceProfiles())
    if (await voiceAuthoringRevision(ledger, JSON.parse(JSON.stringify(current.catalog)), dictionary, voiceProfiles) !== input.expectedRevision || proposed.revision !== dictionary.revision)
      throw new Error('VOICE_CONFLICT: Reload the project dictionary before saving')
    const next = parseAudioPronunciationDictionary({ ...proposed, revision: dictionary.revision + 1 })
    const paths = new Set([VOICE_LEDGER_PATH, AUDIO_VOICE_PROFILES_PATH, 'adv/assets.json', ...Object.keys(current.files).filter(path => /^adv\/assets\/.+\.json$/u.test(path))])
    const changes = [...paths].map(path => ({ path, expected: current.files[path] ?? null, content: current.files[path] ?? null }))
    changes.push({ path: AUDIO_PRONUNCIATION_PATH, expected: current.files[AUDIO_PRONUNCIATION_PATH] ?? null, content: serializeAudioPronunciationDictionary(next) })
    if (changes.length > 100)
      throw new Error('AUDIO_PROJECT_TRANSACTION_LIMIT: Too many catalog documents for one guarded transaction')
    await port.commit(changes, [])
    return await readPronunciation()
  }
  async function readVoiceProfiles() {
    const snapshot = await read()
    return { profiles: snapshot.voiceProfiles, revision: snapshot.revision }
  }
  async function saveVoiceProfiles(input: { expectedRevision: string, profiles: AudioVoiceProfiles }) {
    const current = await port.read()
    const ledger = parseVoiceLedger(current.files[VOICE_LEDGER_PATH] ?? { schemaVersion: 1, lines: {} })
    const pronunciation = parseAudioPronunciationDictionary(current.files[AUDIO_PRONUNCIATION_PATH] ?? createAudioPronunciationDictionary())
    const profiles = parseAudioVoiceProfiles(current.files[AUDIO_VOICE_PROFILES_PATH] ?? createAudioVoiceProfiles())
    const proposed = parseAudioVoiceProfiles(input.profiles)
    if (await voiceAuthoringRevision(ledger, JSON.parse(JSON.stringify(current.catalog)), pronunciation, profiles) !== input.expectedRevision || proposed.revision !== profiles.revision)
      throw new Error('VOICE_CONFLICT: Reload project voice profiles before saving')
    const next = parseAudioVoiceProfiles({ ...proposed, revision: profiles.revision + 1 })
    const paths = new Set([VOICE_LEDGER_PATH, AUDIO_PRONUNCIATION_PATH, 'adv/assets.json', ...Object.keys(current.files).filter(path => /^adv\/assets\/.+\.json$/u.test(path))])
    const changes = [...paths].map(path => ({ path, expected: current.files[path] ?? null, content: current.files[path] ?? null }))
    changes.push({ path: AUDIO_VOICE_PROFILES_PATH, expected: current.files[AUDIO_VOICE_PROFILES_PATH] ?? null, content: serializeAudioVoiceProfiles(next) })
    if (changes.length > 100)
      throw new Error('AUDIO_PROJECT_TRANSACTION_LIMIT')
    await port.commit(changes, [])
    return await readVoiceProfiles()
  }
  return { ...voice, ...createProjectAudioResourceService(port), readPronunciation, savePronunciation, readVoiceProfiles, saveVoiceProfiles }
}

/** Native hosts verify bytes before a take can become project data. */
export async function verifyVoiceCandidateBytes(candidate: Pick<AdvVoiceCandidate, 'sha256'> & Partial<Pick<AdvVoiceCandidate, 'bytes'>>, bytes: ArrayBuffer) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
  if ((candidate.bytes !== undefined && bytes.byteLength !== candidate.bytes) || hash !== candidate.sha256)
    throw new Error('VOICE_AUDIO_CHANGED: Candidate media differs from its immutable provenance')
}
