import type { AiConfig } from '../stores/useAiSettingsStore'

export interface ImageGenerateOptions {
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  style?: string
}

const TRAILING_SLASH_RE = /\/+$/
const UUID_REPLACE_RE = /[xy]/g

/** RFC-4122 v4 UUID, no external deps */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(UUID_REPLACE_RE, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export interface ImageGenerateResult {
  url: string
  base64?: string
}

export interface ImagePromptTemplate {
  prompt: string
  negativePrompt: string
  platforms: {
    doubao: string
    yuanbao: string
    midjourney: string
    stableDiffusion: string
  }
}

/** Image provider configurations */
export interface ImageProviderConfig {
  provider: AiConfig['imageProvider']
  apiKey: string
  model: string
}

// Image generation intent detection patterns (module-scope for performance)
const IMAGE_INTENT_PATTERNS = [
  /\b(?:draw|paint|generate|create|make)\b.+\b(?:image|picture|illustration|art|portrait|sprite|cg)\b/i,
  /\bcharacter\s*(?:sprite|art|portrait|illustration)\b/i,
  /\bbackground\s*(?:art|image|illustration)\b/i,
  /画一[张幅个]/,
  /生成.+(?:图|立绘|插画|CG|背景)/,
  /(?:立绘|插画|CG|背景图|角色图)/,
  /画.+(?:角色|场景|背景)/,
]

/** SiliconFlow image generation models */
export const SILICONFLOW_IMAGE_MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 Schnell (Fast)' },
  { id: 'stabilityai/stable-diffusion-3-5-large-turbo', name: 'SD 3.5 Large Turbo' },
  { id: 'Kwai-Kolors/Kolors', name: 'Kolors' },
]

/**
 * Check if user message implies image generation intent.
 */
export function detectImageIntent(message: string): boolean {
  const lowerMsg = message.toLowerCase()
  return IMAGE_INTENT_PATTERNS.some(p => p.test(lowerMsg) || p.test(message))
}

/**
 * Generate a structured prompt template for image generation.
 * Used when no image API is configured — user can copy prompts to external tools.
 */
export function buildImagePromptTemplate(
  description: string,
  style: string = 'anime',
): ImagePromptTemplate {
  const basePrompt = `${description}, ${style} style, high quality, detailed`
  const negativePrompt = 'low quality, blurry, deformed, ugly, watermark, text'

  return {
    prompt: basePrompt,
    negativePrompt,
    platforms: {
      doubao: `${description}\n风格：${style === 'anime' ? '日系动漫' : style}\n要求：高质量，细节丰富`,
      yuanbao: `请生成一张${style === 'anime' ? '日系动漫风格' : `${style}风格`}的图片：${description}。要求高质量、细节丰富。`,
      midjourney: `${basePrompt} --ar 3:4 --style raw --v 6`,
      stableDiffusion: `(masterpiece, best quality:1.2), ${basePrompt}\nNegative: ${negativePrompt}`,
    },
  }
}

/**
 * Generate an image using SiliconFlow API.
 * POST https://api.siliconflow.cn/v1/images/generations
 */
async function generateViaSiliconFlow(
  options: ImageGenerateOptions,
  apiKey: string,
  model: string,
): Promise<ImageGenerateResult> {
  const width = options.width || 768
  const height = options.height || 1024

  const body: Record<string, unknown> = {
    model: model || 'black-forest-labs/FLUX.1-schnell',
    prompt: options.prompt,
    image_size: `${width}x${height}`,
    num_inference_steps: 20,
  }

  if (options.negativePrompt)
    body.negative_prompt = options.negativePrompt

  const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`SiliconFlow image API error ${response.status}: ${text || response.statusText}`)
  }

  const data = await response.json() as {
    images: Array<{ url: string }>
    seed?: number
  }

  if (!data.images?.[0]?.url)
    throw new Error('No image returned from SiliconFlow API')

  return { url: data.images[0].url }
}

