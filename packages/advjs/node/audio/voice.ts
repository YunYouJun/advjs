import type { AdvVoiceSynthesisResult, CharacterVoiceProfile, JsonObject, VoiceAuthoringEditPlan, VoiceAuthoringSnapshot, VoiceRights, VoiceTake, VoiceTakeSource } from '@advjs/types'
import type { VoicePreviewOptions } from '../commands/voice'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { normalizeAdvAssetManifest } from '@advjs/assets'
import { assertAudioId, AUDIO_PRONUNCIATION_PATH, AUDIO_VOICE_PROFILES_PATH, audioFingerprint, canonicalAudioJson, createAudioPronunciationDictionary, createAudioVoiceProfiles, createVoiceAuthoringService, createVoiceLedger, normalizeAudioLocale, parseAudioPronunciationDictionary, parseAudioVoiceProfiles, parseVoiceLedger, prepareVoiceSpokenText, serializeAudioPronunciationDictionary, serializeAudioVoiceProfiles, serializeVoiceLedger, validateVoiceRights, VOICE_DESIGN_LIBRARY_PATH, VOICE_LEDGER_PATH, voiceAuthoringRevision } from '@advjs/audio'
import { dirname, isAbsolute, relative, resolve } from 'pathe'
import { AdvCommandError } from '../commands/errors'
import { resolveAuthoringVoiceContext, runVoicePreview } from '../commands/voice'
import { readVoiceLibrary } from '../commands/voice-library'
import { loadAdvConfig } from '../config'
import { loadProject } from '../project'
import { withProjectWriteLock } from '../project/write-lock'
import { withVoiceProviderPermit } from './provider-permit'
import { assertVoiceSynthesisProvenance, canonicalVoiceGenerationParameters } from './voice-provenance'

interface AudioVoiceOptions extends VoicePreviewOptions {
  assetManifest?: string
}

function invalid(message: string): never {
  throw new AdvCommandError('ADV_VALIDATION', message)
}

function within(root: string, path: string): boolean {
  const coordinate = relative(root, path)
  return !isAbsolute(coordinate) && coordinate !== '..' && !coordinate.startsWith('../')
}

async function projectPath(root: string, coordinate: string): Promise<string> {
  if (!coordinate || isAbsolute(coordinate) || /^[a-z]+:/iu.test(coordinate) || !within(root, resolve(root, coordinate)))
    invalid('Audio project files and media must remain inside the project')
  const target = resolve(root, coordinate)
  let ancestor = target
  while (true) {
    try {
      const canonical = await realpath(ancestor)
      if (!within(root, canonical))
        invalid('Audio project file resolves outside the project')
      break
    }
    catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT')
        throw error
      if (ancestor === root)
        throw error
      ancestor = dirname(ancestor)
    }
  }
  return target
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return null
    throw error
  }
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function canonicalConsentCoordinate(path: string) {
  const segments = path.split('/')
  if (path.includes('\\') || path.includes(':') || segments.some(segment => !segment || segment === '.' || segment === '..' || ['.git', 'node_modules'].includes(segment.toLowerCase())))
    invalid('VOICE_CONSENT_RECORD_INVALID: Consent records must use canonical project document paths')
}

async function verifyConsentRecord(root: string, take: Pick<VoiceTake, 'rights'>) {
  if (!take.rights)
    return
  canonicalConsentCoordinate(take.rights.consentRecord)
  const target = await projectPath(root, take.rights.consentRecord)
  let canonical: string
  try {
    canonical = await realpath(target)
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      invalid('VOICE_CONSENT_RECORD_MISSING: The project consent record must exist before registering or selecting a take')
    throw error
  }
  if (!within(root, canonical) || !(await stat(canonical)).isFile())
    invalid('VOICE_CONSENT_RECORD_INVALID: Consent records must resolve to existing project files')
  canonicalConsentCoordinate(relative(root, canonical))
}

