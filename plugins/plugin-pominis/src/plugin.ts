import type { AdvPlugin } from '@advjs/types'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { consola } from 'consola'
import { defu } from 'defu'
import { name } from '../package.json'
import { handlePominisAdapter } from './adapter'
import { fetchPominisStory } from './api'

export interface PominisPluginOptions {
  /**
   * story id
   * @example '6c91aa92-3f4a-462e-89e8-05040602e768'
   */
  storyId?: string
  /**
   * token for private story
   */
  token?: string

  /**
   * 是否捆绑资源文件 到 index.html 中
   */
  bundleAssets?: {
    enable?: boolean
    /**
     * 音频文件
     *
     * @default false
     */
    audio?: {
      /**
       * @default false
       */
      enable?: boolean
      /**
       * 最大并发数
       * @default 4
       */
      concurrency?: number
    } | boolean
    /**
     * 图片文件
     *
     * @default false
     */
    image?: {
      /**
       * @default false
       */
      enable?: boolean
      /**
       * 最大并发数
       * @default 4
       */
      concurrency?: number
    } | boolean
  }
}

export const defaultPominisPluginOptions: PominisPluginOptions = {
  storyId: '',
  bundleAssets: {
    audio: false,
    image: false,
    // audio: {
    //   enable: true,
    //   concurrency: 4,
    // },
    // image: {
    //   enable: true,
    //   concurrency: 4,
    // },
  },
}

export function pluginPominis(pluginOptions?: PominisPluginOptions): AdvPlugin {
  return {
    name,
    async optionsResolved(options) {
      /**
       * merge options with default
       */
      pluginOptions = defu(pluginOptions, defaultPominisPluginOptions)

      // convert
      const storyId = pluginOptions?.storyId
      if (storyId) {
        const pominisConfig = await fetchPominisStory({
          storyId,
          token: pluginOptions?.token,
        })
        /**
         * for debug
         */
        const distFolder = path.resolve(options.userRoot, options.outDir || 'dist')
        await mkdir(distFolder, { recursive: true })
        const distConfigPath = path.resolve(distFolder, `${storyId}.json`)
        const content = JSON.stringify(pominisConfig, null, 2) + '\n'
        await writeFile(distConfigPath, content, 'utf-8')
        consola.debug(`Pominis story config saved to: ${distConfigPath}`)

        await handlePominisAdapter(options, pluginOptions, pominisConfig)
      }
    },
  }
}
