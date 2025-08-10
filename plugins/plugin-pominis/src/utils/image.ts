import { Buffer } from 'node:buffer'
import axios from 'axios'

/**
 * 支持的图片格式
 */
const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
]

/**
 * 最大文件大小 (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * 检查URL是否为在线图片链接
 * @param url 待检查的URL
 * @returns 是否为在线图片链接
 */
export function isOnlineImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string')
    return false
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * 从URL获取文件扩展名
 * @param url 图片URL
 * @returns 文件扩展名
 */
function getFileExtensionFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const lastDot = pathname.lastIndexOf('.')
    return lastDot !== -1 ? pathname.substring(lastDot + 1).toLowerCase() : ''
  }
  catch {
    return ''
  }
}

/**
 * 根据文件扩展名推断MIME类型
 * @param extension 文件扩展名
 * @returns MIME类型
 */
function getMimeTypeFromExtension(extension: string): string {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
  }
  return mimeMap[extension.toLowerCase()] || 'image/jpeg'
}

/**
 * 获取在线图片并转换为 base64
 * @param url 图片的 URL
 * @returns base64 格式的图片数据（包含 data: 前缀）
 */
export async function fetchImageAsBase64(
  url: string,
  options: {
    timeout?: number
    maxSize?: number
    userAgent?: string
  } = {},
): Promise<string> {
  const {
    timeout = 30000,
    maxSize = MAX_FILE_SIZE,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  } = options

  if (!isOnlineImageUrl(url)) {
    throw new Error(`Invalid URL: ${url}`)
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'image/*',
      },
      maxContentLength: maxSize,
      maxBodyLength: maxSize,
    })

    // 检查响应大小
    const contentLength = response.headers['content-length']
    if (contentLength && Number.parseInt(contentLength) > maxSize) {
      throw new Error(`Image too large: ${contentLength} bytes (max: ${maxSize} bytes)`)
    }

    // 获取响应的 content-type
    let contentType = response.headers['content-type'] || ''

    // 如果没有 content-type，尝试从URL推断
    if (!contentType) {
      const extension = getFileExtensionFromUrl(url)
      contentType = getMimeTypeFromExtension(extension)
    }

    // 验证是否为支持的图片格式
    if (!SUPPORTED_IMAGE_FORMATS.includes(contentType)) {
      console.warn(`Unsupported image format: ${contentType}, treating as image/jpeg`)
      contentType = 'image/jpeg'
    }

    // 将 arraybuffer 转换为 base64
    const buffer = Buffer.from(response.data)
    const base64 = buffer.toString('base64')

    // 返回完整的 data URL
    return `data:${contentType};base64,${base64}`
  }
  catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout: ${url}`)
      }
      else if (error.response?.status === 404) {
        throw new Error(`Image not found: ${url}`)
      }
      else if (error.response?.status === 403) {
        throw new Error(`Access denied: ${url}`)
      }
      else {
        throw new Error(`HTTP error ${error.response?.status}: ${url}`)
      }
    }
    throw new Error(`Failed to fetch image from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 批量转换图片为base64
 * @param urls 图片URL数组
 * @returns Promise数组，每个Promise解析为{url, base64?, error?}
 */
export async function batchFetchImagesAsBase64(
  urls: string[],
  options: {
    timeout?: number
    maxSize?: number
    userAgent?: string
    concurrency?: number
  } = {},
): Promise<Array<{ url: string, base64?: string, error?: string }>> {
  const { concurrency = 5 } = options

  // 分批处理，避免并发请求过多
  const results: Array<{ url: string, base64?: string, error?: string }> = []

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchPromises = batch.map(async (url) => {
      try {
        const base64 = await fetchImageAsBase64(url, options)
        return { url, base64 }
      }
      catch (error) {
        return {
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })

    const batchResults = await Promise.allSettled(batchPromises)
    const processedResults = batchResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      else {
        return {
          url: batch[index],
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        }
      }
    })

    results.push(...processedResults)
  }

  return results
}
