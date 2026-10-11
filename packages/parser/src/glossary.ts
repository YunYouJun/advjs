import type { AdvAst } from '@advjs/types'
import type { Content, FootnoteDefinition, Root } from 'mdast'
import { mdParseSync } from './markdown'

/** Deliberately project text only: never HTML, URLs, or author material tables. */
function plainText(node: Content): string {
  if (node.type === 'html')
    return ''
  if (node.type === 'image')
    return node.alt ?? ''
  if ('value' in node)
    return String(node.value)
  if ('children' in node)
    return node.children.map(child => plainText(child as Content)).join(node.type === 'footnoteDefinition' ? '\n\n' : '')
  return ''
}

export function prepareGlossary(content: string, glossaryContent: string): {
  definitions: Map<string, string>
  diagnostics: NonNullable<AdvAst.Root['glossaryDiagnostics']>
  ast: Root
} {
  const ast = mdParseSync(content)
  const definitions = new Map<string, string>()
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
        definitions.set(definition.identifier, plainText(definition).trim())
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

/** Preserve author source separately; only referenced plain text crosses to a player. */
export function projectGlossarySource(content: string, references: ReadonlyMap<string, string>): string {
  const ast = mdParseSync(content)
  let projected = content
  // Replacing spans backwards preserves every unrelated source byte and line.
  for (const node of [...ast.children].reverse()) {
    if (node.type !== 'footnoteDefinition' || !node.position)
      continue
    const { start, end } = node.position
    projected = projected.slice(0, start.offset)
      + content.slice(start.offset, end.offset).replace(/[^\r\n]/gu, value => ' '.repeat(value.length))
      + projected.slice(end.offset)
  }
  const escape = (text: string) => text.replace(/([\\`*{}[\]()#+.!_<>&~-])/gu, '\\$1')
  const definitions = [...references].map(([id, text]) => `[^${id}]: ${escape(text).replaceAll('\n', '\n    ')}`).join('\n\n')
  if (!definitions)
    return projected
  // Keep YAML frontmatter at document start and definitions outside any story
  // code fence. All source files remain separate in the existing chapter model.
  const frontmatter = ast.children[0]?.type === 'yaml' ? ast.children[0] : undefined
  const offset = frontmatter?.position?.end.offset ?? 0
  return `${projected.slice(0, offset)}\n\n${definitions}\n\n${projected.slice(offset)}`
}
