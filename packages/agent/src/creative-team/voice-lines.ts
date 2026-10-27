import type { CreativeVoiceLine } from './outputs'
import { JSON_SCHEMA, load } from 'js-yaml'

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** Exact declared character aliases only; the author host still checks the compiled stable speaker. */
function speakerMatches(declared: string, speakerId: string, files: Readonly<Record<string, string>>): boolean {
  if (declared === speakerId)
    return true
  const matches = Object.entries(files).flatMap(([path, source]) => {
    const file = /^adv\/characters\/([\w-]+)\.(?:character\.)?md$/.exec(path)
    const header = file && /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
    if (!header)
      return []
    const data = object(load(header[1]!, { schema: JSON_SCHEMA }))
    const id = data?.id ?? file![1]
    return typeof id === 'string' && [id, data?.name, ...(Array.isArray(data?.aliases) ? data.aliases : [])].includes(declared) ? [id] : []
  })
  return matches.length === 1 && matches[0] === speakerId
}

/** Finite frozen-source check, not a substitute for the host's actual compiler and media verification. */
export function matchesCreativeVoiceLineSource(line: CreativeVoiceLine, files: Readonly<Record<string, string>>, targetLineId?: string): boolean {
  const source = files[line.path]
  if (source === undefined)
    return false
  try {
    if (line.lineId !== undefined) {
      if (!line.path.endsWith('.chapter.json') || (targetLineId !== undefined && targetLineId !== line.lineId))
        return false
      const chapter = object(JSON.parse(source))
      if (!Array.isArray(chapter?.nodes))
        return false
      const rows = chapter.nodes.flatMap((value) => {
        const node = object(value)
        if (node?.type === 'narration')
          return [{ lineId: node.lineId, text: node.text, speakerId: 'narrator' }]
        if (node && (node.type === 'dialogues' || node.type === undefined) && Array.isArray(node.dialogues)) {
          return node.dialogues.flatMap((value) => {
            const row = object(value)
            return row ? [{ lineId: row.lineId, text: row.text, speakerId: row.speakerId || row.speaker || 'narrator' }] : []
          })
        }
        return []
      }).filter(row => row.lineId === line.lineId)
      return rows.length === 1 && rows[0]!.text === line.text && typeof rows[0]!.speakerId === 'string' && speakerMatches(rows[0]!.speakerId, line.speakerId, files)
    }
    if (!line.path.endsWith('.adv.md'))
      return false
    const raw = source.split('\n')[line.line - 1]
    if (!raw?.includes(line.text))
      return false
    // When registering a take, bind even legacy physical-line instructions to its literal stable ID.
    return targetLineId === undefined || (raw.includes(`{#${targetLineId}}`) && source.split(`{#${targetLineId}}`).length === 2)
  }
  catch {
    return false
  }
}
