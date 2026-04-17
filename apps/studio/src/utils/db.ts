import type { AdvCharacter, AdvCharacterDynamicState, WorldClockState, WorldEvent } from '@advjs/types'
import type { CharacterChatMessage, CharacterConversation, ConversationSnapshot } from '../stores/useCharacterChatStore'
import type { CharacterMemory } from '../stores/useCharacterMemoryStore'
import type { GroupChatRoom, GroupChatRoomSnapshot } from '../stores/useGroupChatStore'
import type { CharacterAiOverride } from './resolveAiConfig'
import Dexie from 'dexie'

export const DEFAULT_PROJECT_ID = '_default_'

// --- Table row types (v3: all include projectId) ---

export interface DbCharacterChat {
  projectId: string
  characterId: string
  messages: CharacterChatMessage[]
  contextSummary?: string
}

export interface DbCharacterMemory extends CharacterMemory {
  projectId: string
}

export interface DbGroupChatRoom extends GroupChatRoom {
  projectId: string
}

export interface DbWorldEvent extends WorldEvent {
  projectId: string
}

export interface DbCharacterState {
  projectId: string
  characterId: string
  state: AdvCharacterDynamicState
}

export interface DbWorldClock {
  projectId: string
  clock: WorldClockState
}

export interface DbViewMode {
  projectId: string
  playerCharacterId: string | null
  customCharacters: AdvCharacter[]
}

export interface DbDirHandle {
  projectName: string
  handle: FileSystemDirectoryHandle
}

export interface DbConversationSnapshot extends ConversationSnapshot {
  projectId: string
}

export interface DbCharacterDiary {
  projectId: string
  characterId: string
  id: string
  date: string
  period: string
  content: string
  createdAt: number
  mood?: string
}

export interface DbChatMessage {
  projectId: string
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface DbGroupChatRoomSnapshot extends GroupChatRoomSnapshot {
  projectId: string
}

export interface DbCharacterAiConfig {
  projectId: string
  characterId: string
  config: CharacterAiOverride
}

export interface DbArchivedBatch {
  projectId: string
  characterId: string
  batchId: string
  messages: Array<{ role: string, content: string, timestamp: number }>
  summary: string
  archivedAt: number
}

export interface DbKnowledgeEmbedding {
  projectId: string
  /** Unique key: '{filePath}#{sectionIndex}' */
  sectionKey: string
  embedding: number[]
  /** Content length for change detection */
  contentHash: number
  /** Model used to generate the embedding */
  model: string
}

export interface DbMemfsNode {
  /** Primary key: 'memfs:{projectId}:{path}' */
  key: string
  type: 'file' | 'directory'
  content: string
  mtime: number
  size: number
}

export interface DbQualityEvaluation {
  projectId: string
  characterId: string
  id: string
  score: {
    coherence: number
    characterConsistency: number
    informationDensity: number
    overall: number
    evaluatedAt: string
    messageCount: number
  }
}

// --- Database ---

class StudioDatabase extends Dexie {
  characterChats!: Dexie.Table<DbCharacterChat, [string, string]>
  characterMemories!: Dexie.Table<DbCharacterMemory, [string, string]>
  groupChats!: Dexie.Table<DbGroupChatRoom, [string, string]>
  worldEvents!: Dexie.Table<DbWorldEvent, [string, string]>
  characterStates!: Dexie.Table<DbCharacterState, [string, string]>
  worldClocks!: Dexie.Table<DbWorldClock, string>
  viewModes!: Dexie.Table<DbViewMode, string>
  dirHandles!: Dexie.Table<DbDirHandle, string>
  conversationSnapshots!: Dexie.Table<DbConversationSnapshot, [string, string]>
  characterDiaries!: Dexie.Table<DbCharacterDiary, [string, string]>
  chatMessages!: Dexie.Table<DbChatMessage, [string, string]>
  memfsNodes!: Dexie.Table<DbMemfsNode, string>
  groupChatSnapshots!: Dexie.Table<DbGroupChatRoomSnapshot, [string, string]>
  characterAiConfigs!: Dexie.Table<DbCharacterAiConfig, [string, string]>
  archivedBatches!: Dexie.Table<DbArchivedBatch, [string, string]>
  knowledgeEmbeddings!: Dexie.Table<DbKnowledgeEmbedding, [string, string]>
  qualityEvaluations!: Dexie.Table<DbQualityEvaluation, [string, string]>

