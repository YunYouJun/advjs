import { createAudioId } from '@advjs/audio'
import { parseAst } from '@advjs/parser'

/** Compare authored semantics without source offsets or the identity being added. */
function semantics(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(semantics)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).filter(([key]) => !['position', 'lineId'].includes(key)).map(([key, child]) => [key, semantics(child)]))
  return value
}

/** Prepare candidate text only. Callers must review and persist it through their workspace. */
export async function prepareMarkdownVoiceIdentities(sources: Readonly<Record<string, string>>) {
  const entries = Object.entries(sources)
  if (entries.length > 256 || entries.some(([path, content]) => !path.endsWith('.adv.md') || typeof content !== 'string') || entries.reduce((size, [, content]) => size + content.length, 0) > 10 * 1024 * 1024)
    throw new Error('ADV_VOICE_IDENTITY_SOURCE_LIMIT')
  const parsed = await Promise.all(entries.map(async ([path, content]) => ({ path, content, ast: await parseAst(content) })))
  const used = new Set<string>()
  for (const { ast } of parsed) {
    for (const node of ast.children) {
      if ((node.type === 'dialog' || node.type === 'narration') && node.lineId) {
        if (used.has(node.lineId))
          throw new Error('ADV_VOICE_IDENTITY_DUPLICATE')
        used.add(node.lineId)
      }
    }
  }
  const retained = used.size
  const assigned: Array<{ path: string, line: number, endLine: number, lineId: string }> = []
  const files: Record<string, string> = {}
  for (const { path, content, ast } of parsed) {
    const edits: Array<{ index: number, offset: number, lineId: string }> = []
    for (const [index, node] of ast.children.entries()) {
      if ((node.type !== 'dialog' && node.type !== 'narration') || node.lineId)
        continue
      const position = node.position
      const offset = position?.end.offset
      if (!position || offset === undefined || !Number.isSafeInteger(offset) || offset < 0 || offset > content.length)
        throw new Error('ADV_VOICE_IDENTITY_UNPATCHABLE')
      let lineId: string
      do {
        lineId = createAudioId('line')
      } while (used.has(lineId))
      used.add(lineId)
      edits.push({ index, offset, lineId })
      assigned.push({ path, line: position.start.line, endLine: position.end.line, lineId })
    }
    let prepared = content
    for (const edit of edits.sort((a, b) => b.offset - a.offset))
      prepared = `${prepared.slice(0, edit.offset)} {#${edit.lineId}}${prepared.slice(edit.offset)}`
    if (edits.length) {
      const after = await parseAst(prepared)
      if (JSON.stringify(semantics(after)) !== JSON.stringify(semantics(ast)) || edits.some((edit) => {
        const node = after.children[edit.index]
        return !node || (node.type !== 'dialog' && node.type !== 'narration') || node.lineId !== edit.lineId
      })) {
        throw new Error('ADV_VOICE_IDENTITY_SEMANTICS_CHANGED')
      }
    }
    files[path] = prepared
  }
  return { files, assigned, retained }
}
