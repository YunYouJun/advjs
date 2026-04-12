/**
 * TTS (Text-to-Speech) client with plugin architecture.
 *
 * Provides a unified interface for multiple TTS providers:
 * - Web Speech API (browser built-in, free, offline)
 * - OpenAI TTS (high quality, API key required)
 * - Doubao/ByteDance TTS (OpenAI-compatible format)
 * - Custom (any OpenAI-compatible TTS endpoint)
 *
 * Providers register via `registerTtsProvider()` and are resolved by id.
 * New providers can be added without modifying existing code.
 */

const TRAILING_SLASHES = /\/+$/

// --- Plugin Interface ---

export interface TtsGenerateOptions {
  text: string
  voice: string
  model: string
  speed: number
  apiKey: string
  baseURL: string
  signal?: AbortSignal
}

export interface TtsPlayOptions {
  text: string
  voice: string
  speed: number
}

export interface TtsPlaybackControl {
  stop: () => void
  /** Resolves when playback ends naturally or is stopped */
  onEnd: Promise<void>
}

export interface TtsProvider {
  id: string
  name: string
  needsKey: boolean
  baseURL?: string
  models?: string[]
  voices?: string[]
  registrationUrl?: string
  /** true = can produce audio Blob (saveable); false = real-time only (Web Speech) */
  canGenerateBlob: boolean
  /** Generate audio Blob. Required when canGenerateBlob=true. */
  generate?: (options: TtsGenerateOptions) => Promise<Blob>
  /** Play text directly. Required when canGenerateBlob=false. */
  play?: (options: TtsPlayOptions) => TtsPlaybackControl
}

// --- Provider Registry ---

const ttsProviderRegistry = new Map<string, TtsProvider>()

export function registerTtsProvider(provider: TtsProvider): void {
  ttsProviderRegistry.set(provider.id, provider)
}

export function getTtsProvider(id: string): TtsProvider | undefined {
  return ttsProviderRegistry.get(id)
}

export function listTtsProviders(): TtsProvider[] {
  return [...ttsProviderRegistry.values()]
}

// --- Built-in Providers ---

// 1. Web Speech API (browser built-in)

const webSpeechProvider: TtsProvider = {
  id: 'web-speech',
  name: 'Web Speech API',
  needsKey: false,
  canGenerateBlob: false,

  play(options: TtsPlayOptions): TtsPlaybackControl {
    const utterance = new SpeechSynthesisUtterance(options.text)
    utterance.rate = options.speed

    // Try to find a matching voice
    if (options.voice) {
      const voices = speechSynthesis.getVoices()
      const match = voices.find(v => v.name === options.voice || v.voiceURI === options.voice)
      if (match)
        utterance.voice = match
    }

    let resolveEnd: () => void
    const onEnd = new Promise<void>((resolve) => {
      resolveEnd = resolve
    })

    utterance.onend = () => resolveEnd()
    utterance.onerror = () => resolveEnd()

    speechSynthesis.speak(utterance)

    return {
      stop: () => {
        speechSynthesis.cancel()
        resolveEnd()
      },
      onEnd,
    }
  },
}

/**
 * Get available Web Speech API voices (async — voices may load lazily).
 */
export function getWebSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices()
    if (voices.length > 0) {
      resolve(voices)
      return
    }
    // Voices may not be loaded yet
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices())
    }
    // Fallback timeout
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1000)
  })
}

// 2. OpenAI TTS

