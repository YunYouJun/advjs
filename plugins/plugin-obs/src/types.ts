import type { OBSRequestTypes } from 'obs-websocket-js'
import type OBSWebSocket from 'obs-websocket-js'

export interface ConnectOBSWebSocketOptions {
  /**
   * 端口号通常为 `4455`。
   * 如：`ws://127.0.0.1:4455`。
   * 如：`ws://192.168.31.7:4455`。
   */
  url?: Parameters<OBSWebSocket['connect']>[0]
  /**
   * OBS「工具」->「WebSocket 服务器设置」->「服务器密码」。
   *
   * 你自定义的 obs-websocket 密码。
   */
  password?: Parameters<OBSWebSocket['connect']>[1]
  identificationParams?: Parameters<OBSWebSocket['connect']>[2]

  /**
   * 自定义场景名
   */
  sceneName?: string
  /**
   * 自定义浏览器源名
   */
  inputName?: string

  /**
   * 浏览器源设置。
   *
   * - url: 要录制的网页地址，可以是 localhost。
   * - width: 宽度，默认为 1920。
   * - height: 高度，默认为 1080。
   * - fps: 帧率（可选，默认为 30）。
   */
  inputSettings?: OBSRequestTypes['CreateInput']['inputSettings'] | {
    url: string
    width?: number
    height?: number
    fps?: number
  }

  /**
   * 录制时间
   * @default 1000
   */
  duration?: number

  /**
   * 录制完后是否自动销毁场景
   * @default true
   */
  autoDestroy?: boolean
}
