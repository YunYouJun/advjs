/**
 * Text-level handling of one segment file: unwrapping the model's reply, normalising the
 * frontmatter and title, and finding the closing choice block. Structure is checked on the
 * compiled program (`validate.ts`), not here.
 */

const FENCE = /^\s*(`{3,}|~{3,})/
const TITLE = /^##\s+(\S.*)$/
const ANCHOR = /\s*\{#[^}]*\}\s*$/

export interface PreparedSegment {
  /** The file as the host writes it: normalised frontmatter, title with the host's anchor. */
  source: string
  title?: string
  plotSummary?: string
  /** Something other than a blank line sits between the frontmatter and the title. */
  titleNotFirst: boolean
}

/** Code points, so a CJK character and a Latin letter both count as one. */
export function textLength(text: string): number {
  return [...text].length
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && /^["'].*["']$/.test(trimmed) && trimmed[0] === trimmed.at(-1)) {
    if (trimmed[0] === '"') {
      try {
        return JSON.parse(trimmed)
      }
      catch {}
    }
    return trimmed.slice(1, -1).replaceAll('\'\'', '\'')
  }
  return trimmed
}

/** Drops a wrapping code fence and any chatter before the file starts. */
export function extractSource(reply: string): string {
  let lines = reply.replace(/\r\n?/g, '\n').trim().split('\n')
  const opening = lines[0]?.trim().match(/^(`{3,}|~{3,})[ \t]*([\w-]*)$/)
  if (opening && opening[2] !== 'yaml' && lines.length > 1 && lines.at(-1)!.trim() === opening[1])
    lines = lines.slice(1, -1)
  const start = lines.findIndex(line => line.trim() === '---' || TITLE.test(line))
  if (start > 0)
    lines = lines.slice(start)
  return lines.join('\n').trim()
}

/**
 * Normalises a reply into the file the host writes: frontmatter reduced to a JSON-quoted
 * `plotSummary`, the first `## ` heading given the host's anchor `{#chapterId}` (an anchor the
 * model wrote is dropped).
 */
export function prepareSegment(reply: string, chapterId: string): PreparedSegment {
  const lines = extractSource(reply).split('\n')
  let plotSummary: string | undefined
  let body = 0
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
    if (end > 0) {
      for (const line of lines.slice(1, end)) {
        const match = line.match(/^plotSummary:(.*)$/)
        if (match)
          plotSummary = unquote(match[1]) || undefined
      }
      body = end + 1
    }
  }

  const rest = lines.slice(body)
  const titleIndex = rest.findIndex(line => TITLE.test(line))
  let title: string | undefined
  if (titleIndex !== -1) {
    title = rest[titleIndex].match(TITLE)![1].replace(ANCHOR, '').trim() || undefined
    rest[titleIndex] = `## ${title ?? ''} {#${chapterId}}`
  }
  const titleNotFirst = titleIndex === -1 || rest.slice(0, titleIndex).some(line => line.trim())

  const frontmatter = plotSummary === undefined ? [] : ['---', `plotSummary: ${JSON.stringify(plotSummary)}`, '---', '']
  return {
    source: `${[...frontmatter, ...rest].join('\n').trim()}\n`,
    title,
    plotSummary,
    titleNotFirst,
  }
}

/**
 * 0-based line indexes of the top-level items of the file's last list, outside fenced code.
 * In a segment that passed validation this is the closing choice block.
 */
export function choiceLines(source: string): number[] {
  let fence: string | undefined
  let items: number[] = []
  source.split('\n').forEach((line, index) => {
    const marker = line.match(FENCE)?.[1]
    if (marker) {
      if (!fence)
        fence = marker
      else if (line.trim().startsWith(fence))
        fence = undefined
      return
    }
    if (fence)
      return
    if (/^[-*+]\s+\S/.test(line))
      items.push(index)
    else if (line.trim() && !/^\s/.test(line))
      items = []
  })
  return items
}

/** Escapes text for use inside `[…]` so it reads back as the same label. */
export function escapeLinkText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/[\\`*_[\]()<>!]/g, '\\$&')
}

/**
 * Turns choice items into links. `targets[i]` is `chapter#anchor`; `undefined` leaves item `i`
 * as written. Labels come from the compiled program, so markup in the original is not carried over.
 */
export function linkChoices(source: string, labels: readonly string[], targets: readonly (string | undefined)[]): string {
  const lines = source.split('\n')
  const items = choiceLines(source)
  if (items.length !== labels.length)
    throw new Error(`Expected ${labels.length} choice lines, found ${items.length}`)
  items.forEach((line, i) => {
    const target = targets[i]
    if (target)
      lines[line] = `- [${escapeLinkText(labels[i])}](${target})`
  })
  return lines.join('\n')
}
