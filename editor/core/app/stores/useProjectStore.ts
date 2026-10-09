import type { ProjectSourcePatch } from '@advjs/core'
import type { FSDirItem, TreeNode } from '@advjs/gui'
import type { AdvAgentIntegrationStatus, AdvConfig } from '@advjs/types'
import type { BrowserProjectDirectory, EditorProjectModel } from '../adapters/browser/project'
import type { LocalBridgeAdapter, LocalDirectoryHandle, LocalEditorSession, LocalFileHandle } from '../adapters/local'
import type { AdvConfigAdapterType } from '../types'
import type { RecentProject } from '../workspaces/browser-session'
import type { ProjectFileChange, ProjectWorkspace, ProjectWorkspaceSnapshot, ProjectWorkspaceSubscription } from '../workspaces/project'
import { defaultAdvConfig } from 'advjs'
import { consola } from 'consola'
import { createBrowserProjectWorkspace } from '../adapters/browser/workspace'
import { createLocalBridgeAdapter } from '../adapters/local'
import { localEditorHistoryState, readLocalEditorSession } from '../adapters/local/session'
import { createLocalProjectWorkspace } from '../adapters/local/workspace'
import { PLATFORM_MAP } from '../constants'
import { projectAssetPath } from '../utils/project-files'
import { createBrowserSessionStorage } from '../workspaces/browser-session'
import { createBrowserProjectRecovery } from '../workspaces/recovery'

/**
 * global project store
 */
