import type { MarkdownOptions } from 'vitepress'
import advPalette from '../../../packages/parser/syntaxes/adv.palette.json'
import advGrammar from '../../../packages/parser/syntaxes/adv.tmLanguage.json'

type ShikiSetup = NonNullable<MarkdownOptions['shikiSetup']>
type Highlighter = Parameters<ShikiSetup>[0]
type TokenColor = ReturnType<Highlighter['getTheme']>['settings'][number]
type Role = keyof typeof advPalette.roles

/**
 * AdvScript (`.adv.md`) grammar, highlighted with ```adv fences.
 */
export const advLanguage = advGrammar as unknown as NonNullable<MarkdownOptions['languages']>[number]

/**
 * Token colours from the shared ADV palette (packages/parser/syntaxes/adv.palette.json),
 * so docs, the home page demo and the editors colour scripts the same way.
 */
function advTokenColors(scheme: 'light' | 'dark', fg: string): TokenColor[] {
  const colors: Partial<Record<Role, string>> = advPalette.palettes[scheme]
  return (Object.entries(advPalette.roles) as [Role, { scopes: string[], fontStyle?: string }][])
    .map(([role, { scopes, fontStyle }]) => ({
      scope: scopes,
      settings: { foreground: colors[role] ?? fg, fontStyle: fontStyle ?? '' },
    }))
}

/**
 * The stock code themes have no rules that tell scenes, speakers, choices and
 * anchors apart, so layer the ADV palette over every loaded theme.
 */
export const highlightAdvScripts: ShikiSetup = async (highlighter) => {
  for (const name of highlighter.getLoadedThemes()) {
    const theme = highlighter.getTheme(name)
    const scheme = theme.type === 'light' ? 'light' : 'dark'
    await highlighter.loadTheme({
      ...theme,
      settings: [...theme.settings, ...advTokenColors(scheme, theme.fg)],
    })
  }
}