async function readDocuments(root: string, manifestCoordinate = 'adv/assets.json') {
  const manifestPath = await projectPath(root, manifestCoordinate)
  const sourceText = await readFile(manifestPath, 'utf8')
  const source = JSON.parse(sourceText) as Record<string, unknown>
  if (!source || typeof source !== 'object' || Array.isArray(source) || source.schemaVersion !== 2)
    invalid('Dialogue takes require the native schemaVersion 2 asset catalog')
  const originals = new Map<string, string | null>([[manifestPath, sourceText]])
  const assets: unknown[] = []
  if (Array.isArray(source.includes)) {
    if (source.assets !== undefined)
      invalid('Asset catalog cannot combine includes and inline assets')
    for (const include of source.includes) {
      if (typeof include !== 'string' || isAbsolute(include) || /^[a-z]+:/iu.test(include))
        invalid('Invalid audio asset catalog include')
      const path = await projectPath(root, relative(root, resolve(dirname(manifestPath), include)))
      if (originals.has(path))
        invalid('Duplicate asset catalog fragment')
      const raw = await readFile(path, 'utf8')
      originals.set(path, raw)
      const fragment = JSON.parse(raw) as Record<string, unknown>
      if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
        invalid('Invalid asset catalog fragment')
      assets.push(...fragment.assets)
    }
  }
  else {
    if (!Array.isArray(source.assets))
      invalid('Asset catalog must contain assets or includes')
    assets.push(...source.assets)
  }
  const { includes: _includes, ...base } = source
  const catalog = JSON.parse(JSON.stringify(normalizeAdvAssetManifest({ ...base, assets }, { allowEmpty: true }))) as VoiceAuthoringSnapshot['catalog']
  const ledgerPath = await projectPath(root, VOICE_LEDGER_PATH)
  const ledgerText = await readOptional(ledgerPath)
  originals.set(ledgerPath, ledgerText)
  const ledger = ledgerText === null ? createVoiceLedger() : parseVoiceLedger(ledgerText)
  const pronunciationPath = await projectPath(root, AUDIO_PRONUNCIATION_PATH)
  const pronunciationText = await readOptional(pronunciationPath)
  originals.set(pronunciationPath, pronunciationText)
  const pronunciation = parseAudioPronunciationDictionary(pronunciationText ?? createAudioPronunciationDictionary())
  const voiceProfilesPath = await projectPath(root, AUDIO_VOICE_PROFILES_PATH)
  const voiceProfilesText = await readOptional(voiceProfilesPath)
  originals.set(voiceProfilesPath, voiceProfilesText)
  const voiceProfiles = parseAudioVoiceProfiles(voiceProfilesText ?? createAudioVoiceProfiles())
  const revision = await voiceAuthoringRevision(ledger, catalog, pronunciation, voiceProfiles)
  return { snapshot: { revision, ledger, catalog, pronunciation, voiceProfiles, ...(voiceProfiles.narrator ? { narratorProfile: voiceProfiles.narrator } : {}) } satisfies VoiceAuthoringSnapshot, originals, source, manifestPath, ledgerPath, pronunciationPath, voiceProfilesPath }
}

async function writeAtomic(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, text, { flag: 'wx' })
    await rename(temporary, path)
  }
  finally {
    await rm(temporary, { force: true })
  }
}

