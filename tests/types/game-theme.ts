import type { AdvConfig, AdvThemeConfig, GameUiTokens, ThemeConfig } from '@advjs/types'
import { defineThemeConfig } from '../../packages/advjs/node/config'

interface PaperTheme extends ThemeConfig {
  paper?: { grain: boolean }
}

export const theme = defineThemeConfig<PaperTheme>({
  ui: { colorScheme: 'dark', tokens: { '--adv-choice-bg': '#222', '--adv-theme-paper': 'none' } },
  paper: { grain: true },
})
export const compatible: AdvThemeConfig = theme
export const config: Partial<AdvConfig> = { themeConfig: compatible }
export const inherited = defineThemeConfig({ ui: { colorScheme: 'light' }, custom: { nested: true } })
export const inferredCustomValue: boolean | undefined = inherited.custom?.nested

interface LegacyTheme { audio?: { volume: number } }
export const legacy = defineThemeConfig<LegacyTheme>({ audio: { volume: 0 }, ui: { colorScheme: 'dark' } })

// @ts-expect-error Invalid color schemes cannot enter the public contract.
export const badScheme: ThemeConfig = { ui: { colorScheme: 'sepia' } }
// @ts-expect-error Game UI must not configure AGUI tokens.
export const badEditorToken: GameUiTokens = { '--agui-c-bg': '#fff' }
// @ts-expect-error Studio tokens are not game tokens despite their legacy prefix.
export const badStudioToken: GameUiTokens = { '--adv-color-primary': '#fff' }
// @ts-expect-error Token values must be CSS strings with units where appropriate.
export const badValue: GameUiTokens = { '--adv-choice-radius': 4 }
// @ts-expect-error The helper must enforce known UI fields without explicit generics.
export const badHelper = defineThemeConfig({ ui: { colorScheme: 'sepia' } })
// @ts-expect-error Generic inference must not admit editor tokens alongside valid game tokens.
export const badMixedHelper = defineThemeConfig({ ui: { tokens: { '--adv-choice-bg': '#222', '--agui-c-bg': 'red' } } })
// @ts-expect-error Theme-specific configuration keeps its declared type.
export const badExtension = defineThemeConfig<PaperTheme>({ paper: { grain: 'yes' } })
