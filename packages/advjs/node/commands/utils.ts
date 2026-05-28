import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { consola } from 'consola'

// Module-level regex patterns (per e18e/prefer-static-regex)
const FRONTMATTER_ID_RE = /^id:\s*(\S.*)$/m
const FRONTMATTER_NAME_RE = /^name:\s*(\S.*)$/m

/**
 * Read a file if it exists, otherwise return undefined.
 */
export function readOptionalFile(path: string): string | undefined {
  if (existsSync(path))
    return readFileSync(path, 'utf-8')
  return undefined
}

/**
 * Scan a directory for files matching a given extension.
 */
export function scanFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir))
    return []
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath, ext))
    }
    else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Sanitize a string into a filesystem-safe filename.
 *
 * Used by both auto-fix (`adv check --fix`) and the MCP server's create_*
 * tools to keep arbitrary user/AI-supplied names from escaping the project
 * directory or producing invalid filenames.
 */
// CJK Unified Ideographs (U+4E00–U+9FFF) are explicitly allowed so Chinese
// names round-trip; everything else collapses into a single underscore.
const FILENAME_BLOCKLIST_RE = /[^\w\u4E00-\u9FFF.-]+/g
const FILENAME_TRIM_RE = /^[._-]+|[._-]+$/g
export function sanitizeFilename(input: string): string {
  const cleaned = input
    .normalize('NFKC')
    .replace(FILENAME_BLOCKLIST_RE, '_')
    .replace(FILENAME_TRIM_RE, '')
  return cleaned || 'untitled'
}

/**
 * Resolve the game content root directory.
 * Priority: explicit option > adv.config.json `root` field > `./adv`.
 *
 * Shared by `check`, `play`, and `debug` subcommands so they all agree on
 * which `adv/` tree to operate against.
 */
export function resolveGameRoot(cwd: string, optionRoot?: string): string {
  if (optionRoot)
    return resolve(cwd, optionRoot)

  const configPath = join(cwd, 'adv.config.json')
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      if (config.root)
        return resolve(cwd, config.root)
    }
    catch (e: unknown) {
      consola.warn(`Failed to parse ${configPath}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return resolve(cwd, 'adv')
}

/**
 * Parse scene file frontmatter to extract id and name using simple regex.
 * Avoids importing js-yaml directly.
 */
export function parseSceneFrontmatter(content: string): { id?: string, name?: string } {
  const trimmed = content.trim()
  if (!trimmed.startsWith('---'))
    return {}
  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1)
    return {}
  const frontmatter = trimmed.slice(3, endIndex)
  const idMatch = frontmatter.match(FRONTMATTER_ID_RE)
  const nameMatch = frontmatter.match(FRONTMATTER_NAME_RE)
  return {
    id: idMatch?.[1]?.trim(),
    name: nameMatch?.[1]?.trim(),
  }
}
