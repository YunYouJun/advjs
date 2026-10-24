import type * as Monaco from 'monaco-editor'
import type { LanguageRegistration, ThemeRegistration } from 'shiki/core'
import type { StateStack } from 'shiki/textmate'
import advPalette from '../parser/syntaxes/adv.palette.json'

/** Monaco language id for `.adv.md`, matching the TextMate grammar name. */
export const ADV_LANGUAGE_ID = 'adv'

export const ADV_MONACO_THEMES = { light: 'adv-light', dark: 'adv-dark' } as const

type AdvRole = keyof typeof advPalette.roles
type AdvScheme = keyof typeof advPalette.palettes

/** Roles from the palette shared with the docs site. */
const ROLES = Object.entries(advPalette.roles) as [AdvRole, { scopes: string[], fontStyle?: string }][]

/** Monaco token per ADV role. The prefixes still read sensibly in themes without ADV rules. */
const ROLE_TOKENS: Record<AdvRole, string> = {
  scene: 'keyword.scene.adv',
  heading: 'strong.heading.adv',
  speaker: 'type.speaker.adv',
  status: 'type.status.adv',
  narration: 'comment.narration.adv',
  choice: 'string.choice.adv',
  anchor: 'variable.anchor.adv',
  muted: 'delimiter.adv',
}

/**
 * Frontmatter and option keys. Monaco's teal YAML keys read like speakers,
 * so ADV scripts get their own neutral token; plain `.yaml` files keep theirs.
 */
const YAML_KEY_TOKEN = 'key.yaml.adv'
const YAML_KEY_COLORS: Record<AdvScheme, string> = { light: '4b5563', dark: '9ca3af' }

/** Embedded Markdown and YAML, named like Monaco's own tokenizers name them. */
const BASE_TOKENS: { token: string, scope: string[] }[] = [
  { token: 'comment', scope: ['comment'] },
  { token: 'string.yaml', scope: ['string'] },
  { token: 'number', scope: ['constant.numeric'] },
  { token: 'keyword', scope: ['constant.language', 'keyword', 'storage'] },
  { token: YAML_KEY_TOKEN, scope: ['entity.name.tag.yaml'] },
  { token: 'keyword.md', scope: ['markup.heading'] },
  { token: 'strong.md', scope: ['markup.bold'] },
  { token: 'emphasis.md', scope: ['markup.italic'] },
  { token: 'variable.source.md', scope: ['markup.inline.raw'] },
  { token: 'string.link.md', scope: ['markup.underline.link', 'string.other.link'] },
]

const TOKEN_KINDS = [
  ...BASE_TOKENS,
  ...ROLES.map(([role, { scopes }]) => ({ token: ROLE_TOKENS[role], scope: scopes })),
]

function sentinel(index: number) {
  return `#${index.toString(16).padStart(6, '0')}`
}

/**
 * vscode-textmate resolves the palette's scope selectors the same way the docs
 * site's Shiki does. Give each token kind a sentinel color, then read the
 * token back from it. Later rules win ties, so ADV rules override the
 * embedded languages.
 */
const ADV_MONACO_TOKEN_THEME = {
  name: 'advjs-monaco-tokens',
  type: 'dark',
  fg: sentinel(0),
  bg: '#ffffff',
  settings: [
    { settings: { foreground: sentinel(0), background: '#ffffff' } },
    ...TOKEN_KINDS.map(({ scope }, index) => ({ scope, settings: { foreground: sentinel(index + 1) } })),
  ],
} satisfies ThemeRegistration

/** Map a color from `ADV_MONACO_TOKEN_THEME` back to its Monaco token. */
function advMonacoTokenForColor(color: string | undefined): string {
  const index = color ? Number.parseInt(color.slice(1), 16) : 0
  return index > 0 ? TOKEN_KINDS[index - 1]?.token ?? '' : ''
}

/** Roles without a palette color keep the theme foreground. */
export function advMonacoThemeRules(scheme: AdvScheme): Monaco.editor.ITokenThemeRule[] {
  const colors: Partial<Record<AdvRole, string>> = advPalette.palettes[scheme]
  return [
    ...ROLES.map(([role, { fontStyle }]) => {
      const color = colors[role]
      return { token: ROLE_TOKENS[role], ...color ? { foreground: color.slice(1) } : {}, fontStyle: fontStyle ?? '' }
    }),
    { token: YAML_KEY_TOKEN, foreground: YAML_KEY_COLORS[scheme] },
  ]
}

