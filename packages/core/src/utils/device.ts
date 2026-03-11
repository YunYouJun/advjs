const mobilePattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|HarmonyOS/i
const weChatPattern = /MicroMessenger/i

/**
 * 判断是否为移动端设备
 */
export function isMobile(): boolean {
  return mobilePattern.test(navigator.userAgent)
}

/**
 * 判断是否为微信浏览器环境
 */
export function isWeChat(): boolean {
  return weChatPattern.test(navigator.userAgent)
}
