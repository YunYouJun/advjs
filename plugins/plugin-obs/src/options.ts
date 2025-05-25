import type { ConnectOBSWebSocketOptions } from './types'
import { version } from '../package.json'

export const namespace = `[plugin-obs v${version}]`
export const defaultOptions: ConnectOBSWebSocketOptions = {
  url: 'ws://127.0.0.1:4455',
  password: 'advjs-plugin-obs',
  duration: 1000,

  sceneName: `${namespace} 录制场景`,
  inputName: `${namespace} 浏览器源`,

  inputSettings: {
    url: 'https://love.demo.advjs.org', // 要录制的网页地址
    width: 1920,
    height: 1080,
    fps: 30,
  },

  autoDestroy: true,
}
