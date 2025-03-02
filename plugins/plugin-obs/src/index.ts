/* eslint-disable no-console */
import type { ConnectOBSWebSocketOptions } from './types'
import { dirname } from 'node:path'
import { sleep } from '@advjs/core'
import cliProgress from 'cli-progress'
import consola from 'consola'
import { colors } from 'consola/utils'
import OBSWebSocket from 'obs-websocket-js'

import open from 'open'

import { defaultOptions } from './options'

export * from './types'

/**
 * Connect to an obs-websocket server.
 *
 * @see [obs-websocket - Remote-control OBS Studio using WebSockets](https://obsproject.com/forum/resources/obs-websocket-remote-control-obs-studio-from-websockets.466/)
 * @see [obs-websocket | GitHub](https://github.com/obsproject/obs-websocket)
 * @see [obs-websocket-js | GitHub](https://github.com/obs-websocket-community-projects/obs-websocket-js)
 *
 * 记得勾选「开启 WebSocket 服务」
 */
export async function connectOBSWebSocket(options: ConnectOBSWebSocketOptions) {
  const resolvedOptions = Object.assign({}, defaultOptions, options) as Required<ConnectOBSWebSocketOptions>

  const obs = new OBSWebSocket()
  consola.start('Connecting to', colors.cyan(options.url || 'unknown'))

  const { sceneName, inputName } = resolvedOptions

  try {
    const {
      obsWebSocketVersion,
      negotiatedRpcVersion,
    } = await obs.connect(options.url, options.password, options.identificationParams)

    consola.info(`Connected to server ${colors.yellow(obsWebSocketVersion)} (using RPC ${negotiatedRpcVersion})`)

    // 创建新场景
    await obs.call('CreateScene', {
      sceneName,
    })
    consola.success(`🎬 场景 "${colors.blue(sceneName)}" 创建成功！`)

    // 创建浏览器源
    await obs.call('CreateInput', {
      sceneName, // 如果指定场景，会自动添加到该场景
      inputName, // 自定义源的名称
      inputKind: 'browser_source', // 指定类型为浏览器源
      inputSettings: {
        ...defaultOptions.inputSettings,
        ...options.inputSettings,
      },
    })
    consola.success(`🌐 浏览器源 "${colors.blue(inputName)}" 创建成功！`)

    // 设置当前场景
    await obs.call('SetCurrentProgramScene', {
      sceneName,
    })

    // 等待切换场景
    await sleep(1000)

    // 开始录制
    console.log()
    await obs.call('StartRecord')
    const startTime = Date.now()
    consola.start('开始录制')

    console.log()
    const recordSeconds = resolvedOptions.duration / 1000
    const bar = new cliProgress.SingleBar({
      format: `  🕒 ${colors.cyan('{bar}')} | ${colors.green('{duration_formatted}')}/${recordSeconds}s`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    })
    bar.start(recordSeconds, 0)
    const interval = setInterval(() => {
      bar.increment()
    }, 1000)
    await sleep(resolvedOptions.duration)
    clearInterval(interval)
    bar.update(recordSeconds)
    bar.stop()
    console.log()

    // 停止录制
    const { outputPath } = await obs.call('StopRecord')
    const duration = (Date.now() - startTime) / 1000
    consola.info(`结束录制

  📁 ${colors.blue(outputPath)}
  🕒 ${colors.green(duration.toFixed(2))} s
    `)

    // 打开文件夹
    await open(dirname(outputPath))
  }
  catch (error) {
    console.error('Failed to connect', error)
  }
  finally {
    await obs.call('StopRecord')

    if (resolvedOptions.autoDestroy) {
    // 移除浏览器源
      await obs.call('RemoveInput', {
        inputName,
      })
      consola.debug(`🌐 浏览器源 "${inputName}" 移除成功！`)

      // 移除场景
      await obs.call('RemoveScene', {
        sceneName,
      })
      consola.debug(`🎬 场景 "${sceneName}" 移除成功！`)
    }

    // 断开连接
    await obs.disconnect()
    consola.success('OBS Disconnected.')
  }
}
