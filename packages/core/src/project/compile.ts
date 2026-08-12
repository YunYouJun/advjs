import type {
  AdvAssetManifest,
  AdvCharacter,
  AdvProjectChapter,
  AdvProjectCompileOptions,
  AdvProjectCompileResult,
  AdvProjectDiagnostic,
  AdvProjectFileMap,
  AdvProjectJsonValue,
  AdvProjectScene,
  AdvProjectSource,
  AdvProjectSourceMap,
  JsonObject,
} from '@advjs/types'
import type { MarkdownResourceCatalog } from '../compiler'
import {
  extractCharacterRefs,
  extractSceneRefs,
  parseCharacterMd,
  parseSceneFrontmatterData,
  validateSceneFrontmatter,
} from '@advjs/parser'
import { normalizeAdvAssetManifest } from '../assets'
import { compileMarkdownProgram, isRuntimeIdentifier } from '../compiler'

const PROJECT_SCHEMA_VERSION = 1 as const
const WINDOWS_DRIVE_RE = /^[a-z]:[\\/]/iu
const NONDETERMINISTIC_FIELDS = new Set([
  'builtAt',
  'createdAt',
  'deployedAt',
  'deploymentId',
  'deploymentUrl',
  'durationMs',
  'generatedAt',
  'updatedAt',
])
const CONFIG_FIELDS = new Set([
  'entryChapterId',
  'format',
  'gameConfig',
  'id',
  'plugins',
  'root',
  'runtimePlugins',
  'theme',
])
const GAME_FIELDS = new Set([
  'assets',
  'bgm',
  'chapters',
  'characters',
  'cover',
  'description',
  'entryChapterId',
  'favicon',
  'gallery',
  'id',
  'progression',
  'requiredPlugins',
  'scenes',
  'title',
  'variables',
])
const NORMALIZED_GAME_FIELDS = [
  'bgm',
  'cover',
  'description',
  'favicon',
  'gallery',
  'progression',
  'title',
  'variables',
] as const

interface NormalizedFiles {
  files: Map<string, string>
  diagnostics: AdvProjectDiagnostic[]
}

interface ProjectChapterInput extends AdvProjectChapter {
  content: string
}

function compareText(left: string, right: string) {
  if (left < right)
    return -1
  if (left > right)
    return 1
  return 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeProjectPath(input: string) {
  const slashPath = input.replaceAll('\\', '/')
  if (slashPath.startsWith('/') || WINDOWS_DRIVE_RE.test(slashPath))
    throw new Error(`Project paths must be relative: ${input}`)

  const segments: string[] = []
  for (const segment of slashPath.split('/')) {
    if (!segment || segment === '.')
      continue
    if (segment === '..')
      throw new Error(`Project paths cannot escape the project root: ${input}`)
    segments.push(segment)
  }
  if (segments.length === 0)
    throw new Error(`Project path cannot be empty: ${input}`)
  return segments.join('/')
}

function projectDirname(path: string) {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function joinProjectPath(...parts: string[]) {
  return normalizeProjectPath(parts.filter(Boolean).join('/'))
}

function normalizeFiles(input: AdvProjectFileMap): NormalizedFiles {
  const files = new Map<string, string>()
  const diagnostics: AdvProjectDiagnostic[] = []
  for (const [inputPath, content] of Object.entries(input).sort(([left], [right]) => compareText(left, right))) {
    try {
      const path = normalizeProjectPath(inputPath)
      if (files.has(path)) {
        diagnostics.push({
          code: 'ADV_PROJECT_DUPLICATE_PATH',
          severity: 'error',
          message: `Multiple project files normalize to ${path}`,
          path,
        })
      }
      else {
        files.set(path, content)
      }
    }
    catch (error) {
      diagnostics.push({
        code: 'ADV_PROJECT_INVALID_PATH',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        path: inputPath,
      })
    }
  }
  return { files, diagnostics }
}

function parseJsonObject(
  files: Map<string, string>,
  path: string | undefined,
  diagnostics: AdvProjectDiagnostic[],
): JsonObject {
  if (!path)
    return {}
  try {
    const value = JSON.parse(files.get(path) ?? '')
    if (!isRecord(value))
      throw new TypeError('JSON root must be an object')
    return value as JsonObject
  }
  catch (error) {
    diagnostics.push({
      code: 'ADV_PROJECT_INVALID_JSON',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
      path,
    })
    return {}
  }
}

function canonicalJson(value: unknown): AdvProjectJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  if (Array.isArray(value))
    return value.map(canonicalJson)
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !NONDETERMINISTIC_FIELDS.has(key))
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, canonicalJson(child)]),
    )
  }
  return null
}

