import { Toast } from '@advjs/gui'
import { onScopeDispose, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import { editorPluginCatalog } from '../extensions/catalog'
import { createEditorLayoutState, editorLayoutStateKey, PLUGIN_STATE_KEY, readStorage, saveStorage } from '../extensions/layout-state'
import { createEditorExtensionHost, editorExtensionHostKey } from '../extensions/registry'
import { createEditorHostServices } from '../extensions/services'

export function useEditorExtensions() {
  const project = useProjectStore()
  const { locale } = useI18n()
  let storage: Storage | undefined
  try {
    storage = window.localStorage
  }
  catch { /* Storage is optional. */ }
  const adapter = createEditorHostServices({
    project: () => project.project,
    workspace: () => project.workspace,
    name: () => project.rootDir?.name ?? '',
    refresh: () => project.refreshProject(),
    locale,
    writeClipboard: text => navigator.clipboard.writeText(text),
    notify: description => Toast({ title: locale.value === 'zh-CN' ? '编辑器' : 'Editor', description, duration: 2500 }),
  })
  const saved = readStorage(storage, PLUGIN_STATE_KEY)
  const disabled = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  const host = createEditorExtensionHost(editorPluginCatalog, adapter.services, {
    disabled,
    persistDisabled: ids => saveStorage(storage, PLUGIN_STATE_KEY, ids),
  })
  const layout = createEditorLayoutState(storage)
  provide(editorExtensionHostKey, host)
  provide(editorLayoutStateKey, layout)
  const dispose = () => {
    void host.dispose()
    layout.dispose()
    adapter.dispose()
  }
  onScopeDispose(dispose)
  if (import.meta.hot)
    import.meta.hot.dispose(dispose)
  return {
    async start() {
      await host.start()
      const failed = host.entries.find(entry => entry.required && entry.status === 'error')
      if (failed)
        throw new Error(`${failed.plugin.id}: ${failed.error}`)
    },
  }
}
