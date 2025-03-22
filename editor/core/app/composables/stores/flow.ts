import type { FlowExportObject } from '@vue-flow/core'
// import type { FlowExportObject, VueFlowStore } from '@vue-flow/core'
import type { AdvFlowItem } from '../../types'
import { MarkerType, useVueFlow } from '@vue-flow/core'
import { useStorage } from '@vueuse/core'
import { consola } from 'consola'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { defaultElements, yourNameData } from '../../constants'
import { useFlowLayout } from '../flow'

export const GLOBAL_FLOW_ID = Symbol('advjs-global-flow')

export const useFlowStore = defineStore('flow', () => {
  // const flowInstance = shallowRef<VueFlowStore>()
  const vueFlow = useVueFlow()

  const { layout } = useFlowLayout()

  /**
   * Current flow item
   */
  const curItem = useStorage<AdvFlowItem>('advjs:flow:curItem', {
    name: '',
    data: defaultElements,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  /**
   * `useVueFlow` provides:
   * 1. a set of methods to interact with the VueFlow instance (like `fitView`, `setViewport`, `addEdges`, etc)
   * 2. a set of event-hooks to listen to VueFlow events (like `onInit`, `onNodeDragStop`, `onConnect`, etc)
   * 3. the internal state of the VueFlow instance (like `nodes`, `edges`, `viewport`, etc)
   */
  const { onInit, onNodeDragStop, onConnect, addEdges, setViewport, toObject } = useVueFlow()

  /**
   * toObject transforms your current graph data to an easily persist-able object
   */
  function logToObject() {
    consola.info('Flow Object', toObject())
  }

  /**
   * Resets the current viewport transformation (zoom & pan)
   */
  function resetTransform() {
    setViewport({ x: 0, y: 0, zoom: 1 })
  }

  /**
   * This is a Vue Flow event-hook which can be listened to from anywhere you call the composable, instead of only on the main component
   * Any event that is available as `@event-name` on the VueFlow component is also available as `onEventName` on the composable and vice versa
   *
   * onInit is called when the VueFlow viewport is initialized
   */
  onInit((vueFlowInstance) => {
  // instance is the same as the return of `useVueFlow`
    vueFlowInstance.fitView()
  })

  /**
   * onNodeDragStop is called when a node is done being dragged
   *
   * Node drag events provide you with:
   * 1. the event object
   * 2. the nodes array (if multiple nodes are dragged)
   * 3. the node that initiated the drag
   * 4. any intersections with other nodes
   */
  onNodeDragStop(({ event, nodes, node }) => {
    consola.info('Node Drag Stop', { event, nodes, node })
  })

  /**
   * onConnect is called when a new connection is created.
   *
   * You can add additional properties to your new edge (like a type or label) or block the creation altogether by not calling `addEdges`
   */
  onConnect((connection) => {
    addEdges(connection)
  })

  /**
   * refresh data
   * for debug
   */
  async function refreshData() {
    function postFlowData(data: FlowExportObject) {
      const { nodes, edges } = data

      nodes.forEach((node) => {
        // node.type = 'default'
        if (node.id === 'node_01') {
          node.type = 'input'
        }
        else {
          node.type = 'default'
        }
      })
      edges.forEach((edge) => {
        edge.markerEnd = MarkerType.ArrowClosed
      })
    }
    postFlowData(yourNameData as unknown as FlowExportObject)

    // @ts-expect-error ignore
    curItem.value.data.nodes = yourNameData.nodes
    curItem.value.data.edges = yourNameData.edges

    layoutGraph('LR')
  }

  /**
   * darge 布局
   *
   * @see https://vueflow.dev/examples/layout/simple.html
   * @param direction
   */
  async function layoutGraph(direction: 'LR' | 'TB') {
    curItem.value.data.nodes = layout(
      // nodes.value,
      curItem.value.data.nodes,
      curItem.value.data.edges,
      direction,
    )

    await nextTick()
    setTimeout(() => {
      vueFlow.fitView()
    }, 1)
  }

  return {
    // flowInstance,
    curItem,

    vueFlow,

    resetTransform,
    logToObject,

    refreshData,
    layoutGraph,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFlowStore, import.meta.hot))
