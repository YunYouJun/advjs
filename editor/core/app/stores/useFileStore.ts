import type { LocalFileHandle } from '../adapters/local'
import type { AdvConfigAdapterType } from '../types'
import type { MonacoEditorLanguage } from './useMonacoStore'
import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { projectFileKind } from '../utils/project-files'

export const useFileStore = defineStore('file', () => {
  const gameStore = useGameStore()
  const consoleStore = useConsoleStore()

  /**
   * 被打开的文件
   *
   * 一次只有一个
   */
  const openedFileHandle = shallowRef<FileSystemFileHandle>()
  const openedFilePath = ref('')
  const savedFileContent = ref<string | null>('')
  const externalConflict = ref<{ content: string | null, path: string }>()
  const fileKind = ref<ReturnType<typeof projectFileKind>>('text')
  const previewUrl = ref('')
  const openVersion = ref(0)
  const loading = ref(false)
  let openSequence = 0

  /**
   * rawConfigFile
   *
   * adapted config File
   */
  const showRawConfigFile = useStorage('adv:editor:show-raw-config-file', false)

  /**
   * 被打开的文件内容
   */
  const rawConfigFileContent = ref<string>('')

  /**
   * override filename
   */
  const fileName = ref<string>('')
  const monacoStore = useMonacoStore()
  const isDirty = computed(() => fileKind.value === 'text' && Boolean(openedFileHandle.value) && monacoStore.fileContent !== savedFileContent.value)

  watch(() => showRawConfigFile.value, (val) => {
    if (fileName.value.endsWith('.adv.json'))
      monacoStore.fileContent = val ? rawConfigFileContent.value : JSON.stringify(gameStore.gameConfig, null, 2)
  })

  const app = useAppStore()

  /**
   * open adv config file
   */
  async function openAdvConfigFile() {
    // 选择文件
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'ADV Config File',
          accept: {
            'application/json': ['.adv.json'],
          },
        },
      ],
      excludeAcceptAllOption: true,
    })

    await openAdvConfigFileHandle(fileHandle)
  }

  /**
   * open adv config file handle
   */
  async function openAdvConfigFileHandle(fileHandle: FileSystemFileHandle) {
    await setOpenedFileHandle(fileHandle)

    // 获取文件内容
    const file = await fileHandle.getFile()
    const text = await file.text()
    rawConfigFileContent.value = text

    gameStore.loadGameFromJSONStr(text)

    consoleStore.success('File loaded', {
      fileName: file.name,
    })
  }

  /**
   * 在线 adv config 输入会话框
   */
  const onlineAdvConfigFileDialogOpen = ref(false)
  /**
   * open online adv config file
   */
  async function openOnlineAdvConfigFile(options: {
    /**
     * online url
     */
    url: string
    adapter: AdvConfigAdapterType
  }) {
    const { url, adapter } = options
    // fetch json from online link
    const json = await fetch(url).then(res => res.json())

    rawConfigFileContent.value = JSON.stringify(json, null, 2)
    gameStore.curAdapter = adapter
    gameStore.loadGameFromConfig(json)
    openVirtualFile(url, rawConfigFileContent.value)
    consoleStore.success('File loaded', {
      fileName: url,
    })

    onlineAdvConfigFileDialogOpen.value = false
  }

  /**
   * set opened file handle
   */
  async function setOpenedFileHandle(fileHandle: FileSystemFileHandle, projectPath?: string) {
    const path = projectPath || ('path' in fileHandle
      ? (fileHandle as unknown as LocalFileHandle).path
      : fileHandle.name)
    if (openedFileHandle.value && openedFilePath.value === path) {
      openSequence++
      loading.value = false
      app.activeInspector = 'file'
      openVersion.value++
      return
    }
    assertCanSwitchFile()
    const request = ++openSequence
    const source = useProjectStore().workspace
    const kind = projectFileKind(path)
    loading.value = true
    try {
      const media = ['image', 'audio', 'video'].includes(kind)
      const blob = media
        ? source?.readAsset ? await source.readAsset(path) : await fileHandle.getFile()
        : undefined
      const content = kind === 'text' ? await fileHandle.getFile().then(file => file.text()) : ''
      if (request !== openSequence || source !== useProjectStore().workspace)
        return
      // The current document can become dirty while the next file is loading.
      assertCanSwitchFile()
      releasePreview()
      previewUrl.value = blob ? URL.createObjectURL(blob) : ''
      openedFileHandle.value = fileHandle
      fileName.value = fileHandle.name
      openedFilePath.value = path
      fileKind.value = kind
      if (kind === 'text')
        monacoStore.fileContent = content
      savedFileContent.value = content
      rawConfigFileContent.value = content
      externalConflict.value = undefined
      app.activeInspector = 'file'
      openVersion.value++
    }
    finally {
      if (request === openSequence)
        loading.value = false
    }

    // Media previews keep the cached text editor's model and language intact.
    if (kind !== 'text')
      return
    const ext = fileHandle.name.split('.').pop()?.toLowerCase() || ''
    const extLangMap: Record<string, MonacoEditorLanguage> = {
      ts: 'typescript',
      js: 'javascript',
      html: 'html',
      vue: 'html',
      css: 'css',
      scss: 'css',
      json: 'json',
      md: 'markdown',
    }
    const lang = extLangMap[ext] || 'plaintext'
    monacoStore.language = lang
  }

  function assertCanSwitchFile() {
    if (isDirty.value)
      throw new Error('Save or discard the current file before opening another file.')
  }

  function releasePreview() {
    if (previewUrl.value)
      URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }

  function resetOpenedFile() {
    openSequence++
    releasePreview()
    openedFileHandle.value = undefined
    openedFilePath.value = ''
    fileName.value = ''
    savedFileContent.value = ''
    monacoStore.fileContent = ''
    fileKind.value = 'text'
    externalConflict.value = undefined
    loading.value = false
  }

  function openVirtualFile(name: string, content: string) {
    assertCanSwitchFile()
    resetOpenedFile()
    fileName.value = name
    monacoStore.fileContent = content
    monacoStore.language = 'json'
    app.activeInspector = 'file'
    openVersion.value++
  }

  function discardOpenedFileChanges() {
    if (externalConflict.value)
      acceptExternalChange()
    else
      monacoStore.fileContent = savedFileContent.value ?? ''
  }

  watch(() => useProjectStore().workspace, resetOpenedFile, { flush: 'sync' })
  onScopeDispose(releasePreview)

  async function saveOpenedFile(content = monacoStore.fileContent) {
    const fileHandle = openedFileHandle.value
    if (!fileHandle)
      throw new Error('No local file is open')
    const path = openedFilePath.value || fileHandle.name
    const project = useProjectStore()
    const source = project.workspace
    await project.writeProjectFiles([{ path, content, expected: savedFileContent.value }])
    if (source !== project.workspace || openedFilePath.value !== path)
      return
    savedFileContent.value = content
    externalConflict.value = undefined
    consoleStore.success('Markdown file saved', { fileName: path })
  }

  async function handleExternalChange(path: string, content: string | null) {
    if (!openedFileHandle.value || openedFilePath.value !== path)
      return
    if (fileKind.value !== 'text') {
      const source = useProjectStore().workspace
      if (!source?.readAsset || !['image', 'audio', 'video'].includes(fileKind.value))
        return
      const request = ++openSequence
      const blob = await source.readAsset(path)
      if (request !== openSequence || source !== useProjectStore().workspace || openedFilePath.value !== path)
        return
      releasePreview()
      previewUrl.value = URL.createObjectURL(blob)
      return
    }
    if (isDirty.value) {
      externalConflict.value = { content, path }
      consoleStore.warn('External file change conflicts with unsaved edits', { fileName: path })
      return
    }
    monacoStore.fileContent = content ?? ''
    savedFileContent.value = content
    rawConfigFileContent.value = content ?? ''
    externalConflict.value = undefined
  }

  function acceptExternalChange() {
    const conflict = externalConflict.value
    if (!conflict)
      return
    monacoStore.fileContent = conflict.content ?? ''
    savedFileContent.value = conflict.content
    rawConfigFileContent.value = conflict.content ?? ''
    externalConflict.value = undefined
  }

  async function keepLocalChange() {
    if (externalConflict.value)
      savedFileContent.value = externalConflict.value.content
    await saveOpenedFile()
  }

  return {
    fileName,
    openedFilePath,
    isDirty,
    externalConflict,
    fileKind,
    previewUrl,
    openVersion,
    loading,

    openedFileHandle,
    rawConfigFileContent,
    showRawConfigFile,

    openAdvConfigFileHandle,
    openAdvConfigFile,

    openOnlineAdvConfigFile,
    onlineAdvConfigFileDialogOpen,

    setOpenedFileHandle,
    openVirtualFile,
    discardOpenedFileChanges,
    saveOpenedFile,
    handleExternalChange,
    acceptExternalChange,
    keepLocalChange,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFileStore, import.meta.hot))
