import type { AdvConfigAdapterType } from '../types'
import type { MonacoEditorLanguage } from './useMonacoStore'
import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useFileStore = defineStore('file', () => {
  const gameStore = useGameStore()
  const consoleStore = useConsoleStore()

  /**
   * 被打开的文件
   *
   * 一次只有一个
   */
  const openedFileHandle = shallowRef<FileSystemFileHandle>()

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

  watch(() => showRawConfigFile.value, (val) => {
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
    fileName.value = fileHandle.name
    setOpenedFileHandle(fileHandle)

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
    app.activeInspector = 'file'

    const { url, adapter } = options
    // fetch json from online link
    const json = await fetch(url).then(res => res.json())

    rawConfigFileContent.value = JSON.stringify(json, null, 2)
    gameStore.curAdapter = adapter
    gameStore.loadGameFromConfig(json)
    consoleStore.success('File loaded', {
      fileName: url,
    })

    onlineAdvConfigFileDialogOpen.value = false
  }

  /**
   * set opened file handle
   */
  async function setOpenedFileHandle(fileHandle: FileSystemFileHandle) {
    app.activeInspector = 'file'
    openedFileHandle.value = fileHandle

    const fileContent = await fileHandle.getFile().then(file => file.text())
    monacoStore.fileContent = fileContent

    const ext = fileHandle.name.split('.').pop() || ''
    const extLangMap: Record<string, MonacoEditorLanguage> = {
      ts: 'typescript',
      js: 'javascript',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
    }
    const lang = extLangMap[ext] || 'plaintext'
    monacoStore.language = lang
  }

  return {
    fileName,

    openedFileHandle,
    rawConfigFileContent,
    showRawConfigFile,

    openAdvConfigFileHandle,
    openAdvConfigFile,

    openOnlineAdvConfigFile,
    onlineAdvConfigFileDialogOpen,

    setOpenedFileHandle,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFileStore, import.meta.hot))
