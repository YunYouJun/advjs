import type { CreativeArtifact, CreativeFileChange, CreativeTeamRun } from './contracts'
import type { CreativeTeamStartRequest } from './wire'
import { JSON_SCHEMA, load } from 'js-yaml'
import { creativeArtifactExpectedFiles } from './milestones'
import { requiredCreativeReviewCapabilities } from './validation'
import { matchesCreativeVoiceLineSource } from './voice-lines'
import { parseCreativeProject } from './wire'

export type CreativeMediaTarget = { kind: 'image', assetId: string } | { kind: 'voice', assetId: string, lineId: string, locale: string, takeId: string, phase: 'registered' | 'selected' }
export interface CreativeMediaEvidence {
  verification: 'author-host'
  parent: { artifactId: string, fingerprint: string }
  target: CreativeMediaTarget
  sha256: string
  bytes: number
  mimeType: string
  mediaPath: string
}
export interface CreativeMediaCandidateRequest {
  artifactId: string
  fingerprint: string
  project: CreativeTeamStartRequest['project']
  target: CreativeMediaTarget
  writes: Readonly<Record<string, string>>
  reason: string
}
type RecordValue = Record<string, unknown>
function object(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('CREATIVE_MEDIA_INVALID_OBJECT')
  return value as RecordValue
}
function text(value: unknown, maximum = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new TypeError('CREATIVE_MEDIA_INVALID_TEXT')
  return value
}
function keys(value: RecordValue, allowed: readonly string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key)))
    throw new TypeError('CREATIVE_MEDIA_INVALID_AUTHORITY')
}
function path(value: unknown): string {
  const result = text(value)
  if (!/^[\w./-]+$/.test(result) || result.split('/').some(part => ['', '.', '..'].includes(part)))
    throw new TypeError('CREATIVE_MEDIA_INVALID_PATH')
  return result
}
function positive(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > maximum)
    throw new TypeError('CREATIVE_MEDIA_INVALID_NUMBER')
  return Number(value)
}
/** Bounded canonical JSON also rejects cyclic or expanding YAML aliases. */
export function creativeMediaCanonical(value: unknown): string {
  let budget = 16000
  function encode(input: unknown, depth: number): string {
    if (--budget < 0 || depth > 24)
      throw new TypeError('CREATIVE_MEDIA_INVALID_OBJECT')
    if (input === null || typeof input === 'string' || typeof input === 'boolean' || (typeof input === 'number' && Number.isFinite(input)))
      return JSON.stringify(input)
    if (Array.isArray(input))
      return `[${input.map(item => encode(item, depth + 1)).join(',')}]`
    const record = object(input)
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${encode(record[key], depth + 1)}`).join(',')}}`
  }
  return encode(value, 0)
}
function same(left: unknown, right: unknown): boolean {
  return creativeMediaCanonical(left) === creativeMediaCanonical(right)
}
function omit(value: RecordValue, fields: readonly string[]): RecordValue {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)))
}
function json(content: string): RecordValue {
  return object(JSON.parse(content))
}
function target(value: unknown): CreativeMediaTarget {
  const source = object(value)
  if (source.kind === 'image') {
    keys(source, ['kind', 'assetId'])
    return { kind: 'image', assetId: text(source.assetId) }
  }
  keys(source, ['kind', 'assetId', 'lineId', 'locale', 'takeId', 'phase'])
  if (source.kind !== 'voice' || !/^line_[a-f0-9-]{36}$/.test(String(source.lineId)) || !/^take_[a-f0-9-]{36}$/.test(String(source.takeId)) || !['registered', 'selected'].includes(String(source.phase)))
    throw new TypeError('CREATIVE_MEDIA_INVALID_TARGET')
  return { kind: 'voice', assetId: text(source.assetId), lineId: text(source.lineId), locale: text(source.locale, 40), takeId: text(source.takeId), phase: source.phase as 'registered' | 'selected' }
}
export function parseCreativeMediaEvidence(value: unknown): CreativeMediaEvidence {
  const source = object(value)
  keys(source, ['verification', 'parent', 'target', 'sha256', 'bytes', 'mimeType', 'mediaPath'])
  const parent = object(source.parent)
  keys(parent, ['artifactId', 'fingerprint'])
  if (source.verification !== 'author-host' || !/^[a-f0-9]{64}$/.test(String(source.sha256)) || !/^(?:image\/(?:png|jpeg|webp)|audio\/wav)$/.test(String(source.mimeType)))
    throw new TypeError('CREATIVE_MEDIA_INVALID_EVIDENCE')
  const destination = target(source.target)
  if ((destination.kind === 'voice') !== (source.mimeType === 'audio/wav'))
    throw new TypeError('CREATIVE_MEDIA_INVALID_EVIDENCE')
  return { verification: 'author-host', parent: { artifactId: text(parent.artifactId), fingerprint: text(parent.fingerprint) }, target: destination, sha256: String(source.sha256), bytes: positive(source.bytes, 32 * 1024 * 1024), mimeType: String(source.mimeType), mediaPath: path(source.mediaPath) }
}
export function parseCreativeMediaCandidateRequest(value: unknown): CreativeMediaCandidateRequest {
  const source = object(value)
  keys(source, ['artifactId', 'fingerprint', 'project', 'target', 'writes', 'reason'])
  const writes = object(source.writes)
  if (!Object.keys(writes).length || Object.keys(writes).length > 4)
    throw new TypeError('CREATIVE_MEDIA_INVALID_WRITES')
  return { artifactId: text(source.artifactId), fingerprint: text(source.fingerprint), project: parseCreativeProject(source.project), target: target(source.target), reason: text(source.reason, 4000), writes: Object.fromEntries(Object.entries(writes).map(([name, content]) => [path(name), text(content, 49152)])) }
}

