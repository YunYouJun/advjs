import type { EditorCapabilities } from '../../capabilities'

export function useEditorCapabilities() {
  return useRuntimeConfig().public.editorCapabilities as EditorCapabilities
}
