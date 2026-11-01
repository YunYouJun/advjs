import type { CompileDiagnostic, MarkdownResourceCatalog } from '@advjs/core/compiler'
import type { ProjectSourcePatch, ProjectValidationIssue } from '@advjs/core/project'
import type { AdvAssetManifest, AdvCharacter, AdvGameConfig, AdvProjectCompileOptions, AdvProjectDiagnostic } from '@advjs/types'
import type { Input } from './input'
import type { EngineContentType, EngineDiagnostic } from './protocol'
import { normalizeAdvAssetManifest, readAdvAssetManifestSource } from '@advjs/assets'
import {
  applyProjectPatches,
  compileAuthoringProgram,
  compileProject,
  createLegacyChapterProject,
  createProjectGameConfig,
  createProjectTemplateFiles,
  fixProjectReferences,
  groupLegacyChapterFiles,
  indexProjectContent,
  isSafeProjectPackagePath,
  parseAuthoringGameSettings,
  planProjectPackage,
  PROJECT_SLUG_RE,
  projectTemplates,
  quickStartProjectTemplate,
  readProjectPackageManifest,
  toProjectSlug,
  validateProjectContent,
} from '@advjs/core/project'
import {
  parseAst,
  parseAudioMd,
  parseChapterMd,
  parseCharacterMd,
  parseLocationMd,
  parseSceneMd,
  stringifyAudioMd,
  stringifyCharacterMd,
  stringifyLocationMd,
  stringifySceneMd,
  updateChapterMd,
} from '@advjs/parser'
import {
  isRecord,
  optionalBoolean,
  optionalObject,
  optionalString,
  optionalStringArray,
  optionalStringRecord,
  requireArray,
  requireFileMap,
  requireObject,
  requireString,
} from './input'
import { officialPluginVersions, officialRuntimePlugins } from './plugins'
import { ENGINE_API_VERSION, EngineFailure } from './protocol'

type Operation = (input: Input) => unknown

const CONTENT_TYPES: readonly EngineContentType[] = ['audio', 'chapter', 'character', 'location', 'scene']
const ABSOLUTE_URL = /^(?:https?:|data:|blob:)/u

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

function fromProjectDiagnostic(diagnostic: AdvProjectDiagnostic): EngineDiagnostic {
  return withoutUndefined({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    file: diagnostic.path,
    line: diagnostic.line,
    column: diagnostic.column,
    suggestion: diagnostic.suggestion,
  })
}