/** Node filesystem adapter. Cooperating Editor/CLI writers use the same project lock. */
export async function createNodeVoiceAuthoringService(options: AudioVoiceOptions = {}, hooks: { verifyBeforeCommit?: () => Promise<void> } = {}) {
  const root = await realpath(resolve(options.root ?? process.cwd()))
  const { config } = await loadAdvConfig({ userRoot: root, advConfig: options.config })
  const manifestCoordinate = options.assetManifest ?? config.authoring?.voice?.assetManifest ?? 'adv/assets.json'
  const service = createVoiceAuthoringService({
    read: async () => (await readDocuments(root, manifestCoordinate)).snapshot,
    async verifyTake(input) {
      assertAudioId(input.lineId, 'line')
      assertAudioId(input.takeId, 'take')
      const { snapshot } = await readDocuments(root, manifestCoordinate)
      const take = snapshot.ledger.lines[input.lineId]?.locales[normalizeAudioLocale(input.locale)]?.takes.find(take => take.id === input.takeId)
      const asset = snapshot.catalog.assets.find(asset => asset.id === take?.assetId)
      if (!take || !asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.sha256 !== take.sha256 || asset.state === 'rejected')
        invalid('VOICE_AUDIO_CHANGED: Cached media differs from its immutable take')
      await verifyConsentRecord(root, take)
      const profile = snapshot.catalog.profiles[snapshot.catalog.defaultProfile]
      if (profile?.provider !== 'project' || !asset.path)
        invalid('Cached takes require their verified local media cache')
      const profileRoot = await projectPath(root, profile.root ?? '.')
      const file = await projectPath(root, relative(root, resolve(profileRoot, asset.path)))
      const canonical = await realpath(file)
      if (!within(profileRoot, canonical) || !(await stat(canonical)).isFile())
        invalid('Cached Voice media resolves outside its profile or is not a file')
      const bytes = await readFile(canonical)
      if (digest(bytes) !== take.sha256 || (asset.bytes !== undefined && bytes.length !== asset.bytes))
        invalid('Cached Voice media hash or size differs from the immutable take')
    },
    synthesize: async (line, signal) => {
      const project = await loadProject({ root, allowEmptyAssetManifest: true })
      const snapshot = (await readDocuments(root, manifestCoordinate)).snapshot
      const profile = line.speakerId === 'narrator' ? snapshot.narratorProfile : project.result.project.characters.find(character => character.id === line.speakerId)?.voiceProfile
      const effective = await appliedVoiceOptions({ ...options, root }, line.speakerId, line.locale, profile)
      const context = await resolveAuthoringVoiceContext(effective)
      const backend = 'capabilities' in context.provider ? context.provider.capabilities.backend : 'local'
      const result = await withVoiceProviderPermit(context.provider.id, backend === 'local' ? 1 : 3, signal ?? new AbortController().signal, () => runVoicePreview({ ...effective, signal, list: false, character: line.speakerId, text: line.text }))
      if (!('candidates' in result) || !result.candidates)
        invalid('Dialogue takes require a normalized synthesis provider')
      return result as AdvVoiceSynthesisResult
    },
    async commit(plan: VoiceAuthoringEditPlan) {
      return await withProjectWriteLock(root, async () => {
        options.signal?.throwIfAborted()
        const loaded = await readDocuments(root, manifestCoordinate)
        if (loaded.snapshot.revision !== plan.expectedRevision)
          invalid('VOICE_CONFLICT: Project audio files changed; reload before applying')
        await hooks.verifyBeforeCommit?.()
        // Plans may add immutable takes or change selections; they never rewrite history.
        const ledger = parseVoiceLedger(plan.ledger)
        const existingTakes = Object.values(loaded.snapshot.ledger.lines).flatMap(line => Object.values(line.locales).flatMap(locale => locale.takes))
        const plannedTakes = Object.values(ledger.lines).flatMap(line => Object.values(line.locales).flatMap(locale => locale.takes))
        for (const take of existingTakes) {
          if (!plannedTakes.some(value => value.id === take.id && canonicalAudioJson(value) === canonicalAudioJson(take)))
            invalid('VOICE_CONFLICT: Immutable take history cannot be replaced')
        }
        const expectedAssets = [...loaded.snapshot.catalog.assets, ...plan.addedAssets]
        if (canonicalAudioJson(plan.catalog) !== canonicalAudioJson({ ...loaded.snapshot.catalog, assets: expectedAssets }))
          invalid('Voice take registration cannot modify unrelated catalog entries')
        for (const take of plan.addedTakes)
          await verifyConsentRecord(root, take)
        const profile = plan.catalog.profiles[plan.catalog.defaultProfile]
        if (plan.media.length && profile?.provider !== 'project')
          invalid('Voice take import requires the catalog default profile to be a project profile')
        for (const [lineId, line] of Object.entries(ledger.lines)) {
          for (const [locale, binding] of Object.entries(line.locales)) {
            if (!binding.selectedTake || binding.selectedTake === loaded.snapshot.ledger.lines[lineId]?.locales[locale]?.selectedTake)
              continue
            const take = binding.takes.find(take => take.id === binding.selectedTake)!
            await verifyConsentRecord(root, take)
            const asset = plan.catalog.assets.find(asset => asset.id === take.assetId)!
            if (profile?.provider !== 'project' || !asset.path)
              invalid('Selecting a take requires its verified local media cache')
            const profileRoot = await projectPath(root, profile.root ?? '.')
            const file = await projectPath(root, relative(root, resolve(profileRoot, asset.path)))
            const canonical = await realpath(file)
            if (!within(profileRoot, canonical) || !(await stat(canonical)).isFile())
              invalid('Selected Voice media resolves outside its profile or is not a file')
            const bytes = await readFile(canonical)
            if (digest(bytes) !== take.sha256 || (asset.bytes !== undefined && bytes.length !== asset.bytes))
              invalid('Selected Voice media hash or size differs from the immutable take')
          }
        }
        const writes = new Map<string, string>()
        const audioFragment = resolve(dirname(loaded.manifestPath), 'assets/audio.json')
        if (plan.addedAssets.length) {
          if (Array.isArray(loaded.source.includes)) {
            const coordinate = relative(dirname(loaded.manifestPath), audioFragment)
            const raw = loaded.originals.get(audioFragment) ?? await readOptional(await projectPath(root, relative(root, audioFragment)))
            loaded.originals.set(audioFragment, raw)
            const fragment = raw === null ? { schemaVersion: 2, assets: [] } : JSON.parse(raw)
            if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
              invalid('Audio catalog fragment must declare schemaVersion 2 and assets')
            writes.set(audioFragment, `${JSON.stringify({ ...fragment, assets: [...fragment.assets, ...plan.addedAssets] }, null, 2)}\n`)
            if (!loaded.source.includes.includes(coordinate))
              writes.set(loaded.manifestPath, `${JSON.stringify({ ...loaded.source, includes: [...loaded.source.includes, coordinate] }, null, 2)}\n`)
          }
          else {
            writes.set(loaded.manifestPath, `${JSON.stringify({ ...loaded.source, assets: [...(loaded.source.assets as unknown[]), ...plan.addedAssets] }, null, 2)}\n`)
          }
        }
        writes.set(loaded.ledgerPath, serializeVoiceLedger(ledger))
        const copied: string[] = []
        const completedWrites: string[] = []
        try {
          for (const { candidate, asset } of plan.media) {
            options.signal?.throwIfAborted()
            const source = await projectPath(root, candidate.path)
            const canonicalSource = await realpath(source)
            if (!within(root, canonicalSource) || !(await stat(canonicalSource)).isFile())
              invalid('Voice candidate is not an in-project file')
            const bytes = await readFile(canonicalSource)
            if (bytes.length !== candidate.bytes || digest(bytes) !== candidate.sha256 || asset.sha256 !== candidate.sha256)
              invalid('Voice candidate hash or size changed before import')
            const profileRoot = await projectPath(root, profile!.root ?? '.')
            const destination = await projectPath(root, relative(root, resolve(profileRoot, asset.path!)))
            if (!within(profileRoot, destination))
              invalid('Voice media path escapes the asset profile root')
            await mkdir(dirname(destination), { recursive: true })
            // Persist the verified bytes, not a second read of a mutable source.
            const mediaFile = await open(destination, 'wx')
            copied.push(destination)
            try {
              await mediaFile.writeFile(bytes)
            }
            finally {
              await mediaFile.close()
            }
          }
          // Recheck all input bytes under the lock before the catalog and ledger commit.
          for (const [path, original] of loaded.originals) {
            if (await readOptional(path) !== original)
              invalid('VOICE_CONFLICT: Audio project files changed during import')
          }
          await hooks.verifyBeforeCommit?.()
          for (const [path, text] of writes) {
            options.signal?.throwIfAborted()
            await writeAtomic(await projectPath(root, relative(root, path)), text)
            completedWrites.push(path)
          }
          options.signal?.throwIfAborted()
        }
        catch (error) {
          for (const path of completedWrites.reverse()) {
            const original = loaded.originals.get(path)
            if (original === null || original === undefined)
              await rm(path, { force: true })
            else
              await writeAtomic(path, original)
          }
          for (const path of copied)
            await rm(path, { force: true })
          throw error
        }
        return (await readDocuments(root, manifestCoordinate)).snapshot
      })
    },
  })
  return {
    ...service,
    async readPronunciation() {
      const snapshot = await service.read()
      return { dictionary: snapshot.pronunciation!, revision: snapshot.revision }
    },
    async savePronunciation(input: { expectedRevision: string, dictionary: NonNullable<VoiceAuthoringSnapshot['pronunciation']> }) {
      return await withProjectWriteLock(root, async () => {
        const loaded = await readDocuments(root, manifestCoordinate)
        const proposed = parseAudioPronunciationDictionary(input.dictionary)
        if (loaded.snapshot.revision !== input.expectedRevision || proposed.revision !== loaded.snapshot.pronunciation.revision)
          invalid('VOICE_CONFLICT: Reload the dictionary before saving')
        const dictionary = parseAudioPronunciationDictionary({ ...proposed, revision: proposed.revision + 1 })
        await writeAtomic(loaded.pronunciationPath, serializeAudioPronunciationDictionary(dictionary))
        const snapshot = (await readDocuments(root, manifestCoordinate)).snapshot
        return { dictionary: snapshot.pronunciation, revision: snapshot.revision }
      })
    },
    async readVoiceProfiles() {
      const snapshot = await service.read()
      return { profiles: snapshot.voiceProfiles!, revision: snapshot.revision }
    },
    async saveVoiceProfiles(input: { expectedRevision: string, profiles: NonNullable<VoiceAuthoringSnapshot['voiceProfiles']> }) {
      return await withProjectWriteLock(root, async () => {
        const loaded = await readDocuments(root, manifestCoordinate)
        const proposed = parseAudioVoiceProfiles(input.profiles)
        if (loaded.snapshot.revision !== input.expectedRevision || proposed.revision !== loaded.snapshot.voiceProfiles.revision)
          invalid('VOICE_CONFLICT: Reload project voice profiles before saving')
        const profiles = parseAudioVoiceProfiles({ ...proposed, revision: proposed.revision + 1 })
        await writeAtomic(loaded.voiceProfilesPath, serializeAudioVoiceProfiles(profiles))
        const snapshot = (await readDocuments(root, manifestCoordinate)).snapshot
        return { profiles: snapshot.voiceProfiles, revision: snapshot.revision }
      })
    },
  }
}