function unknownFields(record: JsonObject, known: ReadonlySet<string>): JsonObject {
  return canonicalJson(Object.fromEntries(
    Object.entries(record).filter(([key]) => !known.has(key)),
  )) as JsonObject
}

function normalizedGame(record: JsonObject): JsonObject {
  return canonicalJson(Object.fromEntries(
    NORMALIZED_GAME_FIELDS.flatMap(key => Object.hasOwn(record, key) ? [[key, record[key]]] : []),
  )) as JsonObject
}

function findFirstFile(files: Map<string, string>, candidates: string[]) {
  return candidates.find(path => files.has(path))
}

function resolveSourceReference(reference: string, root: string, files: Map<string, string>) {
  const absolute = reference.startsWith('/')
  const unprefixed = reference.replace(/^\/+/, '')
  const candidates = absolute
    ? [`public/${unprefixed}`, unprefixed]
    : [`${root}/${unprefixed}`, unprefixed, `public/${unprefixed}`]
  const normalized = [...new Set(candidates.map((candidate) => {
    try {
      return normalizeProjectPath(candidate)
    }
    catch {
      return candidate
    }
  }))]
  return findFirstFile(files, normalized) ?? normalized[0]
}

function chapterSourceReferences(value: Record<string, unknown>) {
  if (Array.isArray(value.sources))
    return value.sources.filter((item): item is string => typeof item === 'string')
  if (Array.isArray(value.paths))
    return value.paths.filter((item): item is string => typeof item === 'string')
  if (Array.isArray(value.nodes)) {
    return value.nodes
      .filter(isRecord)
      .filter(node => node.type === 'fountain' && typeof node.src === 'string')
      .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))
      .map(node => node.src as string)
  }
  return []
}

function inferChapterId(raw: string, index: number) {
  return isRuntimeIdentifier(raw) ? raw : `chapter-${index + 1}`
}

function collectChapters(
  files: Map<string, string>,
  root: string,
  gameConfig: JsonObject,
  diagnostics: AdvProjectDiagnostic[],
): ProjectChapterInput[] {
  const configured = Array.isArray(gameConfig.chapters)
    ? gameConfig.chapters.filter((chapter): chapter is JsonObject => isRecord(chapter))
    : []
  const chapters: ProjectChapterInput[] = []

  if (configured.length > 0) {
    configured.forEach((chapter, index) => {
      const id = typeof chapter.id === 'string' && chapter.id
        ? inferChapterId(chapter.id, index)
        : `chapter-${index + 1}`
      const sources = chapterSourceReferences(chapter).map(reference => resolveSourceReference(reference, root, files))
      if (sources.length === 0) {
        diagnostics.push({
          code: 'ADV_PROJECT_CHAPTER_WITHOUT_SOURCE',
          severity: 'error',
          message: `Chapter ${id} does not declare any Markdown sources`,
          path: `${root}/settings/game.json`,
        })
      }
      for (const path of sources) {
        if (!files.has(path)) {
          diagnostics.push({
            code: 'ADV_PROJECT_CHAPTER_NOT_FOUND',
            severity: 'error',
            message: `Chapter source not found: ${path}`,
            path,
          })
        }
      }
      chapters.push({
        id,
        title: typeof chapter.title === 'string' ? chapter.title : undefined,
        sources,
        content: sources.map(path => files.get(path) ?? '').join('\n\n'),
      })
    })
  }
  else {
    const prefix = `${root}/chapters/`
    const chapterFiles = [...files.keys()]
      .filter(path => path.startsWith(prefix) && path.endsWith('.adv.md'))
      .sort(compareText)
    const groups = new Map<string, string[]>()
    for (const path of chapterFiles) {
      const relativePath = path.slice(prefix.length)
      const parts = relativePath.split('/')
      const rawId = parts.length > 1 ? parts[0] : parts[0].slice(0, -'.adv.md'.length)
      const id = inferChapterId(rawId, groups.size)
      const paths = groups.get(id) ?? []
      paths.push(path)
      groups.set(id, paths)
    }
    for (const [id, sources] of groups) {
      chapters.push({
        id,
        title: id,
        sources,
        content: sources.map(path => files.get(path) ?? '').join('\n\n'),
      })
    }
  }

  const ids = new Set<string>()
  for (const chapter of chapters) {
    if (ids.has(chapter.id)) {
      diagnostics.push({
        code: 'ADV_PROJECT_DUPLICATE_CHAPTER',
        severity: 'error',
        message: `Duplicate project chapter: ${chapter.id}`,
        path: chapter.sources[0] ?? `${root}/chapters`,
      })
    }
    ids.add(chapter.id)
  }
  return chapters
}

