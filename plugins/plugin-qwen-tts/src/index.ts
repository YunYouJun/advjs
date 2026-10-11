import type { AdvVoiceContext, AdvVoiceDoctorResult, AdvVoicePresetInspection, AdvVoicePreviewRequest, AdvVoicePreviewResult, AdvVoiceProvider, AdvVoiceSetupResult, AdvVoiceSynthesisProvider, AdvVoiceSynthesisRequest, AdvVoiceSynthesisResult, CharacterVoiceProfile, JsonObject } from '@advjs/types'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { executeCommand, fileDigest, resolveProjectPath, resolveProjectRoot } from './runtime'

const requirements = fileURLToPath(new URL('../python/requirements.txt', import.meta.url))
const previewScript = fileURLToPath(new URL('../python/preview.py', import.meta.url))
const providerId = 'qwen-tts'
const sha256Pattern = /^[a-f0-9]{64}$/
const characterIdPattern = /^[a-z0-9][\w-]*$/i
// Language names accepted by Qwen3-TTS VoiceDesign and Base. Regions remain in
// the authoring locale; the model receives the supported base language.
const qwenLanguages: Readonly<Record<string, string>> = {
  zh: 'Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  de: 'German',
  fr: 'French',
  ru: 'Russian',
  pt: 'Portuguese',
  es: 'Spanish',
  it: 'Italian',
}

function designLanguage(locale: string): string {
  try {
    const language = typeof locale === 'string' && qwenLanguages[new Intl.Locale(locale).language]
    if (language)
      return language
  }
  catch { /* Unsupported or malformed locales must not fall back to Chinese. */ }
  throw new Error('VOICE_DESIGN_LOCALE_UNSUPPORTED')
}

/** Qualitative author preferences become model instructions, without acoustic guarantees. */
function designInstructions(description: string, intent: CharacterVoiceProfile['intent']): string {
  const directions: string[] = []
  const add = (label: string, value?: string) => {
    if (value?.trim())
      directions.push(`${label}: ${value.trim()}`)
  }
  add('Age impression', intent.ageImpression)
  add('Gender expression', intent.genderExpression)
  add('Temperament', intent.temperament?.filter(value => value.trim()).join(', '))
  add('Speaking style', intent.speakingStyle)
  add('Preferred pitch', intent.pitch)
  add('Preferred pace', intent.pace)
  return directions.length ? `${description}\n\nVoice characteristics:\n${directions.join('\n')}` : description
}

interface LocalEnvironment {
  root: string
  directory: string
  python: string
  stamp: string
  modelCache: string
}

interface PreviewConfig {
  version: string
  model: string
  revision: string
  weightSha256: Record<string, string>
  characters: Array<{
    id: string
    name?: string
    text: string
    description?: string
    card?: string
    reference?: { assetId: string, sha256: string, text?: string }
  }>
}

async function localEnvironment(rootPath: string): Promise<LocalEnvironment> {
  const root = await resolveProjectRoot(rootPath)
  const directory = await resolveProjectPath(root, '.advjs/voice', 'Voice environment')
  return {
    root,
    directory,
    // uv links the interpreter to its managed Python installation outside the project.
    python: resolve(await resolveProjectPath(root, resolve(directory, '.venv/bin'), 'Python environment'), 'python'),
    stamp: await resolveProjectPath(root, resolve(directory, 'requirements.sha256'), 'Environment stamp'),
    modelCache: await resolveProjectPath(root, resolve(directory, 'huggingface'), 'Model cache'),
  }
}

function requirePlatform(): void {
  if (process.platform !== 'darwin' || process.arch !== 'arm64')
    throw new Error('The Qwen MLX provider requires an Apple Silicon Mac (darwin arm64)')
}

async function environmentReady(environment: LocalEnvironment): Promise<boolean> {
  const [digest, installed, pythonExists] = await Promise.all([
    fileDigest(requirements),
    readFile(environment.stamp, 'utf8').catch(() => ''),
    stat(environment.python).then(info => info.isFile()).catch(() => false),
  ])
  return pythonExists && installed.trim() === digest
}

async function inspectRuntime(environment: LocalEnvironment, context: AdvVoiceContext): Promise<{ ready: boolean, versions: string }> {
  const versions = await executeCommand(environment.python, ['-c', 'import importlib.metadata,json;print(json.dumps({name:importlib.metadata.version(name) for name in ("mlx-audio","mlx","transformers","numpy")}))'], { ...context, root: environment.root })
  const parsed = record(JSON.parse(versions), 'Runtime versions')
  const ready = parsed['mlx-audio'] === '0.5.8' && parsed.mlx === '0.32.3' && parsed.transformers === '5.19.0' && parsed.numpy === '2.5.3'
  return { ready, versions }
}