/** Read portable v2 JSON only. No URLs are fetched and no provider credentials are interpreted. */
function catalog(files: Readonly<Record<string, string>>) {
  const root = files['adv/assets.json'] ? json(files['adv/assets.json']) : undefined
  const documents: Record<string, RecordValue> = {}
  const assets: RecordValue[] = []
  if (!root)
    return { root, documents, assets }
  if (root.schemaVersion !== 2 || Array.isArray(root.assets) === Array.isArray(root.includes))
    throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
  documents['adv/assets.json'] = root
  if (Array.isArray(root.assets)) {
    assets.push(...root.assets.map(object))
  }
  else {
    const includes = root.includes as unknown[]
    if (new Set(includes).size !== includes.length || includes.length > 128)
      throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
    for (const value of includes) {
      const include = path(value)
      if (!/^assets\/[a-z0-9][\w./-]*\.json$/.test(include))
        throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
      const name = `adv/${include}`
      const fragment = json(files[name] ?? '')
      if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
        throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
      documents[name] = fragment
      assets.push(...fragment.assets.map(object))
    }
  }
  if (assets.length > 2048 || new Set(assets.map(asset => text(asset.id))).size !== assets.length)
    throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
  return { root, documents, assets }
}
function validateCatalog(before: ReturnType<typeof catalog>, after: ReturnType<typeof catalog>, assetId: string, projectId: string) {
  const root = after.root!
  if (!root)
    throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
  const expected = before.root ? omit(before.root, ['assets', 'includes']) : { schemaVersion: 2, id: projectId, defaultProfile: 'local', profiles: {} }
  const profiles = { ...object(expected.profiles ?? {}) }
  if (!profiles.local)
    profiles.local = { provider: 'project', root: 'adv/assets', ...(expected.defaultProfile && expected.defaultProfile !== 'local' ? { fallback: expected.defaultProfile } : {}) }
  expected.profiles = profiles
  if (!same(expected, omit(root, ['assets', 'includes'])))
    throw new TypeError('CREATIVE_MEDIA_PROFILE_CHANGED')
  const originalIncludes = before.root?.includes
  if (Array.isArray(originalIncludes) && (!Array.isArray(root.includes) || !same((root.includes as unknown[]).slice(0, originalIncludes.length), originalIncludes) || root.includes.length > originalIncludes.length + 1))
    throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
  if (before.root && Array.isArray(before.root.assets) !== Array.isArray(root.assets))
    throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
  for (const [name, document] of Object.entries(after.documents)) {
    if (name !== 'adv/assets.json' && !same(omit(document, ['assets']), before.documents[name] ? omit(before.documents[name], ['assets']) : { schemaVersion: 2 }))
      throw new TypeError('CREATIVE_MEDIA_UNRELATED_CHANGE')
  }
  if (!same(before.assets.filter(asset => asset.id !== assetId), after.assets.filter(asset => asset.id !== assetId)))
    throw new TypeError('CREATIVE_MEDIA_UNRELATED_CHANGE')
  const local = object(object(root.profiles).local)
  if (local.provider !== 'project')
    throw new TypeError('CREATIVE_MEDIA_INVALID_CATALOG')
  return typeof local.root === 'string' && local.root ? path(local.root) : ''
}
function frontmatter(content: string | undefined) {
  const match = content?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (content && !match)
    throw new TypeError('CREATIVE_MEDIA_INVALID_SCENE')
  return { data: match ? object(load(match[1], { schema: JSON_SCHEMA })) : undefined, body: match ? content!.slice(match[0].length) : '' }
}
function voiceBinding(files: Readonly<Record<string, string>>, value: Extract<CreativeMediaTarget, { kind: 'voice' }>) {
  const ledger = files['adv/audio/voice-ledger.json'] ? json(files['adv/audio/voice-ledger.json']) : { schemaVersion: 1, lines: {} }
  if (ledger.schemaVersion !== 1)
    throw new TypeError('CREATIVE_MEDIA_INVALID_VOICE')
  const line = object(object(ledger.lines)[value.lineId] ?? {})
  const locale = object(object(line.locales ?? {})[value.locale] ?? { selectedTake: null, takes: [] })
  if (!Array.isArray(locale.takes) || locale.takes.length > 256)
    throw new TypeError('CREATIVE_MEDIA_INVALID_VOICE')
  return { ledger, line, locale, takes: locale.takes.map(object) }
}

