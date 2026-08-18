import type { AdvProjectFileMap } from '@advjs/types'
import type { AgentCapabilityId } from '../core/contracts'
import type { AgentCapabilityInputMap } from './catalog'

const WORLD_PATH = 'adv/world.md'
const OUTLINE_PATH = 'adv/outline.md'
const CHARACTER_PATH_RE = /^adv\/characters\/([\w.-]+)\.character\.md$/

export function toManagedChapterPath(filename: string): string {
  const normalized = filename.trim()
    .replace(/^adv\/chapters\//, '')
    .replace(/\.adv\.md$/, '')
  if (!/^[\w.-]+$/.test(normalized) || normalized.includes('..'))
    throw new TypeError('Chapter filename is not safe for managed authoring.')
  return `adv/chapters/${normalized}.adv.md`
}

/** Select only the project files a capability is allowed to send to Runtime. */
export function selectManagedAgentProjectFiles<K extends AgentCapabilityId>(
  capability: K,
  input: AgentCapabilityInputMap[K],
  files: Readonly<AdvProjectFileMap>,
): AdvProjectFileMap {
  const selected: AdvProjectFileMap = {}
  const chapterPath = 'chapterPath' in input ? input.chapterPath : undefined
  const roleplayIds = capability === 'simulate-roleplay'
    ? new Set((input as AgentCapabilityInputMap['simulate-roleplay']).characterIds)
    : undefined

  for (const [path, content] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right, 'en'))) {
    if (path === WORLD_PATH || path === OUTLINE_PATH) {
      selected[path] = content
      continue
    }
    const character = CHARACTER_PATH_RE.exec(path)
    if (character && (!roleplayIds || roleplayIds.has(character[1]))) {
      selected[path] = content
      continue
    }
    if (chapterPath && path === chapterPath)
      selected[path] = content
  }

  if (chapterPath && selected[chapterPath] === undefined)
    throw new TypeError('The chapter must be saved before managed authoring can use it.')
  if (capability === 'simulate-roleplay' && roleplayIds?.size) {
    const availableIds = new Set(Object.keys(selected).flatMap(path => CHARACTER_PATH_RE.exec(path)?.[1] ?? []))
    if ([...roleplayIds].some(id => !availableIds.has(id)))
      throw new TypeError('Every selected character must be saved before roleplay can run.')
  }
  return selected
}