function collectCharacters(
  files: Map<string, string>,
  root: string,
  gameConfig: JsonObject,
  gameConfigPath: string | undefined,
  diagnostics: AdvProjectDiagnostic[],
  sourceMap: AdvProjectSourceMap,
) {
  const characters: AdvCharacter[] = []
  const known = new Set<string>()

  function registerCharacter(character: AdvCharacter, path: string) {
    if (sourceMap.characters[character.id]) {
      diagnostics.push({
        code: 'ADV_PROJECT_DUPLICATE_CHARACTER',
        severity: 'error',
        message: `Duplicate character id: ${character.id}`,
        path,
      })
    }
    characters.push(character)
    sourceMap.characters[character.id] = path
    known.add(character.id)
    known.add(character.name)
    for (const alias of character.aliases ?? [])
      known.add(alias)
  }

  if (Array.isArray(gameConfig.characters)) {
    for (const value of gameConfig.characters) {
      if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string')
        continue
      registerCharacter(value as unknown as AdvCharacter, gameConfigPath ?? 'game.config.json')
    }
  }

  for (const path of [...files.keys()].filter(path => path.startsWith(`${root}/characters/`) && path.endsWith('.character.md')).sort(compareText)) {
    try {
      const character = parseCharacterMd(files.get(path) ?? '')
      registerCharacter(character, path)
    }
    catch (error) {
      diagnostics.push({
        code: 'ADV_PROJECT_INVALID_CHARACTER',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        path,
      })
    }
  }
  return { characters, known }
}

function normalizeScene(value: Record<string, unknown>): AdvProjectScene | undefined {
  if (typeof value.id !== 'string' || !value.id)
    return undefined
  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : undefined,
    alias: typeof value.alias === 'string' ? value.alias : undefined,
    description: typeof value.description === 'string' ? value.description : undefined,
    imagePrompt: typeof value.imagePrompt === 'string' ? value.imagePrompt : undefined,
    type: value.type === 'image' || value.type === 'model' ? value.type : undefined,
    src: typeof value.src === 'string' ? value.src : undefined,
    assetId: typeof value.assetId === 'string' ? value.assetId : undefined,
    tags: Array.isArray(value.tags) && value.tags.every(tag => typeof tag === 'string')
      ? value.tags
      : undefined,
  }
}

