import type { AdvAst } from '@advjs/types'
import type { Content, FootnoteDefinition, Root } from 'mdast'
import { remark } from 'remark'
import { readGlossaryContent } from './glossary-content'
import { mdParseSync } from './markdown'

/** Legacy safe text fallback: never HTML, link destinations or author notes. */
function plainText(node: Content): string {
  if (node.type === 'html')
    return ''
  if (node.type === 'image')
    return node.alt ?? ''
  if ('value' in node)
    return String(node.value)
  if ('children' in node)
    return node.children.filter(child => child.type !== 'footnoteDefinition').map(child => plainText(child as Content)).join(node.type === 'footnoteDefinition' ? '\n\n' : '')
  return ''
}

/** Copy semantic Markdown nodes, deliberately discarding URLs, HTML and notes. */
function glossaryContentAst(definition: FootnoteDefinition): AdvAst.GlossaryContent | undefined {
  let remaining = 1024
  let exceeded = false
  const enter = (depth: number) => {
    if (--remaining < 0 || depth > 12) {
      exceeded = true
      return false
    }
    return true
  }
  const inline = (node: Content, depth: number): AdvAst.GlossaryInline[] => {
    if (!enter(depth) || node.type === 'html' || node.type === 'footnoteDefinition' || node.type === 'definition')
      return []
    if (node.type === 'text' || node.type === 'inlineCode')
      return [{ type: node.type, value: node.value }]
    if (node.type === 'image' || node.type === 'imageReference')
      return node.alt ? [{ type: 'text', value: node.alt }] : []
    if (node.type === 'break')
      return [{ type: 'text', value: '\n' }]
    if ('children' in node) {
      const children = node.children.flatMap(child => inline(child as Content, depth + 1))
      if (!children.length)
        return []
      return node.type === 'strong' || node.type === 'emphasis'
        ? [{ type: node.type, children }]
        : children
    }
    return []
  }
  const block = (node: Content, depth: number): AdvAst.GlossaryBlock[] => {
    if (!enter(depth) || node.type === 'html' || node.type === 'footnoteDefinition' || node.type === 'definition')
      return []
    if (node.type === 'list') {
      const children = node.children.map(item => ({ type: 'listItem' as const, children: item.children.flatMap(child => block(child, depth + 1)) })).filter(item => item.children.length)
      return children.length ? [{ type: 'list', ordered: Boolean(node.ordered), ...(node.ordered && node.start !== null && node.start !== undefined ? { start: node.start } : {}), children }] : []
    }
    if (node.type === 'paragraph' || node.type === 'heading') {
      const children = node.children.flatMap(child => inline(child, depth + 1))
      return children.length ? [{ type: 'paragraph', children }] : []
    }
    if ('children' in node)
      return node.children.flatMap(child => block(child as Content, depth + 1))
    // Unsupported block constructs retain inert text, rather than renderer code.
    if ('value' in node)
      return [{ type: 'paragraph', children: [{ type: 'text', value: String(node.value) }] }]
    return []
  }
  const content = definition.children.flatMap(node => block(node, 0))
  if (exceeded)
    return undefined
  // Leave ordinary plain-text definitions byte-compatible with old programs.
  if (content.length === 1 && content[0].type === 'paragraph' && content[0].children.every(node => node.type === 'text'))
    return undefined
  return readGlossaryContent(content)
}

