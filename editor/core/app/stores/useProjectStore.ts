import type { FSDirItem, TreeNode } from '@advjs/gui'
import type { AdvConfig } from '@advjs/types'
import type { BrowserProjectDirectory, EditorProjectModel } from '../adapters/browser/project'
import type { LocalBridgeAdapter, LocalBridgeWatch, LocalDirectoryHandle, LocalFileHandle } from '../adapters/local'
import type { AdvConfigAdapterType } from '../types'
import { defaultAdvConfig } from 'advjs'
import { consola } from 'consola'
import { compileEditorProject, createEditorProjectModel, readBrowserProjectFiles } from '../adapters/browser/project'
import { createLocalBridgeAdapter, parseLocalEditorSession } from '../adapters/local'
import { PLATFORM_MAP } from '../constants'

/**
 * global project store
 */
export const useProjectStore = defineStore('@advjs/editor:project', () => {
  const consoleStore = useConsoleStore()
  const fileStore = useFileStore()
  const gameStore = useGameStore()

  // global project store with dir handle
  /**
   * dir handle 无法持久化
   */
  const rootDir = shallowRef<FSDirItem>()
  /**
   * entry file
   */
  const entryFileHandle = shallowRef<FileSystemFileHandle>()
  /**
   * adv.config.json file handle
   */
  const advConfigFileHandle = shallowRef<FileSystemFileHandle>()
  /**
   * adv.config
   */
  const advConfig = ref<AdvConfig>(defaultAdvConfig)
  const project = shallowRef<EditorProjectModel>()
  const workspaceMode = ref<'browser' | 'local'>('browser')
  const localAdapter = shallowRef<LocalBridgeAdapter>()
  const localRootHandle = shallowRef<LocalDirectoryHandle>()
  const localFilePaths = computed(() => Object.keys(project.value?.files ?? {}).sort())
  let localWatch: LocalBridgeWatch | undefined
  let localRefreshTimer: ReturnType<typeof setTimeout> | undefined
  const pendingLocalChanges = new Set<string>()
  const diagnostics = computed(() => project.value?.compilation.diagnostics ?? [])
  const chapters = computed(() => project.value?.compilation.project.chapters ?? [])
  const characters = computed(() => project.value?.compilation.project.characters ?? [])
  const scenes = computed(() => project.value?.compilation.project.scenes ?? [])

  /**
   * current config tab
   */
  const curAdvConfigTab = ref<TreeNode>({ name: 'common' })

  /**
   * set entry file
   * `index.adv.json`
   */
  async function setEntryFileHandle(fileHandle: FileSystemFileHandle) {
    entryFileHandle.value = fileHandle

    // load file content
    await fileStore.openAdvConfigFileHandle(fileHandle)
  }

  /**
   * set `adv.config.json` file handle
   * @param fileHandle
   */
  async function setAdvConfigFileHandle(fileHandle: FileSystemFileHandle) {
    advConfigFileHandle.value = fileHandle

    // load file content
    const advConfigJson = await fileHandle.getFile()
      .then(file => file.text())

    loadAdvConfigJSON(advConfigJson)
  }

  /**
   * load index.adv.json txt
   */
  async function loadIndexAdvJSON(text: string) {
    fileStore.rawConfigFileContent = text
    await gameStore.loadGameFromJSONStr(text)

    consoleStore.success('File loaded', {
      fileName: 'index.adv.json',
    })
  }

  async function loadAdvConfig(data: Partial<AdvConfig>) {
    advConfig.value = {
      ...defaultAdvConfig,
      ...data,
    }
    consoleStore.success('Adv config loaded', {
      fileName: 'adv.config.json',
    })
  }

  /**
   * load adv.config.json
   */
  async function loadAdvConfigJSON(text: string) {
    await loadAdvConfig(JSON.parse(text) as AdvConfig)
  }

  async function activateProject(nextProject: EditorProjectModel, nextRootDir: FSDirItem) {
    if (workspaceMode.value === 'browser')
      rootDir.value = nextRootDir
    project.value = nextProject

    if (nextProject.files['adv.config.json'])
      await loadAdvConfigJSON(nextProject.files['adv.config.json'])

    const errors = nextProject.compilation.diagnostics.filter(item => item.severity === 'error')
    if (nextProject.mode === 'standard-markdown' && errors.length === 0) {
      void gameStore.loadGameFromConfig(nextProject.previewConfig).catch((error) => {
        consoleStore.error('Preview failed to load', { error: String(error) })
      })
    }

    if (nextProject.migrationNotice) {
      consoleStore.warn(nextProject.migrationNotice, { fileName: 'index.adv.json' })
    }
    else if (errors.length > 0) {
      consoleStore.error('Project compilation failed', { diagnostics: errors })
    }
    else {
      consoleStore.success('Markdown project loaded', {
        chapters: nextProject.compilation.project.chapters.length,
        characters: nextProject.compilation.project.characters.length,
        scenes: nextProject.compilation.project.scenes.length,
      })
    }

    return nextProject
  }

  async function openBrowserProject(dirHandle: FileSystemDirectoryHandle) {
    const files = await readBrowserProjectFiles(dirHandle as unknown as BrowserProjectDirectory)
    const nextProject = await compileEditorProject({ files, id: dirHandle.name })
    workspaceMode.value = 'browser'
    return await activateProject(nextProject, {
      name: dirHandle.name,
      kind: 'directory',
      handle: dirHandle,
    } as FSDirItem)
  }

  async function refreshBrowserProject() {
    const handle = rootDir.value?.handle as FileSystemDirectoryHandle | undefined
    return handle ? await openBrowserProject(handle) : undefined
  }

  async function refreshLocalProject() {
    const adapter = localAdapter.value
    if (!adapter)
      return
    const loaded = await adapter.loadProject()
    const name = loaded.root.split(/[\\/]/u).filter(Boolean).at(-1) ?? 'project'
    const nextProject = createEditorProjectModel(loaded.result, loaded.files)
    nextProject.previewConfig = await adapter.resolvePreviewConfig(
      nextProject.compilation,
      nextProject.previewConfig,
    )
    const handle = adapter.createDirectoryHandle(loaded.files, name)
    localRootHandle.value = handle
    workspaceMode.value = 'local'
    return await activateProject(nextProject, {
      name,
      kind: 'directory',
      handle: handle as unknown as FileSystemDirectoryHandle,
    })
  }

  async function getLocalFileHandle(path: string): Promise<LocalFileHandle> {
    const segments = path.split('/').filter(Boolean)
    const fileName = segments.pop()
    if (!fileName || !localRootHandle.value)
      throw new Error(`Local project file is unavailable: ${path}`)
    let directory = localRootHandle.value
    for (const segment of segments)
      directory = await directory.getDirectoryHandle(segment)
    return await directory.getFileHandle(fileName)
  }

  function scheduleLocalRefresh(path: string) {
    if (path)
      pendingLocalChanges.add(path)
    if (localRefreshTimer)
      clearTimeout(localRefreshTimer)
    localRefreshTimer = setTimeout(async () => {
      const adapter = localAdapter.value
      const changedPaths = [...pendingLocalChanges].sort()
      pendingLocalChanges.clear()
      if (!adapter)
        return
      for (const changedPath of changedPaths)
        await fileStore.handleExternalChange(adapter, changedPath).catch(() => {})
      await refreshLocalProject()
    }, 150)
  }

  async function connectLocalBridgeFromLaunch(url = window.location.href) {
    const session = parseLocalEditorSession(url)
    if (!session)
      return false
    localWatch?.stop()
    localAdapter.value = createLocalBridgeAdapter(session)
    await refreshLocalProject()
    localWatch = localAdapter.value.watch(change => scheduleLocalRefresh(change.path))
    void localWatch.done.catch((error) => {
      consoleStore.error('Local workspace watcher stopped', { error: String(error) })
    })
    return true
  }

  function disconnectLocalBridge() {
    localWatch?.stop()
    localWatch = undefined
    localAdapter.value = undefined
    localRootHandle.value = undefined
    if (localRefreshTimer)
      clearTimeout(localRefreshTimer)
    localRefreshTimer = undefined
    pendingLocalChanges.clear()
  }

  async function refreshProject() {
    return workspaceMode.value === 'local'
      ? await refreshLocalProject()
      : await refreshBrowserProject()
  }

  /**
   * for online project
   * @zh 在线项目相关操作
   */
  const online = {
    hostUrl: '',

    /**
     * load online adv.config.json
     */
    loadAdvConfigJSON: async (url: string) => {
      try {
        const data = await fetch(url).then(res => res.json())
        await loadAdvConfig(data)
      }
      catch (error) {
        consola.error('Failed to load online adv.config.json', error)
        // load default advConfig
        await loadAdvConfig({
          cdn: {
            enable: true,
            prefix: online.hostUrl,
          },
        })
      }
    },

    /**
     * load online index.adv.json
     */
    loadIndexAdvJSON: async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) {
        consoleStore.error('Failed to load online index', {
          url,
        })
        return
      }
      const text = await response.text()
      await loadIndexAdvJSON(text)
    },

    async openOnlineAdvProject(params: {
      adapter: AdvConfigAdapterType
      /**
       * 游戏 ID
       */
      gameId: string
      /**
       * project 所在平台
       *
       * - `https://cos.advjs.yunle.fun/games/${gameId}/index.adv.json`
       * - `https://cos.advjs.yunle.fun/games/${gameId}/adv.config.json`
       */
      host: {
      /**
       * @default 'yunlefun'
       * - `https://cos.advjs.yunle.fun/games/${gameId}/index.adv.json`
       * - `https://cos.advjs.yunle.fun/games/${gameId}/adv.config.json`
       */
        platform?: 'yunlefun'
        /**
         * custom url
         * @zh 自定义 URL
         * @example 'https://example.com/games/${gameId}/index.adv.json'
         */
        url?: string
      }
    }) {
      let hostUrl = params.host.url
      if (!hostUrl) {
        const platform = params.host.platform || 'yunlefun'
        if (PLATFORM_MAP[platform]) {
          hostUrl = `${PLATFORM_MAP[platform]}/games/${params.gameId}`
        }
        else {
          consoleStore.error('Invalid host platform', {
            platform: params.host.platform,
          })
          throw new Error(`Invalid host platform: ${params.host.platform}`)
        }
      }

      online.hostUrl = hostUrl
      // load index.adv.json
      await this.loadAdvConfigJSON(`${hostUrl}/adv.config.json`)
      await this.loadIndexAdvJSON(`${hostUrl}/index.adv.json`)
    },
  }

  // /**
  //  * 打开在线项目
  //  */
  // async function

  return {
    rootDir,

    advConfig,
    curAdvConfigTab,
    project,
    workspaceMode,
    localAdapter,
    localFilePaths,
    diagnostics,
    chapters,
    characters,
    scenes,

    entryFileHandle,
    setEntryFileHandle,
    setAdvConfigFileHandle,

    loadIndexAdvJSON,
    loadAdvConfigJSON,
    openBrowserProject,
    refreshBrowserProject,
    refreshLocalProject,
    refreshProject,
    connectLocalBridgeFromLaunch,
    disconnectLocalBridge,
    getLocalFileHandle,

    online,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot))
