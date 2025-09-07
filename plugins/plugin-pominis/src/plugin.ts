import type { AdvPlugin } from '@advjs/types'
import path from 'node:path'
import { defu } from 'defu'
import fs from 'fs-extra'
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
     * @default true
     */
    audio?: {
      /**
       * @default true
       */
      enable?: boolean
      /**
       * 最大并发数
       * @default 4
       */
      concurrency?: number
    }
    /**
     * 图片文件
     *
     * @default true
     */
    image?: {
      /**
       * @default true
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
    audio: {
      enable: true,
      concurrency: 4,
    },
    image: {
      enable: true,
      concurrency: 4,
    },
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
        await fs.ensureDir(distFolder)
        const distConfigPath = path.resolve(distFolder, `${storyId}.json`)
        await fs.writeJson(distConfigPath, pominisConfig, { spaces: 2, EOL: '\n' })

        await handlePominisAdapter(options, pluginOptions, pominisConfig)
      }
    },
  }
}