async function appliedVoiceOptions<T extends AudioVoiceOptions>(options: T, speakerId: string, locale: string, profile: CharacterVoiceProfile | undefined): Promise<T> {
  if (!profile?.locales?.[locale])
    return options
  const context = await resolveAuthoringVoiceContext(options)
  const binding = profile.locales[locale]!.providers[context.provider.id]
  if (!binding?.projectVoiceId)
    return options
  if (options.voice && options.voice !== binding.projectVoiceId)
    invalid('VOICE_PROFILE_MISMATCH: Explicit voice differs from the applied native profile')
  const library = await readVoiceLibrary(context.context.root, context.voice.library ?? VOICE_DESIGN_LIBRARY_PATH)
  const voice = library.library.voices.find(voice => voice.id === binding.projectVoiceId)
  if (!voice?.design || voice.characterId !== speakerId || voice.version !== binding.projectVoiceVersion)
    invalid('VOICE_PROFILE_MISMATCH: Applied design identity or version changed')
  return { ...options, voice: binding.projectVoiceId, locale }
}

export async function runVoiceLedger(options: AudioVoiceOptions = {}): Promise<VoiceAuthoringSnapshot> {
  return await (await createNodeVoiceAuthoringService(options)).read()
}

export interface GenerateVoiceTakeOptions extends AudioVoiceOptions {
  lineId: string
  locale: string
  expectedRevision: string
  speakerId?: string
  displayText?: string
  spokenText?: string
  providerVoiceId?: string
  voiceProfileRevision?: string
  source?: VoiceTakeSource
  rights?: VoiceRights
}

