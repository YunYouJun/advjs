import { diffLines } from 'diff'

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
}

export interface FileDiff {
  filename: string
  before: string
  after: string
  lines: DiffLine[]
  addedCount: number
  removedCount: number
}

/** Strip trailing newline added by diffLines before splitting */
const TRAILING_NEWLINE_RE = /\n$/

/**
 * Compute a line-level diff between two file contents.
 * Uses the `diff` (jsdiff) library for robust LCS-based diffing.
 * Returns a FileDiff with per-line type annotations and summary counts.
 */
export function computeLineDiff(filename: string, before: string, after: string): FileDiff {
  const changes = diffLines(before, after)
  const lines: DiffLine[] = []

  for (const change of changes) {
    const lineArr = change.value.replace(TRAILING_NEWLINE_RE, '').split('\n')
    const type: DiffLine['type'] = change.added ? 'added' : change.removed ? 'removed' : 'unchanged'
    for (const content of lineArr)
      lines.push({ type, content })
  }

  let addedCount = 0
  let removedCount = 0
  for (const l of lines) {
    if (l.type === 'added')
      addedCount++
    else if (l.type === 'removed')
      removedCount++
  }

  return {
    filename,
    before,
    after,
    lines,
    addedCount,
    removedCount,
  }
}
