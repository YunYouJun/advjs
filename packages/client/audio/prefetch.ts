import type { RuntimeAddress, RuntimeNode } from '@advjs/types'

interface VoicePrefetchProgram {
  chapters: { readonly [id: string]: { readonly nodes: { readonly [id: string]: {
    readonly kind: string
    readonly when?: unknown
    readonly data?: { readonly lineId?: unknown }
    readonly next?: Readonly<RuntimeAddress>
  } } } }
}

/** Follow only certain linear edges; never guess across choices, conditions or activities. */
export function followingVoiceLineIds(program: VoicePrefetchProgram | undefined, cursor: Readonly<RuntimeAddress>, count = 3): string[] {
  const lines: string[] = []
  const visited = new Set<string>()
  let address: RuntimeAddress | undefined = { ...cursor }
  while (address && lines.length < count && visited.size < 1000) {
    const key = `${address.chapterId}\0${address.nodeId}`
    if (visited.has(key))
      break
    visited.add(key)
    const node: Pick<RuntimeNode, 'kind'> & { data?: { readonly lineId?: unknown }, next?: Readonly<RuntimeAddress>, when?: unknown } | undefined = program?.chapters[address.chapterId]?.nodes[address.nodeId]
    if (!node || node.when || ['choice', 'activity', 'branch', 'end'].includes(node.kind))
      break
    if (['dialog', 'narration'].includes(node.kind) && typeof node.data?.lineId === 'string')
      lines.push(node.data.lineId)
    address = node.next
  }
  return lines
}