function collectScenes(
  files: Map<string, string>,
  root: string,
  diagnostics: AdvProjectDiagnostic[],
  sourceMap: AdvProjectSourceMap,
) {
  const scenes: AdvProjectScene[] = []
  const known = new Set<string>()
  const prefix = `${root}/scenes/`
  for (const path of [...files.keys()].filter(path => path.startsWith(prefix) && path.endsWith('.md')).sort(compareText)) {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    if (fileName.startsWith('README'))
      continue
    const content = files.get(path) ?? ''
    const validation = validateSceneFrontmatter(content)
    if (!validation.success) {
      diagnostics.push({
        code: 'ADV_PROJECT_INVALID_SCENE_FRONTMATTER',
        severity: 'warning',
        message: validation.error ?? 'Invalid scene frontmatter',
        path,
      })
    }
    const scene = normalizeScene(parseSceneFrontmatterData(content))
    if (!scene) {
      diagnostics.push({
        code: 'ADV_PROJECT_INVALID_SCENE',
        severity: 'error',
        message: 'Scene frontmatter requires a non-empty id',
        path,
      })
      continue
    }
    if (sourceMap.scenes[scene.id]) {
      diagnostics.push({
        code: 'ADV_PROJECT_DUPLICATE_SCENE',
        severity: 'error',
        message: `Duplicate scene id: ${scene.id}`,
        path,
      })
    }
    scenes.push(scene)
    sourceMap.scenes[scene.id] = path
    known.add(scene.id)
    known.add(fileName.slice(0, -'.md'.length))
    if (scene.name)
      known.add(scene.name)
    if (scene.alias)
      known.add(scene.alias)
  }
  return { scenes, known }
}

function collectReferenceDiagnostics(
  files: ReadonlyMap<string, string>,
  chapters: ProjectChapterInput[],
  characters: ReadonlySet<string>,
  scenes: ReadonlySet<string>,
) {
  const diagnostics: AdvProjectDiagnostic[] = []
  const seen = new Set<string>()
  for (const chapter of chapters) {
    for (const path of chapter.sources) {
      const source = files.get(path) ?? ''
      for (const character of extractCharacterRefs(source)) {
        const key = `character:${path}:${character}`
        if (!characters.has(character) && !seen.has(key)) {
          seen.add(key)
          diagnostics.push({
            code: 'ADV_PROJECT_UNKNOWN_CHARACTER',
            severity: 'error',
            message: `Unknown character reference: ${character}`,
            path,
          })
        }
      }
      for (const scene of extractSceneRefs(source)) {
        const key = `scene:${path}:${scene}`
        if (!scenes.has(scene) && !seen.has(key)) {
          seen.add(key)
          diagnostics.push({
            code: 'ADV_PROJECT_UNKNOWN_SCENE',
            severity: 'error',
            message: `Unknown scene reference: ${scene}`,
            path,
          })
        }
      }
    }
  }
  return diagnostics
}

function requiredPlugins(value: unknown) {
  if (!isRecord(value))
    return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .sort(([left], [right]) => compareText(left, right)),
  )
}

function pluginDiagnostics(
  required: Record<string, string>,
  available: Record<string, string> | undefined,
  path: string,
) {
  if (available === undefined)
    return []
  return Object.entries(required).flatMap(([name, version]): AdvProjectDiagnostic[] => {
    if (!Object.hasOwn(available, name)) {
      return [{
        code: 'ADV_PROJECT_UNKNOWN_PLUGIN',
        severity: 'error',
        message: `Required runtime plugin is unavailable: ${name}@${version}`,
        path,
      }]
    }
    if (available[name] !== version) {
      return [{
        code: 'ADV_PROJECT_PLUGIN_VERSION_MISMATCH',
        severity: 'error',
        message: `Runtime plugin ${name} requires ${version}, received ${available[name]}`,
        path,
      }]
    }
    return []
  })
}

