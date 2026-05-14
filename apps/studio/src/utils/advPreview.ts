import type { AdvAst } from '@advjs/types'

export interface RenderableNodeInfo {
  index: number
  type: string
  preview: string
}

function phrasingToText(children: AdvAst.PhrasingContent[]): string {
  return children.map((c) => {
    if (c.type === 'text')
      return (c as AdvAst.Text).value
    if (c.type === 'link')
      return `[${phrasingToText((c as unknown as AdvAst.Link).children)}]`
    return ''
  }).join('')
}

function previewFor(node: AdvAst.Item): string {
  if (node.type === 'dialog') {
    const d = node as AdvAst.Dialog
    const text = phrasingToText(d.children)
    return `${d.character.name}: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`
  }
  if (node.type === 'narration') {
    const text = (node as AdvAst.Narration).children.join(' ')
    return text.slice(0, 30) + (text.length > 30 ? '...' : '')
  }
  if (node.type === 'choices') {
    const choices = (node as AdvAst.Choices).choices.map(c => c.text)
    return choices.join(' / ').slice(0, 40)
  }
  if (node.type === 'paragraph') {
    const text = (node as AdvAst.Paragraph).children.map((c) => {
      if (c.type === 'dialog') {
        const d = c as AdvAst.Dialog
        return `${d.character.name}: ${phrasingToText(d.children)}`
      }
      if (c.type === 'text')
        return (c as AdvAst.Text).value
      return ''
    }).join(' ')
    return text.slice(0, 30) + (text.length > 30 ? '...' : '')
  }
  if (node.type === 'text')
    return ((node as AdvAst.Text).value).slice(0, 30)
  return `[${node.type}]`
}

/**
 * Flatten an AST into the list of nodes the editor's NodeSelector renders.
 * Skips non-renderable boilerplate (code, unknown).
 */
export function buildRenderableNodes(ast?: AdvAst.Root | null): RenderableNodeInfo[] {
  if (!ast)
    return []
  const out: RenderableNodeInfo[] = []
  ast.children.forEach((node, index) => {
    if (node.type === 'code' || node.type === 'unknown')
      return
    out.push({ index, type: node.type, preview: previewFor(node) })
  })
  return out
}
