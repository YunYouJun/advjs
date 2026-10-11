import type { ResolvedAdvOptions } from '@advjs/types'
import type { PominisPluginOptions } from './plugin'
import type { PominisAIVSConfig } from './types'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { convertPominisAItoAdvConfig } from '../shared'
import { fetchImageAsBase64, isOnlineImageUrl } from './utils'
import { fetchAudioAsBase64 } from './utils/audio'

/**
 * 控制 promise 并发数
 */
async function runWithConcurrencyLimit<T>(tasks: (() => Promise<T>)[], maxConcurrency: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  let i = 0
  const running: Promise<void>[] = []
  async function runTask(taskIndex: number) {
    try {
      const res = await tasks[taskIndex]()
      results[taskIndex] = { status: 'fulfilled', value: res }
    }
    catch (err) {
      results[taskIndex] = { status: 'rejected', reason: err }
    }
  }
  while (i < tasks.length) {
    if (running.length < maxConcurrency) {
      const taskPromise = runTask(i)
      running.push(taskPromise.then(() => {
        running.splice(running.indexOf(taskPromise), 1)
      }))
      i++
    }
    else {
      await Promise.race(running)
    }
  }
  await Promise.all(running)
  return results
}

/**
 * fetch pominis story and convert to adv config
 */
export async function handlePominisAdapter(options: ResolvedAdvOptions, pluginOptions: PominisPluginOptions, pominisConfig: PominisAIVSConfig): Promise<void> {
  const gameConfig = convertPominisAItoAdvConfig({
    config: pominisConfig,
    audio: pluginOptions.audio,
  })

  // replace gameConfig
  options.data.gameConfig = gameConfig

  if (options.singlefile) {
    if (pluginOptions.bundleAssets?.image) {
      const imageFetchTaskArr: (() => Promise<void>)[] = []
      consola.start('Converting images to base64 for single file mode...')

      // 处理场景图片
      gameConfig.scenes.forEach((scene) => {
        if (scene.type === 'image' && scene.src && isOnlineImageUrl(scene.src)) {
          imageFetchTaskArr.push(() => (async () => {
            try {
              const base64 = await fetchImageAsBase64(scene.src!)
              consola.success(`Converted scene image: ${colors.cyan(scene.id)}`)
              scene.src = base64
            }
            catch (error) {
              consola.warn(`Failed to convert scene image ${colors.cyan(scene.src!)}:`, (error instanceof Error ? error.message : String(error)))
            // 保持原始 URL，不中断流程
            }
          })())
        }
      })

      // 处理角色头像
      gameConfig.characters.forEach((character) => {
        if (character.avatar && isOnlineImageUrl(character.avatar)) {
          imageFetchTaskArr.push(() => (async () => {
            try {
              const base64 = await fetchImageAsBase64(character.avatar!)
              consola.success(`Converted character avatar: ${colors.cyan(character.name)}`)
              character.avatar = base64
            }
            catch (error) {
              consola.warn(`Failed to convert character avatar ${colors.cyan(character.avatar!)}:`, (error instanceof Error ? error.message : String(error)))
            }
          })())
        }

        // 处理角色立绘
        if (character.tachies) {
          Object.keys(character.tachies).forEach((key) => {
            const tachie = character.tachies![key]
            if (tachie?.src && isOnlineImageUrl(tachie.src)) {
              imageFetchTaskArr.push(() => (async () => {
                try {
                  const base64 = await fetchImageAsBase64(tachie.src!)
                  consola.success(`Converted character tachie: ${colors.cyan(character.name)}/${colors.cyan(key)}`)
                  tachie.src = base64
                }
                catch (error) {
                  consola.warn(`Failed to convert character tachie ${colors.cyan(tachie.src!)}:`, (error instanceof Error ? error.message : String(error)))
                }
              })())
            }
          })
        }
      })

      // batch convert images to base64 with concurrency limit
      const imageConfig = pluginOptions.bundleAssets?.image
      const maxImageConcurrency = typeof imageConfig === 'object' ? (imageConfig?.concurrency || 4) : 4 // 可根据需要调整最大并发数
      if (imageFetchTaskArr.length > 0) {
        consola.log(`Converting ${imageFetchTaskArr.length} images to base64...`)
        await runWithConcurrencyLimit(imageFetchTaskArr, maxImageConcurrency)
        consola.success('🖼️ Image conversion completed')
      }
      else {
        consola.log('No online images found to convert')
      }
    }

    if (pluginOptions.bundleAssets?.audio) {
      const audioFetchTaskArr: (() => Promise<void>)[] = []
      for (const [assetId, asset] of Object.entries(gameConfig.audio?.assets ?? {})) {
        if (asset.kind !== 'bgm')
          continue
        audioFetchTaskArr.push(async () => {
          try {
            asset.src = await fetchAudioAsBase64(asset.src)
            consola.success(`Converted native audio asset: ${colors.cyan(assetId)}`)
          }
          catch (error) {
            consola.warn(`Failed to bundle native audio asset ${colors.cyan(assetId)}:`, error instanceof Error ? error.message : String(error))
          }
        })
      }

      // batch convert src to base64 with concurrency limit
      const defaultAudioConcurrency = 4
      const maxAudioConcurrency = typeof pluginOptions.bundleAssets?.audio === 'object'
        ? pluginOptions.bundleAssets.audio.concurrency || defaultAudioConcurrency
        : defaultAudioConcurrency
      if (audioFetchTaskArr.length > 0) {
        await runWithConcurrencyLimit(audioFetchTaskArr, maxAudioConcurrency)
        consola.success('🎵 BGM conversion completed.')
      }
    }
  }
}
