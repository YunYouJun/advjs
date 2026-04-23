/**
 * Token-aware segmentation for Source-to-Project pipeline (Phase M10).
 *
 * Input: raw text. Output: an ordered list of {@link SourceSegment}s that
 * respect the target token budget per segment while preserving heading
 * context. The generator consumes these segments to paginate LLM calls
 * without losing semantic boundaries.
 *
 * Strategy:
 *   1. Split on Markdown headings H1/H2/H3 first — each section becomes a
 *      candidate segment.
 *   2. If a section exceeds `targetTokens`, sub-split on paragraph breaks
 *      (double newline). Over-long paragraphs are themselves split on
 *      sentence boundaries as a last resort so no segment silently exceeds
 *      the budget.
 *   3. Optional `overlapTokens` prepends the tail of the previous segment
 *      to the next one — useful for LLM continuity but omitted by default.
 *
 * Pure function, no side effects. Unit tested in `__tests__/sourceChunk.test.ts`.
 */

import { estimateTokens } from './tokenEstimate'

export interface SourceSegment {
  index: number
  heading: string
  body: string
  tokenEstimate: number
}

export interface ChunkOptions {
  /** Soft cap per segment. The chunker aims to stay at or below this. */
  targetTokens: number
  /**
   * Tail of previous segment to prepend to the next one (for context continuity).
   * Defaults to 0 (no overlap).
   */
  overlapTokens?: number
}

const HEADING_RE = /^(#{1,3})[ \t]+(\S.*)$/
const FALLBACK_HEADING = '段落'
// Split on sentence-ending punctuation whether or not a space follows. CJK
// prose frequently lacks a trailing space; using `(?<=[。！？.!?])\s+` alone
// would leave a 1200-char paragraph unsplit.
const SENTENCE_BOUNDARY_RE = /(?<=[。！？.!?])\s*/
const PARAGRAPH_SPLIT_RE = /\n\s*\n/
const LINE_SPLIT_RE = /\r?\n/
const LEADING_NON_WHITESPACE_RE = /^\S*\s+/

/**
 * Split text into semantic segments, each within the token budget.
 */
export function chunkByHeadings(text: string, opts: ChunkOptions): SourceSegment[] {
  const { targetTokens, overlapTokens = 0 } = opts
  if (!text.trim())
    return []

  // Step 1: split by headings into raw sections
  const sections = splitByHeadings(text)

  // Step 2: for each section, split further if over budget
  const rawSegments: Array<{ heading: string, body: string }> = []
  for (const section of sections) {
    const sectionTokens = estimateTokens(section.body)
    if (sectionTokens <= targetTokens) {
      rawSegments.push(section)
      continue
    }
    // Over budget — split on paragraphs and accumulate
    const paragraphs = section.body.split(PARAGRAPH_SPLIT_RE).filter(p => p.trim())
    const buckets = packIntoBuckets(paragraphs, targetTokens)
    buckets.forEach((bucket, i) => {
      rawSegments.push({
        heading: buckets.length === 1 ? section.heading : `${section.heading} (${i + 1}/${buckets.length})`,
        body: bucket,
      })
    })
  }

  // Step 3: apply overlap if requested
  const segments: SourceSegment[] = []
  for (let i = 0; i < rawSegments.length; i++) {
    const current = rawSegments[i]
    let body = current.body
    if (overlapTokens > 0 && i > 0) {
      const tail = takeTailByTokens(rawSegments[i - 1].body, overlapTokens)
      if (tail)
        body = `${tail}\n\n${body}`
    }
    segments.push({
      index: i,
      heading: current.heading,
      body,
      tokenEstimate: estimateTokens(body),
    })
  }
  return segments
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function splitByHeadings(text: string): Array<{ heading: string, body: string }> {
  const lines = text.split(LINE_SPLIT_RE)
  const sections: Array<{ heading: string, body: string[] }> = []
  let current: { heading: string, body: string[] } | null = null

  for (const line of lines) {
    const m = line.match(HEADING_RE)
    if (m) {
      // flush previous section
      if (current)
        sections.push(current)
      current = { heading: m[2].trim() || FALLBACK_HEADING, body: [] }
    }
    else {
      if (!current)
        current = { heading: FALLBACK_HEADING, body: [] }
      current.body.push(line)
    }
  }
  if (current)
    sections.push(current)

  return sections
    .map(s => ({ heading: s.heading, body: s.body.join('\n').trim() }))
    .filter(s => s.body.length > 0)
}

/**
 * Greedily pack paragraphs into buckets that each stay under `targetTokens`.
 * A single paragraph exceeding the target is sentence-split as a last resort.
 */
function packIntoBuckets(paragraphs: string[], targetTokens: number): string[] {
  const buckets: string[] = []
  let current: string[] = []
  let currentTokens = 0

  const flush = () => {
    if (current.length > 0) {
      buckets.push(current.join('\n\n'))
      current = []
      currentTokens = 0
    }
  }

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para)
    if (paraTokens > targetTokens) {
      // Flush current, then hard-split this paragraph by sentences
      flush()
      const sentenceBuckets = packSentences(para, targetTokens)
      buckets.push(...sentenceBuckets)
      continue
    }
    if (currentTokens + paraTokens > targetTokens) {
      flush()
    }
    current.push(para)
    currentTokens += paraTokens
  }
  flush()
  return buckets.length > 0 ? buckets : ['']
}

function packSentences(text: string, targetTokens: number): string[] {
  const sentences = text.split(SENTENCE_BOUNDARY_RE).filter(s => s.trim())
  if (sentences.length <= 1) {
    // No sentence boundaries available — accept a single over-budget bucket
    return [text]
  }
  const buckets: string[] = []
  let current: string[] = []
  let currentTokens = 0
  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence)
    if (currentTokens + sentenceTokens > targetTokens && current.length > 0) {
      buckets.push(current.join(' '))
      current = []
      currentTokens = 0
    }
    current.push(sentence)
    currentTokens += sentenceTokens
  }
  if (current.length > 0)
    buckets.push(current.join(' '))
  return buckets
}

/**
 * Take the trailing `~tokens` worth of text from the end of `body`.
 * Preserves word/character boundaries best-effort.
 */
function takeTailByTokens(body: string, tokens: number): string {
  if (tokens <= 0 || !body)
    return ''
  // Work backward from the end. Since tokens ≈ 1.5/char for CJK, ≈ 0.25/char
  // for Latin, a safe upper bound is `tokens * 4` characters.
  const approxChars = Math.min(body.length, tokens * 4)
  const slice = body.slice(body.length - approxChars)
  // Trim to first whitespace/newline boundary for readability
  const trimmed = slice.replace(LEADING_NON_WHITESPACE_RE, '')
  return trimmed.trim()
}
