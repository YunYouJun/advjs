import type { AdvAssetManifest, AdvGameConfig, AdvMusic } from '@advjs/types'
import type { LoadedProject } from '../../project'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { createAdvAssetCatalog } from '@advjs/assets'
import { resolveRuntimeAudioAsset } from '@advjs/audio'
import { createProjectGameConfig } from '@advjs/core'
import { createPublishedAudioCatalog, publishedAudioAsset } from './audio-release'

// Native builds use explicit resources; the starter icon needs no public copy.
const BUILTIN_FAVICON = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path d="M14 10.25L17 8v6l-3-2.25V14H7V8h7v2.25zM5.763 17H20V5H4v13.385L5.763 17zm.692 2L2 22.5V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.455z"/></svg>').toString('base64')}`

/** Resolve validated native chapters and bundle project media for ordinary static hosting. */
export async function prepareProjectGame(loaded: LoadedProject, options: { publishedAudioCatalog?: AdvAssetManifest } = {}) {
  const game = createProjectGameConfig(loaded.result, loaded.files)
  const resources = new Map<string, Buffer>()
  const remoteOrigins = new Set<string>()
  const root = await realpath(loaded.root)
  async function localSource(source: string, expectedHash?: string, expectedBytes?: number, bundle = true) {
    if (source.startsWith('blob:'))
      throw new Error('Temporary Blob URLs cannot be exported; import the resource into the project')
    if (/^https?:/u.test(source)) {
      if (bundle)
        remoteOrigins.add(new URL(source).origin)
      return source
    }
    if (source.startsWith('data:'))
      return source
    const candidates = source.startsWith('/')
      ? [resolve(root, 'public', `.${source}`), resolve(root, `.${source}`)]
      : [resolve(root, source), resolve(root, 'public', source)]
    const target = await Promise.any(candidates.map(path => realpath(path))).catch(() => {
      throw new Error(`Missing project resource: ${source}`)
    })
    const path = relative(root, target)
    if (isAbsolute(path) || path === '..' || path.startsWith('../'))
      throw new Error(`Resource escapes project: ${source}`)
    const bytes = await readFile(target)
    const hash = createHash('sha256').update(bytes).digest('hex')
    if ((expectedHash && hash !== expectedHash) || (expectedBytes !== undefined && bytes.byteLength !== expectedBytes))
      throw new Error(`ADV_AUDIO_MEDIA_CHANGED: Project media differs from its catalog: ${source}`)
    const name = `project-assets/${hash}${extname(target)}`
    if (!bundle)
      return source
    resources.set(name, bytes)
    return `./${name}`
  }
  const manifest = loaded.result.project.assets
  const runtimeAudioIds = new Set(Object.keys(game.audio?.assets ?? {}))
  const published = options.publishedAudioCatalog ? createPublishedAudioCatalog(manifest, options.publishedAudioCatalog, game.audio?.voiceLedger, runtimeAudioIds) : undefined
  const catalog = manifest
    ? createAdvAssetCatalog(manifest, { profile: manifest.profiles.local ? 'local' : undefined, adapter: {
        async resolve(request) {
          const audio = request.asset.type === 'audio'
          const source = request.variant ? request.asset.variants?.[request.variant] : request.asset
          if (audio && request.variant && request.provider === 'project' && (!source?.sha256 || !Number.isSafeInteger(source.bytes) || source.bytes! <= 0))
            throw new Error('ADV_AUDIO_VARIANT_IDENTITY_REQUIRED: Local processed audio requires its hash and byte count')
          return await localSource(request.provider === 'project' ? request.location : request.baseUrl ? new URL(request.location, request.baseUrl).href : request.location, audio ? source?.sha256 : undefined, audio ? source?.bytes : undefined, !(published && audio))
        },
      } })
    : undefined
  game.characters = await Promise.all(game.characters.map(async character => ({
    ...character,
    ...(character.avatar ? { avatar: await localSource(character.avatar) } : {}),
    avatars: character.avatars ? Object.fromEntries(await Promise.all(Object.entries(character.avatars).map(async ([status, portrait]) => [status, { ...portrait, src: await localSource(portrait.src) }]))) : undefined,
    tachies: character.tachies ? Object.fromEntries(await Promise.all(Object.entries(character.tachies).map(async ([name, tachie]) => [name, { ...tachie, src: await localSource(tachie.src) }]))) : undefined,
  })))
  game.scenes = await Promise.all(game.scenes.map(async (scene) => {
    const source = loaded.result.project.scenes.find(item => item.id === scene.id)
    const src = source?.assetId && catalog ? (await catalog.resolve(source.assetId)).src : 'src' in scene && scene.src ? await localSource(scene.src) : ''
    return { ...scene, src }
  }))
  for (const chapter of game.chapters) {
    for (const node of chapter.nodes) {
      if (node.type === 'background' && node.src)
        node.src = await localSource(node.src)
    }
  }
  const library: Record<string, AdvMusic> = typeof game.bgm.library === 'object' ? Object.fromEntries(Object.entries(game.bgm.library).filter((entry): entry is [string, AdvMusic] => !Array.isArray(entry[1]))) : {}
  for (const id of Object.keys(library)) {
    if (manifest?.assets.find(asset => asset.id === id)?.music && !runtimeAudioIds.has(id))
      delete library[id]
  }
  for (const [id, track] of Object.entries(library)) {
    if (published) {
      if (published.get(id)?.kind !== 'bgm')
        throw new Error('ADV_AUDIO_RELEASE_UNREGISTERED_BGM')
      continue
    }
    if (track.src)
      library[id] = { ...track, src: await localSource(track.src) }
  }
  if (catalog) {
    for (const asset of manifest!.assets.filter(item => item.type === 'audio' && item.kind === 'bgm' && runtimeAudioIds.has(item.id))) {
      const selected = published ?? catalog
      const transport = published ? publishedAudioAsset(published, asset.id) : asset
      library[asset.id] = { name: asset.title ?? asset.id, src: (await resolveRuntimeAudioAsset(transport, async variant => (await selected.resolve(asset.id, { variant })).src)).src, description: asset.alt ?? '' }
    }
  }
  game.bgm = { ...game.bgm, library }
  if (catalog && game.audio) {
    for (const id of Object.keys(game.audio.assets)) {
      if (published)
        await catalog.resolve(id)
      const selected = published ?? catalog
      const transport = published ? publishedAudioAsset(published, id) : catalog.get(id)!
      game.audio.assets[id] = await resolveRuntimeAudioAsset(transport, async variant => (await selected.resolve(id, { variant })).src)
      if (published)
        remoteOrigins.add(new URL(game.audio.assets[id]!.src).origin)
    }
  }
  if (game.cover)
    game.cover = await localSource(game.cover)
  const authored = loaded.result.project.game.favicon
  if (typeof authored === 'string' && authored) {
    const src = await localSource(authored)
    const bytes = resources.get(src.replace(/^\.\//u, ''))
    if (bytes) {
      const mime = ({ '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' } as Record<string, string>)[extname(authored).toLowerCase()]
      if (!mime)
        throw new Error('ADV_AUDIO_RELEASE_FAVICON_FORMAT_INVALID')
      game.favicon = `data:${mime};base64,${bytes.toString('base64')}`
    }
    else { game.favicon = src }
  }
  else {
    // No project icon is declared; a built-in inline icon needs no public copy.
    game.favicon = BUILTIN_FAVICON
  }
  return { game: game as AdvGameConfig, resources, remoteOrigins: [...remoteOrigins] }
}
