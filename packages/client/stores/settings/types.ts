import type { UseSpeechSynthesisOptions } from '@vueuse/core'

export interface SettingOptions {
  text: TextOptions
  play: {
    mdUrl: string
  }
  speech: boolean
  speechOptions: UseSpeechSynthesisOptions
  animation: {
    duration: number
  }
}

export type DisplayMode = 'type' | 'soft'
export type DisplaySpeed = 'normal' | 'fast' | 'slow' | 'very_fast'
export type DisplayFontSize = 'xl' | '2xl' | '3xl' | '4xl'

export interface TextOptions {
  curFontSize: DisplayFontSize
  curDisplayMode: DisplayMode
  curSpeed: DisplaySpeed
}
