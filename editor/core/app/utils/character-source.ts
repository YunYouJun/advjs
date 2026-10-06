import type { AdvCharacter, JsonValue } from '@advjs/types'
import { applyProjectPatches } from '@advjs/core'

const fields = ['id', 'name', 'avatar', 'imagePrompt', 'actor', 'cv', 'aliases', 'tags', 'faction', 'language', 'tachies', 'relationships', 'attributes'] as const
const sections = {
  appearance: ['外貌', 'appearance'],
  personality: ['性格', 'personality'],
  background: ['背景', 'background'],
  concept: ['理念', 'concept'],
  speechStyle: ['说话风格', 'speech style', 'speechstyle'],
  knowledgeDomain: ['知识领域', 'knowledge domain', 'knowledgedomain'],
  expertisePrompt: ['专业提示', 'expertise prompt', 'expertiseprompt'],
} as const

/** Patch known fields and sections while retaining unknown YAML and author prose. */
export function updateCharacterSource(path: string, original: string, character: AdvCharacter) {
  let content = applyProjectPatches({ [path]: original }, fields.map(key => ({
    kind: 'frontmatter-set' as const,
    path,
    key,
    value: character[key] as JsonValue | undefined,
  }))).files[path]
  for (const [field, labels] of Object.entries(sections)) {
    const value = character[field as keyof typeof sections]
    if (value === undefined)
      continue
    const headings = [...content.matchAll(/^##[ \t]+([^ \t\r\n].*)$/gmu)]
    const match = headings.find(heading => (labels as readonly string[]).includes(heading[1].trim().toLowerCase()))
    if (match) {
      const start = match.index! + match[0].length
      const end = headings.find(heading => heading.index! > match.index!)?.index ?? content.length
      content = `${content.slice(0, start)}\n\n${value.trim()}\n\n${content.slice(end)}`
    }
    else if (value.trim()) {
      content = `${content.trimEnd()}\n\n## ${labels[0]}\n\n${value.trim()}\n`
    }
  }
  return content
}
