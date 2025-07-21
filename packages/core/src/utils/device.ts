/**
 * 判断是否为移动端设备
 */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|HarmonyOS/i.test(navigator.userAgent)
}

/**
 * 判断是否为微信浏览器环境
 */
export function isWeChat(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent)
}
