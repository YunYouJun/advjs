import type { AdvAst } from '@advjs/types'

/** Rebuild an inert, bounded Markdown tree from untrusted runtime JSON. */
export function readGlossaryContent(value: unknown): AdvAst.GlossaryContent | undefined {
  let remaining = 1024
  let characters = 100_000
  const record = (node: unknown, depth: number): Record<string, unknown> => {
    if (--remaining < 0 || depth > 12 || !node || typeof node !== 'object' || Array.isArray(node))
      throw new Error('Invalid glossary content')
    return node as Record<string, unknown>
  }
  const children = <T>(value: unknown, parse: (item: unknown) => T): T[] => {
    if (!Array.isArray(value) || value.length > remaining)
      throw new Error('Invalid glossary children')
    return value.map(parse)
  }
  function inlineChildren(value: unknown, depth: number): AdvAst.GlossaryInline[] {
    const parsed = children(value, item => inline(item, depth))
    return mergeInline(parsed)
  }
  function mergeInline(parsed: AdvAst.GlossaryInline[]): AdvAst.GlossaryInline[] {
    const merged: AdvAst.GlossaryInline[] = []
    for (const node of parsed) {
      const previous = merged.at(-1)
      if ('value' in node && previous && 'value' in previous && node.type === previous.type)
        previous.value += node.value
      else if ('children' in node && previous && 'children' in previous && node.type === previous.type)
        previous.children = mergeInline([...previous.children, ...node.children])
      else
        merged.push(node)
    }
    return merged
  }
  function inline(value: unknown, depth: number): AdvAst.GlossaryInline {
    const node = record(value, depth)
    if ((node.type === 'text' || node.type === 'inlineCode') && typeof node.value === 'string') {
      characters -= node.value.length
      if (characters < 0)
        throw new Error('Glossary content is too large')
      return { type: node.type, value: node.value }
    }
    if (node.type === 'strong' || node.type === 'emphasis') {
      const parsed = inlineChildren(node.children, depth + 1)
      const flattened = parsed.flatMap(child => child.type === node.type && 'children' in child ? child.children : [child])
      return { type: node.type, children: mergeInline(flattened) }
    }
    throw new Error('Unsupported glossary inline')
  }
  const block = (value: unknown, depth: number): AdvAst.GlossaryBlock => {
    const node = record(value, depth)
    if (node.type === 'paragraph')
      return { type: 'paragraph', children: inlineChildren(node.children, depth + 1) }
    if (node.type === 'list' && typeof node.ordered === 'boolean') {
      if (node.start !== undefined && (!Number.isInteger(node.start) || Number(node.start) < 1 || Number(node.start) > 1_000_000))
        throw new Error('Invalid glossary list start')
      return {
        type: 'list',
        ordered: node.ordered,
        ...(node.ordered && node.start !== undefined ? { start: Number(node.start) } : {}),
        children: children(node.children, (item) => {
          const entry = record(item, depth + 1)
          if (entry.type !== 'listItem')
            throw new Error('Invalid glossary list item')
          return { type: 'listItem', children: children(entry.children, item => block(item, depth + 2)) }
        }),
      }
    }
    throw new Error('Unsupported glossary block')
  }
  try {
    const content = children(value, node => block(node, 0))
    return content.length && characters < 100_000 ? content : undefined
  }
  catch {
    return undefined
  }
}
