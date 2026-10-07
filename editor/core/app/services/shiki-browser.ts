import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import json from 'shiki/langs/json.mjs'
import { flattenJsonHighlightTokens, JSON_HIGHLIGHT_THEME } from '../../../../packages/shared/json-highlight'

const highlighter = createHighlighterCore({
  langs: [json],
  themes: [JSON_HIGHLIGHT_THEME],
  engine: createJavaScriptRegexEngine(),
})

export async function highlightBrowserJson(code: string) {
  const result = (await highlighter).codeToTokens(code, { lang: 'json', theme: JSON_HIGHLIGHT_THEME.name })
  return flattenJsonHighlightTokens(code, result.tokens)
}
