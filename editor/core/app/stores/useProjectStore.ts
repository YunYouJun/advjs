import type { FSDirItem, TreeNode } from '@advjs/gui'
import type { AdvConfig } from '@advjs/types'
import type { AdvConfigAdapterType } from '../types'
import { defaultAdvConfig } from '@advjs/core'
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
    gameStore.loadGameFromJSONStr(text)

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
        console.error('Failed to load online adv.config.json', error)
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
      loadIndexAdvJSON(text)
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

    entryFileHandle,
    setEntryFileHandle,
    setAdvConfigFileHandle,

    loadIndexAdvJSON,
    loadAdvConfigJSON,

    online,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot))
