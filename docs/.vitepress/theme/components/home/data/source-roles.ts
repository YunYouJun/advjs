// Maps TextMate scopes to the shared ADV palette roles, so the home page highlights source the
// same way at build time (`stories.data.ts`) and in the browser (AI mode).
import advPalette from '../../../../../../packages/parser/syntaxes/adv.palette.json'

export interface SourceToken {
  text: string
  /** palette role, or `key` / `str` for the YAML frontmatter */
  role?: string
}

export type SourceLines = SourceToken[][]

const selectors: [selector: string, role: string][] = [
  ...Object.entries(advPalette.roles).flatMap(([role, { scopes }]) => scopes.map(scope => [scope, role] as [string, string])),
  // Frontmatter is embedded YAML; the palette leaves it to the code theme.
  ['entity.name.tag.yaml', 'key'],
  ['string', 'str'],
  ['punctuation.separator.key-value.mapping.yaml', 'muted'],
  ['support.type.property-name.json', 'key'],
  ['constant.numeric', 'num'],
  ['constant.language', 'num'],
  ['punctuation.separator.dictionary', 'muted'],
  ['punctuation.definition.dictionary', 'muted'],
  ['punctuation.definition.array', 'muted'],
  ['punctuation.separator.array', 'muted'],
]

const matches = (scope: string, selector: string) => scope === selector || scope.startsWith(`${selector}.`)

/** Innermost scope first; among selectors matching one scope, the longest wins (TextMate rules). */
export function roleOf(stack: string[]): string | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    let best: [string, string] | undefined
    for (const entry of selectors) {
      if (matches(stack[i], entry[0]) && (!best || entry[0].length > best[0].length))
        best = entry
    }
    if (best)
      return best[1]
  }
}

/** Shiki's tokens with scope explanations → lines of role-tagged tokens, adjacent equal roles merged. */
export function toSourceLines(lines: { content: string, explanation?: { content: string, scopes: { scopeName: string }[] }[] }[][]): SourceLines {
  return lines.map((line) => {
    const out: SourceToken[] = []
    for (const piece of line.flatMap(token => token.explanation ?? [{ content: token.content, scopes: [] }])) {
      const role = roleOf(piece.scopes.map(s => s.scopeName))
      const last = out.at(-1)
      if (last && last.role === role)
        last.text += piece.content
      else
        out.push({ text: piece.content, role })
    }
    return out
  })
}