async function installedRuntimeReady(environment: LocalEnvironment, context: AdvVoiceContext): Promise<boolean> {
  try {
    return (await inspectRuntime(environment, context)).ready
  }
  catch {
    context.signal?.throwIfAborted()
    return false
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be a JSON object`)
  return value as Record<string, unknown>
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${label} must be a nonempty string`)
  return value
}

async function validatePreset(request: AdvVoicePreviewRequest, root: string, inspect = false): Promise<PreviewConfig> {
  request.signal?.throwIfAborted()
  nonemptyString(request.preset, 'Preset ID')
  const config = record(JSON.parse(await readFile(await resolveProjectPath(root, request.configPath, 'Preset config'), 'utf8')), 'Preset')
  nonemptyString(config.version, 'Preset version')
  nonemptyString(config.model, 'Model ID')
  if (typeof config.revision !== 'string' || !/^[a-f0-9]{40}$/.test(config.revision))
    throw new Error('Model revision must be a pinned 40-character commit hash')
  const hashes = record(config.weightSha256, 'Model weight hashes')
  if (!Object.keys(hashes).length)
    throw new Error('Model weight SHA-256 hashes are required')
  for (const [name, hash] of Object.entries(hashes)) {
    if (!name || isAbsolute(name) || name.split(/[\\/]/).includes('..') || typeof hash !== 'string' || !sha256Pattern.test(hash))
      throw new Error('Invalid model weight path or SHA-256')
  }
  if (!Array.isArray(config.characters) || !config.characters.length)
    throw new Error('The preset must contain characters')
  const ids = new Set<string>()
  for (const value of config.characters) {
    const character = record(value, 'Character')
    const id = nonemptyString(character.id, 'Character ID')
    if (!characterIdPattern.test(id) || ids.has(id))
      throw new Error('Character IDs must be unique, safe filename identifiers')
    ids.add(id)
    if (character.card !== undefined)
      await readFile(await resolveProjectPath(root, nonemptyString(character.card, 'Character card'), 'Character card'))
  }
  if (request.character !== undefined && !ids.has(request.character))
    throw new Error(`Unknown preview character: ${request.character}`)
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xFFFFFFFF)
    throw new Error('Preview seed must be an unsigned 32-bit integer')
  if (request.text !== undefined && (!request.character || !request.text.trim() || request.text.length > 500))
    throw new Error('A text override requires one character and 1–500 characters of text')
  if (request.referenceMode !== undefined && !['icl', 'embedding-only'].includes(request.referenceMode))
    throw new Error('Unknown reference mode')
  const selected = (config.characters as PreviewConfig['characters']).filter(character => !request.character || character.id === request.character)
  const references = selected.map(character => character.reference !== undefined)
  if (references.some(Boolean) && !references.every(Boolean))
    throw new Error('A preview batch cannot mix reference and voice-design characters')
  if (request.referenceMode && !references.every(Boolean))
    throw new Error('A reference mode requires reference characters')
  for (const character of selected) {
    const text = request.text ?? character.text
    if (typeof text !== 'string' || !text.trim() || text.length > 500)
      throw new Error('Each preview text must contain 1–500 characters')
    if (character.reference) {
      const reference = record(character.reference, 'Reference')
      nonemptyString(reference.assetId, 'Reference asset ID')
      if (typeof reference.sha256 !== 'string' || !sha256Pattern.test(reference.sha256))
        throw new Error('Reference SHA-256 must be a full lowercase hash')
      if ((request.referenceMode ?? 'icl') === 'icl')
        nonemptyString(reference.text, 'ICL reference transcript')
    }
    else {
      nonemptyString(character.description, 'Voice description')
    }
  }
  if (references.every(Boolean) && !inspect) {
    if (!request.assetManifestPath)
      throw new Error('Reference generation requires an asset manifest')
    await readFile(await resolveProjectPath(root, request.assetManifestPath, 'Asset manifest'))
  }
  return config as unknown as PreviewConfig
}

