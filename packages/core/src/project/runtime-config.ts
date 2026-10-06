import type { AdvGameConfig, AdvProjectCompileResult, AdvProjectFileMap, JsonObject } from '@advjs/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function dataUrl(content: string) {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`
}

export function createProjectGameConfig(compilation: AdvProjectCompileResult, files: AdvProjectFileMap): AdvGameConfig {
  const { project } = compilation
  const game = project.game as JsonObject
  const bgm = isRecord(game.bgm) ? game.bgm : {}
  const gallery = isRecord(game.gallery) ? game.gallery : undefined
  const progression = isRecord(game.progression) ? game.progression : undefined
  const variables = isRecord(game.variables) ? game.variables : undefined

  return {
    title: typeof game.title === 'string' ? game.title : project.id,
    description: typeof game.description === 'string' ? game.description : '',
    favicon: typeof game.favicon === 'string' ? game.favicon : '/favicon.svg',
    cover: typeof game.cover === 'string' ? game.cover : undefined,
    bgm: {
      autoplay: typeof bgm.autoplay === 'boolean' ? bgm.autoplay : false,
      library: typeof bgm.library === 'string' || isRecord(bgm.library)
        ? bgm.library as AdvGameConfig['bgm']['library']
        : undefined,
    },
    assets: {
      manifest: { bundles: [] },
    },
    chapters: project.chapters.map(chapter => ({
      id: chapter.id,
      title: chapter.title ?? chapter.id,
      nodes: chapter.sources.map((source, order) => ({
        id: `${chapter.id}:source:${order + 1}`,
        order,
        src: dataUrl(files[source] ?? ''),
        type: 'fountain' as const,
      })),
    })),
    characters: project.characters,
    scenes: project.scenes.map(scene => scene.type === 'model'
      ? { ...scene, type: 'model' as const }
      : { ...scene, src: scene.src ?? '', type: 'image' as const }),
    requiredPlugins: Object.fromEntries(project.plugins.map(plugin => [plugin.name, plugin.version])),
    gallery: gallery as AdvGameConfig['gallery'],
    progression: progression as AdvGameConfig['progression'],
    variables,
  }
}
