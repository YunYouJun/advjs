import { acceptHMRUpdate, defineStore } from 'pinia'

export const useFileStore = defineStore('file', () => {
  const gameStore = useGameStore()

  /**
   * 被打开的文件
   *
   * 一次只有一个
   */
  const openedFileHandle = shallowRef<FileSystemFileHandle>()
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
  }

  return {
    openedFileHandle,
    configFileContent,

    openAdvConfigFile,
    setOpenedConfigFile,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFileStore, import.meta.hot))
