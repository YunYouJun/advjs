/** Public game UI tokens. Editor chrome uses --agui-* independently. */
export const gameUiTokenNames = [
  '--adv-c-primary',
  '--adv-c-primary-light',
  '--adv-c-text',
  '--adv-c-text-1',
  '--adv-c-text-2',
  '--adv-c-text-3',
  '--adv-c-bg',
  '--adv-c-bg-alt',
  '--adv-font-family',
  '--adv-font-serif',
  '--adv-c-focus',
  '--adv-control-color',
  '--adv-control-hover-bg',
  '--adv-control-hover-border',
  '--adv-control-active-bg',
  '--adv-control-active-color',
  '--adv-control-radius',
  '--adv-tooltip-bg',
  '--adv-tooltip-border',
  '--adv-dialog-bg',
  '--adv-dialog-color',
  '--adv-dialog-name-color',
  '--adv-dialog-text-shadow',
  '--adv-choice-bg',
  '--adv-choice-hover-bg',
  '--adv-choice-color',
  '--adv-choice-border',
  '--adv-choice-radius',
  '--adv-end-bg',
  '--adv-end-color',
  '--adv-end-font-family',
  '--adv-end-font-size',
  '--adv-end-font-weight',
  '--adv-end-letter-spacing',
  '--adv-end-text-shadow',
  '--adv-end-padding',
  '--adv-end-align-items',
  '--adv-end-justify-content',
  '--adv-modal-opacity',
  '--adv-modal-bg-color',
  '--adv-modal-motion-duration',
  '--adv-save-border-color',
  '--adv-save-card-bg',
  '--adv-save-card-radius',
  '--adv-save-card-shadow',
  '--adv-save-card-shadow-hover',
  '--adv-save-control-radius',
  '--adv-save-motion-duration',
] as const

export type GameUiToken = typeof gameUiTokenNames[number] | `--adv-theme-${string}`
export type GameUiTokens = Partial<Record<GameUiToken, string>>

export interface GameUiTheme {
  /** Omit to inherit the host's existing color scheme. Never changes html.dark. */
  colorScheme?: 'light' | 'dark'
  /** Applied only to this game's container; custom tokens use --adv-theme-*. */
  tokens?: GameUiTokens
  /** Default ending content. Override AdvEnd or the AdvGame end slot for custom layouts. */
  end?: {
    /** Plain text; an empty string hides the default label. Defaults to "- END -". */
    text?: string
  }
}

/** Extend this interface in a theme package to type its own configuration. */
export interface ThemeConfig {
  ui?: GameUiTheme
  /** Theme-specific options stay unknown until a concrete theme declares them. */
  [key: string]: unknown
}
