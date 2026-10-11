import type { AdvAst, AdvCharacter, AdvGameConfig, AdvProjectCompileResult, AdvProjectFileMap, JsonObject } from '@advjs/types'
import { isRuntimeAudioAsset, parseAudioMixerConfig, parseVoiceLedger, projectRuntimeAudioAsset, projectRuntimeVoiceLedger, runtimeAudioAssetIds } from '@advjs/audio'
import { projectGlossarySource, readGlossaryContent } from '@advjs/parser'
import { projectRuntimeFlowChapter } from './flow'

/** Player identity deliberately excludes author notes, AI prompts and private attributes. */
export function toPlayerCharacter(character: AdvCharacter): AdvCharacter {
  const { id, name, avatar, avatars, aliases, actor, cv, tachies } = character
  return {
    id,
    name,
    avatar,
    aliases,
    actor,
    cv,
    avatars: avatars ? Object.fromEntries(Object.entries(avatars).map(([status, portrait]) => [status, { src: portrait.src, label: portrait.label }])) : undefined,
    tachies: tachies
      ? Object.fromEntries(Object.entries(tachies).map(([status, tachie]) => {
          const { src, class: className, style, sprite } = tachie
          return [status, {
            src,
            class: className,
            style,
            sprite: sprite ? { frameWidth: sprite.frameWidth, frameHeight: sprite.frameHeight, frames: sprite.frames, fps: sprite.fps, loop: sprite.loop } : undefined,
          }]
        }))
      : undefined,
  }
}

export function toPlayerScene<T extends { imagePrompt?: string }>(scene: T): T {
  const { imagePrompt: _imagePrompt, ...playerScene } = scene
  return playerScene as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function dataUrl(content: string) {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`
}

/** Reuse the existing Markdown chapter transport, never ship author material. */
function playerChapterSources(compilation: AdvProjectCompileResult, files: AdvProjectFileMap, chapterId: string, sources: string[]) {
  const contents = sources.map(source => files[source] ?? '')
  const references = new Map<string, AdvAst.GlossaryDefinition>()
  const chapter = compilation.project.program?.chapters[chapterId]
  for (const node of Object.values(chapter?.nodes ?? {})) {
    if (!Array.isArray(node.data?.glossary))
      continue
    for (const item of node.data.glossary) {
      if (isRecord(item) && typeof item.identifier === 'string' && typeof item.definition === 'string')
        references.set(item.identifier, { text: item.definition, content: readGlossaryContent(item.definitionContent) })
    }
  }
  const stripped = projectGlossarySource(contents.join('\n\n'), new Map())
  let offset = 0
  return contents.map((content, index) => {
    const source = stripped.slice(offset, offset + content.length)
    offset += content.length + 2
    return index === 0 ? projectGlossarySource(source, references) : source
  })
}

function currentProgramVoiceLedger(compilation: AdvProjectCompileResult, source: string) {
  const ledger = parseVoiceLedger(JSON.parse(source))
  const currentLines = new Set<string>()
  for (const chapter of Object.values(compilation.project.program?.chapters ?? {})) {
    for (const node of Object.values(chapter.nodes)) {
      if ((node.kind === 'dialog' || node.kind === 'narration') && typeof node.data?.lineId === 'string')
        currentLines.add(node.data.lineId)
    }
  }
  // Deleted dialogue stays in the native author ledger, but cannot publish audio.
  return projectRuntimeVoiceLedger({ ...ledger, lines: Object.fromEntries(Object.entries(ledger.lines).filter(([lineId]) => currentLines.has(lineId))) })
}

export function createProjectGameConfig(compilation: AdvProjectCompileResult, files: AdvProjectFileMap): AdvGameConfig {
  const { project } = compilation
  const game = project.game as JsonObject
  const bgm = isRecord(game.bgm) ? game.bgm : {}
  const gallery = isRecord(game.gallery) ? game.gallery : undefined
  const progression = isRecord(game.progression) ? game.progression : undefined
  const variables = isRecord(game.variables) ? game.variables : undefined
  const ledger = files['adv/audio/voice-ledger.json'] ? currentProgramVoiceLedger(compilation, files['adv/audio/voice-ledger.json']) : undefined
  const selectedVoiceIds = runtimeAudioAssetIds(ledger)

  return {
    audio: {
      assets: Object.fromEntries((project.assets?.assets ?? []).filter(asset => isRuntimeAudioAsset(asset, selectedVoiceIds)).map(asset => [asset.id, projectRuntimeAudioAsset(asset)])),
      ...(files['adv/audio/mixer.json'] ? { mixer: parseAudioMixerConfig(JSON.parse(files['adv/audio/mixer.json'])) } : {}),
      ...(ledger ? { voiceLedger: ledger } : {}),
      locale: typeof game.locale === 'string' ? game.locale : 'zh-CN',
    },
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
    chapters: project.chapters.map((chapter) => {
      if (chapter.flow)
        return projectRuntimeFlowChapter(chapter.flow)
      const contents = playerChapterSources(compilation, files, chapter.id, chapter.sources)
      return ({
        id: chapter.id,
        title: chapter.title ?? chapter.id,
        nodes: chapter.sources.map((_source, order) => ({
          id: `${chapter.id}:source:${order + 1}`,
          order,
          src: dataUrl(contents[order]),
          type: 'fountain' as const,
        })),
      })
    }),
    entryChapterId: project.entryChapterId,
    characters: project.characters.map(toPlayerCharacter),
    scenes: project.scenes.map(scene => scene.type === 'model'
      ? { ...toPlayerScene(scene), type: 'model' as const }
      : { ...toPlayerScene(scene), src: scene.src ?? '', type: 'image' as const }),
    requiredPlugins: Object.fromEntries(project.plugins.map(plugin => [plugin.name, plugin.version])),
    gallery: gallery as AdvGameConfig['gallery'],
    progression: progression as AdvGameConfig['progression'],
    variables,
  }
}