function loadAssetManifest(
  files: Map<string, string>,
  path: string | undefined,
  diagnostics: AdvProjectDiagnostic[],
): AdvAssetManifest | undefined {
  if (!path)
    return undefined
  const root = parseJsonObject(files, path, diagnostics)
  let input: JsonObject = root
  if (Array.isArray(root.includes)) {
    const assets: AdvProjectJsonValue[] = []
    for (const include of root.includes) {
      if (typeof include !== 'string')
        continue
      const includePath = joinProjectPath(projectDirname(path), include)
      if (!files.has(includePath)) {
        diagnostics.push({
          code: 'ADV_PROJECT_ASSET_FRAGMENT_NOT_FOUND',
          severity: 'error',
          message: `Asset manifest fragment not found: ${includePath}`,
          path: includePath,
        })
        continue
      }
      const fragment = parseJsonObject(files, includePath, diagnostics)
      if (Array.isArray(fragment.assets))
        assets.push(...fragment.assets)
    }
    const { includes: _includes, ...manifest } = root
    input = { ...manifest, assets }
  }
  try {
    return normalizeAdvAssetManifest(input)
  }
  catch (error) {
    diagnostics.push({
      code: 'ADV_PROJECT_INVALID_ASSET_MANIFEST',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
      path,
    })
  }
}

function resourceCatalog(manifest: AdvAssetManifest | undefined): MarkdownResourceCatalog | undefined {
  if (!manifest)
    return undefined
  const backgrounds: string[] = []
  const bgms: string[] = []
  const cgs: string[] = []
  const tachies: Record<string, string[]> = {}
  for (const asset of manifest.assets) {
    if (asset.kind === 'background') {
      backgrounds.push(asset.id)
    }
    else if (asset.kind === 'bgm') {
      bgms.push(asset.id)
    }
    else if (asset.kind === 'cg') {
      cgs.push(asset.id)
    }
    else if (asset.kind === 'tachie' && asset.characterId) {
      const statuses = tachies[asset.characterId] ?? []
      statuses.push(asset.state ?? asset.expression ?? asset.id)
      tachies[asset.characterId] = statuses
    }
  }
  return { backgrounds, bgms, cgs, tachies }
}

function sortDiagnostics(diagnostics: AdvProjectDiagnostic[]) {
  return diagnostics.sort((left, right) => (
    compareText(left.code, right.code)
    || compareText(left.path ?? '', right.path ?? '')
    || (left.line ?? 0) - (right.line ?? 0)
    || (left.column ?? 0) - (right.column ?? 0)
    || compareText(left.message, right.message)
  ))
}

