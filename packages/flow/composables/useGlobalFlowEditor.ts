/**
 * get global flow editor
 */
export function useGlobalFlowEditor() {
  // @ts-expect-error global
  const editor: FlowEditor = window.__GLOBAL_FLOW_EDITOR__ || inject(GLOBAL_FLOW_EDITOR_KEY)
  if (!editor)
    throw new Error('useGlobalFlowEditor() is called without provider.')
  return editor
}
