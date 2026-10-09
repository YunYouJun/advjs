import type { AdvRuntimePlugin } from '@advjs/core'
import type {
  AdvProjectCompileOptions,
  AdvProjectCompileResult,
  AdvProjectFileMap,
  JsonObject,
} from '@advjs/types'
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { compileProject } from '@advjs/core'
import { loadConfig } from 'c12'
import { bundledConfigAliases } from '../config/aliases'

const CONFIG_EXTENSIONS = ['json', 'ts', 'mts', 'cts', 'js', 'mjs', 'cjs'] as const
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.nuxt',
  '.output',
  'coverage',
  'dist',
  'node_modules',
])
const TEXT_FILE_RE = /\.(?:css|html|js|json|jsx|md|mjs|scss|ts|tsx|vue|yaml|yml)$/iu

export interface ProjectConfigSource {
  format: 'json' | 'module' | 'synthetic'
  path?: string
}

export interface ProjectCompatibilityOptions {
  /** Explicit legacy content root used only when no adv.config.* exists. */
  contentRoot: string
  config?: JsonObject
  gameConfig?: JsonObject
}

export interface LoadProjectOptions extends AdvProjectCompileOptions {
  root?: string
  /** Explicit authoring content root, overriding the config root. */
  contentRoot?: string
  compatibility?: ProjectCompatibilityOptions
}

export interface LoadedProject {
  root: string
  config: ProjectConfigSource
  files: AdvProjectFileMap
  /** Source and media paths for authoring navigation; binary contents stay out of the compiler. */
  filePaths?: string[]
  /** Evaluated configuration presented as JSON, rather than editable source. */
  virtualFiles: string[]
  result: AdvProjectCompileResult
  /** Runtime capabilities exported by a module config, retained outside JSON. */
  runtimePlugins: AdvRuntimePlugin[]
}

export class ProjectLoadError extends Error {
  constructor(
    public code: 'ADV_PROJECT_CONFIG_LOAD' | 'ADV_PROJECT_UNSAFE_ROOT' | 'ADV_PROJECT_UNSAFE_SYMLINK',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ProjectLoadError'
  }
}