async function openaiCompatibleGenerate(options: TtsGenerateOptions): Promise<Blob> {
  const url = `${options.baseURL.replace(TRAILING_SLASHES, '')}/audio/speech`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.apiKey)
    headers.Authorization = `Bearer ${options.apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.model || 'tts-1',
      input: options.text,
      voice: options.voice || 'alloy',
      speed: options.speed || 1.0,
      response_format: 'mp3',
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (response.status === 401)
      throw new TtsError('Invalid API key. Please check your TTS settings.', 'auth')
    if (response.status === 429)
      throw new TtsError('Rate limit exceeded. Please wait and try again.', 'rate_limit')
    throw new TtsError(
      `TTS API error ${response.status}: ${errorText || response.statusText}`,
      'api_error',
    )
  }

  return await response.blob()
}

const openaiTtsProvider: TtsProvider = {
  id: 'openai',
  name: 'OpenAI TTS',
  needsKey: true,
  baseURL: 'https://api.openai.com/v1',
  models: ['tts-1', 'tts-1-hd'],
  voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  registrationUrl: 'https://platform.openai.com/',
  canGenerateBlob: true,
  generate: openaiCompatibleGenerate,
}

// 3. Doubao (ByteDance) TTS — OpenAI-compatible format

const doubaoTtsProvider: TtsProvider = {
  id: 'doubao',
  name: 'Doubao TTS',
  needsKey: true,
  baseURL: 'https://openspeech.bytedance.com/api/v1',
  models: [
    'zh_female_tianmeixiaoyuan',
    'zh_male_chunhou',
    'zh_female_shuangkuaisisi',
    'zh_male_yangguang',
    'multi_female_shuangkuai',
    'multi_male_jingji',
  ],
  voices: [],
  registrationUrl: 'https://console.volcengine.com/speech/app',
  canGenerateBlob: true,
  generate: openaiCompatibleGenerate,
}

// 4. Custom (any OpenAI-compatible TTS endpoint)

const customTtsProvider: TtsProvider = {
  id: 'custom',
  name: 'Custom',
  needsKey: false,
  canGenerateBlob: true,
  generate: openaiCompatibleGenerate,
}

// Register all built-in providers
registerTtsProvider(webSpeechProvider)
registerTtsProvider(openaiTtsProvider)
registerTtsProvider(doubaoTtsProvider)
registerTtsProvider(customTtsProvider)

// --- High-level API ---

export interface TtsSettings {
  provider: string
  apiKey: string
  model: string
  voice: string
  speed: number
  customBaseURL: string
}

/** Currently active playback control (for stopping) */
let currentPlayback: TtsPlaybackControl | null = null
let currentAudio: HTMLAudioElement | null = null

/**
 * Play or generate TTS for the given text.
 *
 * - For providers with `canGenerateBlob=true`: generates audio Blob and plays it.
 *   Returns the Blob so callers can cache it.
 * - For providers with `canGenerateBlob=false` (Web Speech): plays directly.
 *   Returns undefined.
 */
export async function ttsSpeak(
  text: string,
  settings: TtsSettings,
  signal?: AbortSignal,
): Promise<Blob | undefined> {
  // Stop any ongoing playback
  ttsStop()

  const provider = getTtsProvider(settings.provider)
  if (!provider)
    throw new TtsError(`Unknown TTS provider: ${settings.provider}`, 'not_found')

  if (provider.canGenerateBlob && provider.generate) {
    const baseURL = settings.provider === 'custom'
      ? settings.customBaseURL
      : (provider.baseURL || '')

    const blob = await provider.generate({
      text,
      voice: settings.voice,
      model: settings.model,
      speed: settings.speed,
      apiKey: settings.apiKey,
      baseURL,
      signal,
    })

    // Play the generated audio
    const audio = new Audio(URL.createObjectURL(blob))
    currentAudio = audio

    const playPromise = new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
    })

    await audio.play()
    await playPromise

    // Cleanup
    URL.revokeObjectURL(audio.src)
    currentAudio = null

    return blob
  }
  else if (provider.play) {
    const control = provider.play({
      text,
      voice: settings.voice,
      speed: settings.speed,
    })
    currentPlayback = control
    await control.onEnd
    currentPlayback = null
    return undefined
  }

  throw new TtsError(`Provider ${settings.provider} has no generate or play method`, 'api_error')
}

/**
 * Play an audio Blob directly (for cached TTS audio).
 * Returns a Promise that resolves when playback ends.
 */
export async function ttsPlayBlob(blob: Blob): Promise<void> {
  ttsStop()

  const audio = new Audio(URL.createObjectURL(blob))
  currentAudio = audio

  const playPromise = new Promise<void>((resolve) => {
    audio.onended = () => resolve()
    audio.onerror = () => resolve()
  })

  await audio.play()
  await playPromise

  URL.revokeObjectURL(audio.src)
  currentAudio = null
}

/**
 * Stop any currently playing TTS audio.
 */
export function ttsStop(): void {
  if (currentPlayback) {
    currentPlayback.stop()
    currentPlayback = null
  }
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    URL.revokeObjectURL(currentAudio.src)
    currentAudio = null
  }
  // Also cancel any ongoing Web Speech
  if (typeof speechSynthesis !== 'undefined')
    speechSynthesis.cancel()
}

/**
 * Check if TTS is currently playing.
 */
export function ttsIsPlaying(): boolean {
  return currentPlayback !== null || (currentAudio !== null && !currentAudio.paused)
}

// --- Error type ---

export type TtsErrorType = 'auth' | 'rate_limit' | 'not_found' | 'api_error' | 'network'

export class TtsError extends Error {
  type: TtsErrorType

  constructor(message: string, type: TtsErrorType) {
    super(message)
    this.name = 'TtsError'
    this.type = type
  }
}
