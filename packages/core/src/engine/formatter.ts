import type { AdvAst } from '@advjs/types'
import type { AstChild, FormattedOutput } from './types'

/**
 * Extract text from mdast PhrasingContent children
 */
function extractText(children: AdvAst.PhrasingContent[]): string {
  return children
    .map((child) => {
      if ('value' in child)
        return child.value
      if ('children' in child)
        return extractText(child.children as AdvAst.PhrasingContent[])
      return ''
    })
    .join('')
}

/**
 * Format an AST node into a displayable output
 *
 * Returns `null` for nodes that should be silently processed (code operations, etc.)
 */
export function formatNode(node: AstChild): FormattedOutput | null {
  if (!node || !node.type)
    return null

  switch (node.type) {
    case 'dialog': {
      const dialog = node as AdvAst.Dialog
      const text = extractText(dialog.children)
      return {
        type: 'dialog',
        text,
        character: dialog.character?.name || '???',
        status: dialog.character?.status,
      }
    }

    case 'narration': {
      const narration = node as AdvAst.Narration
      const text = narration.children?.join('\n') || ''
      return {
        type: 'narration',
        text,
      }
    }

    case 'choices': {
      const choices = node as AdvAst.Choices
      const options = choices.choices.map((choice, index) => ({
        index: index + 1,
        label: choice.text || `选项 ${index + 1}`,
      }))
      const text = options.map(o => `  ${o.index}. ${o.label}`).join('\n')
      return {
        type: 'choices',
        text: `请选择:\n${text}`,
        options,
      }
    }

    case 'scene': {
      const scene = node as AdvAst.SceneInfo
      const parts = [scene.place, scene.time, scene.inOrOut].filter(Boolean)
      return {
        type: 'scene',
        text: `[场景] ${parts.join(' - ')}`,
        place: scene.place,
        time: scene.time,
      }
    }

    case 'text': {
      const text = node as AdvAst.Text
      return {
        type: 'text',
        text: text.value || '',
      }
    }

    case 'paragraph': {
      const paragraph = node as AdvAst.Paragraph
      if (paragraph.children) {
        const text = extractText(paragraph.children as AdvAst.PhrasingContent[])
        if (text.trim())
          return { type: 'text', text }
      }
      return null
    }

    case 'end':
      return {
        type: 'end',
        text: '— END —',
      }

    // Code operations (tachie, camera, background, go) are silent
    case 'code':
      return null

    default:
      return null
  }
}

/**
 * Format output as plain text for CLI
 */
export function formatAsText(output: FormattedOutput): string {
  switch (output.type) {
    case 'dialog':
      return output.status
        ? `${output.character}(${output.status}): ${output.text}`
        : `${output.character}: ${output.text}`
    case 'narration':
      return `  "${output.text}"`
    case 'choices':
      return output.text
    case 'scene':
      return output.text
    case 'text':
      return output.text
    case 'end':
      return `\n${output.text}\n`
    default:
      return ''
  }
}
