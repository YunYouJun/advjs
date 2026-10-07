import type { ShikiServiceApi } from '@devframes/service-shiki'
import theme from 'shiki/themes/vitesse-light.mjs'
import { canHighlightJson, createJsonHighlightPalette, flattenJsonHighlightTokens } from '../../shared/json-highlight'

const palette = createJsonHighlightPalette(theme)

/** Bound input and adapt the host's shared Shiki tokens to AGUI semantics. */
export async function highlightDevToolsJson(service: ShikiServiceApi | undefined, code: unknown) {
  if (!service || typeof code !== 'string' || !canHighlightJson(code))
    return undefined
  const result = await service.codeToTokens({
    code,
    lang: 'json',
    // Keep the semantic palette stable when another Hub plugin merges service themes.
    themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
  })
  return flattenJsonHighlightTokens(code, result.tokens, color => palette.get(color?.toLowerCase() ?? '') ?? 'var(--agui-c-syntax-punctuation)')
}
