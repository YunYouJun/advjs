import { visit } from 'unist-util-visit'
import { generateMockTree } from './generate'

import { testPerformance } from './utils'
import { dfs } from './dfs'

export function testVisitAndDfs(type: 'breadth' | 'depth', count: number) {
  const tree = generateMockTree(type, count)
  const unistData = testPerformance(`unist-util-visit(${type})`, () => {
    let count = 0

    visit(tree, (_node) => {
      count++
    })
    return count
  })

  const dfsData = testPerformance('dfs(breadth)', () => {
    let count = 0

    dfs(tree, (_node: any) => {
      count++
    })
    return count
  })
  // eslint-disable-next-line no-console
  console.table([unistData, dfsData])
}

export function main() {
  testVisitAndDfs('breadth', 20000)
  testVisitAndDfs('breadth', 50000)
  testVisitAndDfs('breadth', 100000)
  testVisitAndDfs('depth', 2000)
  testVisitAndDfs('depth', 5000)
}

main()
