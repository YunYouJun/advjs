import type { AdvRuntimePlugin } from '@advjs/core'
import type { AdvChapter, AdvProjectCompileResult } from '@advjs/types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import process from 'node:process'
import { validateRuntimeProgramPlugins } from '@advjs/core'
import { extractCharacterRefs, extractSceneRefs, parseCharacterMd, validateSceneFrontmatter } from '@advjs/parser'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { t } from '../cli/i18n'
import { loadAdvConfig } from '../config'
import { loadProject } from '../project'
import { compileRuntimeChapterFiles, discoverRuntimeChapterFiles, resolveConfiguredRuntimeChapterFiles } from '../runtime'
import { AdvCommandError } from './errors'
import { parseSceneFrontmatter, resolveGameRoot, sanitizeFilename, scanFiles } from './utils'

export interface CheckOptions {
  root?: string
  /**
   * When true, generate stub files for unresolved character/scene
   * references after the report. Existing files are never overwritten.
   */
  fix?: boolean
  requiredPlugins?: Record<string, string>
  runtimePlugins?: readonly AdvRuntimePlugin[]
  /** Chapter sources declared by gameConfig, including files outside the adv content root. */
  chapters?: AdvChapter[]
}

export interface CheckIssue {
  type: 'error' | 'warning'
  category: 'syntax' | 'runtime' | 'character' | 'scene' | 'scene-frontmatter' | 'location'
  file: string
  message: string
  code?: string
  line?: number
  column?: number
}

export interface CheckResult {
  issues: CheckIssue[]
  passed: boolean
  scriptCount: number
  characterRefCount: number
  sceneRefCount: number
  locationRefCount: number
  compilation?: AdvProjectCompileResult
}

// Re-exported from utils for backwards compatibility (callers used to import
// `resolveGameRoot` from this module).
export { resolveGameRoot } from './utils'

const log = consola.log.bind(consola)

/**
 * Core check logic — returns a structured result.
 * Used by both the CLI (`advCheck`) and MCP Server (`adv_validate`).
 */
