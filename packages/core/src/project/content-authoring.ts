import type { LocationFormData, SceneFormData } from '@advjs/parser'
import type { AdvCharacter } from '@advjs/types'
import type { ProjectContentKind } from './content-index'
import { normalizeAudioLocale, validateCharacterVoiceProfile } from '@advjs/audio'
import {
  parseCharacterMd,
  parseLocationMd,
  parseSceneMd,
  stringifyCharacterMd,
  stringifyLocationMd,
  stringifySceneMd,
} from '@advjs/parser'
import { discoverProjectContentFiles, PROJECT_CONTENT_LOCATIONS } from './content-index'
import { parseCSV } from './csv-parser'
import { newKnowledgeEntry, parseKnowledgeEntry, updateKnowledgeTitle } from './knowledge'
import { PROJECT_SLUG_RE, toProjectSlug } from './slug'

export type ProjectEntryData = Record<string, unknown>
type StructuredKind = Exclude<ProjectContentKind, 'knowledge'>

export function readProjectEntry(kind: ProjectContentKind, path: string, source: string): ProjectEntryData {
  switch (kind) {
    case 'character': return { ...parseCharacterMd(source) }
    case 'scene': return { ...parseSceneMd(source) }
    case 'location': return { ...parseLocationMd(source) }
    case 'knowledge': {
      const { domain, title, content } = parseKnowledgeEntry(path, source)
      return { domain, name: title, content }
    }
  }
}

export function listProjectEntries(files: Readonly<Record<string, string>>, paths: readonly string[], kind: ProjectContentKind) {
  return discoverProjectContentFiles(paths, kind).map((path) => {
    try {
      if (!Object.hasOwn(files, path))
        throw new Error('Unreadable source')
      const data = readProjectEntry(kind, path, files[path])
      return { path, name: typeof data.name === 'string' ? data.name : path.split('/').at(-1) ?? path, data }
    }
    catch {
      return { path, name: path.split('/').at(-1) ?? path }
    }
  })
}

function stringifyEntry(kind: StructuredKind, data: ProjectEntryData, source?: string): string {
  switch (kind) {
    case 'character': return stringifyCharacterMd(data as unknown as AdvCharacter, { source })
    case 'scene': return stringifySceneMd(data as unknown as SceneFormData, { source })
    case 'location': return stringifyLocationMd(data as unknown as LocationFormData, { source })
  }
}

function entryPath(kind: StructuredKind, id: string) {
  const [directory, suffix] = PROJECT_CONTENT_LOCATIONS[kind]
  return `${directory}/${id}${suffix}`
}

function checkedName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /[\r\n]/u.test(value))
    throw new Error('Enter a name on one line')
  return value.trim()
}

export function createProjectEntry(kind: ProjectContentKind, data: ProjectEntryData) {
  const name = checkedName(data.name)
  if (kind === 'knowledge') {
    const entry = newKnowledgeEntry(typeof data.domain === 'string' ? data.domain.trim() : 'general', name, '')
    return { path: entry.file, text: entry.content }
  }
  const id = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : toProjectSlug(name)
  if (!PROJECT_SLUG_RE.test(id))
    throw new Error('Invalid content ID')
  return { path: entryPath(kind, id), text: stringifyEntry(kind, { id, name }) }
}

/** Change display names without changing stable IDs or moving the file. */
export function updateProjectEntry(kind: ProjectContentKind, path: string, source: string, changes: ProjectEntryData) {
  const original = readProjectEntry(kind, path, source)
  const data = { ...original, ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value ?? undefined])) }
  if (Object.hasOwn(changes, 'name'))
    data.name = checkedName(changes.name)
  if (kind === 'character' && data.voiceProfile && typeof data.voiceProfile === 'object' && !('intent' in data.voiceProfile))
    data.voiceProfile = { ...data.voiceProfile, intent: {} }
  const text = kind === 'knowledge'
    ? Object.hasOwn(changes, 'name') ? updateKnowledgeTitle((data.content ?? '') as string, data.name as string) : (data.content ?? '') as string
    : stringifyEntry(kind, { ...data, id: original.id }, source)
  readProjectEntry(kind, path, text)
  return { path, text }
}