/** Freeze finite author-host media changes. This is not server decoding or provider certification. */
export function prepareCreativeMediaCandidate(run: CreativeTeamRun, input: CreativeMediaCandidateRequest, fingerprint: (value: unknown) => string): Omit<CreativeArtifact, 'id' | 'fingerprint'> {
  const original = run.artifacts.find(item => item.id === input.artifactId && item.fingerprint === input.fingerprint && ['selected', 'adopted'].includes(item.status))
  if (!original || original.kind !== (input.target.kind === 'image' ? 'art-direction' : 'voice-direction') || input.project.id !== run.plan.projectId || run.milestones?.some(item => item.status === 'prepared') || run.tasks.some(item => ['running', 'reconcile_required'].includes(item.status)) || run.reservedMicroPoints || ['completed', 'cancelled', 'cancel_requested'].includes(run.status))
    throw new Error('CREATIVE_MEDIA_SOURCE_CONFLICT')
  for (const [name, content] of Object.entries(creativeArtifactExpectedFiles(original, run))) {
    if ((input.project.files[name] ?? null) !== content)
      throw new Error(`CREATIVE_SOURCE_CONFLICT:${name}`)
  }
  const files = { ...input.project.files, ...input.writes }
  const before = catalog(input.project.files)
  const after = catalog(files)
  const localRoot = validateCatalog(before, after, input.target.assetId, input.project.id)
  const asset = after.assets.find(item => item.id === input.target.assetId)
  if (!asset || !/^[a-f0-9]{64}$/.test(String(asset.sha256)))
    throw new TypeError('CREATIVE_MEDIA_INVALID_ASSET')
  keys(asset, ['id', 'type', 'kind', 'path', 'sha256', 'bytes', 'mimeType', 'width', 'height', 'duration', 'characterId', 'expression', 'sceneId', 'state', 'source', 'labels', 'license'])
  const assetPath = path(asset.path)
  const evidence = parseCreativeMediaEvidence({ verification: 'author-host', parent: { artifactId: original.id, fingerprint: original.fingerprint }, target: input.target, sha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType, mediaPath: [localRoot, assetPath].filter(Boolean).join('/') })
  const allowed = new Set(Object.keys(after.documents))
  const upstream = [...original.source.upstream, { artifactId: original.id, fingerprint: original.fingerprint }]
  if (input.target.kind === 'image') {
    const request = original.output?.kind === 'art-direction' ? original.output.requests.find(item => item.assetId === input.target.assetId) : undefined
    if (!request || asset.type !== 'image' || !['image/png', 'image/jpeg', 'image/webp'].includes(evidence.mimeType) || evidence.bytes > 20 * 1024 * 1024 || positive(asset.width, 16384) * positive(asset.height, 16384) > 64000000)
      throw new TypeError('CREATIVE_MEDIA_INVALID_IMAGE')
    if (request.kind === 'background') {
      if (asset.kind !== 'background' || asset.sceneId !== request.sceneId)
        throw new TypeError('CREATIVE_MEDIA_INVALID_BINDING')
      const name = `adv/scenes/${request.sceneId}.md`
      allowed.add(name)
      const originalScene = frontmatter(input.project.files[name])
      const scene = frontmatter(files[name])
      const expected: RecordValue = { ...(originalScene.data ?? { id: request.sceneId, name: request.sceneId }), type: 'image', assetId: request.assetId }
      if (request.locationId && expected.linkedLocation === undefined)
        expected.linkedLocation = request.locationId
      delete expected.src
      if (!same(scene.data, expected) || scene.body !== originalScene.body || scene.data?.id !== request.sceneId)
        throw new TypeError('CREATIVE_MEDIA_INVALID_BINDING')
    }
    else if (asset.kind !== 'character' || asset.characterId !== request.characterId || asset.expression !== (request.kind === 'expression' ? request.expression : 'default') || !input.project.files[`adv/characters/${request.characterId}.character.md`]
      || after.assets.some(item => item.id !== asset.id && item.kind === 'character' && item.characterId === asset.characterId && item.expression === asset.expression)) {
      throw new TypeError('CREATIVE_MEDIA_INVALID_BINDING')
    }
  }
  else {
    const selection = input.target
    allowed.add('adv/audio/voice-ledger.json')
    const previous = voiceBinding(input.project.files, selection)
    const next = voiceBinding(files, selection)
    const take = next.takes.find(item => item.id === selection.takeId)
    const lines = original.output?.kind === 'voice-direction' ? original.output.lines.filter(item => item.speakerId === next.line.speakerId && item.text === (next.locale.displayText ?? next.line.displayText) && matchesCreativeVoiceLineSource(item, input.project.files, selection.lineId)) : []
    const line = lines.length === 1 ? lines[0] : undefined
    if (!line || !take || asset.type !== 'audio' || asset.kind !== 'voice' || evidence.mimeType !== 'audio/wav' || take.assetId !== asset.id || take.sha256 !== asset.sha256 || asset.characterId !== next.line.speakerId || !['system', 'recorded'].includes(String(take.source))
      || typeof asset.duration !== 'number' || !(asset.duration > 0 && asset.duration <= 120) || !/^[a-f0-9]{64}$/.test(String(take.inputFingerprint)) || !/^[a-f0-9]{64}$/.test(String(take.voiceProfileRevision))) {
      throw new TypeError('CREATIVE_MEDIA_INVALID_VOICE')
    }
    keys(take, ['id', 'assetId', 'sha256', 'providerId', 'voiceId', 'model', 'modelRevision', 'voiceProfileRevision', 'inputFingerprint', 'pronunciationRevision', 'spokenText', 'createdAt', 'source', 'rights', 'parameters', 'projectVoiceId', 'projectVoiceVersion', 'alignment'])
    const profile = next.line.speakerId === 'narrator'
      ? object(json(input.project.files['adv/audio/voice-profiles.json'] ?? '{}').narrator)
      : object(frontmatter(input.project.files[`adv/characters/${next.line.speakerId}.character.md`]).data?.voiceProfile)
    const providerId = text(take.providerId)
    const binding = object(object(object(object(profile.locales)[selection.locale]).providers)[providerId])
    if (binding.voiceId !== take.voiceId || binding.model !== take.model || binding.source !== take.source || !same(binding.rights ?? null, take.rights ?? null) || fingerprint(profile) !== take.voiceProfileRevision)
      throw new TypeError('CREATIVE_MEDIA_VOICE_PROFILE_CHANGED')
    const spokenText = text(take.spokenText, 4000).normalize('NFC')
    const voiceInput = { spokenText, locale: selection.locale, speakerId: next.line.speakerId, providerId, voiceId: text(take.voiceId), model: text(take.model), voiceProfileRevision: take.voiceProfileRevision, parameters: object(take.parameters ?? {}), ...(take.pronunciationRevision === undefined ? {} : { pronunciationRevision: take.pronunciationRevision }) }
    if (fingerprint(voiceInput) !== take.inputFingerprint || !Number.isFinite(Date.parse(text(take.createdAt))))
      throw new TypeError('CREATIVE_MEDIA_INVALID_VOICE')
    if (take.rights) {
      const rights = object(take.rights)
      keys(rights, ['license', 'subject', 'consentRecord'])
      text(rights.license)
      text(rights.subject)
      if (!Object.hasOwn(input.project.files, path(rights.consentRecord)))
        throw new TypeError('CREATIVE_MEDIA_CONSENT_REQUIRED')
    }
    const priorTake = previous.takes.find(item => item.id === selection.takeId)
    if (selection.phase === 'registered') {
      if (priorTake || before.assets.some(item => item.id === asset.id) || next.locale.selectedTake !== previous.locale.selectedTake || !same(previous.takes, next.takes.filter(item => item.id !== selection.takeId)))
        throw new TypeError('CREATIVE_MEDIA_INVALID_VOICE')
      const expected = structuredClone(previous.ledger)
      const lines = object(expected.lines)
      const existing = object(lines[selection.lineId] ?? {})
      if (existing.speakerId !== undefined && existing.speakerId !== next.line.speakerId)
        throw new TypeError('CREATIVE_MEDIA_INVALID_VOICE')
      const expectedLocale: RecordValue = { ...previous.locale, displayText: line.text, takes: [...previous.takes, take] }
      const spokenOverride = previous.locale.spokenText ?? existing.spokenText
      if (spokenOverride === undefined)
        delete expectedLocale.spokenText
      else
        expectedLocale.spokenText = spokenOverride
      lines[selection.lineId] = { ...existing, speakerId: next.line.speakerId, displayText: existing.displayText ?? line.text, locales: { ...object(existing.locales ?? {}), [selection.locale]: expectedLocale } }
      if (!same(expected, next.ledger) || (next.line.displayText !== existing.displayText && next.line.displayText !== line.text))
        throw new TypeError('CREATIVE_MEDIA_UNRELATED_CHANGE')
    }
    else {
      if (!priorTake || !same(priorTake, take) || next.locale.selectedTake !== take.id || !same(before.assets, after.assets))
        throw new TypeError('CREATIVE_MEDIA_INVALID_VOICE')
      const expected = structuredClone(previous.ledger)
      object(object(object(expected.lines)[selection.lineId]).locales)[selection.locale] = { ...previous.locale, selectedTake: take.id }
      if (!same(expected, next.ledger))
        throw new TypeError('CREATIVE_MEDIA_UNRELATED_CHANGE')
      const registered = run.artifacts.find(item => item.kind === 'media-adoption' && item.status === 'adopted' && item.media?.target.kind === 'voice' && item.media.target.takeId === take.id && item.media.parent.artifactId === original.id)
      if (!registered)
        throw new Error('CREATIVE_MEDIA_REGISTRATION_REQUIRED')
      upstream.push({ artifactId: registered.id, fingerprint: registered.fingerprint })
    }
  }
  const changes: CreativeFileChange[] = Object.entries(input.writes).flatMap(([name, content]) => {
    if (!allowed.has(name) || (!/^adv\/assets(?:\.json|\/[\w./-]+\.json)$/.test(name) && name !== 'adv/audio/voice-ledger.json' && !/^adv\/scenes\/[\w-]+\.md$/.test(name)))
      throw new TypeError('CREATIVE_MEDIA_INVALID_WRITES')
    return (input.project.files[name] ?? null) === content ? [] : [{ path: name, before: input.project.files[name] ?? null, after: content }]
  })
  if (!changes.length)
    throw new Error('CREATIVE_EMPTY_MILESTONE')
  parseCreativeProject({ id: input.project.id, revision: input.project.revision, files })
  const candidate: Omit<CreativeArtifact, 'id' | 'fingerprint'> = { runId: run.id, taskId: original.taskId, partner: original.partner, projectId: run.plan.projectId, kind: 'media-adoption', source: { projectId: run.plan.projectId, revision: input.project.revision, files: input.project.files, upstream }, summary: input.reason, changes, media: evidence, reviewCapabilities: [], status: 'selected' }
  candidate.reviewCapabilities = requiredCreativeReviewCapabilities(candidate)
  return candidate
}

