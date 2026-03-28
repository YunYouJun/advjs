import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { parseCharacterMd } from '@advjs/parser'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { t } from '../cli/i18n'
import { parseSceneFrontmatter, scanFiles } from './utils'

export interface CheckOptions {
  root?: string
}

export interface CheckIssue {
  type: 'error' | 'warning'
  category: 'syntax' | 'character' | 'scene'
  file: string
  message: string
}

export interface CheckResult {
  issues: CheckIssue[]
  passed: boolean
  scriptCount: number
  characterRefCount: number
  sceneRefCount: number
}

// Module-level regex patterns (per e18e/prefer-static-regex)
const PARENTHESES_STATUS_RE = /[（(].*?[）)]$/
const SCENE_BLOCK_RE = /^【(.+)】$/gm

/**
 * Resolve the game content root directory.
 * Priority: --root flag > adv.config.json root field > ./adv
 */
export function resolveGameRoot(cwd: string, optionRoot?: string): string {
  if (optionRoot)
    return resolve(cwd, optionRoot)

  // Try reading adv.config.json
  const configPath = join(cwd, 'adv.config.json')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      if (config.root)
        return resolve(cwd, config.root)
    }
    catch (e: unknown) {
      // warn about parse errors but fall through to default
      consola.warn(`Failed to parse ${configPath}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return resolve(cwd, 'adv')
}

/**
 * Extract character names referenced via @Name syntax from .adv.md content.
 * Handles @Name(status) and @Name（状态） patterns.
 */
function extractCharacterRefs(content: string): string[] {
  const names = new Set<string>()
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('@'))
      continue

    // Extract the name part: @Name or @Name(status) or @Name（状态）
    let name = trimmed.slice(1) // remove @

    // Remove status in parentheses (both ASCII and Chinese)
    name = name.replace(PARENTHESES_STATUS_RE, '').trim()

    if (name)
      names.add(name)
  }

  return [...names]
}

/**
 * Extract scene place names from 【place，time，inOrOut】 syntax.
 */
function extractSceneRefs(content: string): string[] {
  const places = new Set<string>()

  let match
  SCENE_BLOCK_RE.lastIndex = 0
  // eslint-disable-next-line no-cond-assign
  while ((match = SCENE_BLOCK_RE.exec(content)) !== null) {
    const inner = match[1]
    const separator = '，'
    const parts = inner.split(separator)
    if (parts[0])
      places.add(parts[0].trim())
  }

  return [...places]
}

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
    }
  }

  const chaptersDir = join(gameRoot, 'chapters')
  const charactersDir = join(gameRoot, 'characters')
  const scenesDir = join(gameRoot, 'scenes')

  // 1. Find all .adv.md script files
  const scriptFiles = scanFiles(chaptersDir, '.adv.md')

  // Also check root level .adv.md files
  const rootScripts = scanFiles(gameRoot, '.adv.md')
  const allScripts = [...scriptFiles, ...rootScripts]

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

    if (scene.id)
      knownScenes.add(scene.id)
    if (scene.name)
      knownScenes.add(scene.name)

    // Also use filename without extension as scene identifier
    const fileName = basename(file, '.md')
    knownScenes.add(fileName)
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

  return {
    issues,
    passed: issues.length === 0,
    scriptCount: allScripts.length,
    characterRefCount: allCharacterRefs.size,
    sceneRefCount: allSceneRefs.size,
  }
}

/**
 * Error class for check command failures.
 * Allows CLI layer to distinguish expected errors from unexpected crashes.
 */
export class CheckError extends Error {
  constructor(message: string, public issueCount: number = 0) {
    super(message)
    this.name = 'CheckError'
  }
}

/**
 * CLI entry: runs checks and formats output to stdout.
 */
export async function advCheck(options: CheckOptions) {
  consola.start(t('check.scanning'))
  process.stdout.write('\n')

  const result = await runCheck(options)

  // Handle missing root as fatal error
  if (result.scriptCount === 0 && result.issues.some(i => i.message.startsWith('Game content root not found'))) {
    consola.error(t('check.no_root', result.issues[0].file))
    throw new CheckError(t('check.no_root', result.issues[0].file))
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

  // Summary
  process.stdout.write('\n')
  if (result.passed) {
    consola.success(colors.green(t('check.summary_pass')))
  }
  else {
    consola.error(colors.red(t('check.summary_fail', result.issues.length)))
    throw new CheckError(t('check.summary_fail', result.issues.length), result.issues.length)
  }
}