export interface ProjectBatchRow {
  name: string
  status: 'created' | 'skipped' | 'overwritten' | 'renamed' | 'invalid'
  path?: string
  text?: string
  source?: string
}

const CSV_FIELDS = {
  character: ['tags', 'aliases', 'faction', 'personality', 'appearance', 'background', 'concept', 'speechStyle', 'imagePrompt', 'cv', 'actor', 'language'],
  scene: ['description', 'imagePrompt', 'type', 'tags', 'linkedLocation', 'src', 'assetId'],
} as const
const TAG_SEPARATOR = /\s*;\s*/u

/** Plan in input order so repeated IDs use the same conflict policy within one file. */
export function planProjectContentImport(
  kind: 'character' | 'scene',
  format: 'csv' | 'json',
  raw: string,
  strategy: 'skip' | 'overwrite' | 'rename',
  files: Record<string, string>,
  paths: readonly string[],
): ProjectBatchRow[] {
  const parsed: unknown = format === 'csv' ? parseCSV(raw) : JSON.parse(raw)
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  const occupiedPaths = new Map(paths.map(path => [path.toLowerCase(), path]))
  const occupiedIds = new Map<string, string>()
  const contents = new Map(Object.entries(files))
  for (const { path, data } of listProjectEntries(files, paths, kind)) {
    if (typeof data?.id === 'string')
      occupiedIds.set(data.id.toLowerCase(), path)
  }

  return rows.map((value) => {
    let displayName = ''
    try {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid row')
      const row = value as ProjectEntryData
      displayName = typeof row.name === 'string' ? row.name : typeof row.id === 'string' ? row.id : ''
      const name = checkedName(row.name || (kind === 'scene' && row.id))
      const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : toProjectSlug(name)
      if (!PROJECT_SLUG_RE.test(id) || (row.type && kind === 'scene' && row.type !== 'image' && row.type !== 'model'))
        throw new Error('Invalid ID or scene type')

      const data: ProjectEntryData = format === 'csv'
        ? Object.fromEntries(CSV_FIELDS[kind].flatMap((key) => {
            const value = row[key]
            if (typeof value !== 'string' || !value)
              return []
            return [[key, ['tags', 'aliases'].includes(key) ? value.trim().split(TAG_SEPARATOR).filter(Boolean) : value] as const]
          }))
        : { ...row }
      let finalId = id
      let path = entryPath(kind, id)
      let source: string | undefined
      let status: ProjectBatchRow['status'] = 'created'
      const match = occupiedIds.get(id.toLowerCase()) ?? occupiedPaths.get(path.toLowerCase())
      if (match) {
        if (strategy === 'skip')
          return { name, status: 'skipped' }
        if (strategy === 'overwrite') {
          path = match
          source = contents.get(path)
          if (source === undefined)
            throw new Error('Existing document is unreadable')
          finalId = readProjectEntry(kind, path, source).id as string
          status = 'overwritten'
        }
        else {
          let suffix = 2
          do {
            finalId = `${id}-${suffix++}`
            path = entryPath(kind, finalId)
          } while (occupiedPaths.has(path.toLowerCase()) || occupiedIds.has(finalId.toLowerCase()))
          status = 'renamed'
        }
      }

      const text = source === undefined
        ? stringifyEntry(kind, { ...data, id: finalId, name })
        : updateProjectEntry(kind, path, source, { ...data, name }).text
      readProjectEntry(kind, path, text)
      occupiedPaths.set(path.toLowerCase(), path)
      occupiedIds.set(finalId.toLowerCase(), path)
      contents.set(path, text)
      return { name, status, path, text, source }
    }
    catch {
      return { name: displayName, status: 'invalid' }
    }
  })
}

/** Validate a provider binding before any profile fields are staged. */
export function prepareCharacterVoiceBinding(locale: string, provider: string, binding: ProjectEntryData) {
  const canonical = normalizeAudioLocale(locale.trim())
  const id = provider.trim()
  validateCharacterVoiceProfile({ intent: {}, locales: { [canonical]: { providers: { [id]: binding } } } })
  return canonical
}
