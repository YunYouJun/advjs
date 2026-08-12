import type { CompileResult, MarkdownResourceCatalog } from '@advjs/core'
import type { AdvChapter, RuntimeProgram } from '@advjs/types'
import { compileFlowProgram, compileMarkdownProgram } from '@advjs/core'

export interface RuntimeChapterFetchResponse {
  ok: boolean
  status: number
  text: () => Promise<string>
}

export interface CompileClientRuntimeProgramOptions {
  id: string
  chapters: AdvChapter[]
  entryChapterId?: string
  requiredPlugins?: Record<string, string>
  resources?: MarkdownResourceCatalog
  fetcher?: (url: string) => Promise<RuntimeChapterFetchResponse>
}

function orderChapters(chapters: AdvChapter[], entryChapterId?: string): AdvChapter[] {
  const ordered = [...chapters]
  const entryIndex = entryChapterId
    ? ordered.findIndex(chapter => chapter.id === entryChapterId)
    : -1
  if (entryIndex > 0) {
    const [entry] = ordered.splice(entryIndex, 1)
    ordered.unshift(entry)
  }
  return ordered
}

export async function compileClientRuntimeProgram(
  options: CompileClientRuntimeProgramOptions,
): Promise<CompileResult<RuntimeProgram>> {
  const chapters = orderChapters(options.chapters, options.entryChapterId)
  const fountainNodes = chapters.flatMap(chapter => (
    chapter.nodes.filter(node => node.type === 'fountain')
  ))
  if (!fountainNodes.length) {
    return compileFlowProgram({
      id: options.id,
      chapters,
      requiredPlugins: options.requiredPlugins,
    })
  }

  const diagnostics: CompileResult<RuntimeProgram>['diagnostics'] = []
  const fetcher = options.fetcher ?? (url => fetch(url))
  const sources = await Promise.all(chapters.map(async (chapter) => {
    const nodes = chapter.nodes
      .filter(node => node.type === 'fountain')
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    const unsupported = chapter.nodes.filter(node => (
      node.type !== 'fountain' && node.type !== 'start' && node.type !== 'end'
    ))
    if (!nodes.length || unsupported.length) {
      diagnostics.push({
        code: 'ADV_RUNTIME_MIXED_AUTHOR_FORMAT',
        severity: 'error',
        message: `Chapter ${chapter.id} must use either Fountain or Flow nodes consistently`,
      })
      return undefined
    }

    const contents: string[] = []
    for (const node of nodes) {
      try {
        const response = await fetcher(node.src)
        if (!response.ok) {
          diagnostics.push({
            code: 'ADV_RUNTIME_CHAPTER_FETCH_FAILED',
            severity: 'error',
            message: `Failed to fetch ${node.src}: HTTP ${response.status}`,
            source: { file: node.src },
          })
          continue
        }
        contents.push(await response.text())
      }
      catch (error) {
        diagnostics.push({
          code: 'ADV_RUNTIME_CHAPTER_FETCH_FAILED',
          severity: 'error',
          message: `Failed to fetch ${node.src}: ${error instanceof Error ? error.message : String(error)}`,
          source: { file: node.src },
        })
      }
    }
    return {
      id: chapter.id,
      title: chapter.title,
      content: contents.join('\n\n'),
      sourcePath: nodes.length === 1 ? nodes[0].src : `${chapter.id}:fountain`,
    }
  }))

  if (diagnostics.length)
    return { diagnostics }

  return compileMarkdownProgram({
    id: options.id,
    chapters: sources.filter(source => source !== undefined),
    requiredPlugins: options.requiredPlugins,
    resources: options.resources,
  })
}
