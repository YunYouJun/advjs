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
    // Resolve characters' tachies to blob URLs
    const characters: AdvCharacter[] = await Promise.all(
      project.characters.value.map(async (c) => {
        if (!c.tachies)
          return c
        const tachieEntries = await Promise.all(
          Object.entries(c.tachies).map(async ([status, t]) => [
            status,
            { ...t, src: (await resolveBlobUrl(t.src)) ?? t.src },
          ] as const),
        )
        return { ...c, tachies: Object.fromEntries(tachieEntries) }
      }),
    )

    // Scenes — type: 'image' is required by AdvSceneImage
    const scenes: AdvScene[] = await Promise.all(
      project.scenes.value.map(async (s) => {
        const src = (await resolveBlobUrl(s.src)) ?? ''
        return {
          id: s.id ?? s.file,
          name: s.name,
          type: 'image' as const,
          src,
          alias: s.id ?? s.file,
          description: s.description,
        } satisfies AdvScene
      }),
    )

    // BGM library — keyed by audio.name so fountain scripts can reference by name
    const bgmEntries: [string, AdvMusic][] = await Promise.all(
      project.audios.value.map(async a => [
        a.name,
        {
          name: a.name,
          description: a.description,
          src: (await resolveBlobUrl(a.src)) ?? '',
          duration: a.duration,
          tags: a.tags,
        } satisfies AdvMusic,
      ] as [string, AdvMusic]),
    )
    const bgmLibrary: Record<string, AdvMusic> = Object.fromEntries(bgmEntries)

    // Chapters — pre-parse AST so useAdvNav.loadChapter short-circuits the HTTP fetch
    const chapters: AdvChapter[] = await Promise.all(
      project.chapters.value.map(async (ch) => {
        let content = ch.content
        if (!content) {
          const fs = project.getFs()
          if (fs)
            content = await fs.readFile(ch.file)
        }
        const ast = content ? await parseAst(content) : undefined
        const fountainNode: AdvFountainNode = {
          id: 'fountain-0',
          type: 'fountain',
          src: ch.file,
          ast,
        }
        return {
          id: ch.file,
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

    return {
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
    }
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
    const gc = await buildGameConfig()
    gameConfigRef.value = gc
    configRef.value = buildMinimalConfig(gc)
    ready.value = true
  }

  function dispose() {
    for (const url of blobUrls)
      URL.revokeObjectURL(url)
    blobUrls.clear()
  }

  return {
    gameConfigRef,
    configRef,
    ready,
    refresh,
    dispose,
  }
}