async function reviewedCharacterSource(root: string, speakerId: string) {
  const project = await loadProject({ root, allowEmptyAssetManifest: true })
  if (project.result.project.root !== 'adv')
    invalid('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Native audio authoring requires the adv content root')
  if (project.result.diagnostics.some(diagnostic => ['ADV_PROJECT_INVALID_CHARACTER', 'ADV_PROJECT_DUPLICATE_CHARACTER'].includes(diagnostic.code)))
    invalid('VOICE_PROFILE_MISMATCH: Fix invalid or duplicate project characters before synthesis')
  const character = project.result.project.characters.find(character => character.id === speakerId)
  const sourcePath = project.result.sourceMap.characters[speakerId]
  return { profile: character?.voiceProfile, revision: await audioFingerprint({ character: character ?? null, sourcePath: sourcePath ?? null, source: sourcePath ? project.files[sourcePath] ?? null : null }) }
}

async function reviewedDialogueSource(root: string, lineId: string) {
  const project = await loadProject({ root, allowEmptyAssetManifest: true })
  if (Object.keys(project.files).some(path => path.startsWith('adv/chapters/') && /(?:\.adv\.md|\.chapter\.json)$/u.test(path))
    && project.result.diagnostics.some(issue => issue.severity === 'error')) {
    invalid('VOICE_SOURCE_INVALID: Fix project compilation errors before dialogue synthesis')
  }
  const chapter = Object.values(project.result.project.program?.chapters ?? {}).find(chapter => Object.values(chapter.nodes).some(node => node.data?.lineId === lineId))
  const node = chapter ? Object.values(chapter.nodes).find(node => node.data?.lineId === lineId) : undefined
  const sourceLocale = normalizeAudioLocale(typeof project.result.project.game.locale === 'string' ? project.result.project.game.locale : 'zh-CN')
  const sourceFiles = chapter ? (project.result.sourceMap.chapters[chapter.id] ?? []).map(path => [path, project.files[path] ?? null]) : []
  return { node, sourceLocale, revision: await audioFingerprint(JSON.parse(JSON.stringify({ node: node ?? null, sourceLocale, sourceFiles }))) }
}

