import type { UseSpeechSynthesisOptions } from '@vueuse/core'

export interface SettingOptions {
  dialogBar?: DialogBarMode
  /** Older saved settings may omit it; read through `useSkipPreference()`. */
  skip?: SkipMode
  text: TextOptions
  play: {
    mdUrl: string
  }
  speech: boolean
  speechOptions: UseSpeechSynthesisOptions
  animation: {
    duration: number
    motion: MotionPreference
  }
}

export type DialogBarMode = 'always' | 'auto' | 'collapsed'

/** `read` stops skipping at the first line never read in any playthrough. */
export type SkipMode = 'read' | 'all'

export type MotionPreference = 'full' | 'reduced' | 'none'

export type DisplayMode = 'type' | 'soft'
export type DisplaySpeed = 'normal' | 'fast' | 'slow' | 'very_fast'
export type DisplayFontSize = 'xl' | '2xl' | '3xl' | '4xl'

export interface TextOptions {
  curFontSize: DisplayFontSize
  curDisplayMode: DisplayMode
  curSpeed: DisplaySpeed
}
