import { u } from 'unist-builder'

export function generateSimpleTree() {
  const tree = u('tree', [
    u('leaf', '1'),
    u('node', [u('leaf', '2')]),
    u('void'),
    u('leaf', '3'),
  ])
  return tree
}

/**
 * 生成广度大的语法树
 */
export function generateMockBreadthTree(count = 10000) {
  const leafs = Array(count).fill(0).map((_, i) => u('leaf', i.toString()))
  const tree = u('tree', leafs)
  return tree
}

/**
 * 生成深度大的语法树
 * 大于 两千多 时，深度会超过堆栈限制
 * Maximum call stack size exceeded
 */
export function generateMockDepthTree(count = 2127) {
  let node: any = u('leaf', '0')
  for (let i = 0; i < count; i++)
    node = u('leaf', [node])

  const tree = u('tree', node)
  return tree
}

export function generateMockTree(type: 'breadth' | 'depth', count: number) {
  switch (type) {
    case 'breadth':
      return generateMockBreadthTree(count)
    case 'depth':
      return generateMockDepthTree(count)
    default:
      break
  }
}
