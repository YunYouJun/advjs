import type { AdvAssetEntry, AdvAssetManifest, VoiceLedger } from '@advjs/types'
import type { HostedVoiceSyncInput, HostedVoiceSyncState } from '../../shared/hosted-audio'
import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, open, readdir, readFile, realpath, rm, stat } from 'node:fs/promises'
import { normalizeAdvAssetManifest } from '@advjs/assets'
import { audioProjectMediaPath, canonicalAudioJson, createVoiceLedger, parseVoiceLedger } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { dirname, isAbsolute, relative, resolve } from 'pathe'
import { atomicProjectWrite, projectWriteTarget } from '../editor/mutations'
import { withProjectWriteLock } from '../project/write-lock'

const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const RESERVED = new Set(['.', '..', '.git', 'node_modules'])
const AUDIO_KINDS: readonly string[] = ['voice', 'reference', 'bgm', 'ambience', 'sfx', 'ui']
const BASE_DOCUMENT = /^(?:adv\.config\.json|adv\/settings\/game\.json|adv\/assets\.json|adv\/assets\/[\w./-]+\.json|adv\/audio\/(?:voice-ledger|pronunciation|voice-profiles|mixer|toolchain)\.json|adv\/chapters\/[\w./-]+\.(?:adv\.md|chapter\.json)|adv\/characters\/[\w./-]+\.(?:md|json|ya?ml)|authoring\/voices\/(?:library\.json|designs\/[\w./-]+\.json))$/u

