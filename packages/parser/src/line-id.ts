import type { AdvAst } from '@advjs/types'

const lineIdPattern = /^line_[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u
const markerPattern = /\{#line_[^}\r\n]*\}/gu

export function isDialogueLineId(value: unknown): value is string {
  return typeof value === 'string' && lineIdPattern.test(value)
}

export class AdvLineIdSyntaxError extends Error {
  readonly code = 'ADV_RUNTIME_INVALID_LINE_ID'
  line = 1
  column = 1

  constructor(message: string) {
    super(message)
    this.name = 'AdvLineIdSyntaxError'
  }
}

/** Parse exactly one final token. Never infer an identity from text or position. */
export function parseDialogueLineIdentity(text: string): { text: string, lineId?: string } {
  const markers = [...text.matchAll(markerPattern)]
  if (!markers.length && text.includes('{#line_'))
    throw new AdvLineIdSyntaxError('A dialogue line identity must be a complete final {#line_<uuidv7>} token')
  if (!markers.length)
    return { text }
  const marker = markers[0]
  const lineId = marker[0].slice(2, -1)
  if (markers.length !== 1 || !isDialogueLineId(lineId)
    || text.slice(marker.index + marker[0].length).trim()
    || (marker.index > 0 && !/\s/u.test(text[marker.index - 1]))) {
    throw new AdvLineIdSyntaxError('A dialogue requires at most one final {#line_<uuidv7>} token with a valid UUIDv7')
  }
  return { text: text.slice(0, marker.index).trimEnd(), lineId }
}

function dialogueText(node: AdvAst.Dialog): string {
  const lines = node.children.every(child => child.type === 'text')
  return node.children.map(child => child.type === 'glossaryReference'
    ? `[^${child.identifier}]`
    : 'value' in child ? String(child.value) : '').join(lines ? '\n' : '')
}

/** Authoring serializer used by both hosts when a dialogue is edited or moved. */
export function stringifyDialogue(node: AdvAst.Dialog | AdvAst.Narration): string {
  if (node.lineId !== undefined && !isDialogueLineId(node.lineId))
    throw new AdvLineIdSyntaxError(`Invalid dialogue line ID: ${node.lineId}`)
  const marker = node.lineId ? ` {#${node.lineId}}` : ''
  if (node.type === 'dialog') {
    const status = node.character.status ? `(${node.character.status})` : ''
    return `@${node.character.name}${status}\n${dialogueText(node)}${marker}`
  }
  return `${node.children.join('\n')}${marker}`.split('\n').map(line => `> ${line}`).join('\n')
}
