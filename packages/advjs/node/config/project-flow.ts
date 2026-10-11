import type { AdvGameAudioConfig } from '@advjs/types'
import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { createAdvAssetCatalog } from '@advjs/assets'
import { createProjectGameConfig } from '@advjs/core'
import { loadProject } from '../project'
import { toAtFS } from '../resolver'

/** Native Flow uses the same pure project compiler in dev and static builds. */
export async function loadStandardFlowGame(root: string, audio?: AdvGameAudioConfig) {
  const loaded = await loadProject({ root })
  const errors = loaded.result.diagnostics.filter(issue => issue.severity === 'error')
  if (!loaded.result.project.program || errors.length)
    throw new Error(`Flow project compilation failed: ${errors[0]?.code ?? 'ADV_RUNTIME_NO_CHAPTERS'} ${errors[0]?.message ?? 'No compiled chapters'}`)
  const game = createProjectGameConfig(loaded.result, loaded.files)
  if (audio)
    game.audio = { ...audio, locale: game.audio?.locale }
  const boundRoot = await realpath(root)
  const localSource = async (source: string) => {
    if (/^(?:https?:|data:)/u.test(source))
      return source
    const candidates = source.startsWith('/')
      ? [resolve(root, 'public', `.${source}`), resolve(root, `.${source}`)]
      : [resolve(root, source), resolve(root, 'public', source)]
    const target = await Promise.any(candidates.map(path => realpath(path))).catch(() => {
      throw new Error(`Missing Flow project resource: ${source}`)
    })
    const bound = relative(boundRoot, target)
    if (isAbsolute(bound) || bound === '..' || bound.startsWith('../'))
      throw new Error('ADV_PROJECT_RESOURCE_ESCAPE: Flow media escapes project')
    return toAtFS(target)
  }
  const manifest = loaded.result.project.assets
  const catalog = manifest
    ? createAdvAssetCatalog(manifest, { adapter: {
        async resolve(request) {
          return request.provider === 'http' ? request.baseUrl ? new URL(request.location, request.baseUrl).href : request.location : localSource(request.location)
        },
      } })
    : undefined
  game.scenes = await Promise.all(game.scenes.map(async (scene) => {
    const authored = loaded.result.project.scenes.find(item => item.id === scene.id)
    const src = authored?.assetId && catalog ? (await catalog.resolve(authored.assetId)).src : 'src' in scene && scene.src ? await localSource(scene.src) : ''
    return { ...scene, src }
  }))
  game.characters = await Promise.all(game.characters.map(async character => ({
    ...character,
    ...(character.avatar ? { avatar: await localSource(character.avatar) } : {}),
    ...(character.tachies ? { tachies: Object.fromEntries(await Promise.all(Object.entries(character.tachies).map(async ([name, tachie]) => [name, { ...tachie, src: await localSource(tachie.src) }]))) } : {}),
  })))
  for (const chapter of game.chapters) {
    for (const node of chapter.nodes) {
      if (node.type === 'background' && node.src)
        node.src = await localSource(node.src)
    }
  }
  return game
}
