import type { AdvAst, JsonValue, RuntimeNode, RuntimeProgram } from '@advjs/types'
import type { CompileDiagnostic, CompileResult, RuntimeChapterInput } from './types'
import { parseAst } from '@advjs/parser'
import { linkRuntimeProgram } from './link'

export interface MarkdownChapterSource {
  id: string
  title?: string
  content: string
  sourcePath?: string
}

export interface MarkdownProgramSource {
  id: string
  chapters: MarkdownChapterSource[]
  requiredPlugins?: Record<string, string>
}

function phrasingText(children: Array<AdvAst.PhrasingContent | AdvAst.Dialog>): string {
  return children.map((child) => {
    if ('value' in child)
      return String(child.value)
    return phrasingText(child.children)
  }).join('')
}

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function compileNode(
  node: AdvAst.Child,
  id: string,
  diagnostics: CompileDiagnostic[],
  sourcePath?: string,
): RuntimeNode | null {
  switch (node.type) {
    case 'dialog':
      return {
        id,
        kind: 'dialog',
        data: {
          character: node.character.name,
          status: node.character.status ?? '',
          text: phrasingText(node.children),
        },
      }
    case 'narration':
      return { id, kind: 'narration', data: { text: node.children.join('\n') } }
    case 'text':
      return { id, kind: 'text', data: { text: node.value } }
    case 'paragraph': {
      const text = phrasingText(node.children)
      return text.trim() ? { id, kind: 'text', data: { text } } : null
    }
    case 'scene':
      return {
        id,
        kind: 'scene',
        data: {
          place: node.place,
          time: node.time,
          inOrOut: node.inOrOut,
        },
      }
    case 'choices': {
      const hasExecutableChoice = node.choices.some(choice => Boolean(choice.target || choice.do?.value))
      if (hasExecutableChoice) {
        diagnostics.push({
          code: 'ADV_RUNTIME_CHOICE_LINK_REQUIRED',
          severity: 'error',
          message: 'Choice targets and actions must be linked before RuntimeProgram execution',
          source: sourcePath ? { file: sourcePath } : undefined,
        })
      }
      return {
        id,
        kind: 'choices',
        data: {
          options: node.choices.map((choice, index) => ({
            id: `choice-${index + 1}`,
            label: choice.text,
          })),
        },
      }
    }
    case 'code':
      if (typeof node.value === 'string') {
        diagnostics.push({
          code: 'ADV_RUNTIME_EXECUTABLE_SCRIPT',
          severity: 'error',
          message: 'Executable script blocks are not supported by RuntimeProgram',
          source: sourcePath ? { file: sourcePath } : undefined,
        })
        return null
      }
      return node.value?.length
        ? { id, kind: 'effects', data: { operations: json(node.value) } }
        : null
    default:
      return null
  }
}

export async function compileMarkdownProgram(source: MarkdownProgramSource): Promise<CompileResult<RuntimeProgram>> {
  const diagnostics: CompileDiagnostic[] = []
  const chapters: RuntimeChapterInput[] = []

  for (const chapterSource of source.chapters) {
    const ast = await parseAst(chapterSource.content)
    const nodes = ast.children
      .map((node, index) => compileNode(node, `node-${index}`, diagnostics, chapterSource.sourcePath))
      .filter((node): node is RuntimeNode => node !== null)

    nodes.push({ id: 'end', kind: 'end' })
    nodes.forEach((node, index) => {
      const next = nodes[index + 1]
      if (next)
        node.next = { chapterId: chapterSource.id, nodeId: next.id }
    })

    chapters.push({
      id: chapterSource.id,
      title: chapterSource.title,
      entry: nodes[0].id,
      nodes,
    })
  }

  if (diagnostics.some(item => item.severity === 'error'))
    return { diagnostics }

  const firstChapter = chapters[0]
  if (!firstChapter) {
    return {
      diagnostics: [{
        code: 'ADV_RUNTIME_NO_CHAPTERS',
        severity: 'error',
        message: 'RuntimeProgram requires at least one chapter',
      }],
    }
  }

  const linked = await linkRuntimeProgram({
    id: source.id,
    entry: { chapterId: firstChapter.id, nodeId: firstChapter.entry },
    chapters,
    requiredPlugins: source.requiredPlugins,
  })
  return {
    program: linked.program,
    diagnostics: [...diagnostics, ...linked.diagnostics],
  }
}