async function doctor(context: AdvVoiceContext): Promise<AdvVoiceDoctorResult> {
  context.signal?.throwIfAborted()
  const environment = await localEnvironment(context.root)
  const supported = process.platform === 'darwin' && process.arch === 'arm64'
  const checks: AdvVoiceDoctorResult['checks'] = [{
    id: 'platform',
    status: supported ? 'pass' : 'fail',
    message: supported ? 'Apple Silicon MLX is supported' : 'Requires an Apple Silicon Mac (darwin arm64)',
  }]
  const prepared = await environmentReady(environment)
  checks.push({ id: 'environment', status: prepared ? 'pass' : 'fail', message: prepared ? 'Isolated Python environment matches bundled requirements' : 'Run adv voice setup to prepare the isolated Python environment' })
  try {
    const version = await executeCommand('uv', ['--version'], { ...context, root: environment.root })
    checks.push({ id: 'uv', status: 'pass', message: version.trim() })
  }
  catch (error) {
    context.signal?.throwIfAborted()
    checks.push({ id: 'uv', status: 'warn', message: error instanceof Error ? error.message : String(error) })
  }
  let runtimeReady = false
  if (prepared) {
    try {
      const runtime = await inspectRuntime(environment, context)
      runtimeReady = runtime.ready
      checks.push({ id: 'runtime', status: runtimeReady ? 'pass' : 'fail', message: runtimeReady ? runtime.versions.trim() : 'Installed runtime versions do not match bundled requirements' })
    }
    catch (error) {
      context.signal?.throwIfAborted()
      checks.push({ id: 'runtime', status: 'fail', message: error instanceof Error ? error.message : String(error) })
    }
  }
  const cachedModels = await readdir(resolve(environment.modelCache, 'hub')).catch(() => [])
  checks.push({ id: 'model-cache', status: cachedModels.some(name => name.startsWith('models--')) ? 'pass' : 'warn', message: `Project model cache: ${environment.modelCache}; preview verifies the selected revision and weight hashes` })
  return { provider: providerId, supported, ready: supported && prepared && runtimeReady, environmentDirectory: resolve(environment.directory, '.venv'), modelCacheDirectory: environment.modelCache, checks }
}

async function setup(context: AdvVoiceContext): Promise<AdvVoiceSetupResult> {
  context.signal?.throwIfAborted()
  requirePlatform()
  const environment = await localEnvironment(context.root)
  const commandContext = { ...context, root: environment.root }
  if (!await environmentReady(environment) || !await installedRuntimeReady(environment, commandContext)) {
    // A stale stamp must not continue advertising a broken or partially repaired environment.
    await rm(environment.stamp, { force: true })
    await mkdir(environment.directory, { recursive: true })
    if (!await stat(environment.python).then(info => info.isFile()).catch(() => false))
      await executeCommand('uv', ['venv', '--python', '3.12', resolve(environment.directory, '.venv')], commandContext)
    await executeCommand('uv', ['pip', 'install', '--python', environment.python, '--requirement', requirements], commandContext)
    context.signal?.throwIfAborted()
    if (!await installedRuntimeReady(environment, commandContext))
      throw new Error('VOICE_ENVIRONMENT_NOT_READY: Installed runtime versions do not match bundled requirements')
    await writeFile(environment.stamp, await fileDigest(requirements))
  }
  return { provider: providerId, ready: true, environmentDirectory: resolve(environment.directory, '.venv') }
}

