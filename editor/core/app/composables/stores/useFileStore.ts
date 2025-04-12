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
   * confirmed online adv config file
   */
  const onlineAdvConfigFileUrl = useStorage('adv:editor:online-adv-config-url', '')

  /**
   * 被打开的文件内容
   */
  const configFileContent = ref<string>('')

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
    configFileContent.value = text

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
  async function openOnlineAdvConfigFile() {
    app.activeInspector = 'file'

    // fetch json from online link
    const url = onlineAdvConfigFileUrl.value
    const json = await fetch(url).then(res => res.json())

    configFileContent.value = JSON.stringify(json, null, 2)
    gameStore.loadGameFromConfig(json)
    consoleStore.success('File loaded', {
      fileName: url,
    })

    onlineAdvConfigFileDialogOpen.value = false
  }

  return {
    openedFileHandle,
    onlineAdvConfigFileUrl,
    configFileContent,

    openAdvConfigFile,
    setOpenedConfigFile,

    openOnlineAdvConfigFile,
    onlineAdvConfigFileDialogOpen,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFileStore, import.meta.hot))
