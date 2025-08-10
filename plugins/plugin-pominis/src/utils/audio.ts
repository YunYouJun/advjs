import { Buffer } from 'node:buffer'

/**
 * 将在线音频 URL 转为 base64 字符串
 * @param url 音频文件的在线 URL
 * @returns base64 字符串（带 data:audio/xxx;base64, 前缀）
 */
export async function fetchAudioAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`)
  }
  const contentType = response.headers.get('content-type') || 'audio/mpeg'
  const arrayBuffer = await response.arrayBuffer()
  const base64String = arrayBufferToBase64(arrayBuffer)
  return `data:${contentType};base64,${base64String}`
}

/**
 * ArrayBuffer 转 base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  if (typeof btoa === 'function') {
    return btoa(binary)
  }
  else {
    return Buffer.from(binary, 'binary').toString('base64')
  }
}
