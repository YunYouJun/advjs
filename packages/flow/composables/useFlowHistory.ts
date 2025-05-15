import type { FlowExportObject, VueFlowStore } from '@vue-flow/core'
// import { useGlobalFlowEditor } from '@stardew/kit/client'
import { useManualRefHistory } from '@vueuse/core'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
// import { ipcRenderer, Menu } from '~/env'
import { useGlobalFlowEditor } from './useGlobalFlowEditor'

export const commitActions = [
  'add-node',
  'delete-node',
  'add-edge',
  'delete-edge',
  'move-node',
]

/**
 * undo/redo for flow history
 */
export function useFlowHistory(ctx: {
  initialData: FlowExportObject
  vueFlowStore: VueFlowStore
}) {
  const { initialData, vueFlowStore } = ctx
  const data = ref<FlowExportObject>(initialData)
  const {
    edges,
    setNodes,
    setEdges,

    onNodeDragStop,
    onNodesChange,

    // fitView,
    toObject,
  } = vueFlowStore

  const { undo, redo, commit, canRedo, canUndo } = useManualRefHistory(data as any, {
    capacity: 10,
    parse: JSON.parse,
    dump: JSON.stringify,
  })

  const { emitter } = useGlobalFlowEditor()

  onNodesChange((nodes) => {
    const isSelectionDelete = nodes.every(node => node.type === 'remove')
    // 多选删除
    if (isSelectionDelete && nodes.length) {
      // 过滤掉已经删除的节点的边
      const deletedNodeIds = nodes.filter(node => node.type === 'remove').map(node => node.id || '')
      const filteredEdges = edges.value.filter(edge =>
        !deletedNodeIds.includes(edge.source) && !deletedNodeIds.includes(edge.target),
      )
      setEdges(filteredEdges)

      commitData()
    }
  })

  function setFlowDataWithoutViewport(data: FlowExportObject) {
    setNodes(data.nodes)
    setEdges(data.edges)
    // setViewport(data.viewport)
  }

  async function undoFlow() {
    if (!canUndo.value)
      return

    undo()
    await nextTick()

    if (!data.value)
      return
    setFlowDataWithoutViewport(data.value)
    updateUndoRedoEnabled()
  }

  async function redoFlow() {
    if (!canRedo.value)
      return

    redo()
    await nextTick()

    if (!data.value)
      return
    setFlowDataWithoutViewport(data.value)
    updateUndoRedoEnabled()
  }

  // when change
  async function onChange() {
    await nextTick()
    commitData()
  }
  onNodeDragStop(onChange)
  // onNodesChange((nodes) => {
  // // 位置变动在 onNodeDragStop 中处理
  //   const changed = nodes.some(node => !['dimensions', 'position', 'select'].includes(node.type))
  //   if (changed)
  //     onChange()
  // })
  // onEdgesChange((edges) => {
  // // 选择变动不计入状态
  //   const changed = edges.some(edge => edge.type !== 'select')
  //   if (changed)
  //     onChange()
  // })

  // register menu
  // const menu = Menu.getApplicationMenu()
  // const undoItem = menu?.getMenuItemById('undo')
  // const redoItem = menu?.getMenuItemById('redo')

  /**
   * update undo/redo menu enabled
   */
  function updateUndoRedoEnabled() {
    // if (undoItem)
    //   undoItem.enabled = canUndo.value
    // if (redoItem)
    //   redoItem.enabled = canRedo.value
  }

  function commitData() {
    data.value = JSON.parse(JSON.stringify(toObject()))
    commit()
    updateUndoRedoEnabled()
  }

  // listen
  onMounted(() => {
    emitter.on('commit', commitData)

    // ipcRenderer.on('undo', undoFlow)
    // ipcRenderer.on('redo', redoFlow)
  })
  onUnmounted(() => {
    emitter.off('commit', commitData)

    // ipcRenderer.off('undo', undoFlow)
    // ipcRenderer.off('redo', redoFlow)
  })

  return {
    data,
    undoFlow,
    redoFlow,
    commitData,

    updateUndoRedoEnabled,
  }
}
