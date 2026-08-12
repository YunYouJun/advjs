import * as Y from 'yjs'
import { YCloudbaseProvider } from '../../../src/utils/y-cloudbase'

type Scenario = 'convergence' | 'reconnect' | 'permission-denied'
type Operator = 'gt' | 'lt' | 'neq'

interface OperatorValue {
  operator: Operator
  value: unknown
}

interface StoredDocument extends Record<string, unknown> {
  _id: string
}

interface WatchSubscription {
  collection: string
  filters: Record<string, unknown>
  onChange: (snapshot: { docs: StoredDocument[], docChanges: Array<{ dataType: 'add', doc: StoredDocument }> }) => void
}

interface ScenarioResult {
  ownerText: string
  peerText: string
  rejectedWrites: number
  writeErrors: number
}

const UPDATE_COLLECTION = 'advjs_collab_updates'
const ROOM_ID = 'phase-18-e2e'
const DOCUMENT_KEY = 'file:adv/chapters/intro.adv.md'

function isOperatorValue(value: unknown): value is OperatorValue {
  return !!value && typeof value === 'object' && 'operator' in value && 'value' in value
}

function matchesFilters(document: StoredDocument, filters: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([key, expected]) => {
    const actual = document[key]
    if (!isOperatorValue(expected))
      return actual === expected
    if (expected.operator === 'gt')
      return Number(actual) > Number(expected.value)
    if (expected.operator === 'lt')
      return Number(actual) < Number(expected.value)
    return actual !== expected.value
  })
}

class MemoryCloudbaseBackend {
  private collections = new Map<string, StoredDocument[]>()
  private subscriptions = new Set<WatchSubscription>()
  private nextId = 1
  rejectedWrites = 0

  createApp(canWriteUpdates = true) {
    return {
      database: () => ({
        command: {
          gt: (value: unknown): OperatorValue => ({ operator: 'gt', value }),
          lt: (value: unknown): OperatorValue => ({ operator: 'lt', value }),
          neq: (value: unknown): OperatorValue => ({ operator: 'neq', value }),
        },
        collection: (name: string) => this.createQuery(name, canWriteUpdates),
      }),
    }
  }

  private createQuery(
    collection: string,
    canWriteUpdates: boolean,
    filters: Record<string, unknown> = {},
    order: { field: string, direction: 'asc' | 'desc' } | null = null,
    limitCount = Number.POSITIVE_INFINITY,
  ): any {
    return {
      where: (nextFilters: Record<string, unknown>) =>
        this.createQuery(collection, canWriteUpdates, { ...filters, ...nextFilters }, order, limitCount),
      orderBy: (field: string, direction: 'asc' | 'desc') =>
        this.createQuery(collection, canWriteUpdates, filters, { field, direction }, limitCount),
      limit: (count: number) =>
        this.createQuery(collection, canWriteUpdates, filters, order, count),
      get: async () => {
        let documents = this.read(collection).filter(document => matchesFilters(document, filters))
        if (order) {
          const multiplier = order.direction === 'asc' ? 1 : -1
          documents = [...documents].sort((a, b) => (Number(a[order.field]) - Number(b[order.field])) * multiplier)
        }
        return { data: documents.slice(0, limitCount).map(document => ({ ...document })) }
      },
      add: async (value: Record<string, unknown>) => {
        this.assertWriteAllowed(collection, canWriteUpdates)
        const document: StoredDocument = { ...value, _id: `memory-${this.nextId++}` }
        this.read(collection).push(document)
        this.notify(collection, document)
        return { _id: document._id }
      },
      remove: async () => {
        this.assertWriteAllowed(collection, canWriteUpdates)
        const documents = this.read(collection)
        const retained = documents.filter(document => !matchesFilters(document, filters))
        this.collections.set(collection, retained)
        return { deleted: documents.length - retained.length }
      },
      doc: (id: string) => ({
        set: async (value: Record<string, unknown>) => {
          this.assertWriteAllowed(collection, canWriteUpdates)
          const documents = this.read(collection)
          const existing = documents.findIndex(document => document._id === id)
          const document: StoredDocument = { ...value, _id: id }
          if (existing >= 0)
            documents.splice(existing, 1, document)
          else
            documents.push(document)
          this.notify(collection, document)
          return { _id: id }
        },
        update: async (value: Record<string, unknown>) => {
          this.assertWriteAllowed(collection, canWriteUpdates)
          const document = this.read(collection).find(item => item._id === id)
          if (document)
            Object.assign(document, value)
          return { updated: document ? 1 : 0 }
        },
        remove: async () => {
          this.assertWriteAllowed(collection, canWriteUpdates)
          const documents = this.read(collection)
          this.collections.set(collection, documents.filter(document => document._id !== id))
          return { deleted: documents.some(document => document._id === id) ? 1 : 0 }
        },
      }),
      watch: (callbacks: Pick<WatchSubscription, 'onChange'> & { onError: (error: unknown) => void }) => {
        const subscription: WatchSubscription = { collection, filters, onChange: callbacks.onChange }
        this.subscriptions.add(subscription)
        return { close: () => this.subscriptions.delete(subscription) }
      },
    }
  }

  private read(collection: string): StoredDocument[] {
    let documents = this.collections.get(collection)
    if (!documents) {
      documents = []
      this.collections.set(collection, documents)
    }
    return documents
  }

