import type { AdvAst } from '@advjs/types'

/** Safe glossary reference spans emitted by the Markdown compiler. */
export interface GlossaryReference {
  identifier: string
  label: string
  definition: string
  definitionContent?: AdvAst.GlossaryContent
  start: number
  end: number
}

/** Validate node data rather than trusting JSON from external runtime programs. */
export function glossaryReferences(value: unknown, text: string): GlossaryReference[] {
  if (!Array.isArray(value))
    return []
  let end = 0
  return value.filter((item): item is GlossaryReference => {
    if (!item || typeof item !== 'object'
      || typeof item.identifier !== 'string' || typeof item.label !== 'string' || typeof item.definition !== 'string'
      || !Number.isInteger(item.start) || !Number.isInteger(item.end)
      || item.start < end || item.end <= item.start || item.end > text.length
      || text.slice(item.start, item.end) !== item.label) {
      return false
    }
    end = item.end
    return true
  })
}
