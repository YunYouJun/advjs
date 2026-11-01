import type { AuthoringGraphNode } from './types'

export function authoringEdgePath(from: AuthoringGraphNode, to: AuthoringGraphNode, index: number, width: number, height: number) {
  const sx = from.x + width
  const sy = from.y + height / 2
  const tx = to.x
  const ty = to.y + height / 2
  if (sx < tx)
    return `M ${sx} ${sy} C ${sx + 42} ${sy}, ${tx - 42} ${ty}, ${tx} ${ty}`
  const loop = Math.min(from.y, to.y) - 30 - index % 5 * 8
  return `M ${sx} ${sy} C ${sx + 80} ${sy}, ${sx + 80} ${loop}, ${sx} ${loop} L ${tx - 30} ${loop} Q ${tx - 50} ${loop} ${tx - 50} ${ty - 20} Q ${tx - 50} ${ty} ${tx} ${ty}`
}
