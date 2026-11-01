import type { GameUiTokenName } from './theme'

/**
 * Machine-readable contract for `ThemeConfig.ui.tokens`.
 *
 * Defaults mirror the fallbacks in `packages/client` and the bundled themes'
 * stylesheets; keep them in sync when a consumer changes.
 */

/** CSS value grammar a token expects. `paint` also accepts gradients. */
export type GameUiTokenKind
  = | 'color'
    | 'paint'
    | 'length'
    | 'font-family'
    | 'font-weight'
    | 'shadow'
    | 'duration'
    | 'number'
    | 'keyword'

export type GameUiTokenGroup
  = | 'base'
    | 'typography'
    | 'focus'
    | 'controls'
    | 'tooltip'
    | 'dialog'
    | 'choice'
    | 'end'
    | 'modal'
    | 'save'

export const bundledGameThemes = ['default', 'pominis', 'starter'] as const
export type BundledGameTheme = typeof bundledGameThemes[number]

export interface GameUiSchemeValue {
  light: string
  dark: string
}

export interface GameUiTokenSpec {
  kind: GameUiTokenKind
  group: GameUiTokenGroup
  description: string
  /** Components or selectors that read the token. */
  consumers: readonly string[]
  /** Client fallback. `var()` references resolve against other tokens. */
  default: string | GameUiSchemeValue
  /** Values a bundled theme declares instead of the client fallback. */
  themes?: Partial<Record<BundledGameTheme, string>>
}

const serifStack = '\'ZCOOL XiaoWei\', \'Songti SC\', \'Noto Serif SC\', STZhongsong, STKaiti, KaiTi, Roboto, ui-serif, Georgia, Cambria, \'Times New Roman\', Times, serif'