function comparePaths(left: string, right: string) {
  if (left < right)
    return -1
  if (left > right)
    return 1
  return 0
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function toProjectPath(path: string) {
  return path.split(sep).join('/')
}

function isWithinRoot(root: string, target: string) {
  const path = relative(root, target)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

function stableJson(value: unknown) {
  const ancestors = new WeakSet<object>()
  return JSON.stringify(value, (_key, child) => {
    if (typeof child === 'bigint')
      return child.toString()
    if (typeof child === 'function' || typeof child === 'symbol' || child === undefined)
      return undefined
    if (child && typeof child === 'object') {
      if (ancestors.has(child))
        return undefined
      ancestors.add(child)
    }
    return child
  })
}

async function fileExists(path: string) {
  try {
    return (await stat(path)).isFile()
  }
  catch {
    return false
  }
}

async function directoryExists(path: string) {
  try {
    return (await stat(path)).isDirectory()
  }
  catch {
    return false
  }
}

async function assertSafeProjectFile(root: string, realRoot: string, path: string) {
  const target = await realpath(resolve(root, path))
  if (!isWithinRoot(realRoot, target)) {
    throw new ProjectLoadError(
      'ADV_PROJECT_UNSAFE_SYMLINK',
      `Project file symlink escapes the project root: ${path}`,
    )
  }
}

async function findConfig(root: string, name: 'adv' | 'game') {
  const candidates = CONFIG_EXTENSIONS.map(extension => `${name}.config.${extension}`)
  for (const path of candidates) {
    if (await fileExists(resolve(root, path)))
      return path
  }
}

function safeRelativeRoot(root: string, configuredRoot: unknown) {
  const requested = typeof configuredRoot === 'string' && configuredRoot
    ? configuredRoot
    : './adv'
  const absolute = resolve(root, requested)
  if (!isWithinRoot(root, absolute)) {
    throw new ProjectLoadError(
      'ADV_PROJECT_UNSAFE_ROOT',
      `Project content root escapes the project directory: ${requested}`,
    )
  }
  const path = toProjectPath(relative(root, absolute))
  return path || 'adv'
}

async function readModuleConfig(root: string, path: string, name: 'adv' | 'game') {
  try {
    const loaded = await loadConfig<JsonObject>({
      name,
      cwd: root,
      configFile: resolve(root, path),
      configFileRequired: true,
      jitiOptions: { alias: bundledConfigAliases() },
      rcFile: false,
      globalRc: false,
      packageJson: false,
      dotenv: false,
    })
    return loaded.config
  }
  catch (error) {
    throw new ProjectLoadError(
      'ADV_PROJECT_CONFIG_LOAD',
      `Failed to load ${path}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

async function readJsonForDiscovery(root: string, path: string) {
  try {
    return JSON.parse(await readFile(resolve(root, path), 'utf8')) as JsonObject
  }
  catch {
    return {}
  }
}

async function collectProjectFiles(
  root: string,
  realRoot: string,
  directories: string[],
) {
  const files = new Map<string, string>()
  const filePaths = new Set<string>()
  const visited = new Set<string>()

  async function walk(logicalDirectory: string, relativeDirectory: string) {
    const actualDirectory = await realpath(logicalDirectory)
    if (!isWithinRoot(realRoot, actualDirectory)) {
      throw new ProjectLoadError(
        'ADV_PROJECT_UNSAFE_SYMLINK',
        `Project directory symlink escapes the project root: ${relativeDirectory}`,
      )
    }
    if (visited.has(actualDirectory))
      return
    visited.add(actualDirectory)

    const entries = (await readdir(logicalDirectory, { withFileTypes: true }))
      .sort((left, right) => comparePaths(left.name, right.name))
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name))
        continue
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
      const logicalPath = resolve(logicalDirectory, entry.name)
      const metadata = entry.isSymbolicLink() ? await stat(logicalPath) : await lstat(logicalPath)
      if (entry.isSymbolicLink()) {
        const target = await realpath(logicalPath)
        if (!isWithinRoot(realRoot, target)) {
          throw new ProjectLoadError(
            'ADV_PROJECT_UNSAFE_SYMLINK',
            `Project symlink escapes the project root: ${relativePath}`,
          )
        }
      }
      if (metadata.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name))
          await walk(logicalPath, relativePath)
      }
      else if (metadata.isFile()) {
        filePaths.add(relativePath)
        if (TEXT_FILE_RE.test(entry.name))
          files.set(relativePath, await readFile(logicalPath, 'utf8'))
      }
    }
  }

  for (const directory of [...new Set(directories)].sort(comparePaths)) {
    const logicalDirectory = resolve(root, directory)
    if (await directoryExists(logicalDirectory))
      await walk(logicalDirectory, directory)
  }
  return { files, filePaths }
}

/**
 * Load one ADV.JS project from disk and compile it through the browser-safe
 * project compiler. Files are always exposed as stable project-relative paths.
 */
export async function loadProject(options: LoadProjectOptions = {}): Promise<LoadedProject> {
  const root = resolve(options.root ?? process.cwd())
  const realRoot = await realpath(root)
  const configPath = await findConfig(root, 'adv')
  if (configPath)
    await assertSafeProjectFile(root, realRoot, configPath)
  let configSource: ProjectConfigSource
  let config: JsonObject

  if (configPath?.endsWith('.json')) {
    configSource = { format: 'json', path: configPath }
    config = await readJsonForDiscovery(root, configPath)
  }
  else if (configPath) {
    configSource = { format: 'module', path: configPath }
    config = await readModuleConfig(root, configPath, 'adv')
  }
  else if (options.compatibility) {
    configSource = { format: 'synthetic' }
    config = {
      format: 'adv-md',
      root: options.compatibility.contentRoot,
      ...options.compatibility.config,
    }
  }
  else {
    configSource = { format: 'synthetic' }
    config = {}
  }

  const contentRoot = safeRelativeRoot(root, options.contentRoot ?? config.root)
  if (options.contentRoot)
    config = { ...config, root: contentRoot }
  const { files, filePaths } = await collectProjectFiles(root, realRoot, [contentRoot, 'public', 'pages', 'layouts', 'components', 'styles', 'client'])
  const virtualFiles: string[] = []
  const setVirtualConfig = (path: string, value: unknown) => {
    files.set(path, stableJson(value) ?? '{}')
    virtualFiles.push(path)
  }
  for (const extension of CONFIG_EXTENSIONS) {
    const path = `theme.config.${extension}`
    if (await fileExists(resolve(root, path))) {
      await assertSafeProjectFile(root, realRoot, path)
      files.set(path, await readFile(resolve(root, path), 'utf8'))
      filePaths.add(path)
    }
  }

  if (configSource.format === 'json' && configPath && !options.contentRoot) {
    files.set('adv.config.json', await readFile(resolve(root, configPath), 'utf8'))
  }
  else if (configPath || options.compatibility || options.contentRoot) {
    setVirtualConfig('adv.config.json', config)
  }

  const rootGameConfigPath = await findConfig(root, 'game')
  if (rootGameConfigPath)
    await assertSafeProjectFile(root, realRoot, rootGameConfigPath)
  if (rootGameConfigPath?.endsWith('.json')) {
    files.set('game.config.json', await readFile(resolve(root, rootGameConfigPath), 'utf8'))
  }
  else if (rootGameConfigPath) {
    const gameConfig = await readModuleConfig(root, rootGameConfigPath, 'game')
    setVirtualConfig('game.config.json', gameConfig)
  }
  else if (isJsonObject(config.gameConfig)) {
    setVirtualConfig('game.config.json', config.gameConfig)
  }
  else if (options.compatibility?.gameConfig) {
    setVirtualConfig('game.config.json', options.compatibility.gameConfig)
  }

  // Legacy module projects can keep metadata in settings/game.json while
  // declaring chapter URLs in adv.config.ts. Include those sources in checks
  // instead of treating the metadata-only settings file as an empty story.
  if (options.staticAnalysis && files.has('game.config.json')) {
    const settingsPath = [`${contentRoot}/settings/game.json`, `${contentRoot}/game.config.json`].find(path => files.has(path))
    if (settingsPath) {
      try {
        const settings = JSON.parse(files.get(settingsPath)!) as JsonObject
        const moduleGame = JSON.parse(files.get('game.config.json')!) as JsonObject
        for (const field of ['chapters', 'variables', 'entryChapterId'] as const) {
          if (settings[field] === undefined && moduleGame[field] !== undefined)
            settings[field] = moduleGame[field]
        }
        const projected = JSON.stringify(settings)
        if (projected !== files.get(settingsPath))
          virtualFiles.push(settingsPath)
        files.set(settingsPath, projected)
      }
      catch {
        // Preserve malformed source for the project compiler to diagnose.
      }
    }
  }

  const sortedFiles = Object.fromEntries([...files.entries()].sort(([left], [right]) => comparePaths(left, right)))
  const runtimePlugins = (Array.isArray(config.plugins) ? config.plugins : [])
    .filter((plugin): plugin is JsonObject & AdvRuntimePlugin => Boolean(
      isJsonObject(plugin) && typeof plugin.name === 'string' && typeof plugin.version === 'string',
    ))
  const result = await compileProject(
    { files: sortedFiles, id: typeof config.id === 'string' ? config.id : undefined },
    {
      plugins: options.plugins ?? (runtimePlugins.length ? Object.fromEntries(runtimePlugins.map(plugin => [plugin.name, plugin.version])) : undefined),
      staticAnalysis: options.staticAnalysis,
      validateContentReferences: options.validateContentReferences,
    },
  )
  return {
    root,
    config: configSource,
    files: sortedFiles,
    filePaths: [...new Set([...filePaths, ...Object.keys(sortedFiles), ...configPath ? [configPath] : []])].sort(comparePaths),
    virtualFiles,
    result,
    runtimePlugins,
  }
}