function fromCompileDiagnostic(diagnostic: CompileDiagnostic): EngineDiagnostic {
  return withoutUndefined({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    file: diagnostic.source?.file,
    line: diagnostic.source?.line,
    column: diagnostic.source?.column,
    suggestion: diagnostic.suggestion,
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Run a shared-module call whose failures describe the author's content. */
function content<T>(run: () => T): T {
  try {
    return run()
  }
  catch (error) {
    throw new EngineFailure('ENGINE_CONTENT_INVALID', errorMessage(error))
  }
}

async function contentAsync<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  }
  catch (error) {
    throw new EngineFailure('ENGINE_CONTENT_INVALID', errorMessage(error))
  }
}

function contentType(input: Input): EngineContentType {
  const type = requireString(input, 'type')
  if (!CONTENT_TYPES.includes(type as EngineContentType))
    throw new EngineFailure('ENGINE_INVALID_INPUT', `type must be one of ${CONTENT_TYPES.join(', ')}`, 'type')
  return type as EngineContentType
}

function compileOptions(input: Input): AdvProjectCompileOptions {
  const options = optionalObject(input, 'options') ?? {}
  return { plugins: officialPluginVersions(), ...options } as AdvProjectCompileOptions
}

function gameSettings(files: Record<string, string>) {
  try {
    return parseAuthoringGameSettings(files['adv/settings/game.json'])
  }
  catch (error) {
    throw new EngineFailure('ENGINE_PROJECT_INVALID', errorMessage(error), 'files.adv/settings/game.json')
  }
}

function projectIndex(input: Input) {
  const files = requireFileMap(input)
  const paths = optionalStringArray(input, 'paths')
  try {
    return { files, index: indexProjectContent({ files, paths }) }
  }
  catch (error) {
    throw new EngineFailure('ENGINE_PROJECT_INVALID', errorMessage(error), 'files.adv.config.json')
  }
}

/**
 * Map project-relative media paths onto the player's read-only scheme.
 * JavaScriptCore has no `URL`, so paths are joined as normalized strings.
 */
function resolvePlayerUrls(gameConfig: AdvGameConfig, manifest: AdvAssetManifest | undefined, baseUrl: string): AdvGameConfig {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const toUrl = (path: string) => ABSOLUTE_URL.test(path) || !path ? path : `${base}${path.replace(/^\.?\//u, '')}`
  const profile = manifest?.profiles[manifest.defaultProfile ?? '']
  const assetRoot = profile?.provider === 'project' ? (profile.root ?? '').replace(/^\.?\/|\/$/gu, '') : ''
  const audioUrl = (path: string) => ABSOLUTE_URL.test(path) ? path : toUrl(assetRoot ? `${assetRoot}/${path}` : path)
  return {
    ...gameConfig,
    characters: gameConfig.characters.map(character => ({
      ...character,
      ...(character.avatar ? { avatar: toUrl(character.avatar) } : {}),
      tachies: Object.fromEntries(Object.entries(character.tachies ?? {}).map(([status, tachie]) => [status, { ...tachie, src: toUrl(tachie.src) }])),
    })),
    scenes: gameConfig.scenes.map(scene => scene.type === 'image' ? { ...scene, src: toUrl(scene.src) } : scene),
    audio: gameConfig.audio && {
      ...gameConfig.audio,
      assets: Object.fromEntries(Object.entries(gameConfig.audio.assets).map(([id, asset]) => [id, {
        ...asset,
        src: audioUrl(asset.src),
        ...(asset.variants
          ? { variants: Object.fromEntries(Object.entries(asset.variants).map(([name, variant]) => [name, variant && { ...variant, src: audioUrl(variant.src) }])) }
          : {}),
      }])),
    },
  }
}

function validationIssues(input: Input): ProjectValidationIssue[] {
  return requireArray(input, 'issues').map((issue, index) => {
    if (!isRecord(issue)
      || typeof issue.file !== 'string'
      || typeof issue.message !== 'string'
      || typeof issue.type !== 'string'
      || typeof issue.category !== 'string') {
      throw new EngineFailure('ENGINE_INVALID_INPUT', `issues.${index} must be a validation issue`, `issues.${index}`)
    }
    return issue as unknown as ProjectValidationIssue
  })
}

export const operations: Record<string, Operation> = {
  'engine.info': () => ({
    apiVersion: ENGINE_API_VERSION,
    operations: Object.keys(operations).sort(),
    plugins: officialPluginVersions(),
  }),

  'project.index': (input) => {
    const { index } = projectIndex(input)
    return {
      ...index,
      chapters: index.chapters.map(({ content: _content, ...chapter }) => chapter),
    }
  },

  'project.compile': async (input) => {
    const files = requireFileMap(input)
    const result = await compileProject({ files }, compileOptions(input))
    return { ...result, diagnostics: result.diagnostics.map(fromProjectDiagnostic) }
  },

  'project.playerConfig': async (input) => {
    const files = requireFileMap(input)
    const baseUrl = requireString(input, 'baseUrl')
    const compilation = await compileProject({ files }, compileOptions(input))
    const diagnostics = compilation.diagnostics.map(fromProjectDiagnostic)
    if (compilation.diagnostics.some(item => item.severity === 'error'))
      return { diagnostics }
    return {
      diagnostics,
      gameConfig: resolvePlayerUrls(createProjectGameConfig(compilation, files), compilation.project.assets, baseUrl),
    }
  },

  'project.validate': async (input) => {
    const { files, index } = projectIndex(input)
    const settings = gameSettings(files)
    const result = await validateProjectContent({
      chapters: index.chapters,
      characters: index.characters,
      scenes: index.scenes,
      audios: index.audios,
      locations: index.locations,
      requiredPlugins: settings.requiredPlugins,
      plugins: officialRuntimePlugins(),
    })
    return { ...result, contentIssues: index.issues }
  },

  'project.authoringProgram': async (input) => {
    const { files, index } = projectIndex(input)
    const override = optionalObject(input, 'override')
    const result = await compileAuthoringProgram({
      chapters: index.chapters,
      requiredPlugins: gameSettings(files).requiredPlugins,
      plugins: officialRuntimePlugins(),
      override: override && {
        file: requireString(override, 'file'),
        content: requireString(override, 'content'),
      },
      resources: optionalObject(input, 'resources') as MarkdownResourceCatalog | undefined,
    })
    return withoutUndefined({
      entry: result.program?.entry,
      rows: result.rows,
      diagnostics: result.diagnostics.map(fromCompileDiagnostic),
    })
  },

  'project.fixReferences': (input) => {
    const files = requireFileMap(input)
    return fixProjectReferences(files, validationIssues(input))
  },

  'project.applyPatches': (input) => {
    const files = requireFileMap(input)
    const patches = requireArray(input, 'patches') as ProjectSourcePatch[]
    return content(() => applyProjectPatches(files, patches))
  },

  'project.legacyChapters': (input) => {
    const chapters = requireFileMap(input, 'chapters')
    const groups = groupLegacyChapterFiles(Object.keys(chapters))
    const project = createLegacyChapterProject({
      chapters: groups.map(group => ({
        id: group.id,
        title: group.title,
        sources: group.paths.map(path => chapters[path]),
      })),
      entryChapterId: optionalString(input, 'entryChapterId'),
      requiredPlugins: optionalStringRecord(input, 'requiredPlugins'),
      glossary: optionalString(input, 'glossary'),
    })
    return { ...project, chapters: groups }
  },

  'project.templates': () => ({
    templates: projectTemplates.map(template => template.id),
    quickStart: quickStartProjectTemplate.id,
  }),

  'project.fromTemplate': (input) => {
    const templateId = requireString(input, 'templateId')
    const name = requireString(input, 'name')
    return {
      files: Object.fromEntries(createProjectTemplateFiles(templateId, name).map(file => [file.path, file.content])),
    }
  },

  'project.slug': (input) => {
    const slug = toProjectSlug(requireString(input, 'name'))
    return { slug, valid: PROJECT_SLUG_RE.test(slug) }
  },

  'package.plan': async (input) => {
    const files = requireFileMap(input)
    const plan = await contentAsync(() => planProjectPackage({
      files,
      paths: optionalStringArray(input, 'paths') ?? [],
      name: requireString(input, 'name'),
      exportedAt: requireString(input, 'exportedAt'),
    }))
    // The exact manifest text Web Studio writes, so packages match byte for byte.
    return { ...plan, manifestText: JSON.stringify(plan.manifest, null, 2) }
  },

  'package.inspect': (input) => {
    const paths = optionalStringArray(input, 'paths') ?? []
    const manifest = optionalString(input, 'manifest')
    return {
      manifest: content(() => readProjectPackageManifest(manifest)),
      unsafePaths: paths.filter(path => !isSafeProjectPackagePath(path)),
    }
  },

  'chapter.parseAst': (input) => {
    const source = requireString(input, 'content')
    const glossary = optionalString(input, 'glossary') ?? ''
    return content(() => parseAst(source, glossary))
  },

  'content.parse': (input) => {
    const type = contentType(input)
    const source = requireString(input, 'content')
    return content(() => {
      switch (type) {
        case 'audio': return parseAudioMd(source)
        case 'chapter': return parseChapterMd(source, optionalString(input, 'filename') ?? 'chapter.adv.md')
        case 'character': return parseCharacterMd(source)
        case 'location': return parseLocationMd(source)
        case 'scene': return parseSceneMd(source)
      }
    })
  },

  'content.stringify': (input) => {
    const type = contentType(input)
    const data = requireObject(input, 'data')
    const source = optionalString(input, 'source')
    return content(() => {
      switch (type) {
        case 'audio': return stringifyAudioMd(data as any, { source })
        case 'chapter': return updateChapterMd({
          filename: requireString(data, 'filename'),
          title: typeof data.title === 'string' ? data.title : '',
          plotSummary: typeof data.plotSummary === 'string' ? data.plotSummary : undefined,
          content: requireString(data, 'content'),
        })
        case 'character': return stringifyCharacterMd(data as unknown as AdvCharacter, { source })
        case 'location': return stringifyLocationMd(data as any, { source })
        case 'scene': return stringifySceneMd(data as any, { source })
      }
    })
  },

  'assets.normalizeManifest': (input) => {
    const manifest = input.manifest
    const allowEmpty = optionalBoolean(input, 'allowEmpty')
    return content(() => normalizeAdvAssetManifest(manifest, { allowEmpty }))
  },

  'assets.readManifest': (input) => {
    const files = requireFileMap(input)
    return content(() => {
      const source = readAdvAssetManifestSource(files)
      return source && { path: source.path, manifest: normalizeAdvAssetManifest(source.manifest, { allowEmpty: true }) }
    })
  },

  'host.selfTest': async (input) => {
    const text = requireString(input, 'text')
    const bytes = new TextEncoder().encode(text)
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return {
      byteLength: bytes.byteLength,
      sha256: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''),
      roundTrip: new TextDecoder().decode(bytes),
      clone: structuredClone({ list: [1, 'two', { three: null }], nested: { when: 'now' } }),
    }
  },
}