export const useProjectStore = defineStore('@advjs/editor:project', () => {
  const consoleStore = useConsoleStore()
  const fileStore = useFileStore()
  const gameStore = useGameStore()

  // global project store with dir handle
  // Browser handles are kept raw in memory and structured-cloned to IndexedDB.
  const rootDir = shallowRef<FSDirItem>()
  // Keep the attempted native path available when reading the project fails.
  const projectLocation = shallowRef('')
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
  const workspace = shallowRef<ProjectWorkspace>()
  const workspaceMode = computed(() => workspace.value?.kind ?? 'browser')
  let localAdapter: LocalBridgeAdapter | undefined
  let localSession: LocalEditorSession | undefined
  const localFilePaths = computed(() => (project.value?.filePaths ?? Object.keys(project.value?.files ?? {})).toSorted())
  let workspaceSubscription: ProjectWorkspaceSubscription | undefined
  let localRefreshTimer: ReturnType<typeof setTimeout> | undefined
  const pendingLocalChanges = new Set<string>()
  const resourceRevision = ref(0)
  const diagnostics = computed(() => project.value?.compilation.diagnostics ?? [])
  const chapters = computed(() => project.value?.compilation.project.chapters ?? [])
  const characters = computed(() => project.value?.compilation.project.characters ?? [])
  const scenes = computed(() => project.value?.compilation.project.scenes ?? [])
  const localConnecting = shallowRef(false)
  const localRecoveryFailed = shallowRef(false)
  const localRecoveryError = shallowRef<unknown>()
  const desktopRecentProjects = shallowRef<RecentProject[]>([])
  const recentProjectError = shallowRef('')
  const recovery = createBrowserProjectRecovery({
    storage: createBrowserSessionStorage(),
    open: activateBrowserWorkspace,
    pick: () => window.showDirectoryPicker({ mode: 'readwrite' }),
    warn: error => consoleStore.warn('Workspace recovery failed', { error }),
  })
  const recoveryStatus = computed(() => localConnecting.value
    ? 'restoring'
    : localRecoveryFailed.value ? 'local-unavailable' : recovery.status.value)
  const isRestoringProject = computed(() => recoveryStatus.value === 'restoring')
  const recentProjects = computed(() => window.advDesktop ? desktopRecentProjects.value : recovery.recentProjects.value)

  async function loadDesktopRecentProjects() {
    const projects = await window.advDesktop!.recentProjects()
    desktopRecentProjects.value = projects.map(project => ({ ...project, templateId: '', lastOpenedAt: project.lastOpenedAt ?? 0 }))
  }

  async function reopenRecentProject(id: string) {
    recentProjectError.value = ''
    if (!window.advDesktop)
      return recovery.reopen(id)
    if (isRestoringProject.value)
      return false
    localConnecting.value = true
    try {
      return await window.advDesktop.openRecent(id)
    }
    catch (error) {
      recentProjectError.value = String(error)
      consoleStore.error('Could not reopen project', { projectId: id, error })
      return false
    }
    finally {
      localConnecting.value = false
    }
  }

  async function removeRecentProject(id: string) {
    recentProjectError.value = ''
    if (!window.advDesktop)
      return recovery.remove(id)
    if (isRestoringProject.value)
      return
    localConnecting.value = true
    try {
      await window.advDesktop.removeRecent(id)
      await loadDesktopRecentProjects()
    }
    catch (error) {
      recentProjectError.value = String(error)
      consoleStore.error('Could not remove recent project', { projectId: id, error })
    }
    finally {
      localConnecting.value = false
    }
  }

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

  async function activateProject(snapshot: ProjectWorkspaceSnapshot) {
    const nextProject = snapshot.project
    rootDir.value = {
      name: snapshot.name,
      kind: 'directory',
      handle: snapshot.root as unknown as FileSystemDirectoryHandle,
    } as FSDirItem
    project.value = nextProject

    if (nextProject.files['adv.config.json'])
      await loadAdvConfigJSON(nextProject.files['adv.config.json'])
    else
      await loadAdvConfig({})

    const errors = nextProject.compilation.diagnostics.filter(item => item.severity === 'error')
    if (!window.advDesktop && nextProject.mode === 'standard-markdown' && errors.length === 0) {
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

  async function activateWorkspace(nextWorkspace: ProjectWorkspace) {
    const initial = await nextWorkspace.snapshot()
    workspaceSubscription?.stop()
    workspace.value?.dispose?.()
    workspaceSubscription = undefined
    workspace.value = nextWorkspace
    const nextProject = await activateProject(initial)
    workspaceSubscription = nextWorkspace.subscribe?.(change => scheduleLocalRefresh(change.path))
    void workspaceSubscription?.done.catch((error) => {
      consoleStore.error('Project workspace watcher stopped', { error: String(error) })
    })
    return nextProject
  }

  async function activateBrowserWorkspace(dirHandle: FileSystemDirectoryHandle) {
    const nextProject = await activateWorkspace(createBrowserProjectWorkspace(
      dirHandle as unknown as BrowserProjectDirectory,
    ))
    localAdapter = undefined
    localSession = undefined
    projectLocation.value = ''
    localRecoveryFailed.value = false
    window.history.replaceState(localEditorHistoryState(window.history.state), '')
    return nextProject
  }

  async function openBrowserProject(dirHandle: FileSystemDirectoryHandle, options: { templateId?: string } = {}) {
    const nextProject = await activateBrowserWorkspace(dirHandle)
    await recovery.remember(dirHandle, options.templateId)
    return nextProject
  }

  async function getLocalFileHandle(path: string): Promise<LocalFileHandle> {
    const segments = path.split('/').filter(Boolean)
    const fileName = segments.pop()
    const root = rootDir.value?.handle as unknown as LocalDirectoryHandle | undefined
    if (!fileName || !root)
      throw new Error(`Local project file is unavailable: ${path}`)
    let directory = root
    for (const segment of segments)
      directory = await directory.getDirectoryHandle(segment)
    return await directory.getFileHandle(fileName)
  }

  function scheduleLocalRefresh(path: string) {
    if (path)
      pendingLocalChanges.add(path)
    if (localRefreshTimer)
      clearTimeout(localRefreshTimer)
    const scheduledWorkspace = workspace.value
    localRefreshTimer = setTimeout(async () => {
      if (workspace.value !== scheduledWorkspace)
        return
      try {
        const changedPaths = [...pendingLocalChanges].sort()
        pendingLocalChanges.clear()
        // macOS may coalesce media changes into a containing-directory event.
        if (!changedPaths.length || changedPaths.some(path => !/\.(?:md|json)$/iu.test(path)))
          resourceRevision.value++
        const nextProject = await refreshProject()
        if (!nextProject)
          return
        for (const changedPath of changedPaths) {
          const content = nextProject.files[changedPath]
          await fileStore.handleExternalChange(changedPath, content ?? null).catch(() => {})
        }
      }
      catch (error) {
        consoleStore.error('External project refresh failed', { error: String(error) })
      }
    }, 150)
  }

  async function connectLocalBridgeFromLaunch(url = window.location.href) {
    const session = window.advDesktop ? await window.advDesktop.session() : readLocalEditorSession(url, window.history.state)
    if (!session)
      return false
    if (window.advDesktop && !('root' in session && session.root))
      return false
    projectLocation.value = 'root' in session && typeof session.root === 'string' ? session.root : ''
    // Preserve router/Nuxt state while scrubbing the credential from the URL.
    // History state survives reload and stays out of local/sessionStorage.
    if (!window.advDesktop) {
      window.history.replaceState(
        localEditorHistoryState(window.history.state, session),
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }
    const adapter = createLocalBridgeAdapter(session)
    await activateWorkspace(createLocalProjectWorkspace(adapter))
    localAdapter = adapter
    localSession = session
    localRecoveryFailed.value = false
    return true
  }

  async function restoreProjectWorkspace() {
    localConnecting.value = true
    try {
      if (window.advDesktop) {
        await loadDesktopRecentProjects().catch((error) => {
          consoleStore.warn('Could not load recent projects', { error: String(error) })
        })
      }
      else {
        await recovery.load()
      }
      if (window.advDesktop || readLocalEditorSession(window.location.href, window.history.state)) {
        try {
          await connectLocalBridgeFromLaunch()
          consoleStore.success('Local workspace connected')
        }
        catch (error) {
          localRecoveryFailed.value = true
          localRecoveryError.value = error
          consoleStore.error('Local workspace connection failed', { error })
        }
        // A stopped/expired bridge must not silently open a browser project.
        return
      }
      await recovery.restore()
    }
    finally {
      localConnecting.value = false
    }
  }

  function retryProjectRecovery() {
    if (localRecoveryFailed.value)
      return restoreProjectWorkspace()
    const id = recovery.pending.value?.id
    return id ? recovery.reopen(id) : Promise.resolve(false)
  }

  function retainLocalBridgeSession() {
    if (localSession && !window.advDesktop)
      window.history.replaceState(localEditorHistoryState(window.history.state, localSession), '')
  }

  function disconnectLocalBridge() {
    workspaceSubscription?.stop()
    workspaceSubscription = undefined
    workspace.value?.dispose?.()
    localAdapter = undefined
    localSession = undefined
    projectLocation.value = ''
    if (localRefreshTimer)
      clearTimeout(localRefreshTimer)
    localRefreshTimer = undefined
    pendingLocalChanges.clear()
  }

  async function refreshProject() {
    const source = workspace.value
    if (!source)
      return
    const snapshot = await source.snapshot()
    if (workspace.value !== source)
      return
    return await activateProject(snapshot)
  }

  async function commitProject(patches: readonly ProjectSourcePatch[]) {
    if (!workspace.value)
      throw new Error('No project workspace is open')
    const source = workspace.value
    const snapshot = await source.commit(patches)
    if (workspace.value !== source)
      return
    return await activateProject(snapshot)
  }

  async function writeProjectFiles(changes: ProjectFileChange[]) {
    const source = workspace.value
    if (!source?.writeFiles)
      throw new Error('Workspace does not support file changes')
    const snapshot = await source.writeFiles(changes)
    if (workspace.value === source)
      return await activateProject(snapshot)
  }

  async function projectAssetUrl(path: string) {
    if (/^(?:https?:|blob:|data:)/u.test(path))
      return path
    if (!workspace.value?.assetUrl)
      throw new Error('Open a project to read assets')
    return await workspace.value.assetUrl(projectAssetPath(path, localFilePaths.value))
  }

  async function loadLocalAgentStatus(): Promise<AdvAgentIntegrationStatus> {
    if (!localAdapter)
      throw new Error('Local Agent integration requires a live local workspace')
    return await localAdapter.loadCodexStatus()
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
    projectLocation,

    advConfig,
    curAdvConfigTab,
    project,
    workspace,
    workspaceMode,
    resourceRevision,
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
    restoreProjectWorkspace,
    retryProjectRecovery,
    retainLocalBridgeSession,
    recoveryStatus,
    recoveryError: computed(() => localRecoveryFailed.value ? localRecoveryError.value : recovery.error.value),
    isRestoringProject,
    pendingProject: computed(() => recovery.pending.value?.name),
    recentProjects,
    loadDesktopRecentProjects,
    recentProjectError,
    reopenRecentProject,
    removeRecentProject,
    refreshProject,
    commitProject,
    writeProjectFiles,
    projectAssetUrl,
    connectLocalBridgeFromLaunch,
    disconnectLocalBridge,
    getLocalFileHandle,
    loadLocalAgentStatus,

    online,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot))
