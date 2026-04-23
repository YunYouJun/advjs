/**
 * Multi-format source normalization for Source-to-Project pipeline (Phase M10).
 *
 * Turns any raw input (text/markdown/chat-log, and later PDF/URL) into a
 * uniform {@link NormalizedSource} that the projectGenerator can consume
 * without caring about the original format.
 *
 * W1 scope: `text`, `markdown`, `chat-log`.
 * W3 scope: `pdf` (dynamic `pdfjs-dist`), `url` (fetch + readability fallback).
 * Post-contest: `image` (VLM OCR), `audio` (ASR).
 *
 * Pure-ish module — parsing uses `tokenEstimate` and `sourceChunk`, both of
 * which are deterministic. No network calls in W1.
 */

import type { SourceSegment } from './sourceChunk'
import yaml from 'js-yaml'
import { parseFrontmatterAndBody } from './mdFrontmatter'
import { chunkByHeadings } from './sourceChunk'
import { estimateTokens } from './tokenEstimate'

export type SourceType = 'text' | 'markdown' | 'chat-log' | 'pdf' | 'url'

export interface SourceParseInput {
  type: SourceType
  /**
   * Either a raw string (already decoded) or a Blob/File to read.
   * W1 only handles string; W3 adds File support for PDF.
   */
  content: string | Blob
  filename?: string
}

export interface SourceParseOptions {
  /** Target tokens per segment. Default: 1000. */
  targetTokensPerSegment?: number
  /** Trailing context to prepend to next segment. Default: 0. */
  overlapTokens?: number
}

export interface NormalizedSource {
  type: SourceType
  title: string
  segments: SourceSegment[]
  metadata: Record<string, string | number>
  suggestedTemplateId?: string
  /** Kept for debugging / re-chunking. */
  raw: string
}

const DEFAULT_TARGET_TOKENS = 1000
const UNTITLED = '未命名素材'

/**
 * Entry point. Dispatches by {@link SourceType}.
 */
