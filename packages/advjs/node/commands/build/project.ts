import type { AdvGameConfig, AdvMusic } from '@advjs/types'
import type { Buffer } from 'node:buffer'
import type { LoadedProject } from '../../project'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { createAdvAssetCatalog } from '@advjs/assets'
import { createProjectGameConfig } from '@advjs/core'

/** Resolve saved Markdown content and bundle project media for ordinary static hosting. */
export async function prepareProjectGame(loaded: LoadedProject) {
  const game = createProjectGameConfig(loaded.result, loaded.files)
  const resources = new Map<string, Buffer>()
  const remoteOrigins = new Set<string>()
  const root = await realpath(loaded.root)
  async function localSource(source: string) {
    if (source.startsWith('blob:'))
      throw new Error('Temporary Blob URLs cannot be exported; import the resource into the project')
    if (/^https?:/u.test(source)) {
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
    const name = `project-assets/${createHash('sha256').update(bytes).digest('hex')}${extname(target)}`
    resources.set(name, bytes)
    return `./${name}`
  }
  const manifest = loaded.result.project.assets
  const catalog = manifest ? createAdvAssetCatalog(manifest, { profile: manifest.profiles.local ? 'local' : undefined, adapter: { resolve: async asset => await localSource(asset.provider === 'project' ? asset.location : asset.baseUrl ? new URL(asset.location, asset.baseUrl).href : asset.location) } }) : undefined
  game.characters = await Promise.all(game.characters.map(async character => ({
    ...character,
    ...(character.avatar ? { avatar: await localSource(character.avatar) } : {}),
    tachies: character.tachies ? Object.fromEntries(await Promise.all(Object.entries(character.tachies).map(async ([name, tachie]) => [name, { ...tachie, src: await localSource(tachie.src) }]))) : undefined,
  })))
  game.scenes = await Promise.all(game.scenes.map(async (scene) => {
    const source = loaded.result.project.scenes.find(item => item.id === scene.id)
    const src = source?.assetId && catalog ? (await catalog.resolve(source.assetId)).src : 'src' in scene && scene.src ? await localSource(scene.src) : ''
    return { ...scene, src }
  }))
  const library: Record<string, AdvMusic> = typeof game.bgm.library === 'object' ? Object.fromEntries(Object.entries(game.bgm.library).filter((entry): entry is [string, AdvMusic] => !Array.isArray(entry[1]))) : {}
  for (const [id, track] of Object.entries(library)) {
    if (track.src)
      library[id] = { ...track, src: await localSource(track.src) }
  }
  if (catalog) {
    for (const asset of manifest!.assets.filter(item => item.type === 'audio')) library[asset.id] = { name: asset.title ?? asset.id, src: (await catalog.resolve(asset.id)).src, description: asset.alt ?? '' }
  }
  game.bgm = { ...game.bgm, library }
  if (game.cover)
    game.cover = await localSource(game.cover)
  return { game: game as AdvGameConfig, resources, remoteOrigins: [...remoteOrigins] }
}
