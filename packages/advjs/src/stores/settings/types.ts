import type { SpeechSynthesisOptions } from './useSpeech'

export interface SettingOptions {
  isFullscreen: boolean
  text: TextOptions
  play: {
    mdUrl: string
  }
  speech: SpeechSynthesisOptions
}

export type DisplayMode = 'type' | 'soft'
export type DisplaySpeed = 'normal' | 'fast' | 'slow'
export type DisplayFontSize = 'xl' | '2xl' | '3xl'

export interface TextOptions {
  curFontSize: DisplayFontSize
  curDisplayMode: DisplayMode
  curSpeed: DisplaySpeed
}