export async function parseSource(
  input: SourceParseInput,
  opts: SourceParseOptions = {},
): Promise<NormalizedSource> {
  const targetTokens = opts.targetTokensPerSegment ?? DEFAULT_TARGET_TOKENS
  const overlapTokens = opts.overlapTokens ?? 0

  const raw = await readAsString(input.content)

  switch (input.type) {
    case 'markdown':
      return parseMarkdown(raw, { targetTokens, overlapTokens }, input.filename)
    case 'chat-log':
      return parseChatLog(raw, { targetTokens, overlapTokens }, input.filename)
    case 'text':
      return parsePlainText(raw, { targetTokens, overlapTokens }, input.filename)
    case 'pdf':
    case 'url':
      throw new Error(`[sourceParser] "${input.type}" is scheduled for Week 3, not yet implemented.`)
    default: {
      const _exhaustive: never = input.type
      throw new Error(`[sourceParser] unknown source type: ${_exhaustive}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function parseMarkdown(
  raw: string,
  chunkOpts: { targetTokens: number, overlapTokens: number },
  filename?: string,
): NormalizedSource {
  const { frontmatter, body } = parseFrontmatterAndBody(raw)
  const metadata: Record<string, string | number> = {}

  let fmTitle: string | undefined
  if (frontmatter) {
    try {
      const parsed = yaml.load(frontmatter) as Record<string, unknown> | null
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' || typeof v === 'number')
            metadata[k] = v
        }
        const fmName = parsed.title ?? parsed.name
        if (typeof fmName === 'string' && fmName.trim())
          fmTitle = fmName.trim()
      }
    }
    catch {
      // Malformed frontmatter — ignore, fall back to body-based title
    }
  }

  const title = resolveTitle({ fmTitle, body, filename })
  const segments = chunkByHeadings(body, chunkOpts)
  metadata.totalTokens = segments.reduce((sum, s) => sum + s.tokenEstimate, 0)
  metadata.segmentCount = segments.length

  return {
    type: 'markdown',
    title,
    segments,
    metadata,
    suggestedTemplateId: suggestTemplate({ title, body, metadata }),
    raw,
  }
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

function parsePlainText(
  raw: string,
  chunkOpts: { targetTokens: number, overlapTokens: number },
  filename?: string,
): NormalizedSource {
  const title = resolveTitle({ body: raw, filename })
  const segments = chunkByHeadings(raw, chunkOpts)
  const metadata: Record<string, string | number> = {
    totalTokens: segments.reduce((sum, s) => sum + s.tokenEstimate, 0),
    segmentCount: segments.length,
  }
  return {
    type: 'text',
    title,
    segments,
    metadata,
    suggestedTemplateId: suggestTemplate({ title, body: raw, metadata }),
    raw,
  }
}

// ---------------------------------------------------------------------------
// Chat log
// ---------------------------------------------------------------------------

interface ChatMessage {
  speaker: string
  content: string
  timestamp?: string
}

/**
 * Accepts either:
 *  - JSON: `[{ speaker, content, timestamp? }, ...]`
 *  - Plain transcript: `Alice: Hello\nBob: Hi` (one message per line)
 *  - WeChat-export style: `[2024-01-01 12:00:00] Alice\nHello`
 */
function parseChatLog(
  raw: string,
  chunkOpts: { targetTokens: number, overlapTokens: number },
  filename?: string,
): NormalizedSource {
  const messages = tryParseJsonChat(raw) ?? parsePlainChat(raw)
  const speakers = Array.from(new Set(messages.map(m => m.speaker))).filter(Boolean)

  // Rebuild as a readable transcript for chunking
  const transcript = messages
    .map(m => (m.timestamp ? `[${m.timestamp}] ${m.speaker}：${m.content}` : `${m.speaker}：${m.content}`))
    .join('\n')

  const title = deriveTitleFromFilename(filename)
    ?? (speakers.length >= 2 ? `${speakers[0]} 与 ${speakers[1]} 的对话` : UNTITLED)

  const segments = chunkByHeadings(transcript, chunkOpts)
  const metadata: Record<string, string | number> = {
    speakerCount: speakers.length,
    messageCount: messages.length,
    totalTokens: segments.reduce((sum, s) => sum + s.tokenEstimate, 0),
    segmentCount: segments.length,
  }
  if (speakers.length > 0)
    metadata.speakers = speakers.join(', ')

  return {
    type: 'chat-log',
    title,
    segments,
    metadata,
    suggestedTemplateId: 'customer-service',
    raw,
  }
}

function tryParseJsonChat(raw: string): ChatMessage[] | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{'))
    return null
  try {
    const parsed = JSON.parse(trimmed)
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    const out: ChatMessage[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object')
        continue
      const speaker = (item.speaker ?? item.role ?? item.from ?? item.author ?? '').toString().trim()
      const content = (item.content ?? item.message ?? item.text ?? '').toString().trim()
      if (!content)
        continue
      const msg: ChatMessage = { speaker: speaker || 'Anon', content }
      if (typeof item.timestamp === 'string')
        msg.timestamp = item.timestamp
      out.push(msg)
    }
    return out.length > 0 ? out : null
  }
  catch {
    return null
  }
}

const WECHAT_TIMESTAMP_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?)\][ \t]+(\S.*)$/
const SPEAKER_COLON_RE = /^([^：:]{1,30})[：:][ \t]*(\S.*)$/
const LINE_SPLIT_RE = /\r?\n/
const BODY_TITLE_RE = /^#[ \t]+(\S.*)$/m
const EXT_RE = /\.[^.]+$/

function parsePlainChat(raw: string): ChatMessage[] {
  const lines = raw.split(LINE_SPLIT_RE).map(l => l.trim()).filter(Boolean)
  const messages: ChatMessage[] = []
  let pendingSpeaker: string | null = null
  let pendingTimestamp: string | undefined
  for (const line of lines) {
    const tsMatch = line.match(WECHAT_TIMESTAMP_RE)
    if (tsMatch) {
      pendingSpeaker = tsMatch[2].trim() || null
      pendingTimestamp = tsMatch[1]
      continue
    }
    if (pendingSpeaker) {
      messages.push({ speaker: pendingSpeaker, content: line, timestamp: pendingTimestamp })
      pendingSpeaker = null
      pendingTimestamp = undefined
      continue
    }
    const colonMatch = line.match(SPEAKER_COLON_RE)
    if (colonMatch) {
      messages.push({ speaker: colonMatch[1].trim(), content: colonMatch[2].trim() })
      continue
    }
    // Continuation line — append to previous message
    if (messages.length > 0) {
      messages.at(-1)!.content += `\n${line}`
    }
    else {
      messages.push({ speaker: 'Anon', content: line })
    }
  }
  return messages
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readAsString(content: string | Blob): Promise<string> {
  if (typeof content === 'string')
    return content
  // Blob/File path (future PDF input still goes through a dedicated branch
  // that does NOT call this helper). For text Blobs this is safe.
  return await content.text()
}

/**
 * Priority: frontmatter.title → body "# heading" → filename stem → first
 * short non-empty line → UNTITLED. Filename beats body-firstLine so that
 * `note.txt` with `"No headings here."` yields "note", not the first line.
 */
function resolveTitle(input: { fmTitle?: string, body: string, filename?: string }): string {
  if (input.fmTitle)
    return input.fmTitle
  const h1 = extractH1FromBody(input.body)
  if (h1)
    return h1
  const fromFilename = deriveTitleFromFilename(input.filename)
  if (fromFilename)
    return fromFilename
  const firstLine = firstNonEmptyLine(input.body)
  if (firstLine)
    return firstLine
  return UNTITLED
}

function extractH1FromBody(body: string): string | undefined {
  const match = body.match(BODY_TITLE_RE)
  return match ? match[1].trim() : undefined
}

function firstNonEmptyLine(body: string): string | undefined {
  const line = body.split(LINE_SPLIT_RE).map(l => l.trim()).find(Boolean)
  if (!line)
    return undefined
  return line.length <= 40 ? line : `${line.slice(0, 30)}…`
}

function deriveTitleFromFilename(filename?: string): string | undefined {
  if (!filename)
    return undefined
  const base = filename.replace(EXT_RE, '').trim()
  return base || undefined
}

// ---------------------------------------------------------------------------
// Template suggestion heuristics
// ---------------------------------------------------------------------------

const TEMPLATE_HEURISTICS: Array<{ id: string, keywords: RegExp }> = [
  { id: 'training-drill', keywords: /(SOP|流程|规范|合规|话术|培训|上岗|手册|规章)/i },
  { id: 'customer-service', keywords: /(客诉|客服|工单|投诉|FAQ|咨询|售后)/i },
  { id: 'anti-fraud', keywords: /(诈骗|反诈|防骗|冒充|转账|诈欺|电信诈)/ },
  { id: 'medical-comm', keywords: /(病例|诊断|病人|主诉|病情|告知|医患|医院|诊室)/ },
  { id: 'touch-book', keywords: /(绘本|触摸|盲文|视障|盲童|插图|陪读)/ },
  { id: 'life-story', keywords: /(回忆|人生|自传|我的一生|童年|记忆|口述|奶奶|爷爷|外婆|外公|年轻的时候)/ },
]

function suggestTemplate(input: { title: string, body: string, metadata: Record<string, string | number> }): string | undefined {
  const haystack = `${input.title}\n${input.body}`
  for (const { id, keywords } of TEMPLATE_HEURISTICS) {
    if (keywords.test(haystack))
      return id
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Public util: total tokens helper
// ---------------------------------------------------------------------------

export function totalSegmentTokens(src: NormalizedSource): number {
  return src.segments.reduce((sum, s) => sum + s.tokenEstimate, 0)
}

// estimateTokens re-export for internal tests / downstream consumers
export { estimateTokens }