async function preview(request: AdvVoicePreviewRequest): Promise<AdvVoicePreviewResult> {
  request.signal?.throwIfAborted()
  requirePlatform()
  const environment = await localEnvironment(request.root)
  const config = await validatePreset(request, environment.root)
  if (!await environmentReady(environment))
    throw new Error(`The isolated voice environment is not prepared. Run adv voice setup${request.offline ? ' before offline preview; no installation was attempted' : ''}`)
  const resultFile = await resolveProjectPath(environment.root, resolve(environment.directory, 'results', `${randomUUID()}.json`), 'Preview result')
  const arguments_ = [previewScript, '--root', environment.root, '--config', await resolveProjectPath(environment.root, request.configPath, 'Preset config'), '--result-file', resultFile, '--preset', request.preset, '--seed', String(request.seed)]
  if (request.assetManifestPath)
    arguments_.push('--asset-manifest', await resolveProjectPath(environment.root, request.assetManifestPath, 'Asset manifest'))
  if (request.character)
    arguments_.push('--character', request.character)
  if (request.text !== undefined)
    arguments_.push('--text', request.text)
  if (request.referenceMode)
    arguments_.push('--reference-mode', request.referenceMode)
  if (request.offline)
    arguments_.push('--offline')
  try {
    await executeCommand(environment.python, arguments_, { ...request, root: environment.root })
    request.signal?.throwIfAborted()
    const result = record(JSON.parse(await readFile(resultFile, 'utf8')), 'Preview result')
    const manifest = record(result.manifest, 'Voice manifest')
    const manifestPath = await resolveProjectPath(resolve(environment.directory, 'previews'), nonemptyString(result.manifestPath, 'Manifest path'), 'Manifest path')
    const selected = config.characters.filter(character => !request.character || character.id === request.character)
    const generationMode = selected[0]?.reference ? `reference-${request.referenceMode ?? 'icl'}` : 'voice-design'
    if (manifest.preset !== request.preset || manifest.model !== config.model || manifest.revision !== config.revision || manifest.seed !== request.seed || manifest.generationMode !== generationMode || !Array.isArray(manifest.samples) || !manifest.samples.length)
      throw new Error('The voice manifest does not match the requested preview')
    const recordedManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (JSON.stringify(recordedManifest) !== JSON.stringify(manifest))
      throw new Error('The saved voice manifest differs from the process result')
    const expectedIds = selected.map(character => character.id)
    if (manifest.samples.length !== expectedIds.length)
      throw new Error('The voice manifest contains an unexpected number of samples')
    for (const [index, item] of manifest.samples.entries()) {
      const sample = record(item, 'Voice sample')
      if (sample.id !== expectedIds[index] || typeof sample.sha256 !== 'string' || !sha256Pattern.test(sample.sha256))
        throw new Error('The voice sample has invalid identity or provenance')
      if (sample.text !== (request.text?.trim() ?? selected[index]?.text) || sample.sampleRate !== 24000 || typeof sample.durationSeconds !== 'number' || !Number.isFinite(sample.durationSeconds) || sample.durationSeconds <= 0)
        throw new Error('The voice sample has invalid text or audio metadata')
      const samplePath = await resolveProjectPath(dirname(manifestPath), resolve(environment.root, nonemptyString(sample.path, 'Sample path')), 'Sample path')
      if ((await stat(samplePath)).size !== sample.bytes || await fileDigest(samplePath) !== sample.sha256)
        throw new Error('The generated voice sample does not match its recorded hash and size')
    }
    request.signal?.throwIfAborted()
    return { provider: providerId, preset: request.preset, manifestPath, manifest: manifest as JsonObject }
  }
  finally {
    await rm(resultFile, { force: true })
  }
}

/** Resolve Qwen-specific defaults without loading Python, models, or reference audio. */
async function normalizeRequest(request: AdvVoiceSynthesisRequest): Promise<AdvVoicePreviewRequest> {
  request.signal?.throwIfAborted()
  const root = await resolveProjectRoot(request.root)
  const source = record(JSON.parse(await readFile(await resolveProjectPath(root, request.configPath, 'Preset config'), 'utf8')), 'Preset')
  if (!Array.isArray(source.characters))
    throw new Error('The preset must contain characters')
  const selected = source.characters.map(value => record(value, 'Character')).filter(character => !request.character || character.id === request.character)
  const hasReference = selected.some(character => character.reference !== undefined)
  if (request.referenceMode !== undefined && !hasReference)
    throw new Error('--reference-mode requires a reference voice preset')
  const mode = hasReference ? request.referenceMode ?? request.defaultReferenceMode ?? 'embedding-only' : undefined
  if (mode !== undefined && !['icl', 'embedding-only'].includes(mode))
    throw new Error('Unknown Qwen reference mode')
  return { ...request, seed: request.seed ?? 42, referenceMode: mode as AdvVoicePreviewRequest['referenceMode'] }
}

async function inspectPreset(request: AdvVoiceSynthesisRequest): Promise<AdvVoicePresetInspection> {
  const normalized = await normalizeRequest(request)
  const config = await validatePreset(normalized, await resolveProjectRoot(request.root), true)
  const selected = config.characters.filter(character => !request.character || character.id === request.character)
  return {
    presetSha256: createHash('sha256').update(await readFile(await resolveProjectPath(await resolveProjectRoot(request.root), request.configPath, 'Preset config'), 'utf8')).digest('hex'),
    seed: normalized.seed,
    referenceMode: normalized.referenceMode,
    requiresReferenceAssets: selected.some(character => Boolean(character.reference)),
    characters: selected.map(character => ({
      id: character.id,
      name: character.name ?? character.id,
      card: character.card,
      text: request.text?.trim() ?? character.text,
      referenceAssetId: character.reference?.assetId,
      generation: {
        model: config.model,
        providerVoiceId: character.reference ? `reference:${character.reference.assetId}:${character.reference.sha256}` : `design:${createHash('sha256').update(character.description!).digest('hex')}`,
        source: character.reference ? 'cloned' : 'designed',
        revision: config.revision,
        mimeType: 'audio/wav',
        ...(character.reference ? { referenceAssetId: character.reference.assetId, referenceSha256: character.reference.sha256 } : {}),
        parameters: { modelRevision: config.revision, seed: normalized.seed, ...(normalized.referenceMode ? { referenceMode: normalized.referenceMode } : {}) },
      },
    })),
  }
}

