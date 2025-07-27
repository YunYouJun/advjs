import type { ResolvedAdvOptions } from '@advjs/types'
import type { PominisAIVSConfig } from './types'
import { consola } from 'consola'
import { convertPominisAItoAdvConfig } from '../shared'
import { fetchImageAsBase64, isOnlineImageUrl } from './utils'

/**
 * fetch pominis story and convert to adv config
 */
export async function handlePominisAdapter(options: ResolvedAdvOptions, pominisConfig: PominisAIVSConfig): Promise<void> {
  const gameConfig = convertPominisAItoAdvConfig({
    config: pominisConfig,
  })

  // replace gameConfig
  options.data.gameConfig = gameConfig

  if (options.singlefile) {
    consola.start('Converting images to base64 for single file mode...')
    const imagePromises: Promise<void>[] = []

    // 处理场景图片
    gameConfig.scenes.forEach((scene) => {
      if (scene.type === 'image' && scene.src && isOnlineImageUrl(scene.src)) {
        const promise = fetchImageAsBase64(scene.src)
          .then((base64) => {
            consola.success(`Converted scene image: ${scene.id}`)
            scene.src = base64
          })
          .catch((error) => {
            consola.warn(`Failed to convert scene image ${scene.src}:`, error.message)
            // 保持原始 URL，不中断流程
          })
        imagePromises.push(promise)
      }
    })

    // 处理角色头像
    gameConfig.characters.forEach((character) => {
      if (character.avatar && isOnlineImageUrl(character.avatar)) {
        const promise = fetchImageAsBase64(character.avatar)
          .then((base64) => {
            consola.success(`Converted character avatar: ${character.name}`)
            character.avatar = base64
          })
          .catch((error) => {
            consola.warn(`Failed to convert character avatar ${character.avatar}:`, error.message)
          })
        imagePromises.push(promise)
      }

      // 处理角色立绘
      if (character.tachies) {
        Object.keys(character.tachies).forEach((key) => {
          const tachie = character.tachies![key]
          if (tachie?.src && isOnlineImageUrl(tachie.src)) {
            const promise = fetchImageAsBase64(tachie.src)
              .then((base64) => {
                consola.success(`Converted character tachie: ${character.name}/${key}`)
                tachie.src = base64
              })
              .catch((error) => {
                consola.warn(`Failed to convert character tachie ${tachie.src}:`, error.message)
              })
            imagePromises.push(promise)
          }
        })
      }
    })

    // 等待所有图片转换完成
    if (imagePromises.length > 0) {
      consola.log(`Converting ${imagePromises.length} images to base64...`)
      await Promise.allSettled(imagePromises)
      consola.success('Image conversion completed')
    }
    else {
      consola.log('No online images found to convert')
    }
  }
}
