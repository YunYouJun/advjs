import { useEditorLayoutState } from '../extensions/layout-state'
import { useAssetBrowserStore } from '../stores/useAssetBrowserStore'

export function useProjectAssetActions() {
  const assets = useAssetBrowserStore()
  const app = useAppStore()
  const layout = useEditorLayoutState()
  function select(path: string) {
    assets.selectedPath = path
    app.activeInspector = 'asset'
    layout.select('inspector', 'advjs.core/inspector')
  }
  function showInProject(path: string) {
    assets.revealInProject(path)
    layout.select('navigation', 'advjs.core/project')
  }
  function showInAssets(path: string) {
    assets.revealAsset(path)
    layout.select('bottom', 'advjs.core/assets')
    select(path)
  }
  return { select, showInProject, showInAssets }
}
