import type { AdvAst, JsonValue, RuntimeProgram } from '@advjs/types'
import type {
  CompileDiagnostic,
  CompileResult,
  CompileSourceLocation,
  RuntimeChapterInput,
  RuntimeNodeInput,
} from './types'
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

function sourceLocation(
  node: AdvAst.Node,
  sourcePath?: string,
): CompileSourceLocation | undefined {
  if (!sourcePath && !node.position)
    return undefined
  return {
    file: sourcePath,
    line: node.position?.start.line,
    column: node.position?.start.column,
  }
}

function compileNode(
  node: AdvAst.Child,
  id: string,
  diagnostics: CompileDiagnostic[],
  sourcePath?: string,
): RuntimeNodeInput | null {
  const source = sourceLocation(node, sourcePath)
  const withSource = (compiled: RuntimeNodeInput): RuntimeNodeInput => ({
    ...compiled,
    source,
  })

  switch (node.type) {
    case 'dialog':
      return withSource({
        id,
        kind: 'dialog',
        data: {
          character: node.character.name,
          status: node.character.status ?? '',
          text: phrasingText(node.children),
        },
      })
    case 'narration':
      return withSource({ id, kind: 'narration', data: { text: node.children.join('\n') } })
    case 'text':
      return withSource({ id, kind: 'text', data: { text: node.value } })
    case 'paragraph': {
      const text = phrasingText(node.children)
      return text.trim() ? withSource({ id, kind: 'text', data: { text } }) : null
    }
    case 'scene':
      return withSource({
        id,
        kind: 'scene',
        data: {
          place: node.place,
          time: node.time,
          inOrOut: node.inOrOut,
        },
      })
    case 'heading':
      return withSource({
        id,
        kind: 'anchor',
        data: { depth: node.depth, text: node.value },
      })
    case 'choices': {
      const hasExecutableChoice = node.choices.some(choice => Boolean(choice.do?.value))
      if (hasExecutableChoice) {
        const executable = node.choices.find(choice => Boolean(choice.do?.value))
        diagnostics.push({
          code: 'ADV_RUNTIME_EXECUTABLE_CHOICE_ACTION',
          severity: 'error',
          message: 'Executable choice actions are not supported by RuntimeProgram',
          source: executable ? sourceLocation(executable, sourcePath) : source,
        })
      }
      return withSource({
        id,
        kind: 'choices',
        choices: node.choices.map((choice, index) => ({
          id: `choice-${index + 1}`,
          label: choice.text,
          target: choice.target,
          source: sourceLocation(choice, sourcePath),
        })),
      })
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
        ? withSource({ id, kind: 'effects', data: { operations: json(node.value) } })
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
      .map((node, index) => compileNode(
        node,
        node.id ?? `node-${index}`,
        diagnostics,
        chapterSource.sourcePath,
      ))
      .filter((node): node is RuntimeNodeInput => node !== null)

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