export async function runCheck(options: CheckOptions & { cwd?: string }): Promise<CheckResult> {
  const cwd = options.cwd || process.cwd()
  const gameRoot = resolveGameRoot(cwd, options.root)
  const issues: CheckIssue[] = []

  // Validate game root exists
  if (!existsSync(gameRoot)) {
    return {
      issues: [{
        type: 'error',
        category: 'syntax',
        file: gameRoot,
        message: `Game content root not found: ${gameRoot}`,
      }],
      passed: false,
      scriptCount: 0,
      characterRefCount: 0,
      sceneRefCount: 0,
      locationRefCount: 0,
    }
  }

  const loadedProject = options.root
    ? undefined
    : await loadProject({
        root: cwd,
        plugins: options.runtimePlugins
          ? Object.fromEntries(options.runtimePlugins.map(plugin => [plugin.name, plugin.version]))
          : undefined,
      })
  const compilation = loadedProject?.config.format === 'synthetic'
    ? undefined
    : loadedProject?.result

  const chaptersDir = join(gameRoot, 'chapters')
  const charactersDir = join(gameRoot, 'characters')
  const scenesDir = join(gameRoot, 'scenes')
  const locationsDir = join(gameRoot, 'locations')

  const configuredChapters = options.chapters?.length
    ? resolveConfiguredRuntimeChapterFiles({
      cwd,
      scriptPath: join(cwd, '__adv_check_entry__.adv.md'),
      chapters: options.chapters,
    }).chapters
    : []
  const configuredPaths = configuredChapters.flatMap(chapter => chapter.paths)
  for (const file of configuredPaths) {
    if (!existsSync(file)) {
      issues.push({
        type: 'error',
        category: 'runtime',
        code: 'ADV_RUNTIME_CHAPTER_NOT_FOUND',
        file: relative(cwd, file),
        message: `Configured chapter source not found: ${relative(cwd, file)}`,
      })
    }
  }

  // 1. Find all .adv.md script files
  const scriptFiles = scanFiles(chaptersDir, '.adv.md')

  // Also check root level .adv.md files
  const rootScripts = scanFiles(gameRoot, '.adv.md')
  const allScripts = [...new Set([
    ...scriptFiles,
    ...rootScripts,
    ...configuredPaths.filter(existsSync),
  ])].sort()

  // 2. Syntax check — parse each script
  const syntaxErrorFiles = new Set<string>()
  const allCharacterRefs = new Map<string, Set<string>>() // charName -> set of files
  const allSceneRefs = new Map<string, Set<string>>() // sceneName -> set of files

  for (const file of allScripts) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(`${cwd}/`, '')

    // Syntax check via parser
    try {
      const { parseAst } = await import('@advjs/parser')
      await parseAst(content)
    }
    catch (err: unknown) {
      syntaxErrorFiles.add(relPath)
      issues.push({
        type: 'error',
        category: 'syntax',
        file: relPath,
        message: err instanceof Error ? err.message : String(err),
      })
    }

    // Extract character references
    const charRefs = extractCharacterRefs(content)
    for (const name of charRefs) {
      if (!allCharacterRefs.has(name))
        allCharacterRefs.set(name, new Set())
      allCharacterRefs.get(name)!.add(relPath)
    }

    // Extract scene references
    const sceneRefs = extractSceneRefs(content)
    for (const place of sceneRefs) {
      if (!allSceneRefs.has(place))
        allSceneRefs.set(place, new Set())
      allSceneRefs.get(place)!.add(relPath)
    }
  }

  // Compile and link the complete story, so exact targets, conditions, actions,
  // and required plugin capabilities are checked together rather than file by file.
  if (compilation) {
    const compatibilityDiagnostics = new Set([
      'ADV_PROJECT_INVALID_SCENE_FRONTMATTER',
      'ADV_PROJECT_UNKNOWN_CHARACTER',
      'ADV_PROJECT_UNKNOWN_SCENE',
    ])
    for (const diagnostic of compilation.diagnostics) {
      if (compatibilityDiagnostics.has(diagnostic.code))
        continue
      issues.push({
        type: diagnostic.severity,
        category: diagnostic.code.startsWith('ADV_RUNTIME_') || diagnostic.code.includes('PLUGIN')
          ? 'runtime'
          : 'syntax',
        code: diagnostic.code,
        file: diagnostic.path ?? relative(cwd, gameRoot),
        line: diagnostic.line,
        column: diagnostic.column,
        message: diagnostic.message,
      })
    }
    if (compilation.project.program) {
      for (const diagnostic of validateRuntimeProgramPlugins(
        compilation.project.program,
        options.runtimePlugins,
      )) {
        issues.push({
          type: diagnostic.severity,
          category: 'runtime',
          code: diagnostic.code,
          file: relative(cwd, gameRoot),
          message: diagnostic.message,
        })
      }
    }
  }
  else if (allScripts.length > 0 && syntaxErrorFiles.size === 0) {
    const nestedChapters = configuredChapters.length
      ? configuredChapters.filter(chapter => chapter.paths.every(existsSync))
      : (scriptFiles.length ? await discoverRuntimeChapterFiles(scriptFiles[0]) : [])
    const nestedPaths = new Set(nestedChapters.flatMap(chapter => chapter.paths))
    const extraChapters = allScripts
      .filter(file => !nestedPaths.has(file))
      .map((file, index) => ({
        id: `chapter-root-${index + 1}`,
        title: basename(file, '.adv.md'),
        paths: [file],
      }))

    try {
      const compiled = await compileRuntimeChapterFiles({
        id: `adv-check:${relative(cwd, gameRoot) || 'game'}`,
        chapters: [...nestedChapters, ...extraChapters],
        requiredPlugins: options.requiredPlugins,
      })
      for (const diagnostic of compiled.diagnostics) {
        const file = diagnostic.source?.file
        issues.push({
          type: diagnostic.severity,
          category: 'runtime',
          code: diagnostic.code,
          file: file ? relative(cwd, file) : relative(cwd, gameRoot),
          line: diagnostic.source?.line,
          column: diagnostic.source?.column,
          message: diagnostic.message,
        })
      }
      if (compiled.program) {
        for (const diagnostic of validateRuntimeProgramPlugins(
          compiled.program,
          options.runtimePlugins,
        )) {
          issues.push({
            type: diagnostic.severity,
            category: 'runtime',
            code: diagnostic.code,
            file: relative(cwd, gameRoot),
            message: diagnostic.message,
          })
        }
      }
    }
    catch (error) {
      issues.push({
        type: 'error',
        category: 'runtime',
        code: 'ADV_RUNTIME_COMPILE_FAILED',
        file: relative(cwd, gameRoot),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // 3. Character reference check
  const characterFiles = scanFiles(charactersDir, '.character.md')
  const knownCharacters = new Map<string, string>() // name/id/alias -> file

  for (const file of characterFiles) {
    const content = readFileSync(file, 'utf-8')
    try {
      const char = parseCharacterMd(content)
      const relPath = file.replace(`${cwd}/`, '')

      // Register by id, name, and aliases
      knownCharacters.set(char.id, relPath)
      knownCharacters.set(char.name, relPath)
      if (char.aliases) {
        for (const alias of char.aliases)
          knownCharacters.set(alias, relPath)
      }
    }
    catch {
      // Skip invalid character files
    }
  }

  for (const [name, files] of allCharacterRefs) {
    if (!knownCharacters.has(name)) {
      for (const file of files) {
        issues.push({
          type: 'error',
          category: 'character',
          file,
          message: name,
        })
      }
    }
  }

  // 4. Scene reference check
  const sceneFiles = scanFiles(scenesDir, '.md')
    .filter(f => !basename(f).startsWith('README'))
  const knownScenes = new Set<string>()

  for (const file of sceneFiles) {
    const content = readFileSync(file, 'utf-8')
    const scene = parseSceneFrontmatter(content)
    const relPath = file.replace(`${cwd}/`, '')

    if (scene.id)
      knownScenes.add(scene.id)
    if (scene.name)
      knownScenes.add(scene.name)

    // Also use filename without extension as scene identifier
    const fileName = basename(file, '.md')
    knownScenes.add(fileName)

    // Validate scene frontmatter against the schema (catches malformed
    // `type` enum, non-string fields, missing id — format-freeze hardening).
    const validation = validateSceneFrontmatter(content)
    if (!validation.success) {
      issues.push({
        type: 'warning',
        category: 'scene-frontmatter',
        file: relPath,
        message: validation.error ?? 'invalid frontmatter',
      })
    }
  }

  for (const [place, files] of allSceneRefs) {
    if (!knownScenes.has(place)) {
      for (const file of files) {
        issues.push({
          type: 'warning',
          category: 'scene',
          file,
          message: place,
        })
      }
    }
  }

  // 5. Location reference check — scan locations/*.md and cross-reference with scenes
  const locationFiles = scanFiles(locationsDir, '.md')
    .filter(f => !basename(f).startsWith('README'))
  const knownLocations = new Set<string>()

  for (const file of locationFiles) {
    const content = readFileSync(file, 'utf-8')
    const loc = parseSceneFrontmatter(content) // reuse: extracts id + name
    if (loc.id)
      knownLocations.add(loc.id)
    if (loc.name)
      knownLocations.add(loc.name)
    const fileName = basename(file, '.md')
    knownLocations.add(fileName)
  }

  // Check: scene places that match neither scenes/*.md nor locations/*.md
  // (only when locations dir exists and has files — otherwise don't add noise)
  if (locationFiles.length > 0) {
    for (const [place, files] of allSceneRefs) {
      if (!knownScenes.has(place) && !knownLocations.has(place)) {
        for (const file of files) {
          // Avoid duplicating the scene warning — only add location hint
          // if there's no scene warning already emitted for this place
          if (knownScenes.size > 0 || knownLocations.size > 0) {
            issues.push({
              type: 'warning',
              category: 'location',
              file,
              message: place,
            })
          }
        }
      }
    }
  }

  return {
    issues,
    passed: issues.length === 0,
    scriptCount: allScripts.length,
    characterRefCount: allCharacterRefs.size,
    sceneRefCount: allSceneRefs.size,
    locationRefCount: knownLocations.size,
    compilation,
  }
}

export interface FixSummary {
  created: string[]
  skipped: string[]
}

/**
 * Generate stub files for unresolved character/scene references.
 *
 * Conservative — only creates new files; never modifies existing ones.
 * Returns the list of created paths (relative to cwd) and skipped paths
 * (when a same-named file already exists, e.g. from an earlier run).
 */
export async function applyFixes(result: CheckResult, gameRoot: string, cwd: string = process.cwd()): Promise<FixSummary> {
  const created: string[] = []
  const skipped: string[] = []

  const charactersDir = join(gameRoot, 'characters')
  const scenesDir = join(gameRoot, 'scenes')

  const seenCharacters = new Set<string>()
  for (const issue of result.issues) {
    if (issue.category !== 'character')
      continue
    if (seenCharacters.has(issue.message))
      continue
    seenCharacters.add(issue.message)

    const safe = sanitizeFilename(issue.message)
    const filePath = join(charactersDir, `${safe}.character.md`)
    const rel = filePath.replace(`${cwd}/`, '')

    if (existsSync(filePath)) {
      skipped.push(rel)
      continue
    }

    mkdirSync(dirname(filePath), { recursive: true })
    const stub = `---\nid: ${safe}\nname: ${issue.message}\n---\n\n# ${issue.message}\n\n> TODO: 描述这个角色（外貌、性格、背景）。由 \`adv check --fix\` 自动生成。\n`
    writeFileSync(filePath, stub, 'utf-8')
    created.push(rel)
  }

  const seenScenes = new Set<string>()
  for (const issue of result.issues) {
    if (issue.category !== 'scene')
      continue
    if (seenScenes.has(issue.message))
      continue
    seenScenes.add(issue.message)

    const safe = sanitizeFilename(issue.message)
    const filePath = join(scenesDir, `${safe}.md`)
    const rel = filePath.replace(`${cwd}/`, '')

    if (existsSync(filePath)) {
      skipped.push(rel)
      continue
    }

    mkdirSync(dirname(filePath), { recursive: true })
    const stub = `---\nid: ${safe}\nname: ${issue.message}\n---\n\n# ${issue.message}\n\n> TODO: 描述这个场景。由 \`adv check --fix\` 自动生成。\n`
    writeFileSync(filePath, stub, 'utf-8')
    created.push(rel)
  }

  return { created, skipped }
}

/**
 * Error class for check command failures.
 * Allows CLI layer to distinguish expected errors from unexpected crashes.
 */
export class CheckError extends AdvCommandError {
  constructor(
    message: string,
    public issueCount: number = 0,
    public result?: CheckResult,
  ) {
    super('ADV_VALIDATION', message)
    this.name = 'CheckError'
  }
}

/**
 * CLI entry: runs checks and formats output to stdout.
 */
export async function advCheck(options: CheckOptions) {
  consola.start(t('check.scanning'))
  process.stdout.write('\n')

  const { config } = await loadAdvConfig({ userRoot: process.cwd() })
  const runtimePlugins = Array.isArray(config.plugins)
    ? config.plugins.filter((plugin): plugin is AdvRuntimePlugin => Boolean(
        plugin
        && typeof plugin === 'object'
        && typeof (plugin as AdvRuntimePlugin).name === 'string'
        && typeof (plugin as AdvRuntimePlugin).version === 'string',
      ))
    : []
  const result = await runCheck({
    ...options,
    requiredPlugins: config.gameConfig?.requiredPlugins,
    runtimePlugins,
    chapters: config.gameConfig?.chapters,
  })

  // Handle missing root as fatal error
  if (result.scriptCount === 0 && result.issues.some(i => i.message.startsWith('Game content root not found'))) {
    consola.error(t('check.no_root', result.issues[0].file))
    throw new CheckError(t('check.no_root', result.issues[0].file), result.issues.length, result)
  }

  if (result.scriptCount === 0) {
    consola.warn(t('check.no_scripts'))
  }

  // Report syntax results
  const syntaxIssues = result.issues.filter(i => i.category === 'syntax')
  if (syntaxIssues.length === 0) {
    consola.success(t('check.syntax_ok', result.scriptCount))
  }
  else {
    const syntaxFiles = new Set(syntaxIssues.map(i => i.file))
    consola.fail(t('check.syntax_errors', syntaxIssues.length, syntaxFiles.size))
    for (const issue of syntaxIssues) {
      log(colors.red(`  ✗ ${t('check.syntax_error_detail', issue.file, issue.message)}`))
    }
  }

  const runtimeIssues = result.issues.filter(i => i.category === 'runtime')
  if (runtimeIssues.length === 0) {
    consola.success(t('check.runtime_ok'))
  }
  else {
    consola.fail(t('check.runtime_errors', runtimeIssues.length))
    for (const issue of runtimeIssues) {
      const location = issue.line
        ? `${issue.file}:${issue.line}:${issue.column ?? 1}`
        : issue.file
      log(colors.red(`  ✗ ${t('check.runtime_error_detail', location, issue.code ?? 'ADV_RUNTIME_ERROR', issue.message)}`))
    }
  }

  // Report character results
  const charIssues = result.issues.filter(i => i.category === 'character')
  if (charIssues.length === 0) {
    consola.success(t('check.characters_ok'))
  }
  else {
    const unresolvedNames = new Set(charIssues.map(i => i.message))
    consola.fail(t('check.characters_errors', unresolvedNames.size))
    for (const issue of charIssues) {
      log(colors.yellow(`  ⚠ ${t('check.character_unresolved', issue.file, issue.message)}`))
    }
  }

  // Report scene results
  const sceneIssues = result.issues.filter(i => i.category === 'scene')
  if (sceneIssues.length === 0 && result.sceneRefCount > 0) {
    consola.success(t('check.scenes_ok'))
  }
  else if (sceneIssues.length > 0) {
    const unresolvedScenes = new Set(sceneIssues.map(i => i.message))
    consola.fail(t('check.scenes_errors', unresolvedScenes.size))
    for (const issue of sceneIssues) {
      log(colors.yellow(`  ⚠ ${t('check.scene_unresolved', issue.file, issue.message)}`))
    }
  }

  // Report scene frontmatter schema results
  const sceneFmIssues = result.issues.filter(i => i.category === 'scene-frontmatter')
  if (sceneFmIssues.length > 0) {
    consola.fail(t('check.scene_frontmatter_errors', sceneFmIssues.length))
    for (const issue of sceneFmIssues) {
      log(colors.yellow(`  ⚠ ${t('check.scene_frontmatter_detail', issue.file, issue.message)}`))
    }
  }

  // Report location results
  const locationIssues = result.issues.filter(i => i.category === 'location')
  if (result.locationRefCount > 0 && locationIssues.length === 0) {
    consola.success(t('check.locations_ok', result.locationRefCount))
  }
  else if (locationIssues.length > 0) {
    const unresolvedLocations = new Set(locationIssues.map(i => i.message))
    consola.fail(t('check.locations_errors', unresolvedLocations.size))
    for (const issue of locationIssues) {
      log(colors.yellow(`  ⚠ ${t('check.location_unresolved', issue.file, issue.message)}`))
    }
  }

  // Auto-fix pass (creates stub files for unresolved character/scene refs)
  let fixSummary: FixSummary | null = null
  if (options.fix && (charIssues.length > 0 || sceneIssues.length > 0)) {
    process.stdout.write('\n')
    consola.start(t('check.fix_start'))
    const cwd = process.cwd()
    const gameRoot = resolveGameRoot(cwd, options.root)
    fixSummary = await applyFixes(result, gameRoot, cwd)
    if (fixSummary.created.length) {
      consola.success(t('check.fix_created', fixSummary.created.length))
      for (const file of fixSummary.created)
        log(colors.green(`  + ${file}`))
    }
    if (fixSummary.skipped.length) {
      consola.info(t('check.fix_skipped', fixSummary.skipped.length))
      for (const file of fixSummary.skipped)
        log(colors.dim(`  - ${file}`))
    }
  }

  // Summary
  process.stdout.write('\n')
  // After --fix, recompute "passed" by ignoring issues that have a created stub
  const fixedIssues = fixSummary?.created.length ?? 0
  const remainingIssues = result.issues.length - fixedIssues
  if (result.passed) {
    consola.success(colors.green(t('check.summary_pass')))
  }
  else if (remainingIssues <= 0) {
    consola.success(colors.green(t('check.summary_pass_after_fix', fixedIssues)))
  }
  else {
    consola.error(colors.red(t('check.summary_fail', remainingIssues)))
    throw new CheckError(t('check.summary_fail', remainingIssues), remainingIssues, result)
  }

  return result
}
