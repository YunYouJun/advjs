import type { AdvMusic, ResolvedAdvOptions } from '@advjs/types'
import type { PominisPluginOptions } from './plugin'
import type { PominisAIVSConfig } from './types'
import { getBgmSrcUrl } from '@advjs/core'
import { consola } from 'consola'
import { bgmLibraryUrl, cdnDomain, convertPominisAItoAdvConfig } from '../shared'
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
  })

  // replace gameConfig
  options.data.gameConfig = gameConfig
  gameConfig.bgm = {
    autoplay: true,
    library: bgmLibraryUrl,
  }

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
      consola.success('🖼️ Image conversion completed')
    }
    else {
      consola.log('No online images found to convert')
    }

    const audioFetchTaskArr: (() => Promise<void>)[] = []
    /**
     * 替换 bgmThemeId 为 bgmSrc
     */
    let bgmLibrary = (gameConfig.bgm?.library || {}) as Record<string, AdvMusic>
    if (typeof bgmLibrary === 'string') {
      await fetch(bgmLibrary)
        .then(res => res.json())
        .then((data) => {
          bgmLibrary = data
        })
    }
    gameConfig.chapters.forEach((chapter) => {
      chapter.nodes.forEach((node) => {
        if ('bgmThemeId' in node && node.bgmThemeId && node.bgmThemeId !== 'silence') {
          const bgmKey = node.bgmThemeId
          const cdnUrl = options.data.config.cdn.prefix || cdnDomain
          const bgmName = bgmLibrary[bgmKey]?.name || ''
          const bgmSrc = getBgmSrcUrl({ cdnUrl, bgmName })
          node.bgmSrc = bgmSrc

          audioFetchTaskArr.push(() => (async () => {
            try {
              const base64 = await fetchAudioAsBase64(bgmSrc)
              consola.success(`Converted BGM: ${bgmKey} -> base64`)
              node.bgmSrc = base64
            }
            catch (error) {
              consola.warn(`Failed to convert BGM ${bgmSrc}:`, (error instanceof Error ? error.message : String(error)))
            }
          })())
        }
      })
    })

    // batch convert src to base64 with concurrency limit
    const maxAudioConcurrency = pluginOptions.bundleAssets?.audio?.concurrency || 4 // 可根据需要调整最大并发数
    if (audioFetchTaskArr.length > 0) {
      await runWithConcurrencyLimit(audioFetchTaskArr, maxAudioConcurrency)
      consola.success('🎵 BGM conversion completed.')
    }
  }
}
