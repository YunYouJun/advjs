/**
 * Shared frontmatter parsing utility.
 * Used by chapterMd.ts and sceneMd.ts.
 */
export function parseFrontmatterAndBody(content: string): { frontmatter: string, body: string } {
  const trimmed = content.trim()
  if (!trimmed.startsWith('---'))
    return { frontmatter: '', body: trimmed }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1)
    return { frontmatter: '', body: trimmed }

  const frontmatter = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trim()
  return { frontmatter, body }
}