export const gameUiTokenContract: Record<GameUiTokenName, GameUiTokenSpec> = {
  '--adv-c-primary': {
    kind: 'color',
    group: 'base',
    description: 'Brand accent for pressed controls, active tabs, pagination and the default focus ring.',
    consumers: ['control-button', 'AdvMenuPanelTabTitle', 'SavePagination', 'DialogBarSettings'],
    default: '#0078e7',
  },
  '--adv-c-primary-light': {
    kind: 'color',
    group: 'base',
    description: 'Translucent accent wash behind the current save page.',
    consumers: ['SavePagination'],
    default: 'rgba(0, 120, 231, 0.1)',
  },
  '--adv-c-text': {
    kind: 'color',
    group: 'base',
    description: 'Default text colour of the game container, menus, tooltips and save cards.',
    consumers: ['[data-adv-ui="game"]', 'GameControlHint', 'SavedCard'],
    default: { light: '#000', dark: '#fff' },
  },
  '--adv-c-text-1': {
    kind: 'color',
    group: 'base',
    description: 'Primary body text on panel surfaces.',
    consumers: ['menus'],
    default: { light: 'rgba(60, 60, 67)', dark: 'rgba(255, 255, 245, 0.86)' },
  },
  '--adv-c-text-2': {
    kind: 'color',
    group: 'base',
    description: 'Secondary text, such as tooltip descriptions.',
    consumers: ['GameControlHint'],
    default: { light: 'rgba(60, 60, 67, 0.78)', dark: 'rgba(235, 235, 245, 0.6)' },
  },
  '--adv-c-text-3': {
    kind: 'color',
    group: 'base',
    description: 'Muted metadata, such as save timestamps and empty slot labels.',
    consumers: ['SavedCard'],
    default: { light: 'rgba(60, 60, 67, 0.56)', dark: 'rgba(235, 235, 245, 0.38)' },
  },
  '--adv-c-bg': {
    kind: 'color',
    group: 'base',
    description: 'Game container and title screen background behind the scene art.',
    consumers: ['AdvThemeScope', 'start layout'],
    default: { light: 'rgba(255, 255, 255, 0.9)', dark: 'rgba(0, 0, 0, 0.9)' },
  },
  '--adv-c-bg-alt': {
    kind: 'color',
    group: 'base',
    description: 'Raised surface for tooltips and save cards.',
    consumers: ['GameControlHint', 'SavedCard'],
    default: { light: '#f6f6f7', dark: '#161618' },
  },
  '--adv-font-family': {
    kind: 'font-family',
    group: 'typography',
    description: 'Body font stack for every game surface. Always end with a generic family.',
    consumers: ['[data-adv-ui="game"]', 'settings', 'GameControlHint', 'AdvGlossaryModal'],
    default: 'inherit',
  },
  '--adv-font-serif': {
    kind: 'font-family',
    group: 'typography',
    description: 'Display serif used by theme menus and titles.',
    consumers: ['theme menu.scss'],
    default: 'serif',
    themes: { default: serifStack, pominis: serifStack },
  },
  '--adv-c-focus': {
    kind: 'color',
    group: 'focus',
    description: 'Keyboard focus outline for every focusable control in the game. Must stay visible on all surfaces.',
    consumers: ['game-ui.scss', 'control-button', 'slider', 'PrintWords'],
    default: 'var(--adv-c-primary)',
  },
  '--adv-control-color': {
    kind: 'color',
    group: 'controls',
    description: 'Text and icon colour of the dialog control bar and top icon buttons.',
    consumers: ['DialogControls', 'GameIconButton', 'QuickSaveControls'],
    default: 'inherit',
  },
  '--adv-control-hover-bg': {
    kind: 'paint',
    group: 'controls',
    description: 'Hover and focus background of player controls.',
    consumers: ['control-button', 'AdvCheckbox'],
    default: 'rgb(255 255 255 / 10%)',
  },
  '--adv-control-hover-border': {
    kind: 'color',
    group: 'controls',
    description: 'Hover border of player controls.',
    consumers: ['control-button'],
    default: 'color-mix(in srgb, currentColor 20%, transparent)',
  },
  '--adv-control-active-bg': {
    kind: 'paint',
    group: 'controls',
    description: 'Pressed and toggled-on background of player controls and tabs.',
    consumers: ['control-button', 'AdvMenuPanelTabTitle', 'AdvTextButton'],
    default: 'rgb(255 255 255 / 18%)',
  },
  '--adv-control-active-color': {
    kind: 'color',
    group: 'controls',
    description: 'Text colour of toggled-on controls such as auto and skip.',
    consumers: ['control-button'],
    default: 'var(--adv-c-primary)',
  },
  '--adv-control-radius': {
    kind: 'length',
    group: 'controls',
    description: 'Corner radius of player controls, sliders and (by default) save controls.',
    consumers: ['control-button', 'slider'],
    default: '4px',
  },
  '--adv-tooltip-bg': {
    kind: 'color',
    group: 'tooltip',
    description: 'Control hint background.',
    consumers: ['GameControlHint'],
    default: 'var(--adv-c-bg-alt)',
  },
  '--adv-tooltip-border': {
    kind: 'color',
    group: 'tooltip',
    description: 'Control hint border.',
    consumers: ['GameControlHint'],
    default: 'color-mix(in srgb, var(--adv-c-text) 16%, transparent)',
  },
  '--adv-dialog-bg': {
    kind: 'paint',
    group: 'dialog',
    description: 'Dialogue box background. Gradients are allowed; text sits on the opaque part.',
    consumers: ['AdvDialogBox'],
    default: 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.75) 35%, black) no-repeat bottom',
  },
  '--adv-dialog-color': {
    kind: 'color',
    group: 'dialog',
    description: 'Dialogue and narration text colour.',
    consumers: ['AdvDialogBox', 'DialogControls'],
    default: 'white',
  },
  '--adv-dialog-name-color': {
    kind: 'color',
    group: 'dialog',
    description: 'Speaker name colour.',
    consumers: ['AdvDialogBox'],
    default: '#e5e7eb',
  },
  '--adv-dialog-text-shadow': {
    kind: 'shadow',
    group: 'dialog',
    description: 'Text shadow of dialogue text; use `none` on light, opaque dialog boxes.',
    consumers: ['AdvDialogBox', 'DialogControls'],
    default: '0 0 0.2rem black',
  },
  '--adv-choice-bg': {
    kind: 'paint',
    group: 'choice',
    description: 'Choice button background.',
    consumers: ['AdvChoice'],
    default: 'rgb(0 0 0 / 80%)',
  },
  '--adv-choice-hover-bg': {
    kind: 'paint',
    group: 'choice',
    description: 'Choice button background on hover.',
    consumers: ['AdvChoice'],
    default: 'rgb(59 130 246 / 80%)',
  },
  '--adv-choice-color': {
    kind: 'color',
    group: 'choice',
    description: 'Choice button text colour. Declare it whenever you change the choice backgrounds.',
    consumers: ['AdvChoice'],
    default: 'inherit',
  },
  '--adv-choice-border': {
    kind: 'color',
    group: 'choice',
    description: 'Choice button border and narrow-layout scrollbar colour.',
    consumers: ['AdvChoice'],
    default: 'white',
  },
  '--adv-choice-radius': {
    kind: 'length',
    group: 'choice',
    description: 'Choice button corner radius.',
    consumers: ['AdvChoice'],
    default: '0',
  },
  '--adv-end-bg': {
    kind: 'paint',
    group: 'end',
    description: 'Ending screen background.',
    consumers: ['AdvEnd'],
    default: 'rgb(0 0 0 / 60%)',
  },
  '--adv-end-color': {
    kind: 'color',
    group: 'end',
    description: 'Ending screen text colour.',
    consumers: ['AdvEnd'],
    default: '#fff',
  },
  '--adv-end-font-family': {
    kind: 'font-family',
    group: 'end',
    description: 'Ending screen font stack.',
    consumers: ['AdvEnd'],
    default: 'var(--adv-font-family, inherit)',
  },
  '--adv-end-font-size': {
    kind: 'length',
    group: 'end',
    description: 'Ending text size; `cqw` follows the logical game canvas.',
    consumers: ['AdvEnd'],
    default: 'clamp(2rem, 8cqw, 6rem)',
  },
  '--adv-end-font-weight': {
    kind: 'font-weight',
    group: 'end',
    description: 'Ending text weight.',
    consumers: ['AdvEnd'],
    default: '700',
  },
  '--adv-end-letter-spacing': {
    kind: 'length',
    group: 'end',
    description: 'Ending text letter spacing.',
    consumers: ['AdvEnd'],
    default: 'normal',
  },
  '--adv-end-text-shadow': {
    kind: 'shadow',
    group: 'end',
    description: 'Ending text shadow.',
    consumers: ['AdvEnd'],
    default: 'none',
  },
  '--adv-end-padding': {
    kind: 'length',
    group: 'end',
    description: 'Ending screen padding (1–4 lengths).',
    consumers: ['AdvEnd'],
    default: '1.5rem',
  },
  '--adv-end-align-items': {
    kind: 'keyword',
    group: 'end',
    description: 'Vertical alignment of the ending text (flex `align-items`).',
    consumers: ['AdvEnd'],
    default: 'center',
  },
  '--adv-end-justify-content': {
    kind: 'keyword',
    group: 'end',
    description: 'Horizontal alignment of the ending text (flex `justify-content`).',
    consumers: ['AdvEnd'],
    default: 'center',
  },
  '--adv-modal-opacity': {
    kind: 'number',
    group: 'modal',
    description: 'Opacity (0–1) the default modal background uses.',
    consumers: ['css-vars.scss'],
    default: '0.9',
  },
  '--adv-modal-bg-color': {
    kind: 'color',
    group: 'modal',
    description: 'Background of the backlog, save, load and settings modals.',
    consumers: ['AdvModal'],
    default: { light: 'rgba(255, 255, 255, var(--adv-modal-opacity))', dark: 'rgba(0, 0, 0, var(--adv-modal-opacity))' },
  },
  '--adv-modal-motion-duration': {
    kind: 'duration',
    group: 'modal',
    description: 'Modal open and close duration. Reduced motion shortens it automatically.',
    consumers: ['AdvModal'],
    default: '180ms',
  },
  '--adv-save-border-color': {
    kind: 'color',
    group: 'save',
    description: 'Save card and pagination border.',
    consumers: ['SavedCard', 'SavePagination'],
    default: 'color-mix(in srgb, var(--adv-c-text) 16%, transparent)',
  },
  '--adv-save-card-bg': {
    kind: 'paint',
    group: 'save',
    description: 'Save card background.',
    consumers: ['SavedCard'],
    default: 'var(--adv-c-bg-alt)',
  },
  '--adv-save-card-radius': {
    kind: 'length',
    group: 'save',
    description: 'Save card corner radius.',
    consumers: ['SavedCard'],
    default: 'var(--adv-control-radius, 4px)',
  },
  '--adv-save-card-shadow': {
    kind: 'shadow',
    group: 'save',
    description: 'Save card box shadow.',
    consumers: ['SavedCard'],
    default: 'none',
  },
  '--adv-save-card-shadow-hover': {
    kind: 'shadow',
    group: 'save',
    description: 'Save card box shadow on hover.',
    consumers: ['SavedCard'],
    default: 'none',
  },
  '--adv-save-control-radius': {
    kind: 'length',
    group: 'save',
    description: 'Save pagination button radius.',
    consumers: ['SavePagination'],
    default: 'var(--adv-control-radius, 4px)',
  },
  '--adv-save-motion-duration': {
    kind: 'duration',
    group: 'save',
    description: 'Save card and pagination transition duration.',
    consumers: ['SavedCard', 'SavePagination'],
    default: '180ms',
  },
}

