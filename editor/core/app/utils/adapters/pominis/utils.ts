import type { AdvGameConfig } from '@advjs/types'
import type { PominisAIVSConfig } from './types'

/**
 * adapt ai pominis format
 */
export function convertPominisAItoAdvConfig(config: PominisAIVSConfig) {
  const advConfig = JSON.parse(JSON.stringify(config)) as PominisAIVSConfig

  // advConfig.chapters.forEach((chapter) => {
  //   chapter.
  // })

  return advConfig as any as AdvGameConfig
}