export class HostedVoiceSyncError extends Error {
  constructor(public statusCode: number, code: string) {
    super(code)
  }
}
function fail(code: string, statusCode = 400): never {
  throw new HostedVoiceSyncError(statusCode, code)
}
function inside(root: string, path: string) {
  const coordinate = relative(root, path)
  return !isAbsolute(coordinate) && coordinate !== '..' && !coordinate.startsWith('../')
}
function canonicalPath(path: string) {
  if (!path || path.includes('\\') || path.includes(':') || path.includes('\0') || path.split('/').some(part => !part || RESERVED.has(part.toLowerCase())))
    fail('ADV_AUDIO_SYNC_PATH_INVALID')
  return path
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function consentPaths(files: Record<string, string>) {
  const paths = new Set<string>()
  function visit(value: unknown) {
    if (!value || typeof value !== 'object')
      return
    for (const [key, child] of Object.entries(value)) {
      if (key === 'consentRecord' && typeof child === 'string')
        paths.add(canonicalPath(child))
      else
        visit(child)
    }
  }
  for (const [path, source] of Object.entries(files)) {
    if (path.endsWith('.json')) {
      visit(JSON.parse(source))
    }
    else if (path.startsWith('adv/characters/')) {
      for (const line of source.split(/\r?\n/u)) {
        const trimmed = line.trim()
        if (trimmed.startsWith('consentRecord:'))
          paths.add(canonicalPath(trimmed.slice('consentRecord:'.length).trim().replace(/^['"]|['"]$/gu, '')))
      }
    }
  }
  return paths
}
function parseFiles(value: unknown) {
  if (!object(value) || Object.keys(value).length > 512)
    fail('ADV_AUDIO_SYNC_INPUT_INVALID')
  const files: Record<string, string> = {}
  let bytes = 0
  for (const [coordinate, source] of Object.entries(value)) {
    canonicalPath(coordinate)
    if (typeof source !== 'string')
      fail('ADV_AUDIO_SYNC_INPUT_INVALID')
    bytes += new TextEncoder().encode(source).byteLength
    if (bytes > MAX_SOURCE_BYTES || new TextEncoder().encode(source).byteLength > 1024 * 1024)
      fail('ADV_AUDIO_SYNC_SOURCE_LIMIT', 413)
    if (coordinate.endsWith('.json'))
      canonicalAudioJson(JSON.parse(source))
    // Native Markdown is prose and data, never an executable configuration.
    if (/\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|authorization)\s*[:=]/iu.test(source))
      fail('ADV_AUDIO_SYNC_CREDENTIALS_FORBIDDEN')
    files[coordinate] = source
  }
  const consent = consentPaths(files)
  for (const [path, source] of Object.entries(files)) {
    if (BASE_DOCUMENT.test(path))
      continue
    if (!consent.has(path) || !/\.(?:md|txt|json)$/u.test(path) || new TextEncoder().encode(source).byteLength > 64 * 1024)
      fail('ADV_AUDIO_SYNC_PATH_UNSUPPORTED')
  }
  const config = JSON.parse(files['adv.config.json'] ?? '{}')
  if (!object(config) || !['adv', './adv'].includes(String(config.root)) || !['adv-md', 'flow'].includes(String(config.format))
    || (config.schemaVersion !== undefined && config.schemaVersion !== 1) || (config.entryChapterId !== undefined && typeof config.entryChapterId !== 'string')
    || Object.keys(config).some(key => !['schemaVersion', 'id', 'format', 'root', 'theme', 'title', 'description', 'locale', 'languages', 'entryChapterId'].includes(key))) {
    fail('ADV_AUDIO_SYNC_CONFIG_INVALID')
  }
  return files
}
function catalog(files: Record<string, string>): AdvAssetManifest {
  const source = JSON.parse(files['adv/assets.json'] ?? '{}')
  if (!object(source))
    fail('ADV_AUDIO_SYNC_CATALOG_REQUIRED')
  const { includes, ...base } = source
  let assets = source.assets
  if (includes !== undefined) {
    if (assets !== undefined || !Array.isArray(includes) || includes.length > 64)
      fail('ADV_AUDIO_SYNC_CATALOG_INVALID')
    const fragments = new Set<string>()
    assets = includes.flatMap((path) => {
      if (typeof path !== 'string')
        fail('ADV_AUDIO_SYNC_CATALOG_INVALID')
      canonicalPath(path)
      const coordinate = `adv/${path}`
      if (!/^adv\/assets\/[\w./-]+\.json$/u.test(coordinate) || fragments.has(coordinate))
        fail('ADV_AUDIO_SYNC_CATALOG_INVALID')
      fragments.add(coordinate)
      const fragment = JSON.parse(files[coordinate] ?? '{}')
      if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
        fail('ADV_AUDIO_SYNC_CATALOG_INVALID')
      return fragment.assets
    })
  }
  const normalized: AdvAssetManifest = JSON.parse(JSON.stringify(normalizeAdvAssetManifest({ ...base, assets }, { allowEmpty: true })))
  for (const profile of Object.values(normalized.profiles)) {
    if (profile.provider === 'project' && profile.root !== undefined && profile.root !== '.')
      canonicalPath(profile.root)
  }
  for (const asset of normalized.assets) {
    if (asset.path)
      canonicalPath(asset.path)
  }
  return normalized
}
function mergeLedger(current: VoiceLedger, incoming: VoiceLedger): VoiceLedger {
  const result = structuredClone(current)
  for (const [id, line] of Object.entries(incoming.lines)) {
    const prior = result.lines[id]
    if (prior && prior.speakerId !== line.speakerId)
      fail('ADV_AUDIO_SYNC_IDENTITY_CONFLICT', 409)
    if (!prior) {
      result.lines[id] = structuredClone(line)
      continue
    }
    prior.displayText = line.displayText
    if (line.spokenText === undefined)
      delete prior.spokenText
    else
      prior.spokenText = line.spokenText
    for (const [locale, binding] of Object.entries(line.locales)) {
      const saved = prior.locales[locale]
      if (!saved) {
        prior.locales[locale] = structuredClone(binding)
        continue
      }
      for (const take of binding.takes) {
        const existing = saved.takes.find(item => item.id === take.id)
        if (existing && canonicalAudioJson(existing) !== canonicalAudioJson(take))
          fail('ADV_AUDIO_SYNC_IMMUTABLE_TAKE', 409)
        if (!existing)
          saved.takes.push(structuredClone(take))
      }
      saved.selectedTake = binding.selectedTake
      for (const key of ['displayText', 'spokenText'] as const) {
        if (binding[key] === undefined)
          delete saved[key]
        else
          saved[key] = binding[key]
      }
    }
  }
  return parseVoiceLedger(result)
}
function mergeCatalog(current: AdvAssetManifest | undefined, incoming: AdvAssetManifest) {
  if (!current)
    return incoming
  const assets = structuredClone(current.assets)
  for (const asset of incoming.assets) {
    const index = assets.findIndex(item => item.id === asset.id)
    const existing = assets[index]
    if (existing) {
      for (const key of ['type', 'kind', 'path', 'sha256', 'bytes', 'mimeType', 'duration', 'characterId'] as const) {
        if (existing[key] !== asset[key])
          fail('ADV_AUDIO_SYNC_IMMUTABLE_ASSET', 409)
      }
      assets[index] = { ...existing, ...asset }
    }
    else {
      assets.push(structuredClone(asset))
    }
  }
  if (current.assets.some(asset => asset.type === 'audio' && asset.kind === 'voice')
    && (current.defaultProfile !== incoming.defaultProfile || canonicalAudioJson(current.profiles) !== canonicalAudioJson(incoming.profiles))) {
    fail('ADV_AUDIO_SYNC_MEDIA_ROOT_CHANGED', 409)
  }
  return normalizeAdvAssetManifest({ ...incoming, assets }, { allowEmpty: true })
}

/** Finite mirror writes reuse native locks and keep all server take identities. */
export async function createHostedVoiceProjectSync(root: string, options: { validateVoiceDesign?: (incoming: Record<string, string>, current: Record<string, string>) => Promise<Record<string, string>>, validateProtectedFiles?: (incoming: Record<string, string>, current: Record<string, string>) => Promise<void> } = {}) {
  root = await realpath(root)
  async function readFiles() {
    const files: Record<string, string> = {}
    let bytes = 0
    async function read(path: string) {
      const target = await realpath(resolve(root, path))
      if (!inside(root, target) || !(await stat(target)).isFile())
        fail('ADV_AUDIO_SYNC_PATH_INVALID')
      const info = await stat(target)
      bytes += info.size
      if (info.size > 1024 * 1024 || bytes > MAX_SOURCE_BYTES)
        fail('ADV_AUDIO_SYNC_SOURCE_LIMIT', 413)
      files[path] = await readFile(target, 'utf8')
    }
    async function walk(directory: string) {
      for (const entry of await readdir(resolve(root, directory), { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))) {
        if (RESERVED.has(entry.name.toLowerCase()) || entry.isSymbolicLink())
          continue
        const path = `${directory}/${entry.name}`
        if (entry.isDirectory())
          await walk(path)
        else if (BASE_DOCUMENT.test(path))
          await read(path)
      }
    }
    if ((await lstat(resolve(root, 'adv.config.json')).catch(() => undefined))?.isFile())
      await read('adv.config.json')
    await walk('adv')
    await walk('authoring/voices')
    for (const path of consentPaths(files)) {
      if (files[path] === undefined && (await lstat(resolve(root, path)).catch(() => undefined))?.isFile())
        await read(path)
    }
    return files
  }
  const revision = (files: Record<string, string>) => createHash('sha256').update(canonicalAudioJson(files)).digest('hex')
  async function nativeAssetPath(manifest: AdvAssetManifest, asset: AdvAssetEntry, write = false) {
    const path = audioProjectMediaPath(manifest, asset)
    canonicalPath(path)
    if (!/\.(?:wav|mp3|m4a|aac|ogg|opus|flac|webm)$/iu.test(path))
      fail('ADV_AUDIO_SYNC_MEDIA_FORMAT_INVALID')
    const target = write ? await projectWriteTarget(root, path) : resolve(root, path)
    let ancestor = target
    while (true) {
      const canonical = await realpath(ancestor).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
      if (canonical) {
        if (!inside(root, canonical))
          fail('ADV_AUDIO_SYNC_PATH_INVALID')
        break
      }
      ancestor = resolve(ancestor, '..')
    }
    if (!inside(root, target))
      fail('ADV_AUDIO_SYNC_PATH_INVALID')
    return target
  }
  async function state(files: Record<string, string>): Promise<HostedVoiceSyncState> {
    const missingMedia: HostedVoiceSyncState['missingMedia'] = []
    if (files['adv/assets.json']) {
      const manifest = catalog(files)
      for (const asset of manifest.assets.filter(asset => asset.type === 'audio' && AUDIO_KINDS.includes(asset.kind))) {
        if (!asset.path || !asset.sha256)
          continue
        const path = await nativeAssetPath(manifest, asset)
        const info = await stat(path).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
        if (!info) {
          missingMedia.push({ assetId: asset.id, sha256: asset.sha256, kind: asset.kind as HostedVoiceSyncState['missingMedia'][number]['kind'], ...(asset.bytes === undefined ? {} : { bytes: asset.bytes }), ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) })
        }
        else if (!info.isFile() || info.size > 64 * 1024 * 1024 || createHash('sha256').update(await readFile(path)).digest('hex') !== asset.sha256 || (asset.bytes !== undefined && asset.bytes !== info.size)) {
          fail('ADV_AUDIO_SYNC_MEDIA_CHANGED', 409)
        }
      }
    }
    return { revision: revision(files), missingMedia }
  }
  return {
    async read() {
      return await withProjectWriteLock(root, async () => state(await readFiles()))
    },
    async sync(input: HostedVoiceSyncInput) {
      if (!object(input) || Object.keys(input).some(key => !['expectedRevision', 'files'].includes(key)) || typeof input.expectedRevision !== 'string')
        fail('ADV_AUDIO_SYNC_INPUT_INVALID')
      const incoming = parseFiles(input.files)
      return await withProjectWriteLock(root, async () => {
        const current = await readFiles()
        if (revision(current) !== input.expectedRevision)
          fail('ADV_AUDIO_SYNC_CONFLICT', 409)
        await options.validateProtectedFiles?.(incoming, current)
        const merged = mergeCatalog(current['adv/assets.json'] ? catalog(current) : undefined, catalog(incoming))
        const ledger = mergeLedger(current['adv/audio/voice-ledger.json'] ? parseVoiceLedger(current['adv/audio/voice-ledger.json']) : createVoiceLedger(), incoming['adv/audio/voice-ledger.json'] ? parseVoiceLedger(incoming['adv/audio/voice-ledger.json']) : createVoiceLedger())
        const next: Record<string, string> = { ...incoming, 'adv/assets.json': `${JSON.stringify(merged, null, 2)}\n`, 'adv/audio/voice-ledger.json': `${JSON.stringify(ledger, null, 2)}\n` }
        const designFiles = Object.keys({ ...current, ...incoming }).filter(path => path.startsWith('authoring/voices/'))
        if (designFiles.length) {
          if (!options.validateVoiceDesign)
            fail('VOICE_DESIGN_SYNC_UNSUPPORTED')
          Object.assign(next, await options.validateVoiceDesign(incoming, current))
        }
        for (const path of consentPaths(current)) {
          if (current[path] !== undefined && next[path] === undefined)
            next[path] = current[path]!
        }
        // Includes have been flattened into the sole canonical catalog.
        for (const path of Object.keys(next)) {
          if (path.startsWith('adv/assets/'))
            delete next[path]
        }
        const compiled = await compileProject({ files: next }, { allowEmptyAssetManifest: true })
        if (compiled.project.root !== 'adv' || !compiled.project.program || compiled.diagnostics.some(item => item.severity === 'error'))
          fail(compiled.diagnostics.find(item => item.severity === 'error')?.code ?? 'ADV_AUDIO_SYNC_PROJECT_INVALID')
        canonicalAudioJson(compiled.project.characters)
        const coordinates = new Set([...Object.keys(current), ...Object.keys(next)])
        const changed: Array<{ path: string, target: string, previous: string | undefined }> = []
        try {
          for (const path of coordinates) {
            if (current[path] === next[path])
              continue
            const target = await projectWriteTarget(root, path)
            changed.push({ path, target, previous: current[path] })
            if (next[path] === undefined)
              await rm(target, { force: true })
            else
              await atomicProjectWrite(target, next[path]!)
          }
          const canonicalChanges = Object.keys(next).filter(path => incoming[path] !== next[path]).map(path => ({ path, expected: incoming[path] ?? null, content: next[path]! }))
          return { ...await state(next), changes: canonicalChanges }
        }
        catch (error) {
          for (const entry of changed.reverse()) {
            if (entry.previous === undefined)
              await rm(entry.target, { force: true })
            else
              await atomicProjectWrite(entry.target, entry.previous)
          }
          throw error
        }
      })
    },
    async upload(assetId: string, bytes: Uint8Array, sha256: string, mimeType: string) {
      return await withProjectWriteLock(root, async () => {
        const files = await readFiles()
        const manifest = catalog(files)
        const asset = manifest.assets.find(asset => asset.id === assetId && asset.type === 'audio' && AUDIO_KINDS.includes(asset.kind))
        if (!asset || !asset.path || !asset.sha256 || asset.sha256 !== sha256 || !bytes.length || bytes.length > 64 * 1024 * 1024
          || createHash('sha256').update(bytes).digest('hex') !== sha256 || (asset.bytes !== undefined && bytes.length !== asset.bytes) || !/^audio\/[\w.+-]+$/u.test(mimeType) || (asset.mimeType && asset.mimeType !== mimeType)) {
          fail('ADV_AUDIO_SYNC_MEDIA_INVALID')
        }
        const path = await nativeAssetPath(manifest, asset, true)
        const existing = await readFile(path).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
        if (existing) {
          if (createHash('sha256').update(existing).digest('hex') !== sha256)
            fail('ADV_AUDIO_SYNC_IMMUTABLE_MEDIA', 409)
        }
        else {
          // Linking a durable sibling never replaces a master created by an
          // external author while this project lock was held.
          const temporary = resolve(dirname(path), `.advjs-audio-${randomUUID()}.tmp`)
          try {
            const file = await open(temporary, 'wx', 0o600)
            try {
              await file.writeFile(bytes)
              await file.sync()
            }
            finally { await file.close() }
            await link(temporary, path).catch(async (error) => {
              if (error.code !== 'EEXIST')
                throw error
              const authoritative = await nativeAssetPath(manifest, asset)
              const info = await stat(authoritative)
              if (!info.isFile() || info.size !== bytes.length || createHash('sha256').update(await readFile(authoritative)).digest('hex') !== sha256)
                fail('ADV_AUDIO_SYNC_IMMUTABLE_MEDIA', 409)
            })
          }
          finally { await rm(temporary, { force: true }) }
        }
        return { assetId, sha256, bytes: bytes.length }
      })
    },
  }
}