export type GameUiThemeTokenName = `--adv-theme-${string}`

/** `--adv-theme-*` tokens a bundled theme's own components read. */
export const bundledThemeTokenContract: Partial<Record<BundledGameTheme, Record<GameUiThemeTokenName, GameUiTokenSpec>>> = {
  default: {
    '--adv-theme-start-title-gap': {
      kind: 'length',
      group: 'base',
      description: 'Gap between the title block and the start menu.',
      consumers: ['pages/start.vue'],
      default: '36px',
    },
    '--adv-theme-start-title-size': {
      kind: 'length',
      group: 'typography',
      description: 'Game title size on the start screen.',
      consumers: ['pages/start.vue'],
      default: '30px',
    },
    '--adv-theme-start-title-color': {
      kind: 'color',
      group: 'base',
      description: 'Game title colour on the start screen.',
      consumers: ['pages/start.vue'],
      default: 'var(--adv-c-text)',
    },
    '--adv-theme-logo-color': {
      kind: 'color',
      group: 'base',
      description: 'Logo glyph colour on the start screen.',
      consumers: ['pages/start.vue'],
      default: { light: '#2563eb', dark: '#60a5fa' },
    },
    '--adv-theme-start-bg-filter': {
      kind: 'keyword',
      group: 'base',
      description: 'CSS filter on the default start-screen art (`none`, `invert(1)`, `sepia(0.6)`…).',
      consumers: ['layouts/start.vue'],
      default: { light: 'none', dark: 'invert(1)' },
    },
    '--adv-theme-start-menu-size': {
      kind: 'length',
      group: 'typography',
      description: 'Start menu label size.',
      consumers: ['components/start/StartMenu.vue'],
      default: '18px',
    },
    '--adv-theme-start-menu-color': {
      kind: 'color',
      group: 'controls',
      description: 'Start menu label colour.',
      consumers: ['components/start/StartMenu.vue'],
      default: 'var(--adv-c-text)',
    },
    '--adv-theme-start-menu-bg': {
      kind: 'paint',
      group: 'controls',
      description: 'Start menu button background.',
      consumers: ['components/start/StartMenu.vue'],
      default: 'color-mix(in srgb, var(--adv-c-bg-alt) 78%, transparent)',
    },
    '--adv-theme-start-menu-hover-bg': {
      kind: 'paint',
      group: 'controls',
      description: 'Start menu button background on hover and press.',
      consumers: ['components/start/StartMenu.vue'],
      default: 'color-mix(in srgb, var(--adv-c-primary) 12%, var(--adv-c-bg-alt))',
    },
    '--adv-theme-start-menu-hover-color': {
      kind: 'color',
      group: 'controls',
      description: 'Start menu label colour on hover.',
      consumers: ['components/start/StartMenu.vue'],
      default: 'var(--adv-c-text)',
    },
  },
}