/** Other adopted media keep anchors only while their immutable asset and current binding survive. */
export function compatibleCreativeMediaArtifacts(run: CreativeTeamRun, files: Readonly<Record<string, string>>): string[] {
  const current = catalog(files)
  const assets = current.assets
  const local = current.root ? object(object(current.root.profiles).local) : {}
  const root = typeof local.root === 'string' ? local.root : ''
  return run.artifacts.filter((artifact) => {
    const evidence = artifact.media
    if (artifact.kind !== 'media-adoption' || artifact.status !== 'adopted' || !evidence)
      return false
    const asset = assets.find(item => item.id === evidence.target.assetId)
    if (!asset || asset.sha256 !== evidence.sha256 || asset.bytes !== evidence.bytes || asset.mimeType !== evidence.mimeType || [root, asset.path].filter(Boolean).join('/') !== evidence.mediaPath)
      return false
    const parent = run.artifacts.find(item => item.id === evidence.parent.artifactId && item.fingerprint === evidence.parent.fingerprint)
    const expected = creativeArtifactExpectedFiles(artifact, run)
    const inputs = new Set<string>()
    if (evidence.target.kind === 'voice' && parent?.output?.kind === 'voice-direction') {
      for (const path of ['adv/audio/pronunciation.json', 'adv/audio/voice-profiles.json', 'adv/settings/game.json'])
        inputs.add(path)
      for (const line of parent.output.lines) {
        inputs.add(line.path)
        if (line.speakerId !== 'narrator')
          inputs.add(`adv/characters/${line.speakerId}.character.md`)
      }
    }
    if (evidence.target.kind === 'image' && parent?.output?.kind === 'art-direction') {
      const request = parent.output.requests.find(item => item.assetId === evidence.target.assetId)
      if (request)
        inputs.add(request.kind === 'background' ? `adv/scenes/${request.sceneId}.md` : `adv/characters/${request.characterId}.character.md`)
    }
    if ([...inputs].some(path => (files[path] ?? null) !== (expected[path] ?? null)))
      return false
    if (evidence.target.kind === 'voice') {
      const selection = evidence.target
      const binding = voiceBinding(files, selection)
      return binding.takes.some(item => item.id === selection.takeId && item.assetId === asset.id && item.sha256 === asset.sha256) && (evidence.target.phase === 'registered' || binding.locale.selectedTake === evidence.target.takeId)
    }
    const request = parent?.output?.kind === 'art-direction' ? parent.output.requests.find(item => item.assetId === evidence.target.assetId) : undefined
    if (!request)
      return false
    if (request.kind === 'background')
      return asset.kind === 'background' && asset.sceneId === request.sceneId && frontmatter(files[`adv/scenes/${request.sceneId}.md`]).data?.assetId === asset.id
    return asset.kind === 'character' && asset.characterId === request.characterId && asset.expression === (request.kind === 'expression' ? request.expression : 'default')
  }).map(item => item.id)
}
