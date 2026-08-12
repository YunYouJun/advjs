import type { AdvAssetCatalog } from '@advjs/core'
import type {
  AdvChapter,
  AdvCharacter,
  AdvConfig,
  AdvFountainNode,
  AdvGameConfig,
  AdvMusic,
  AdvScene,
} from '@advjs/types'
import type { AssetsManifest } from 'pixi.js'
import { parseAst } from '@advjs/parser'
import { ref } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'
import { loadStudioAssetCatalog } from '../utils/projectAssets'
import { applyStudioGameSettings, loadStudioGameSettings } from '../utils/projectRuntimeFiles'
import { createStudioChapterIdMap } from '../utils/runtimeAuthoring'
import { useProjectContent } from './useProjectContent'

/**
 * Translates Studio's project model (`useProjectContent`) into a client-friendly
 * `AdvConfig` + `AdvGameConfig`, with project-relative asset paths resolved to
 * blob URLs via the project's IFileSystem.
 *
 * Lifecycle:
 * - Call `refresh()` once before mounting `<AdvGame>` (and on project switch).
 * - Call `dispose()` on unmount to revoke all created blob URLs.
 */
export function useStudioAdvConfig() {
  const project = useProjectContent()
  const studioStore = useStudioStore()

  const gameConfigRef = ref<Partial<AdvGameConfig>>({})
  const configRef = ref<AdvConfig | null>(null)
  const ready = ref(false)
  const chapterSources = new Map<string, string>()
  const chapterFileToId = new Map<string, string>()
  const chapterIdToFile = new Map<string, string>()
  let assetCatalog: AdvAssetCatalog | null = null

  /** Track blob URLs for revocation on dispose. Filesystem-backed only. */
  const blobUrls = new Set<string>()

  async function resolveBlobUrl(relPath: string | undefined): Promise<string | undefined> {
    if (!relPath)
      return undefined
    if (relPath.startsWith('http://') || relPath.startsWith('https://') || relPath.startsWith('blob:') || relPath.startsWith('data:'))
      return relPath
    const fs = project.getFs()
    if (!fs)
      return relPath // COS / no-fs mode: assume caller already absolute
    try {
      const url = await fs.readBlobUrl(relPath)
      blobUrls.add(url)
      return url
    }
    catch {
      return relPath
    }
  }

  async function buildGameConfig(): Promise<Partial<AdvGameConfig>> {
    const fs = project.getFs()
    const settings = fs ? await loadStudioGameSettings(fs) : {}
    assetCatalog?.dispose()
    assetCatalog = fs ? await loadStudioAssetCatalog(fs) : null

    async function resolveCatalogAsset(assetId: string, variant?: string): Promise<string | undefined> {
      if (!assetCatalog)
        return undefined
      return (await assetCatalog.resolve(assetId, { variant })).src
    }

    // Resolve characters' tachies to blob URLs
    const characters: AdvCharacter[] = await Promise.all(
      project.characters.value.map(async (c) => {
        const tachies = Object.fromEntries(await Promise.all(
          Object.entries(c.tachies ?? {}).map(async ([status, t]) => [
            status,
            { ...t, src: (await resolveBlobUrl(t.src)) ?? t.src },
          ] as const),
        ))

        const catalogTachies = assetCatalog?.list({ kind: 'character' })
          .filter(asset => asset.characterId === c.id && asset.expression) ?? []
        for (const asset of catalogTachies) {
          const status = asset.expression!
          const animation = assetCatalog?.list({ kind: 'animation' })
            .find(item => item.characterId === c.id && item.state === status)
          const resolved = animation
            ? await assetCatalog!.resolve(animation.id)
            : await assetCatalog!.resolve(asset.id)
          tachies[status] = animation
            ? {
                src: resolved.src,
                sprite: {
                  frameWidth: animation.frameWidth!,
                  frameHeight: animation.frameHeight!,
                  frames: animation.frames!,
                  fps: animation.fps!,
                  loop: animation.loop,
                },
              }
            : { src: resolved.src }
        }

        const defaultTachie = tachies.default
        return {
          ...c,
          avatar: defaultTachie?.src ?? (await resolveBlobUrl(c.avatar)) ?? c.avatar,
          tachies: Object.keys(tachies).length > 0 ? tachies : c.tachies,
        }
      }),
    )

    // Scenes — type: 'image' is required by AdvSceneImage
    const scenes: AdvScene[] = await Promise.all(
      project.scenes.value.map(async (s) => {
        const id = s.id ?? s.file
        const conventionalAssetId = `background/${id}`
        const assetId = s.assetId ?? (assetCatalog?.get(conventionalAssetId) ? conventionalAssetId : undefined)
        const src = assetId
          ? (await resolveCatalogAsset(assetId)) ?? ''
          : (await resolveBlobUrl(s.src)) ?? ''
        return {
          id,
          name: s.name,
          type: 'image' as const,
          src,
          alias: s.id ?? s.file,
          description: s.description,
        } satisfies AdvScene
      }),
    )

    // BGM library — keyed by audio.name so fountain scripts can reference by name
    const audioSpecs = [...project.audios.value]
    for (const asset of assetCatalog?.list({ kind: 'bgm' }) ?? []) {
      const name = asset.id.replace(/^bgm\//u, '')
      if (!audioSpecs.some(audio => audio.assetId === asset.id || audio.name === name)) {
        audioSpecs.push({
          file: `adv/assets.json#${asset.id}`,
          name,
          assetId: asset.id,
          description: asset.title,
          duration: asset.duration,
        })
      }
    }
    const bgmEntries: [string, AdvMusic][] = await Promise.all(
      audioSpecs.map(async (a) => {
        const conventionalAssetId = `bgm/${a.name}`
        const assetId = a.assetId ?? (assetCatalog?.get(conventionalAssetId) ? conventionalAssetId : undefined)
        const asset = assetId ? assetCatalog?.get(assetId) : undefined
        return [
          a.name,
        {
          name: a.name,
          description: a.description ?? asset?.title,
          src: assetId
            ? (await resolveCatalogAsset(assetId)) ?? ''
            : (await resolveBlobUrl(a.src)) ?? '',
          duration: a.duration ?? asset?.duration,
          tags: a.tags,
        } satisfies AdvMusic,
        ] as [string, AdvMusic]
      }),
    )
    const bgmLibrary: Record<string, AdvMusic> = Object.fromEntries(bgmEntries)

    const gallery = settings.gallery
      ? {
          ...settings.gallery,
          items: await Promise.all(settings.gallery.items.map(async (item) => {
            if (item.assetId) {
              if (!assetCatalog)
                throw new Error(`ADV_ASSET_CATALOG_MISSING: ${item.assetId}`)
              const asset = assetCatalog.get(item.assetId)
              if (!asset)
                throw new Error(`ADV_ASSET_NOT_FOUND: ${item.assetId}`)
              const src = await resolveCatalogAsset(item.assetId)
              const thumbnailVariant = item.thumbnailVariant
                ?? (asset.variants?.thumbnail ? 'thumbnail' : undefined)
              const thumbnail = thumbnailVariant
                ? await resolveCatalogAsset(item.assetId, thumbnailVariant)
                : src
              return {
                id: item.id,
                title: item.title ?? asset.title ?? item.id,
                src: src!,
                thumbnail,
                alt: item.alt ?? asset.alt,
                chapterId: item.chapterId ?? asset.chapterId,
              }
            }
            return {
              id: item.id,
              title: item.title!,
              src: (await resolveBlobUrl(item.src)) ?? item.src!,
              thumbnail: (await resolveBlobUrl(item.thumbnail)) ?? item.thumbnail,
              alt: item.alt,
              chapterId: item.chapterId,
            }
          })),
        }
      : undefined

    // Chapters keep their authoring AST for editor-only visualizations. Runtime
    // compilation reads the same source through `fetchChapter` below.
    const chapterIds = createStudioChapterIdMap(project.chapters.value.map(chapter => chapter.file))
    const chapters: AdvChapter[] = await Promise.all(
      project.chapters.value.map(async (ch) => {
        let content = ch.content
        if (!content) {
          const fs = project.getFs()
          if (fs)
            content = await fs.readFile(ch.file)
        }
        const ast = content ? await parseAst(content) : undefined
        chapterSources.set(ch.file, content ?? '')
        const fountainNode: AdvFountainNode = {
          id: 'fountain-0',
          type: 'fountain',
          src: ch.file,
          ast,
        }
        const chapterId = chapterIds.get(ch.file)!
        chapterFileToId.set(ch.file, chapterId)
        chapterIdToFile.set(chapterId, ch.file)
        return {
          id: chapterId,
          title: ch.name,
          startNodeId: 'fountain-0',
          nodes: [fountainNode],
        } satisfies AdvChapter
      }),
    )

    // Pixi assets manifest — Pixi `Assets.load(alias)` resolves these
    const manifest: AssetsManifest = {
      bundles: [
        {
          name: 'scenes',
          assets: scenes
            .filter(s => s.type === 'image' && s.src)
            .map(s => ({ alias: s.alias ?? s.id, src: (s as { src: string }).src })),
        },
        {
          name: 'tachies',
          assets: characters.flatMap(c =>
            Object.entries(c.tachies ?? {})
              .filter(([, t]) => t.src)
              .map(([status, t]) => ({ alias: `${c.id}-${status}`, src: t.src })),
          ),
        },
      ],
    }

    return applyStudioGameSettings({
      title: studioStore.currentProject?.name ?? 'Studio Project',
      description: '',
      favicon: '',
      bgm: {
        autoplay: true,
        library: bgmLibrary,
      },
      assets: { manifest },
      chapters,
      characters,
      scenes,
    }, {
      ...settings,
      gallery,
    })
  }

  function buildMinimalConfig(gameConfig: Partial<AdvGameConfig>): AdvConfig {
    return {
      logLevel: 3, // info
      root: '/',
      format: 'flow',
      theme: 'default',
      features: { babylon: false },
      aspectRatio: 16 / 9,
      canvasWidth: 1920,
      viewportFit: 'contain',
      selectable: true,
      pages: { start: { bg: '' } },
      showCharacterAvatar: true,
      cdn: { enable: false },
      gameConfig,
      themeConfig: {} as Record<string, string | number>,
      runtimeConfig: { canvasHeight: 1080 },
      plugins: [],
    }
  }

  async function refresh() {
    ready.value = false
    chapterSources.clear()
    chapterFileToId.clear()
    chapterIdToFile.clear()
    const gc = await buildGameConfig()
    gameConfigRef.value = gc
    configRef.value = buildMinimalConfig(gc)
    ready.value = true
  }

  function chapterIdForFile(file: string): string | undefined {
    return chapterFileToId.get(file)
  }

  function chapterFileForId(id: string): string | undefined {
    return chapterIdToFile.get(id)
  }

  async function fetchChapter(url: string) {
    const source = chapterSources.get(url)
    return {
      ok: source !== undefined,
      status: source !== undefined ? 200 : 404,
      async text() {
        return source ?? ''
      },
    }
  }

  function dispose() {
    assetCatalog?.dispose()
    assetCatalog = null
    for (const url of blobUrls)
      URL.revokeObjectURL(url)
    blobUrls.clear()
  }

  return {
    gameConfigRef,
    configRef,
    ready,
    refresh,
    fetchChapter,
    chapterIdForFile,
    chapterFileForId,
    dispose,
  }
}
