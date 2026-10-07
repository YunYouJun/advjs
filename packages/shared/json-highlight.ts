export interface JsonHighlightToken {
  content: string
  color?: string
}

interface SourceToken extends JsonHighlightToken {
  offset: number
  variants?: Record<string, { color?: string }>
  htmlStyle?: { color?: string }
}

export const MAX_JSON_HIGHLIGHT_LENGTH = 32_768

/** Map a bundled theme's semantic scopes back to AGUI's theme-independent colors. */
export function createJsonHighlightPalette(theme: {
  tokenColors?: Array<{ scope?: string | string[], settings: { foreground?: string } }>
}) {
  const palette = new Map<string, string>()
  const roles: Record<string, string[]> = {
    key: ['meta.property-name', 'punctuation.support.type.property-name'],
    string: ['string', 'punctuation.definition.string'],
    number: ['constant.numeric'],
    literal: ['constant.language'],
    punctuation: ['punctuation'],
  }
  for (const [role, scopes] of Object.entries(roles)) {
    for (const setting of theme.tokenColors ?? []) {
      const settingScopes = typeof setting.scope === 'string' ? [setting.scope] : setting.scope ?? []
      if (setting.settings.foreground && settingScopes.some(scope => scopes.includes(scope)))
        palette.set(setting.settings.foreground.toLowerCase(), `var(--agui-c-syntax-${role})`)
    }
  }
  return palette
}

/** CSS variables let cached tokens follow the host theme without re-tokenizing. */
export const JSON_HIGHLIGHT_THEME = {
  name: 'advjs-json',
  colors: {
    'editor.foreground': 'var(--agui-c-syntax-punctuation)',
    'editor.background': 'transparent',
  },
  settings: [
    { scope: 'string', settings: { foreground: 'var(--agui-c-syntax-string)' } },
    { scope: 'support.type.property-name.json', settings: { foreground: 'var(--agui-c-syntax-key)' } },
    { scope: 'constant.numeric', settings: { foreground: 'var(--agui-c-syntax-number)' } },
    { scope: 'constant.language', settings: { foreground: 'var(--agui-c-syntax-literal)' } },
    { scope: ['punctuation.separator', 'punctuation.section'], settings: { foreground: 'var(--agui-c-syntax-punctuation)' } },
  ],
}

export function canHighlightJson(code: string) {
  if (!code.trim() || code.length > MAX_JSON_HIGHLIGHT_LENGTH)
    return false
  try {
    JSON.parse(code)
    return true
  }
  catch {
    return false
  }
}

/** Preserve original whitespace, including CRLF and trailing newlines. */
export function flattenJsonHighlightTokens(
  code: string,
  lines: readonly (readonly SourceToken[])[],
  resolveColor: (color: string | undefined) => string | undefined = color => color,
): JsonHighlightToken[] {
  const result: JsonHighlightToken[] = []
  let offset = 0
  for (const token of lines.flat()) {
    if (token.offset > offset)
      result.push({ content: code.slice(offset, token.offset) })
    result.push({ content: token.content, color: resolveColor(token.color ?? token.variants?.light?.color ?? token.htmlStyle?.color) })
    offset = token.offset + token.content.length
  }
  if (offset < code.length)
    result.push({ content: code.slice(offset) })
  return result
}
