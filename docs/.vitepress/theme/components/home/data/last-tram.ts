import type { RuntimeNode } from '@advjs/types'
import { stories } from './skins'

const { program } = stories.tram
const ordered = [program.entry.chapterId, ...Object.keys(program.chapters).filter(id => id !== program.entry.chapterId)]

/**
 * The script's anchors drawn as the tram line, across both chapters: the entry, then each
 * heading in order. 钟楼 is where the line forks, so the last two stations are branches.
 */
export const stations: { id: string, name?: string, branch?: boolean }[] = [
  { id: program.entry.nodeId },
  ...ordered.flatMap(chapter => Object.values(program.chapters[chapter].nodes))
    .filter((node: RuntimeNode) => node.kind === 'anchor')
    .map(node => ({ id: node.id, name: node.data!.text as string, branch: node.id === 'sea' || node.id === 'observatory' })),
]

/** The station each node is played at (`chapter#node` → anchor): the last anchor before it in its chapter. */
export const stationOf: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const chapter of ordered) {
    const { nodes, entry } = program.chapters[chapter]
    let at = entry
    for (const node of Object.values(nodes)) {
      if (node.kind === 'anchor')
        at = node.id
      map[`${chapter}#${node.id}`] = at
    }
  }
  return map
})()