export function prepareGlossary(content: string, glossaryContent: string): {
  definitions: Map<string, AdvAst.GlossaryDefinition>
  diagnostics: NonNullable<AdvAst.Root['glossaryDiagnostics']>
  ast: Root
} {
  const ast = mdParseSync(content)
  const definitions = new Map<string, AdvAst.GlossaryDefinition>()
  const diagnostics: NonNullable<AdvAst.Root['glossaryDiagnostics']> = []
  for (const [document, isShared] of [[ast, false], [mdParseSync(glossaryContent), true]] as const) {
    for (const node of document.children) {
      if (node.type !== 'footnoteDefinition')
        continue
      const definition = node as FootnoteDefinition
      if (definitions.has(definition.identifier)) {
        diagnostics.push({
          code: 'ADV_RUNTIME_DUPLICATE_GLOSSARY_DEFINITION',
          message: `Duplicate glossary definition: ${definition.label ?? definition.identifier}`,
          position: definition.position,
          source: isShared ? 'glossary' : undefined,
        })
      }
      else {
        const content = glossaryContentAst(definition)
        // Rich fallback must derive from the same public tree as transport, so
        // discarded HTML/URLs and block layout cannot alter export hashes.
        const safeText = (node: AdvAst.GlossaryBlock | AdvAst.GlossaryInline | { type: 'listItem', children: AdvAst.GlossaryBlock[] }): string =>
          'value' in node ? node.value : node.children.map(safeText).join(node.type === 'paragraph' || node.type === 'strong' || node.type === 'emphasis' ? '' : '\n\n')
        const text = content ? content.map(safeText).join('\n\n').trim() : plainText(definition).trim()
        definitions.set(definition.identifier, { text, ...(content ? { content } : {}) })
      }
    }
  }

  // Resolve only actual paragraph AST nodes. Prepending synthetic declarations
  // lets the native parser decide whether a candidate is an escaped marker,
  // inline code, or a real reference (including unresolved references). Unlike
  // appending to a whole chapter, an unclosed fence cannot swallow declarations.
  const linkDefinitions = ast.children.filter(node => node.type === 'definition').map(node => content.slice(node.position?.start.offset, node.position?.end.offset)).join('\n\n')
  for (const paragraph of ast.children) {
    if (paragraph.type !== 'paragraph' || !paragraph.position)
      continue
    const position = paragraph.position
    const raw = content.slice(position.start.offset, position.end.offset)
    const declarations: string[] = []
    // This scan proposes labels only; the native parser validates every
    // declaration, including escaped brackets and invalid/space-containing IDs.
    for (let start = raw.indexOf('[^'); start !== -1; start = raw.indexOf('[^', start + 2)) {
      for (let end = start + 2; end < raw.length && end - start <= 1002; end++) {
        if (raw[end] === '\\' && ['[', ']', '\\'].includes(raw[end + 1])) {
          end++
          continue
        }
        if (raw[end] === '[' || raw[end] === '\n' || raw[end] === '\r')
          break
        if (raw[end] !== ']')
          continue
        const declaration = `${raw.slice(start, end + 1)}: .`
        const parsed = mdParseSync(declaration)
        if (parsed.children.length === 1 && parsed.children[0].type === 'footnoteDefinition')
          declarations.push(declaration)
        break
      }
    }
    if (!declarations.length)
      continue
    const prefix = `${linkDefinitions}\n\n${[...new Set(declarations)].join('\n\n')}\n\n`
    const prefixLines = prefix.split('\n').length - 1
    const parsed = mdParseSync(prefix + raw).children.find(node => node.type === 'paragraph' && (node.position?.start.offset ?? -1) >= prefix.length)
    if (!parsed || parsed.type !== 'paragraph')
      continue
    const remap = (node: Content) => {
      if (node.position) {
        for (const point of [node.position.start, node.position.end]) {
          if (point.line === prefixLines + 1)
            point.column += position.start.column - 1
          point.line += position.start.line - prefixLines - 1
          if (point.offset !== undefined)
            point.offset += (position.start.offset ?? 0) - prefix.length
        }
      }
      if ('children' in node)
        node.children.forEach(child => remap(child as Content))
    }
    parsed.children.forEach(child => remap(child))
    paragraph.children = parsed.children
  }
  return { definitions, diagnostics, ast }
}

/** Preserve author source separately; only referenced safe content crosses to a player. */
export function projectGlossarySource(content: string, references: ReadonlyMap<string, string | AdvAst.GlossaryDefinition>): string {
  const ast = mdParseSync(content)
  const ranges: Array<{ start: number, end: number }> = []
  const collect = (node: Content | Root) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (node.type === 'footnoteDefinition' && start !== undefined && end !== undefined)
      ranges.push({ start, end })
    if ('children' in node)
      node.children.forEach(child => collect(child as Content))
  }
  collect(ast)
  ranges.sort((left, right) => left.start - right.start || right.end - left.end)
  const merged: typeof ranges = []
  for (const range of ranges) {
    const previous = merged.at(-1)
    if (previous && range.start <= previous.end)
      previous.end = Math.max(previous.end, range.end)
    else
      merged.push({ ...range })
  }
  let projected = content
  // Nested definitions can overlap their parent definition. Replace their union
  // once, backwards, retaining unrelated bytes, line endings and UTF-16 offsets.
  for (const { start, end } of merged.reverse()) {
    projected = projected.slice(0, start)
      + content.slice(start, end).replace(/[^\r\n]/gu, value => ' '.repeat(value.length))
      + projected.slice(end)
  }
  const escape = (text: string) => text.replace(/([\\`*{}[\]()#+.!_<>&~-])/gu, '\\$1')
  const definitions = [...references].map(([id, definition]) => {
    const text = typeof definition === 'string' ? definition : definition.text
    const content = typeof definition === 'string' ? undefined : readGlossaryContent(definition.content)
    // remark escapes literal Markdown punctuation and code delimiters. Only
    // allowlisted AST nodes enter it; raw HTML/URLs/author source never do.
    const markdown = content
      ? remark().stringify({ type: 'root', children: content } as Root).trimEnd()
      : escape(text)
    return `[^${id}]: ${markdown.replaceAll('\n', '\n    ')}`
  }).join('\n\n')
  if (!definitions)
    return projected
  // Keep YAML frontmatter at document start and definitions outside any story
  // code fence. All source files remain separate in the existing chapter model.
  const frontmatter = ast.children[0]?.type === 'yaml' ? ast.children[0] : undefined
  const offset = frontmatter?.position?.end.offset ?? 0
  return `${projected.slice(0, offset)}\n\n${definitions}\n\n${projected.slice(offset)}`
}