export type GameUiContrastKind = 'text' | 'large-text' | 'non-text'

export interface GameUiContrastPair {
  id: string
  foreground: GameUiTokenName | GameUiThemeTokenName
  background: GameUiTokenName | GameUiThemeTokenName
  /** Only checked when the project uses this bundled theme. */
  theme?: BundledGameTheme
  /** WCAG 2.2 AA: 4.5 for body text, 3 for large text and focus indicators. */
  minRatio: number
  kind: GameUiContrastKind
  description: string
}

export const gameUiContrastPairs: readonly GameUiContrastPair[] = [
  { id: 'dialog-text', foreground: '--adv-dialog-color', background: '--adv-dialog-bg', minRatio: 4.5, kind: 'text', description: 'Dialogue text on the dialog box' },
  { id: 'dialog-name', foreground: '--adv-dialog-name-color', background: '--adv-dialog-bg', minRatio: 4.5, kind: 'text', description: 'Speaker name on the dialog box' },
  { id: 'choice-text', foreground: '--adv-choice-color', background: '--adv-choice-bg', minRatio: 4.5, kind: 'text', description: 'Choice text on the choice button' },
  { id: 'choice-hover-text', foreground: '--adv-choice-color', background: '--adv-choice-hover-bg', minRatio: 4.5, kind: 'text', description: 'Choice text on the hovered choice button' },
  { id: 'surface-text', foreground: '--adv-c-text', background: '--adv-c-bg', minRatio: 4.5, kind: 'text', description: 'Game text on the container and title screen' },
  { id: 'tooltip-text', foreground: '--adv-c-text', background: '--adv-tooltip-bg', minRatio: 4.5, kind: 'text', description: 'Control hint text on its background' },
  { id: 'save-card-text', foreground: '--adv-c-text', background: '--adv-save-card-bg', minRatio: 4.5, kind: 'text', description: 'Save card text on the save card' },
  { id: 'end-text', foreground: '--adv-end-color', background: '--adv-end-bg', minRatio: 3, kind: 'large-text', description: 'Ending text on the ending screen' },
  { id: 'focus-surface', foreground: '--adv-c-focus', background: '--adv-c-bg', minRatio: 3, kind: 'non-text', description: 'Focus outline against the game surface' },
  { id: 'focus-choice', foreground: '--adv-c-focus', background: '--adv-choice-bg', minRatio: 3, kind: 'non-text', description: 'Focus outline against a choice button' },
  { id: 'focus-dialog', foreground: '--adv-c-focus', background: '--adv-dialog-bg', minRatio: 3, kind: 'non-text', description: 'Focus outline against the dialog box and its control bar' },
  { id: 'start-menu-text', foreground: '--adv-theme-start-menu-color', background: '--adv-theme-start-menu-bg', minRatio: 4.5, kind: 'text', theme: 'default', description: 'Start menu labels on their buttons' },
  { id: 'start-menu-hover-text', foreground: '--adv-theme-start-menu-hover-color', background: '--adv-theme-start-menu-hover-bg', minRatio: 4.5, kind: 'text', theme: 'default', description: 'Start menu labels on hovered buttons' },
]

/** Contract entry for a public token, or a `--adv-theme-*` token the bundled theme reads. */
export function getGameUiTokenSpec(name: string, theme?: string): GameUiTokenSpec | undefined {
  return gameUiTokenContract[name as GameUiTokenName]
    ?? bundledThemeTokenContract[theme as BundledGameTheme]?.[name as GameUiThemeTokenName]
}

/** Client fallback, or the bundled theme's own value, for one colour scheme. */
export function resolveGameUiTokenDefault(name: GameUiTokenName | GameUiThemeTokenName, scheme: 'light' | 'dark', theme?: string): string | undefined {
  const spec = getGameUiTokenSpec(name, theme)
  if (!spec)
    return undefined
  const themed = theme && spec.themes?.[theme as BundledGameTheme]
  if (themed)
    return themed
  return typeof spec.default === 'string' ? spec.default : spec.default[scheme]
}