export function advMonacoTheme(dark: boolean): string {
  return dark ? ADV_MONACO_THEMES.dark : ADV_MONACO_THEMES.light
}

const MAX_LINE_LENGTH = 20_000
const TOKENIZE_TIME_LIMIT = 500

class AdvTokenizerState implements Monaco.languages.IState {
  constructor(readonly stack: StateStack) {}

  // TextMate rule stacks are immutable.
  clone() {
    return this
  }

  equals(other: Monaco.languages.IState) {
    return other instanceof AdvTokenizerState && (other.stack === this.stack || other.stack.equals(this.stack))
  }
}

/** Tokenize `.adv.md` with the shared TextMate grammar. */
export async function createAdvTokensProvider(): Promise<Monaco.languages.TokensProvider> {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, { EncodedTokenMetadata, INITIAL }, markdown, yaml, grammar] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/textmate'),
    import('shiki/langs/markdown.mjs'),
    import('shiki/langs/yaml.mjs'),
    import('../parser/syntaxes/adv.tmLanguage.json'),
  ])
  const highlighter = await createHighlighterCore({
    langs: [markdown.default, yaml.default, grammar.default as unknown as LanguageRegistration],
    themes: [ADV_MONACO_TOKEN_THEME],
    engine: createJavaScriptRegexEngine(),
  })
  const tokens = highlighter.setTheme(ADV_MONACO_TOKEN_THEME.name).colorMap.map(advMonacoTokenForColor)
  const adv = highlighter.getLanguage(ADV_LANGUAGE_ID)

  return {
    getInitialState: () => new AdvTokenizerState(INITIAL),
    tokenize(line, state) {
      if (line.length >= MAX_LINE_LENGTH)
        return { endState: state, tokens: [{ startIndex: 0, scopes: '' }] }
      const result = adv.tokenizeLine2(line, (state as AdvTokenizerState).stack, TOKENIZE_TIME_LIMIT)
      const lineTokens: Monaco.languages.IToken[] = []
      for (let i = 0; i < result.tokens.length; i += 2)
        lineTokens.push({ startIndex: result.tokens[i]!, scopes: tokens[EncodedTokenMetadata.getForeground(result.tokens[i + 1]!)] ?? '' })
      return { endState: new AdvTokenizerState(result.ruleStack), tokens: lineTokens }
    },
  }
}

const plainState: Monaco.languages.IState = { clone: () => plainState, equals: other => other === plainState }
const plainTokensProvider: Monaco.languages.TokensProvider = {
  getInitialState: () => plainState,
  tokenize: () => ({ endState: plainState, tokens: [] }),
}

const registered = new WeakSet<object>()

/**
 * Register the `adv` language and the `adv-light` / `adv-dark` themes, which
 * extend `vs` / `vs-dark`. Each Monaco instance is set up once; later calls
 * return false.
 */
export function registerAdvMonacoLanguage(monaco: typeof Monaco): boolean {
  if (registered.has(monaco.languages))
    return false
  registered.add(monaco.languages)
  monaco.languages.register({ id: ADV_LANGUAGE_ID, extensions: ['.adv.md'], aliases: ['ADV Script', 'advscript'] })
  // Shiki and the grammars load when the first `adv` model is tokenized.
  monaco.languages.registerTokensProviderFactory(ADV_LANGUAGE_ID, {
    create: () => createAdvTokensProvider().catch((error) => {
      console.error('[advjs] Failed to load the ADV grammar; showing plain text.', error)
      return plainTokensProvider
    }),
  })
  monaco.editor.defineTheme(ADV_MONACO_THEMES.light, { base: 'vs', inherit: true, rules: advMonacoThemeRules('light'), colors: {} })
  monaco.editor.defineTheme(ADV_MONACO_THEMES.dark, { base: 'vs-dark', inherit: true, rules: advMonacoThemeRules('dark'), colors: {} })
  return true
}
