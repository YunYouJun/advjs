import type { HighlighterCore } from 'shiki/core'
import type { SourceLines } from '../data/source-roles'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import advGrammar from '../../../../../../packages/parser/syntaxes/adv.tmLanguage.json'
import { toSourceLines } from '../data/source-roles'

/** Only scope names matter here: roles come from the shared palette, not from a theme's colours. */
const theme = { name: 'adv-roles', type: 'dark' as const, fg: '#ffffff', bg: '#000000', settings: [] }

let loading: Promise<HighlighterCore> | undefined

function load() {
  return loading ??= createHighlighterCore({
    themes: [theme],
    langs: [
      import('shiki/langs/markdown.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/json.mjs'),
      advGrammar as any,
    ],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
}

/** Highlights a project file into the same role-tagged lines the build-time explorer uses. */
export async function highlight(path: string, source: string): Promise<SourceLines> {
  const highlighter = await load()
  const { tokens } = highlighter.codeToTokens(source.trimEnd(), {
    lang: path.endsWith('.json') ? 'json' : 'adv',
    theme: theme.name,
    includeExplanation: 'scopeName',
  })
  return toSourceLines(tokens)
}