  private assertWriteAllowed(collection: string, canWriteUpdates: boolean) {
    if (collection !== UPDATE_COLLECTION || canWriteUpdates)
      return
    this.rejectedWrites += 1
    throw new Error('PERMISSION_DENIED: viewer cannot write collaboration updates')
  }

  private notify(collection: string, document: StoredDocument) {
    for (const subscription of this.subscriptions) {
      if (subscription.collection !== collection || !matchesFilters(document, subscription.filters))
        continue
      subscription.onChange({
        docs: this.read(collection).filter(item => matchesFilters(item, subscription.filters)),
        docChanges: [{ dataType: 'add', doc: { ...document } }],
      })
    }
  }
}

function createProvider(doc: Y.Doc, backend: MemoryCloudbaseBackend, clientId: string, canWriteUpdates = true) {
  return new YCloudbaseProvider(doc, {
    cloudApp: backend.createApp(canWriteUpdates) as never,
    roomId: ROOM_ID,
    clientId,
    awarenessInterval: 60_000,
  })
}

async function waitFor(predicate: () => boolean, message: string, timeout = 2_500) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate())
      return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(message)
}

async function convergenceScenario(): Promise<ScenarioResult> {
  const backend = new MemoryCloudbaseBackend()
  const ownerDoc = new Y.Doc()
  const peerDoc = new Y.Doc()
  const owner = createProvider(ownerDoc, backend, 'owner')
  const peer = createProvider(peerDoc, backend, 'editor')

  await owner.connect()
  await peer.connect()
  ownerDoc.getText(DOCUMENT_KEY).insert(0, 'owner')
  await waitFor(() => peerDoc.getText(DOCUMENT_KEY).toString() === 'owner', 'peer did not receive owner edit')
  peerDoc.getText(DOCUMENT_KEY).insert(5, '-editor')
  await waitFor(() => ownerDoc.getText(DOCUMENT_KEY).toString() === 'owner-editor', 'owner did not receive peer edit')

  const result = {
    ownerText: ownerDoc.getText(DOCUMENT_KEY).toString(),
    peerText: peerDoc.getText(DOCUMENT_KEY).toString(),
    rejectedWrites: backend.rejectedWrites,
    writeErrors: 0,
  }
  owner.destroy()
  peer.destroy()
  return result
}

async function reconnectScenario(): Promise<ScenarioResult> {
  const backend = new MemoryCloudbaseBackend()
  const ownerDoc = new Y.Doc()
  const peerDoc = new Y.Doc()
  const owner = createProvider(ownerDoc, backend, 'owner')
  const peer = createProvider(peerDoc, backend, 'editor')

  await owner.connect()
  await peer.connect()
  ownerDoc.getText(DOCUMENT_KEY).insert(0, 'before')
  await waitFor(() => peerDoc.getText(DOCUMENT_KEY).toString() === 'before', 'initial edit did not converge')

  peer.disconnect()
  ownerDoc.getText(DOCUMENT_KEY).insert(6, '-offline')
  await new Promise(resolve => setTimeout(resolve, 400))
  await peer.connect()
  await waitFor(() => peerDoc.getText(DOCUMENT_KEY).toString() === 'before-offline', 'peer did not catch up after reconnect')

  peerDoc.getText(DOCUMENT_KEY).insert(14, '-after-reconnect')
  await waitFor(
    () => ownerDoc.getText(DOCUMENT_KEY).toString() === 'before-offline-after-reconnect',
    'reconnected peer could not publish a new edit',
  )

  const result = {
    ownerText: ownerDoc.getText(DOCUMENT_KEY).toString(),
    peerText: peerDoc.getText(DOCUMENT_KEY).toString(),
    rejectedWrites: backend.rejectedWrites,
    writeErrors: 0,
  }
  owner.destroy()
  peer.destroy()
  return result
}

async function permissionDeniedScenario(): Promise<ScenarioResult> {
  const backend = new MemoryCloudbaseBackend()
  const ownerDoc = new Y.Doc()
  const viewerDoc = new Y.Doc()
  const owner = createProvider(ownerDoc, backend, 'owner')
  const viewer = createProvider(viewerDoc, backend, 'viewer', false)
  let writeErrors = 0
  viewer.on('write-error', () => writeErrors += 1)

  await owner.connect()
  ownerDoc.getText(DOCUMENT_KEY).insert(0, 'published')
  await new Promise(resolve => setTimeout(resolve, 400))
  await viewer.connect()
  await waitFor(() => viewerDoc.getText(DOCUMENT_KEY).toString() === 'published', 'viewer did not load published state')

  viewerDoc.getText(DOCUMENT_KEY).insert(9, '-forbidden')
  await waitFor(() => writeErrors === 1, 'permission rejection was not surfaced')
  await new Promise(resolve => setTimeout(resolve, 50))

  const result = {
    ownerText: ownerDoc.getText(DOCUMENT_KEY).toString(),
    peerText: viewerDoc.getText(DOCUMENT_KEY).toString(),
    rejectedWrites: backend.rejectedWrites,
    writeErrors,
  }
  owner.destroy()
  viewer.destroy()
  return result
}

export async function runCollabScenario(scenario: Scenario): Promise<ScenarioResult> {
  if (scenario === 'convergence')
    return convergenceScenario()
  if (scenario === 'reconnect')
    return reconnectScenario()
  return permissionDeniedScenario()
}