/**
 * Generate an image using Runware REST API.
 * POST https://api.runware.ai/v1
 */
async function generateViaRunware(
  options: ImageGenerateOptions,
  apiKey: string,
): Promise<ImageGenerateResult> {
  const taskUUID = uuidv4()
  const response = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify([
      { taskType: 'authentication', apiKey },
      {
        taskType: 'imageInference',
        taskUUID,
        positivePrompt: options.prompt,
        model: 'runware:100@1',
        width: options.width ?? 512,
        height: options.height ?? 512,
        numberResults: 1,
        outputFormat: 'WEBP',
      },
    ]),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Runware API error ${response.status}: ${text || response.statusText}`)
  }

  const json = await response.json() as { data?: Array<{ taskType: string, imageURL?: string }> }
  const imageTask = json.data?.find(d => d.taskType === 'imageInference')
  const url = imageTask?.imageURL
  if (!url)
    throw new Error('No image URL in Runware response')

  return { url }
}

/**
 * Works with OpenAI and other compatible providers.
 */
async function generateViaOpenAI(
  options: ImageGenerateOptions,
  apiKey: string,
  model: string,
  baseURL: string = 'https://api.openai.com/v1',
): Promise<ImageGenerateResult> {
  const body: Record<string, unknown> = {
    model: model || 'dall-e-3',
    prompt: options.prompt,
    size: `${options.width || 1024}x${options.height || 1024}`,
    n: 1,
    response_format: 'url',
  }

  const url = `${baseURL.replace(TRAILING_SLASH_RE, '')}/images/generations`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Image API error ${response.status}: ${text || response.statusText}`)
  }

  const data = await response.json() as {
    data: Array<{ url?: string, b64_json?: string }>
  }

  const result = data.data?.[0]
  if (!result)
    throw new Error('No image returned from API')

  if (result.url)
    return { url: result.url }
  if (result.b64_json)
    return { url: `data:image/png;base64,${result.b64_json}`, base64: result.b64_json }

  throw new Error('No image URL or base64 in response')
}

/**
 * Generate an image using Tencent Hunyuan TextToImageLite via the OpenAI-compatible
 * Hunyuan Studio endpoint. The user is expected to provide their Hunyuan API key
 * obtained from https://cloud.tencent.com/document/product/1729/101797.
 *
 * NOTE: Hunyuan's native Sign-V3 API requires server-side signing. Browser-only
 * integration uses the Hunyuan OpenAI-compatible endpoint which supports image
 * generation via the `/v1/images/generations` path.
 */
async function generateViaHunyuan(
  options: ImageGenerateOptions,
  apiKey: string,
  model: string,
): Promise<ImageGenerateResult> {
  // Hunyuan OpenAI-compatible endpoint (image generation)
  const baseURL = 'https://api.hunyuan.cloud.tencent.com/v1'
  return generateViaOpenAI(
    options,
    apiKey,
    model || 'hunyuan-image',
    baseURL,
  )
}

/**
 * Generate an image using the configured provider.
 */
export async function generateImage(
  options: ImageGenerateOptions,
  config: AiConfig,
): Promise<ImageGenerateResult> {
  switch (config.imageProvider) {
    case 'siliconflow':
      return generateViaSiliconFlow(options, config.imageApiKey, config.imageModel)

    case 'openai-dall-e':
      return generateViaOpenAI(options, config.imageApiKey, config.imageModel)

    case 'hunyuan':
      return generateViaHunyuan(options, config.imageApiKey, config.imageModel)

    case 'runware':
      return generateViaRunware(options, config.imageApiKey)

    case 'none':
    default:
      throw new Error('No image provider configured. Go to Settings → AI → Image Generation to set one up.')
  }
}

/**
 * Check if image generation is available (provider configured with API key).
 */
export function isImageGenerationAvailable(config: AiConfig): boolean {
  if (config.imageProvider === 'none')
    return false
  return !!config.imageApiKey
}
