import type { AdvData, ResolvedAdvOptions } from '@advjs/types'
import type { PluginContext } from 'rollup'
import { realpath } from 'node:fs/promises'
import { createAdvAssetCatalog } from '@advjs/assets'
import { isAbsolute, relative, resolve } from 'pathe'
import { loadProject } from '../project'
import { toAtFS } from '../resolver'

/** Compile canonical Markdown content into the existing client configuration. */
export async function createProjectDataModule(
  options: Pick<ResolvedAdvOptions, 'userRoot' | 'data'>,
  context: Pick<PluginContext, 'addWatchFile'>,
): Promise<string | undefined> {
  const loaded = await loadProject({ root: options.userRoot })
  const config = JSON.parse(loaded.files['adv.config.json'] ?? '{}')
  if (config.format !== 'adv-md')
    return undefined
  const { project, diagnostics } = loaded.result
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error')
  if (errors.length)
    throw new Error(`Project compilation failed: ${errors[0].code} ${errors[0].message}`)

  for (const file of Object.keys(loaded.files))
    context.addWatchFile(resolve(loaded.root, file))
  const root = await realpath(loaded.root)
  const imports: string[] = []
  const bindings: string[] = []

  async function bindAsset(src: string, target: string, projectPath = false): Promise<void> {
    if (/^(?:https?:|data:|blob:)/u.test(src)) {
      bindings.push(`${target} = ${JSON.stringify(src)}`)
      return
    }
    if (!projectPath && src.startsWith('/')) {
      bindings.push(`${target} = ${JSON.stringify(src)}`)
      return
    }
    const path = resolve(loaded.root, src)
    const actual = await realpath(path).catch(() => {
      throw new Error(`Missing runtime asset: ${src}. Run adv assets pull before building.`)
    })
    const relativePath = relative(root, actual)
    if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith('../'))
      throw new Error(`Runtime asset escapes the project root: ${src}`)
    context.addWatchFile(path)
    const name = `__adv_asset_${imports.length}`
    imports.push(`import ${name} from ${JSON.stringify(`${toAtFS(path)}?url`)}`)
    bindings.push(`${target} = ${name}`)
  }

  const catalog = project.assets
    ? createAdvAssetCatalog(project.assets, {
        // Local downloaded previews produce a self-contained deployment.
        profile: project.assets.profiles.local ? 'local' : undefined,
        adapter: {
          resolve(request) {
            return request.provider === 'project' || /^(?:https?:|data:|blob:)/u.test(request.location)
              ? request.location
              : new URL(request.location, request.baseUrl).href
          },
        },
      })
    : undefined

  const gameConfig: AdvData['gameConfig'] = {
    ...options.data.gameConfig,
    ...project.game,
    chapters: project.chapters.map(chapter => ({
      id: chapter.id,
      title: chapter.title ?? chapter.id,
      nodes: chapter.sources.map((source, order) => ({
        id: `${chapter.id}:source:${order + 1}`,
        order,
        type: 'fountain',
        src: `data:text/markdown;charset=utf-8,${encodeURIComponent(loaded.files[source])}`,
      })),
    })),
    // Only playback fields are shipped; authoring cards and visual references stay private.
    characters: project.characters.map(({ id, name, aliases, avatar, avatars, tachies }) => ({ id, name, aliases, avatar, avatars, tachies })),
    scenes: project.scenes.map(({ id, name, alias, type }) => type === 'model'
      ? { id, name, alias, type: 'model' }
      : { id, name, alias, type: 'image', src: '' }),
    requiredPlugins: Object.fromEntries(project.plugins.map(plugin => [plugin.name, plugin.version])),
  }
  for (const [index, scene] of project.scenes.entries()) {
    const target = `data.gameConfig.scenes[${index}].src`
    if (scene.assetId && catalog) {
      const asset = await catalog.resolve(scene.assetId)
      await bindAsset(asset.src, target, true)
    }
    else if (scene.src) {
      await bindAsset(scene.src, target)
    }
  }
  for (const [index, character] of gameConfig.characters.entries()) {
    if (character.avatar)
      await bindAsset(character.avatar, `data.gameConfig.characters[${index}].avatar`)
    for (const [status, avatar] of Object.entries(character.avatars ?? {}))
      await bindAsset(avatar.src, `data.gameConfig.characters[${index}].avatars[${JSON.stringify(status)}].src`)
    for (const [name, tachie] of Object.entries(character.tachies ?? {}))
      await bindAsset(tachie.src, `data.gameConfig.characters[${index}].tachies[${JSON.stringify(name)}].src`)
  }
  catalog?.dispose()
  return [
    ...imports,
    `const data = ${JSON.stringify({ ...options.data, gameConfig })}`,
    ...bindings,
    'export default data',
  ].join('\n')
}
