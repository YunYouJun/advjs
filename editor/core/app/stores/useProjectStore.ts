import type { FSDirItem, TreeNode } from '@advjs/gui'
import type { AdvConfig } from '@advjs/types'
import { defaultConfig } from '@advjs/core'
import { consola } from 'consola'

/**
 * global project store
 */
export const useProjectStore = defineStore('@advjs/editor:project', () => {
  const fileStore = useFileStore()

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
  const advConfig = ref<AdvConfig>(defaultConfig)

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
      .then(text => JSON.parse(text) as AdvConfig)
    advConfig.value = advConfigJson

    consola.info('adv.config.json', advConfigJson)
  }

  return {
    rootDir,

    advConfig,
    curAdvConfigTab,

    entryFileHandle,
    setEntryFileHandle,
    setAdvConfigFileHandle,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot))
