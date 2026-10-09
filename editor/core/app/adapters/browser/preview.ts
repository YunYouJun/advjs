import type { AdvGameConfig, AdvScene } from '@advjs/types'
import type { EditorProjectModel } from './project'
import { createAdvAssetCatalog } from '@advjs/assets'
import { projectAssetPath } from '../../utils/project-files'

/** Resolve preview media without changing authored sources or the compiled Program. */
export async function resolveBrowserPreviewConfig(
  model: EditorProjectModel,
  assetUrl: (path: string) => Promise<string>,
): Promise<AdvGameConfig> {
  const config = model.previewConfig
  const filePaths = model.filePaths ?? Object.keys(model.files)
  const pending = new Map<string, Promise<string>>()
  const localUrl = async (value: string): Promise<string> => {
    if (!value || /^(?:[a-z][\da-z+.-]*:|\/\/)/iu.test(value) || value.includes('\\') || [...value].some(character => character.charCodeAt(0) < 32))
      return value
    const path = value.split(/[?#]/u)[0]
    if (path.split('/').includes('..'))
      return value
    const resolved = projectAssetPath(path, filePaths)
    // URLs absent from this project retain their existing host behavior.
    if (!filePaths.includes(resolved))
      return value
    let url = pending.get(resolved)
    if (!url) {
      url = assetUrl(resolved)
      pending.set(resolved, url)
    }
    const hash = value.includes('#') ? value.slice(value.indexOf('#')) : ''
    return `${await url}${hash}`
  }
  const manifest = model.compilation.project.assets
  const catalog = manifest && createAdvAssetCatalog(manifest, {
    adapter: {
      async resolve(asset) {
        if (asset.provider === 'project') {
          if (!filePaths.includes(asset.location))
            return asset.location
          return await localUrl(asset.location)
        }
        if (/^(?:https?:|blob:|data:)/iu.test(asset.location))
          return asset.location
        if (!asset.baseUrl)
          throw new Error(`Asset profile "${asset.profile}" has no baseUrl`)
        return new URL(asset.location, asset.baseUrl).href
      },
    },
  })
  const projectScenes = new Map(model.compilation.project.scenes.map(scene => [scene.id, scene]))
  const scenes: AdvScene[] = await Promise.all(config.scenes.map(async (scene) => {
    if (scene.type !== 'image')
      return scene
    const assetId = projectScenes.get(scene.id)?.assetId
    let src = scene.src
    if (assetId && catalog) {
      // Unknown references already have a source diagnostic. Keep the project
      // openable so its scene/catalog can be repaired in the source editor.
      const asset = catalog.get(assetId)
      if (asset) {
        const local = manifest?.profiles.local
        // Mixed catalogs can contain remote-only entries. Prefer the local
        // profile only when it can address this entry or declares a fallback.
        const preferLocal = local && ((local.provider === 'project' && asset.path) || local.fallback)
        src = (await catalog.resolve(assetId, { profile: preferLocal ? 'local' : undefined })).src
      }
    }
    else {
      src = await localUrl(scene.src)
    }
    return { ...scene, src }
  }))

  // Runtime effects keep their authored URLs. Register preview aliases so both
  // scene names and direct background URLs resolve to the same local image.
  const backgrounds = new Map<string, string>()
  config.scenes.forEach((scene, index) => {
    const resolved = scenes[index]
    if (scene.type === 'image' && scene.src && resolved.type === 'image' && scene.src !== resolved.src)
      backgrounds.set(scene.src, resolved.src)
  })
  for (const chapter of Object.values(model.compilation.project.program?.chapters ?? {})) {
    for (const node of Object.values(chapter.nodes)) {
      if (node.kind !== 'effects' || !Array.isArray(node.data?.operations))
        continue
      for (const operation of node.data.operations) {
        if (!operation || typeof operation !== 'object' || Array.isArray(operation) || operation.type !== 'background' || typeof operation.url !== 'string')
          continue
        const src = await localUrl(operation.url)
        if (src !== operation.url)
          backgrounds.set(operation.url, src)
      }
    }
  }
  for (const [alias, src] of backgrounds) {
    if (!scenes.some(scene => scene.id === alias || scene.alias === alias))
      scenes.push({ id: `project-background:${encodeURIComponent(alias)}`, alias, type: 'image', src })
  }

  return {
    ...config,
    cover: config.cover ? await localUrl(config.cover) : config.cover,
    favicon: await localUrl(config.favicon),
    scenes,
    characters: await Promise.all(config.characters.map(async character => ({
      ...character,
      avatar: character.avatar ? await localUrl(character.avatar) : character.avatar,
      tachies: character.tachies && Object.fromEntries(await Promise.all(Object.entries(character.tachies).map(async ([name, tachie]) => [name, { ...tachie, src: await localUrl(tachie.src) }]))),
    }))),
    gallery: config.gallery && {
      ...config.gallery,
      items: await Promise.all(config.gallery.items.map(async item => ({ ...item, src: await localUrl(item.src), thumbnail: item.thumbnail ? await localUrl(item.thumbnail) : item.thumbnail }))),
    },
  }
}
