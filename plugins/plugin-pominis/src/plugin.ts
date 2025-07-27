import type { AdvPlugin } from '@advjs/types'
import { name } from '../package.json'
import { handlePominisAdapter } from './adapter'
import { fetchPominisStory } from './api'

export interface PominisPluginOptions {
  /**
   * story id
   * @example '6c91aa92-3f4a-462e-89e8-05040602e768'
   */
  storyId?: string
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
        await handlePominisAdapter(options, pominisConfig)
      }
    },
  }
}