/** Generate a candidate through the existing registry, then register an unselected take. */
export async function runVoiceGenerateTake(options: GenerateVoiceTakeOptions): Promise<VoiceAuthoringSnapshot> {
  if (options.voiceProfileRevision !== undefined && !/^[a-f0-9]{64}$/u.test(options.voiceProfileRevision))
    invalid('Voice Profile revision must be a SHA-256 hash before synthesis')
  if (options.providerVoiceId !== undefined && !options.providerVoiceId.trim())
    invalid('Actual provider voice ID must not be empty')
  const projectRoot = await realpath(resolve(options.root ?? process.cwd()))
  let characterReview: Awaited<ReturnType<typeof reviewedCharacterSource>> | undefined
  let presetReview: { path: string, source: string } | undefined
  let reviewedSpeakerId: string | undefined
  let dialogueReview: Awaited<ReturnType<typeof reviewedDialogueSource>> | undefined
  async function verifyReview() {
    if (dialogueReview && (await reviewedDialogueSource(projectRoot, options.lineId)).revision !== dialogueReview.revision)
      invalid('VOICE_CONFLICT: The reviewed dialogue source changed during synthesis')
    if (characterReview && reviewedSpeakerId && (await reviewedCharacterSource(projectRoot, reviewedSpeakerId)).revision !== characterReview.revision)
      invalid('VOICE_CONFLICT: The reviewed project character changed during synthesis')
    if (presetReview && await readFile(presetReview.path, 'utf8') !== presetReview.source)
      invalid('VOICE_CONFLICT: The inspected voice preset changed during synthesis')
  }
  const service = await createNodeVoiceAuthoringService(options, { verifyBeforeCommit: verifyReview })
  const snapshot = await service.read()
  if (snapshot.revision !== options.expectedRevision)
    invalid('VOICE_CONFLICT: Audio documents changed before synthesis')
  const existing = snapshot.ledger.lines[options.lineId]
  const locale = normalizeAudioLocale(options.locale)
  const localized = existing?.locales[locale]
  dialogueReview = await reviewedDialogueSource(projectRoot, options.lineId)
  const currentText = typeof dialogueReview.node?.data?.text === 'string' ? dialogueReview.node.data.text : undefined
  const currentSpeaker = dialogueReview.node ? dialogueReview.node.kind === 'narration' ? 'narrator' : dialogueReview.node.data?.speakerId : undefined
  if (currentSpeaker && options.speakerId && options.speakerId !== currentSpeaker)
    invalid('VOICE_CONFLICT: The requested speaker differs from the current dialogue source')
  const speakerId = options.speakerId ?? (typeof currentSpeaker === 'string' ? currentSpeaker : existing?.speakerId)
  const sourceText = locale === dialogueReview.sourceLocale ? currentText : localized?.displayText ?? existing?.displayText ?? currentText
  const explicitText = options.displayText ?? options.text
  if (locale === dialogueReview.sourceLocale && currentText !== undefined && explicitText !== undefined && explicitText !== currentText)
    invalid('VOICE_CONFLICT: Source-language synthesis requires the current dialogue text')
  const displayText = explicitText ?? sourceText ?? localized?.displayText ?? existing?.displayText
  const spokenText = options.spokenText ?? localized?.spokenText ?? existing?.spokenText
  if (!speakerId || !displayText)
    invalid('A new dialogue take requires a speaker ID and display text')
  reviewedSpeakerId = speakerId
  if (speakerId !== 'narrator')
    characterReview = await reviewedCharacterSource(projectRoot, speakerId)
  const nativeProfile: CharacterVoiceProfile | undefined = speakerId === 'narrator' ? snapshot.narratorProfile : characterReview?.profile
  options = await appliedVoiceOptions(options, speakerId, locale, nativeProfile)
  let reviewedProfileRevision: string | undefined
  let profileLibraryPath: string | undefined
  if (options.voice) {
    const { config } = await loadAdvConfig({ userRoot: projectRoot, advConfig: options.config })
    profileLibraryPath = config.authoring?.voice?.library ?? VOICE_DESIGN_LIBRARY_PATH
    const library = await readVoiceLibrary(projectRoot, profileLibraryPath)
    const profile = library.library.voices.find(voice => voice.id === options.voice)
    if (!profile)
      invalid('Unknown project Voice Profile')
    reviewedProfileRevision = await audioFingerprint(profile)
  }
  // Inspect through the same registry before incurring synthesis or downloads.
  const prepared = await prepareVoiceSpokenText(displayText, { override: spokenText, locale, pronunciation: snapshot.pronunciation })
  const inspected = await runVoicePreview({ ...options, list: true, character: speakerId, text: prepared.text })
  let effectiveSource = options.source
  let effectiveRights = options.rights
  let nativeProfileRevision: string | undefined
  const actual = 'characters' in inspected ? inspected.characters.find(character => character.id === speakerId)?.generation : undefined
  if (speakerId === 'narrator' || nativeProfile) {
    const profile = nativeProfile
    const binding = profile?.locales?.[locale]?.providers[inspected.provider]
    if (!profile || !binding || !actual || binding.voiceId !== actual.providerVoiceId || binding.model !== actual.model || binding.source !== actual.source
      || (options.providerVoiceId !== undefined && options.providerVoiceId !== actual.providerVoiceId) || (options.source !== undefined && options.source !== binding.source)
      || (options.rights !== undefined && canonicalAudioJson(options.rights) !== canonicalAudioJson(binding.rights ?? null))) {
      invalid('VOICE_PROFILE_MISMATCH: Synthesis needs its exact-locale project profile and inspected provider identity')
    }
    nativeProfileRevision = await audioFingerprint(profile)
    if (options.voiceProfileRevision !== undefined && options.voiceProfileRevision !== nativeProfileRevision)
      invalid('VOICE_PROFILE_MISMATCH: The supplied profile revision differs from the native project profile')
    effectiveSource ??= binding.source
    effectiveRights ??= binding.rights
  }
  if (actual && ((options.source !== undefined && options.source !== actual.source) || (options.providerVoiceId !== undefined && options.providerVoiceId !== actual.providerVoiceId)))
    invalid('VOICE_PROFILE_MISMATCH: Explicit source and voice identity must match provider inspection')
  effectiveSource ??= actual?.source
  const requiresConsent = 'characters' in inspected && inspected.characters.some(character => character.referenceAssetId)
  if (effectiveSource === 'recorded')
    invalid('Synthesis cannot claim a recorded voice source; import recorded media instead')
  if (requiresConsent && effectiveSource !== undefined && effectiveSource !== 'cloned')
    invalid('Reference-conditioned synthesis must retain its cloned source')
  if (effectiveRights)
    validateVoiceRights(effectiveRights)
  if ((requiresConsent || effectiveSource === 'cloned') && !effectiveRights)
    invalid('Reference-conditioned takes require rights and a project consent record before generation')
  if (effectiveRights) {
    await verifyConsentRecord(projectRoot, { rights: effectiveRights })
  }
  if (!('configPath' in inspected))
    invalid('Dialogue take generation requires read-only preset inspection')
  const presetSource = await readFile(inspected.configPath, 'utf8')
  presetReview = { path: inspected.configPath, source: presetSource }
  const presetHash = createHash('sha256').update(presetSource).digest('hex')
  const designParameters: JsonObject = options.voice && nativeProfile?.locales?.[locale]?.providers[inspected.provider]?.projectVoiceId ? { projectVoiceId: options.voice, projectVoiceVersion: nativeProfile.locales[locale]!.providers[inspected.provider]!.projectVoiceVersion!, locale } : {}
  const canonicalParameters: JsonObject | undefined = actual ? { ...canonicalVoiceGenerationParameters(inspected, speakerId, presetHash), ...designParameters } : undefined
  await verifyReview()
  const result = await service.synthesize({ lineId: options.lineId, locale, speakerId, displayText, expectedRevision: snapshot.revision, ...(spokenText === undefined ? {} : { spokenText }) }, options.signal)
  if (result.provider !== inspected.provider || result.preset !== inspected.preset || await readFile(inspected.configPath, 'utf8') !== presetSource)
    invalid('VOICE_CONFLICT: The inspected voice implementation changed during synthesis')
  if (actual && canonicalParameters) {
    assertVoiceSynthesisProvenance(result, { providerId: inspected.provider, preset: inspected.preset, speakerId, voiceId: actual.providerVoiceId, model: actual.model, mimeType: actual.mimeType, parameters: canonicalParameters })
    const refreshed = await runVoicePreview({ ...options, list: true, character: speakerId, text: prepared.text })
    if (!('characters' in refreshed) || refreshed.provider !== inspected.provider || refreshed.preset !== inspected.preset || canonicalAudioJson(refreshed.characters.find(character => character.id === speakerId)?.generation ?? null) !== canonicalAudioJson(actual)
      || canonicalAudioJson({ ...canonicalVoiceGenerationParameters(refreshed, speakerId, presetHash), ...designParameters }) !== canonicalAudioJson(canonicalParameters)) {
      invalid('VOICE_CONFLICT: The inspected provider provenance changed during synthesis')
    }
  }
  await verifyReview()
  const candidate = result.candidates[0]!
  const voiceId = options.providerVoiceId ?? candidate.providerVoiceId
  const source = effectiveSource ?? actual?.source ?? (voiceId?.startsWith('reference:') ? 'cloned' : voiceId?.startsWith('design:') ? 'designed' : 'system')
  let voiceProfileRevision = nativeProfileRevision ?? options.voiceProfileRevision ?? presetHash
  if (options.voice) {
    const root = await realpath(resolve(options.root ?? process.cwd()))
    const { config } = await loadAdvConfig({ userRoot: root, advConfig: options.config })
    const library = await readVoiceLibrary(root, profileLibraryPath ?? config.authoring?.voice?.library)
    const profile = library.library.voices.find(voice => voice.id === options.voice)
    if (!profile)
      invalid('Unknown project Voice Profile')
    const libraryRevision = await audioFingerprint(profile)
    if (libraryRevision !== reviewedProfileRevision)
      invalid('VOICE_CONFLICT: The reviewed Voice Profile changed during synthesis')
    if (!nativeProfileRevision)
      voiceProfileRevision = libraryRevision
  }
  if (!voiceProfileRevision)
    invalid('The generated candidate lacks a frozen Voice Profile revision')
  options.signal?.throwIfAborted()
  const extension = candidate.mimeType === 'audio/wav' ? 'wav' : candidate.mimeType === 'audio/mpeg' ? 'mp3' : candidate.mimeType === 'audio/ogg' ? 'ogg' : undefined
  if (!extension)
    invalid('Voice candidate format is not supported for local take registration')
  const parameters: JsonObject = canonicalParameters ?? {}
  for (const field of canonicalParameters ? [] : ['seed', 'generationMode', 'temperature', 'maxTokens', 'language', 'topK', 'topP', 'repetitionPenalty', 'engine', 'engineVersion', 'runtimeVersions', 'presetSha256']) {
    if (result.manifest[field] !== undefined)
      parameters[field] = result.manifest[field]!
  }
  const inputs = result.manifest.inputs
  if (!canonicalParameters && Array.isArray(inputs)) {
    const actual = inputs.find(input => input && typeof input === 'object' && !Array.isArray(input) && input.characterId === speakerId)
    if (actual && typeof actual === 'object' && !Array.isArray(actual)) {
      for (const field of ['speed', 'instructions']) {
        if (actual[field] !== undefined)
          parameters[field] = actual[field]!
      }
    }
  }
  const assetPath = `audio/voice/${locale.toLowerCase()}/${speakerId}/${options.lineId}/${randomUUID()}.${candidate.sha256}.${extension}`
  return await service.register({ lineId: options.lineId, locale, speakerId, displayText, ...(spokenText === undefined ? {} : { spokenText }), candidate, assetPath, voiceProfileRevision, ...(options.providerVoiceId === undefined ? {} : { providerVoiceId: options.providerVoiceId }), source, ...(effectiveRights === undefined ? {} : { rights: effectiveRights }), parameters, expectedRevision: options.expectedRevision })
}

/** Bind a reviewed existing take. Replacing or clearing a selection is explicit. */
export async function runVoiceBindTake(options: AudioVoiceOptions & { lineId: string, locale: string, takeId: string | null, expectedRevision: string, replaceSelected?: boolean }): Promise<VoiceAuthoringSnapshot> {
  return await (await createNodeVoiceAuthoringService(options)).select(options)
}
