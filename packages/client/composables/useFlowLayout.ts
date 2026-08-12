import type { Edge, Node } from '@vue-flow/core'
import dagre from '@dagrejs/dagre'
import { Position, useVueFlow } from '@vue-flow/core'
import { ref } from 'vue'

/** Calculate a left-to-right or top-to-bottom layout for the active flow. */
export function useFlowLayout() {
  const { findNode } = useVueFlow()
  const graph = ref(new dagre.graphlib.Graph())
  const previousDirection = ref('LR')

  function layout(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB' = 'LR') {
    const dagreGraph = new dagre.graphlib.Graph()
    graph.value = dagreGraph
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const isHorizontal = direction === 'LR'
    dagreGraph.setGraph({ rankdir: direction })
    previousDirection.value = direction

    for (const node of nodes) {
      const graphNode = findNode(node.id)
      dagreGraph.setNode(node.id, {
        height: graphNode?.dimensions.height || 50,
        width: graphNode?.dimensions.width || 150,
      })
    }

    for (const edge of edges)
      dagreGraph.setEdge(edge.source, edge.target)

    dagre.layout(dagreGraph)

    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)
      return {
        ...node,
        position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
      }
    })
  }

  return { graph, layout, previousDirection }
}
