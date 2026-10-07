import { defineStore } from 'pinia'
import { computed, reactive, shallowRef, watch } from 'vue'
import { readStorage, saveStorage } from '../extensions/layout-state'
import { ASSET_BROWSER_STATE_KEY, assetFolders, assetParentFolder, availableAssetFolder, filterProjectAssets, isProjectAsset, restoreAssetBrowserPreferences } from '../utils/asset-browser'

export const useAssetBrowserStore = defineStore('asset-browser', () => {
  const project = useProjectStore()
  let storage: Storage | undefined
  try {
    storage = typeof window === 'undefined' ? undefined : window.localStorage
  }
  catch { /* Browsing also works when storage is unavailable. */ }
  const preferences = reactive(restoreAssetBrowserPreferences(readStorage(storage, ASSET_BROWSER_STATE_KEY)))
  const query = shallowRef('')
  const type = shallowRef('all')
  const selectedPath = shallowRef('')
  const projectRevealPath = shallowRef('')
  const projectRevealVersion = shallowRef(0)
  const assetRevealVersion = shallowRef(0)
  const paths = computed(() => project.localFilePaths.filter(isProjectAsset))
  const folders = computed(() => assetFolders(paths.value))
  const filtered = computed(() => filterProjectAssets(paths.value, { ...preferences, type: type.value, query: query.value }))

  watch(preferences, value => saveStorage(storage, ASSET_BROWSER_STATE_KEY, value), { deep: true })
  watch(() => project.workspace, () => {
    selectedPath.value = ''
    projectRevealPath.value = ''
    query.value = ''
    type.value = 'all'
  }, { flush: 'sync' })
  watch(paths, (available) => {
    if (!project.project)
      return
    preferences.folder = availableAssetFolder(preferences.folder, folders.value)
    if (!available.includes(selectedPath.value))
      selectedPath.value = ''
  }, { immediate: true })

  function browse(folder: string) {
    preferences.folder = availableAssetFolder(folder, folders.value)
    preferences.scope = 'folder'
  }
  function revealAsset(path: string) {
    if (!paths.value.includes(path))
      return
    browse(assetParentFolder(path))
    query.value = ''
    type.value = 'all'
    selectedPath.value = path
    assetRevealVersion.value++
  }
  function revealInProject(path: string) {
    projectRevealPath.value = path
    projectRevealVersion.value++
  }

  return { preferences, query, type, selectedPath, paths, filtered, browse, revealAsset, revealInProject, projectRevealPath, projectRevealVersion, assetRevealVersion }
})
