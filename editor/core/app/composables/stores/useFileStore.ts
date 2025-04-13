import type { AdvConfigAdapterType } from '../../types'
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
   * monaco editor file content
   */
  const monacoEditorFileContent = computed(() => {
    return showRawConfigFile.value ? rawConfigFileContent.value : JSON.stringify(gameStore.gameConfig, null, 2)
  })

  const app = useAppStore()

  function setOpenedConfigFile(fileHandle: FileSystemFileHandle) {
    app.activeInspector = 'file'
    openedFileHandle.value = fileHandle
  }

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

    setOpenedConfigFile(fileHandle)

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

  return {
    monacoEditorFileContent,
    openedFileHandle,
    rawConfigFileContent,
    showRawConfigFile,

    openAdvConfigFile,
    setOpenedConfigFile,

    openOnlineAdvConfigFile,
    onlineAdvConfigFileDialogOpen,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFileStore, import.meta.hot))