  constructor() {
    super('advjs-studio')

    // v2: original single-field primary keys.
    // We MUST keep this declaration so Dexie knows the v2 schema when upgrading
    // from v2 → v3. The v3 upgrade handler will manually migrate the data.
    this.version(2).stores({
      characterChats: 'characterId',
      characterMemories: 'characterId',
      groupChats: 'id',
      worldEvents: 'id',
      characterStates: 'characterId',
      dirHandles: 'projectName',
    })

    this.version(3).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      dirHandles: 'projectName',
    }).upgrade(async (tx) => {
      // Tag all existing rows with DEFAULT_PROJECT_ID
      const tables = ['characterChats', 'characterMemories', 'groupChats', 'worldEvents', 'characterStates']
      for (const tableName of tables) {
        await tx.table(tableName).toCollection().modify((row: any) => {
          if (!row.projectId)
            row.projectId = DEFAULT_PROJECT_ID
        })
      }

      // Migrate worldClock from localStorage → Dexie
      try {
        const raw = localStorage.getItem('advjs-studio-world-clock')
        if (raw) {
          const parsed = JSON.parse(raw)
          await tx.table('worldClocks').put({
            projectId: DEFAULT_PROJECT_ID,
            clock: { ...parsed, running: false },
          })
        }
      }
      catch {
        // ignore
      }
    })

    this.version(4).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
    }).upgrade(async (tx) => {
      // Migrate viewMode project-level fields from localStorage → Dexie
      try {
        const raw = localStorage.getItem('advjs-studio-view-mode')
        if (raw) {
          const parsed = JSON.parse(raw)
          await tx.table('viewModes').put({
            projectId: DEFAULT_PROJECT_ID,
            playerCharacterId: parsed.playerCharacterId || null,
            customCharacters: parsed.customCharacters || [],
          })
          // Keep only `mode` in localStorage (global preference)
          localStorage.setItem('advjs-studio-view-mode', JSON.stringify({
            mode: parsed.mode || 'visitor',
          }))
        }
      }
      catch {
        // ignore
      }
    })

    this.version(5).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
    })

    this.version(6).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId]',
    })

    this.version(7).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId]',
      chatMessages: '[projectId+id]',
      groupChatSnapshots: '[projectId+id], [projectId+roomId]',
    })

    // v8: add compound index for efficient diary duplicate detection
    this.version(8).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId], [projectId+characterId+date+period]',
      chatMessages: '[projectId+id]',
      groupChatSnapshots: '[projectId+id], [projectId+roomId]',
    })

    // v9: add characterAiConfigs table for per-character AI overrides
    this.version(9).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId], [projectId+characterId+date+period]',
      chatMessages: '[projectId+id]',
      groupChatSnapshots: '[projectId+id], [projectId+roomId]',
      characterAiConfigs: '[projectId+characterId]',
    })

    // v10: add archivedBatches table for message archival
    this.version(10).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId], [projectId+characterId+date+period]',
      chatMessages: '[projectId+id]',
      groupChatSnapshots: '[projectId+id], [projectId+roomId]',
      characterAiConfigs: '[projectId+characterId]',
      archivedBatches: '[projectId+batchId], [projectId+characterId]',
    })

    // v11: add knowledgeEmbeddings table for vector retrieval
    this.version(11).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId], [projectId+characterId+date+period]',
      chatMessages: '[projectId+id]',
      groupChatSnapshots: '[projectId+id], [projectId+roomId]',
      characterAiConfigs: '[projectId+characterId]',
      archivedBatches: '[projectId+batchId], [projectId+characterId]',
      knowledgeEmbeddings: '[projectId+sectionKey]',
    })

    // v12: add memfsNodes table for in-memory file system persistence (Safari/Firefox/mobile fallback)
    this.version(12).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId], [projectId+characterId+date+period]',
      chatMessages: '[projectId+id]',
      groupChatSnapshots: '[projectId+id], [projectId+roomId]',
      characterAiConfigs: '[projectId+characterId]',
      archivedBatches: '[projectId+batchId], [projectId+characterId]',
      knowledgeEmbeddings: '[projectId+sectionKey]',
      memfsNodes: 'key',
    })

    // v13: add qualityEvaluations table for AI chat quality scoring
    this.version(13).stores({
      characterChats: '[projectId+characterId]',
      characterMemories: '[projectId+characterId]',
      groupChats: '[projectId+id]',
      worldEvents: '[projectId+id]',
      characterStates: '[projectId+characterId]',
      worldClocks: 'projectId',
      viewModes: 'projectId',
      dirHandles: 'projectName',
      conversationSnapshots: '[projectId+id], [projectId+characterId]',
      characterDiaries: '[projectId+id], [projectId+characterId], [projectId+characterId+date+period]',
      chatMessages: '[projectId+id]',
      groupChatSnapshots: '[projectId+id], [projectId+roomId]',
      characterAiConfigs: '[projectId+characterId]',
      archivedBatches: '[projectId+batchId], [projectId+characterId]',
      knowledgeEmbeddings: '[projectId+sectionKey]',
      memfsNodes: 'key',
      qualityEvaluations: '[projectId+id], [projectId+characterId]',
    })
  }
}

