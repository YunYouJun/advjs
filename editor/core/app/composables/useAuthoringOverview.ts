import { useEditorPluginContext } from '@advjs/editor-sdk'
import { computed } from 'vue'
import { contextSections, contextStats } from '../extensions/builtin/context'

export interface ChapterProgress { name: string, status: 'completed' | 'draft' | 'pending' }
export interface AuthoringCharacter { name: string, role: string, description: string }

function cells(line: string) {
  return line.trim().replace(/^\|/u, '').replace(/\|$/u, '').split('|').map(cell => cell.trim())
}

export function chapterProgress(readme: string): ChapterProgress[] {
  return readme.split('\n').filter(line => /[✅📝⏳]/u.test(line)).map(line => ({
    name: line.includes('|') ? cells(line)[0] : line.trim(),
    status: line.includes('✅') ? 'completed' : line.includes('📝') ? 'draft' : 'pending',
  }))
}

export function authoringCharacters(readme: string): AuthoringCharacter[] {
  const lines = readme.split('\n')
  return lines.flatMap((line, index) => {
    if (!line.includes('|'))
      return []
    const row = cells(line)
    const separator = (text: string) => cells(text).every(cell => /^:?-+:?$/u.test(cell))
    if (row.length < 4 || separator(line) || separator(lines[index + 1] ?? ''))
      return []
    return [{ name: row[0], role: row[2], description: row[3] }]
  })
}

export function useAuthoringOverview() {
  const ctx = useEditorPluginContext()
  const project = ctx.project.current
  const sections = computed(() => contextSections(project.value))
  const read = (id: string) => sections.value.find(section => section.id === id)?.content ?? ''
  const chapters = computed(() => chapterProgress(read('chapters')))
  return {
    project,
    zh: computed(() => ctx.locale.value === 'zh-CN'),
    chapters,
    characters: computed(() => authoringCharacters(read('characters'))),
    stats: computed(() => contextStats(project.value)),
    hasWorld: computed(() => Boolean(read('world'))),
  }
}
