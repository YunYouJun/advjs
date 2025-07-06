import type { AdvAIConfig } from './types'

/**
 * 遍历 chapters nodes
 */
export function walkChapterNodes({ json }: {
  json: AdvAIConfig
}) {
  const nodes: string[] = []
  json.chapters.forEach((chapter) => {
    chapter.nodes.forEach((node) => {
      nodes.push(node.id)
    })
  })
  return nodes
}
