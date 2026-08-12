import type {
  AdvGameConfig,
  AdvProjectCompileResult,
  AdvProjectFileMap,
  AdvProjectSource,
  JsonObject,
} from '@advjs/types'
import { compileProject } from '@advjs/core'

const IGNORED_DIRECTORIES = new Set(['.git', '.output', 'dist', 'node_modules'])
const TEXT_FILE_RE = /(?:^|\/)(?:[^/]+\.(?:css|html|js|json|jsx|md|mjs|scss|svg|ts|tsx|txt|yaml|yml)|README)$/iu
const LEGACY_ENTRY_RE = /(?:^|\/)index\.adv\.json$/u

export interface BrowserProjectFile {
  kind: 'file'
  name: string
  getFile: () => Promise<{
    size: number
    text: () => Promise<string>
  }>
}

export interface BrowserProjectDirectory {
  kind: 'directory'
  name: string
  values: () => AsyncIterable<BrowserProjectDirectory | BrowserProjectFile>
}

export interface EditorProjectModel {
  compilation: AdvProjectCompileResult
  files: AdvProjectFileMap
  migrationNotice?: string
  mode: 'legacy-json' | 'standard-markdown'
  previewConfig: AdvGameConfig
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'en')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function dataUrl(content: string) {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`
}

function toPreviewConfig(compilation: AdvProjectCompileResult, files: AdvProjectFileMap): AdvGameConfig {
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

export async function readBrowserProjectFiles(root: BrowserProjectDirectory): Promise<AdvProjectFileMap> {
  const files: Array<[string, string]> = []

  async function visit(directory: BrowserProjectDirectory, prefix = ''): Promise<void> {
    for await (const entry of directory.values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.kind === 'directory') {
        if (!IGNORED_DIRECTORIES.has(entry.name))
          await visit(entry, path)
        continue
      }

      const file = await entry.getFile()
      files.push([path, TEXT_FILE_RE.test(path) ? await file.text() : ''])
    }
  }

  await visit(root)
  return Object.fromEntries(files.sort(([left], [right]) => compareText(left, right)))
}

export async function compileEditorProject(source: AdvProjectSource): Promise<EditorProjectModel> {
  const files = Object.fromEntries(Object.entries(source.files).sort(([left], [right]) => compareText(left, right)))
  const compilation = await compileProject({ ...source, files })
  return createEditorProjectModel(compilation, files)
}

export function createEditorProjectModel(compilation: AdvProjectCompileResult, sourceFiles: AdvProjectFileMap): EditorProjectModel {
  const files = Object.fromEntries(Object.entries(sourceFiles).sort(([left], [right]) => compareText(left, right)))
  const hasMarkdownChapter = Object.keys(files).some(path => path.endsWith('.adv.md'))
  const legacyEntry = Object.keys(files).find(path => LEGACY_ENTRY_RE.test(path))
  const legacyJsonOnly = Boolean(legacyEntry && !hasMarkdownChapter)
  const migrationNotice = legacyJsonOnly
    ? `Legacy ${legacyEntry} projects are not opened as the primary format. Migrate the story to adv/chapters/*.adv.md first.`
    : undefined

  if (migrationNotice) {
    compilation.diagnostics.push({
      code: 'ADV_EDITOR_LEGACY_JSON',
      severity: 'warning',
      message: migrationNotice,
      path: legacyEntry,
    })
  }

  return {
    compilation,
    files,
    migrationNotice,
    mode: legacyJsonOnly ? 'legacy-json' : 'standard-markdown',
    previewConfig: toPreviewConfig(compilation, files),
  }
}