let _db = new StudioDatabase()

/**
 * Open the database with auto-recovery.
 *
 * v2→v3 changed primary keys (e.g. 'characterId' → '[projectId+characterId]'),
 * which IndexedDB does not support. If a user's browser still has a v2 database,
 * Dexie throws "UpgradeError Not yet support for changing primary key" and the
 * DB stays closed, breaking all subsequent reads/writes.
 *
 * Recovery: delete the corrupted DB and recreate from scratch.
 * Data loss is acceptable — v2 data is from early development and minimal.
 */
export const dbReady: Promise<StudioDatabase> = _db.open()
  .then(() => _db)
  .catch(async (err) => {
    console.warn('[db] Failed to open database, deleting and recreating:', err)
    _db.close()
    await Dexie.delete('advjs-studio')
    _db = new StudioDatabase()
    await _db.open()
    return _db
  })

// Synchronous export for convenience — Dexie queues operations until open() resolves,
// so callers can use `db.table.get(...)` without awaiting. After recovery `_db` points
// to the fresh instance; the proxy ensures callers always reach it.
export const db: StudioDatabase = new Proxy({} as StudioDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(_db, prop, receiver)
  },
})

// --- Project data helpers ---

/**
 * Re-key all rows marked as `_default_` to the given real projectId.
 * Called once when a project is opened for the first time after migration.
 */
export async function claimDefaultData(projectId: string): Promise<void> {
  if (projectId === DEFAULT_PROJECT_ID)
    return

  await db.transaction('rw', [
    db.characterChats,
    db.characterMemories,
    db.groupChats,
    db.worldEvents,
    db.characterStates,
    db.worldClocks,
    db.viewModes,
    db.characterDiaries,
    db.chatMessages,
  ], async () => {
    // For each table with compound keys, re-key _default_ rows in-place.
    // Using modify() is atomic within the transaction — no data loss on crash.
    for (const table of [db.characterChats, db.characterMemories, db.groupChats, db.worldEvents, db.characterStates, db.characterDiaries, db.chatMessages] as Dexie.Table[]) {
      const rows = await table.where('projectId').equals(DEFAULT_PROJECT_ID).toArray()
      if (rows.length > 0) {
        // Compound-key tables cannot modify the key in-place, so delete + bulkPut
        // within the same Dexie transaction (atomic: all-or-nothing).
        await table.where('projectId').equals(DEFAULT_PROJECT_ID).delete()
        await table.bulkPut(rows.map((r: any) => ({ ...r, projectId })))
      }
    }

    // worldClocks: single key = projectId
    const clockRow = await db.worldClocks.get(DEFAULT_PROJECT_ID)
    if (clockRow) {
      await db.worldClocks.delete(DEFAULT_PROJECT_ID)
      await db.worldClocks.put({ ...clockRow, projectId })
    }

    // viewModes: single key = projectId
    const viewRow = await db.viewModes.get(DEFAULT_PROJECT_ID)
    if (viewRow) {
      await db.viewModes.delete(DEFAULT_PROJECT_ID)
      await db.viewModes.put({ ...viewRow, projectId })
    }
  })
}

/**
 * Check if any data with `_default_` projectId exists.
 */
export async function hasDefaultData(): Promise<boolean> {
  const count = await db.characterChats.where('projectId').equals(DEFAULT_PROJECT_ID).count()
  if (count > 0)
    return true
  const clockRow = await db.worldClocks.get(DEFAULT_PROJECT_ID)
  if (clockRow)
    return true
  const viewRow = await db.viewModes.get(DEFAULT_PROJECT_ID)
  return !!viewRow
}

// --- Legacy migration helpers ---

/**
 * One-time migration: read a heavy store from localStorage into Dexie,
 * then remove the localStorage key.
 */
export async function migrateLocalStorageToDb<T>(
  storageKey: string,
  putFn: (data: T) => Promise<void>,
): Promise<T | null> {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw)
      return null
    const data = JSON.parse(raw) as T
    await putFn(data)
    localStorage.removeItem(storageKey)
    return data
  }
  catch {
    return null
  }
}

/**
 * Convert a Map-serialized array back to a CharacterConversation Map.
 */
export function deserializeConversations(
  entries: [string, CharacterConversation][],
): Map<string, CharacterConversation> {
  return new Map(entries)
}