async function synthesize(request: AdvVoiceSynthesisRequest): Promise<AdvVoiceSynthesisResult> {
  const normalized = await normalizeRequest(request)
  const root = await resolveProjectRoot(request.root)
  const configPath = await resolveProjectPath(root, request.configPath, 'Preset config')
  const source = await readFile(configPath, 'utf8')
  const config = await validatePreset(normalized, root, true)
  const result = await preview(normalized)
  if (await readFile(configPath, 'utf8') !== source)
    throw new Error('VOICE_CONFLICT: The Qwen preset changed during synthesis')
  return {
    ...result,
    candidates: (result.manifest.samples as unknown as Array<Record<string, unknown>>).map(sample => ({
      id: `${request.preset}:${String(sample.id)}:${String(sample.sha256).slice(0, 12)}`,
      characterId: String(sample.id),
      text: String(sample.text),
      path: String(sample.path),
      sha256: String(sample.sha256),
      bytes: Number(sample.bytes),
      mimeType: 'audio/wav',
      durationSeconds: Number(sample.durationSeconds),
      sampleRate: Number(sample.sampleRate),
      provider: providerId,
      model: String(result.manifest.model),
      revision: String(result.manifest.revision),
      // Qwen conditions on an immutable reference or a design description, rather
      // than offering a supplier catalog voice ID. Freeze that actual identity.
      providerVoiceId: (() => {
        const character = config.characters.find(character => character.id === sample.id)!
        return character.reference
          ? `reference:${character.reference.assetId}:${character.reference.sha256}`
          : `design:${createHash('sha256').update(character.description!).digest('hex')}`
      })(),
      voiceId: request.voiceId,
      voiceVersion: request.voiceVersion,
    })),
  }
}

/** Create an optional Node-only adapter; legacy preview remains available. */
export function createQwenTtsProvider(): AdvVoiceProvider & AdvVoiceSynthesisProvider {
  return {
    id: providerId,
    doctor,
    setup,
    preview,
    inspectPreset,
    synthesize,
    async buildDesignPreset({ template, characterId, text, locale, intent, definition }) {
      if (typeof template.model !== 'string' || !['designed', 'cloned'].includes(definition.source))
        throw new Error('VOICE_DESIGN_SOURCE_UNSUPPORTED')
      if (definition.source === 'designed' ? !template.model.includes('VoiceDesign') : !template.model.includes('-Base'))
        throw new Error('VOICE_DESIGN_TEMPLATE_MODE_MISMATCH')
      const language = designLanguage(locale)
      const character: JsonObject = { id: characterId, text }
      if (definition.source === 'designed') {
        if (!definition.description)
          throw new Error('VOICE_DESIGN_DESCRIPTION_REQUIRED')
        character.description = designInstructions(definition.description, intent)
      }
      else {
        if (!definition.reference || !definition.rights)
          throw new Error('VOICE_DESIGN_REFERENCE_RIGHTS_REQUIRED')
        character.reference = { assetId: definition.reference.assetId, sha256: definition.reference.sha256, ...(definition.reference.text ? { text: definition.reference.text } : {}) }
      }
      return { ...template, language, characters: [character] }
    },
    capabilities: {
      backend: 'local',
      synthesis: true,
      voiceCreation: false,
      offline: true,
      designSources: ['designed', 'cloned'],
      models: [
        { id: 'Qwen3-TTS-12Hz-1.7B-Base (MLX)', modes: ['icl', 'embedding-only'], maxTextCharacters: 500, formats: ['audio/wav'], streaming: false },
        { id: 'Qwen3-TTS-12Hz-1.7B-VoiceDesign (MLX)', modes: ['voice-design'], maxTextCharacters: 500, formats: ['audio/wav'], streaming: false },
      ],
    },
  }
}
