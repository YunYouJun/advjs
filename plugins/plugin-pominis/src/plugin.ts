import type { AdvPlugin } from '@advjs/types'
import path from 'node:path'
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
   * 是否捆绑资源文件 到 index.html 中
   *
   * @default true
   */
  bundleAssets?: boolean | {
    /**
     * 音频文件
     *
     * @default true
     */
    audio?: boolean
    /**
     * 图片文件
     *
     * @default true
     */
    image?: boolean
  }
}

export function pluginPominis(pluginOptions?: PominisPluginOptions): AdvPlugin {
  return {
    name,
    async optionsResolved(options) {
      // convert
      const storyId = pluginOptions?.storyId
      if (storyId) {
        const pominisConfig = await fetchPominisStory({
          storyId,
        })
        /**
         * for debug
         */
        const distFolder = path.resolve(options.userRoot, options.outDir || 'dist')
        await fs.ensureDir(distFolder)
        const distConfigPath = path.resolve(distFolder, `${storyId}.json`)
        await fs.writeJson(distConfigPath, pominisConfig, { spaces: 2, EOL: '\n' })

        await handlePominisAdapter(options, pominisConfig)
      }
    },
  }
}
