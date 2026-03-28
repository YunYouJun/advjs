import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