export async function compileProject(
  source: AdvProjectSource,
  options: AdvProjectCompileOptions = {},
): Promise<AdvProjectCompileResult> {
  const normalized = normalizeFiles(source.files)
  const { files } = normalized
  const diagnostics = [...normalized.diagnostics]
  const configPath = files.has('adv.config.json') ? 'adv.config.json' : undefined
  if (!configPath) {
    diagnostics.push({
      code: 'ADV_PROJECT_CONFIG_NOT_FOUND',
      severity: 'error',
      message: 'Project requires adv.config.json',
      path: 'adv.config.json',
    })
  }
  const config = parseJsonObject(files, configPath, diagnostics)

  let root = 'adv'
  if (typeof config.root === 'string') {
    try {
      root = normalizeProjectPath(config.root)
    }
    catch (error) {
      diagnostics.push({
        code: 'ADV_PROJECT_INVALID_ROOT',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        path: configPath ?? 'adv.config.json',
      })
    }
  }

  const rawFormat = typeof config.format === 'string' ? config.format : 'adv-md'
  const format = rawFormat === 'fountain' ? 'adv-md' : rawFormat
  if (format !== 'adv-md' && format !== 'flow') {
    diagnostics.push({
      code: 'ADV_PROJECT_UNKNOWN_FORMAT',
      severity: 'error',
      message: `Unknown project format: ${rawFormat}`,
      path: configPath ?? 'adv.config.json',
    })
  }

  const gameConfigPath = findFirstFile(files, [
    `${root}/settings/game.json`,
    `${root}/game.config.json`,
    'game.config.json',
  ])
  const gameConfig = parseJsonObject(files, gameConfigPath, diagnostics)
  const assetsPath = findFirstFile(files, [`${root}/assets.json`, 'assets.json'])
  const sourceMap: AdvProjectSourceMap = {
    config: configPath,
    gameConfig: gameConfigPath,
    assets: assetsPath,
    chapters: {},
    characters: {},
    scenes: {},
  }

  const chapters = collectChapters(files, root, gameConfig, diagnostics)
  for (const chapter of chapters)
    sourceMap.chapters[chapter.id] = chapter.sources
  const entryChapterId = typeof gameConfig.entryChapterId === 'string'
    ? gameConfig.entryChapterId
    : typeof config.entryChapterId === 'string'
      ? config.entryChapterId
      : chapters[0]?.id
  if (entryChapterId && !chapters.some(chapter => chapter.id === entryChapterId)) {
    diagnostics.push({
      code: 'ADV_PROJECT_UNKNOWN_ENTRY_CHAPTER',
      severity: 'error',
      message: `Unknown project entry chapter: ${entryChapterId}`,
      path: gameConfigPath ?? configPath ?? 'adv.config.json',
    })
  }

  const characterResult = collectCharacters(files, root, gameConfig, gameConfigPath, diagnostics, sourceMap)
  const sceneResult = collectScenes(files, root, diagnostics, sourceMap)
  if (options.validateContentReferences !== false)
    diagnostics.push(...collectReferenceDiagnostics(files, chapters, characterResult.known, sceneResult.known))

  const required = requiredPlugins(gameConfig.requiredPlugins)
  diagnostics.push(...pluginDiagnostics(
    required,
    options.plugins,
    gameConfigPath ?? configPath ?? 'adv.config.json',
  ))
  const assets = loadAssetManifest(files, assetsPath, diagnostics)

  let program
  if (format === 'adv-md') {
    const entryIndex = entryChapterId ? chapters.findIndex(chapter => chapter.id === entryChapterId) : 0
    const ordered = [...chapters]
    if (entryIndex > 0) {
      const [entry] = ordered.splice(entryIndex, 1)
      ordered.unshift(entry)
    }
    const compiled = await compileMarkdownProgram({
      id: source.id ?? (typeof config.id === 'string' ? config.id : 'adv-project'),
      chapters: ordered.map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        sourcePath: chapter.sources.join(', '),
      })),
      requiredPlugins: required,
      resources: resourceCatalog(assets),
    })
    program = compiled.program
    diagnostics.push(...compiled.diagnostics.map((diagnostic): AdvProjectDiagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      path: diagnostic.source?.file ?? chapters[0]?.sources[0] ?? configPath ?? 'adv.config.json',
      line: diagnostic.source?.line,
      column: diagnostic.source?.column,
    })))
  }
  else if (format === 'flow') {
    diagnostics.push({
      code: 'ADV_PROJECT_FLOW_NOT_IMPLEMENTED',
      severity: 'error',
      message: 'The standard project compiler does not yet accept serialized Flow chapters',
      path: configPath ?? 'adv.config.json',
    })
  }

  sortDiagnostics(diagnostics)
  if (diagnostics.some(diagnostic => diagnostic.severity === 'error'))
    program = undefined

  const projectId = source.id
    ?? (typeof config.id === 'string' ? config.id : undefined)
    ?? (typeof gameConfig.id === 'string' ? gameConfig.id : undefined)
    ?? 'adv-project'
  return {
    project: {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: projectId,
      format: format === 'flow' ? 'flow' : 'adv-md',
      root,
      theme: typeof config.theme === 'string' ? config.theme : undefined,
      entryChapterId,
      game: normalizedGame(gameConfig),
      chapters: chapters.map(({ id, title, sources }) => ({ id, title, sources })),
      characters: characterResult.characters,
      scenes: sceneResult.scenes,
      plugins: Object.entries(required).map(([name, version]) => ({ name, version })),
      assets,
      program,
      extensions: {
        config: unknownFields(config, CONFIG_FIELDS),
        game: unknownFields(gameConfig, GAME_FIELDS),
      },
    },
    diagnostics,
    sourceMap,
  }
}
