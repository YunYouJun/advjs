import type { CreativeArtRequest } from '@advjs/agent'
import type { CreativeImageMetadata } from './creativeImage'
import type { StudioNativeFileChange } from './nativeProjectMutation'
import Dexie from 'dexie'

export interface CreativeArtImportScope { accountId: string, projectId: string, runId: string }
export interface CreativeArtImportReview {
  beforeRevision: string
  afterRevision: string
  changes: StudioNativeFileChange[]
  mediaPath: string
  binding: string
}
/** Private candidate/journal metadata. Decoded bytes only enter the project after explicit adoption. */
export interface CreativeArtImportEntry extends CreativeArtImportScope {
  id: string
  artifactId: string
  artifactFingerprint: string
  request: CreativeArtRequest
  fileName: string
  attribution: string
  license: string
  image: CreativeImageMetadata
  data?: ArrayBuffer
  createdAt: number
  state: 'candidate' | 'adopting' | 'adopted' | 'undoing' | 'undone'
  review?: CreativeArtImportReview
}
export interface CreativeArtImportCache {
  list: (scope: CreativeArtImportScope) => Promise<CreativeArtImportEntry[]>
  save: (entry: CreativeArtImportEntry) => Promise<void>
  discard: (entry: CreativeArtImportEntry) => Promise<void>
}
const database = new Dexie('advjs-studio-creative-art-imports')
database.version(1).stores({ entries: '[accountId+projectId+runId+id], [accountId+projectId+runId]' })
const entries = database.table<CreativeArtImportEntry, [string, string, string, string]>('entries')
const scopeKey = (entry: CreativeArtImportScope) => [entry.accountId, entry.projectId, entry.runId]

/** Keep recoverable image candidates outside exported source; adopted bytes are not duplicated here. */
export const creativeArtImportCache: CreativeArtImportCache = {
  async list(scope) {
    return (await entries.where('[accountId+projectId+runId]').equals(scopeKey(scope)).toArray()).sort((a, b) => b.createdAt - a.createdAt)
  },
  async save(entry) {
    await database.transaction('rw', entries, async () => {
      const previous = await entries.where('[accountId+projectId+runId]').equals(scopeKey(entry)).toArray()
      const retained = previous.filter(item => item.id !== entry.id)
      if (retained.length >= 32 || retained.reduce((size, item) => size + (item.data?.byteLength ?? 0), entry.data?.byteLength ?? 0) > 64 * 1024 * 1024)
        throw new Error('CREATIVE_IMAGE_STORAGE_LIMIT')
      await entries.put(structuredClone(entry))
    })
  },
  async discard(entry) {
    if (!['candidate', 'undone'].includes(entry.state))
      throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
    await entries.delete([...scopeKey(entry), entry.id] as [string, string, string, string])
  },
}
