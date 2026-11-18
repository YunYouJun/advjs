import type { AdvAssetEntry } from '@advjs/types'
import type { IFileSystem } from '../../../src/utils/fs'
import { audioProjectMediaPath } from '@advjs/audio'
import captured from '../../../../../packages/agent/test/fixtures/creative-playtest-voice-author-host.json'
import { db } from '../../../src/utils/db'
import { BrowserFsAdapter } from '../../../src/utils/fs/BrowserFsAdapter'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import { createStudioAudioService, initializeStudioAudioCatalog } from '../../../src/utils/projectAudio'

const ledgerPath = 'adv/audio/voice-ledger.json'
const baseFiles: Record<string, string> = { ...captured.project.files }
const ledger = JSON.parse(baseFiles[ledgerPath]!)
const lineId = Object.keys(ledger.lines)[0]!
const locale = 'zh-CN'
const binding = ledger.lines[lineId].locales[locale]
const takeId = binding.takes[0].id as string
const authorTakeId = 'take_01900400-0000-7000-8000-000000000099'
const authorAssetId = 'audio_01900400-0000-7000-8000-000000000099'
binding.selectedTake = null
binding.takes.push({ ...binding.takes[0], id: authorTakeId, assetId: authorAssetId })
baseFiles[ledgerPath] = JSON.stringify(ledger)
const assetFragment = JSON.parse(baseFiles['adv/assets/audio.json']!)
const asset = assetFragment.assets[0]
assetFragment.assets.push({ ...asset, id: authorAssetId })
baseFiles['adv/assets/audio.json'] = JSON.stringify(assetFragment)
const mediaPath = audioProjectMediaPath(JSON.parse(baseFiles['adv/assets.json']!), asset)
const referenceAsset: AdvAssetEntry = { id: 'audio_01900400-0000-7000-8000-000000000098', kind: 'reference', type: 'audio', path: 'author-imports/参考 台词.wav', sha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType, duration: asset.duration }
const importedPath = audioProjectMediaPath(JSON.parse(baseFiles['adv/assets.json']!), referenceAsset)
let fs: IFileSystem
let projectId = ''
let backend: 'memory' | 'browser'
let rootName: string
let release: (() => void) | undefined
let completion: Promise<void> | undefined
const state: { phase: string, loaded: boolean, error?: string } = { phase: 'idle', loaded: false }

Object.assign(window, { audioTransactionFixture: {
  async open(id: string, storage: typeof backend, empty = false) {
    if (!/^[a-z0-9-]+$/.test(id))
      throw new Error('Task-owned fixture project ID required')
    projectId = id
    backend = storage
    rootName = `advjs-audio-transaction-${id}`
    if (backend === 'memory') {
      const adapter = new MemoryFsAdapter(id)
      await adapter.init()
      fs = adapter
    }
    else {
      fs = new BrowserFsAdapter(await (await navigator.storage.getDirectory()).getDirectoryHandle(rootName, { create: true }))
    }
    if (!empty && !await fs.exists('adv.config.json')) {
      for (const [path, content] of Object.entries(baseFiles))
        await fs.writeFile(path, content)
      await fs.flush?.()
    }
    document.querySelector('#status')!.textContent = `Actual ${backend} project ${id}`
  },
  async load() {
    const file = (document.querySelector('#audio') as HTMLInputElement).files?.[0]
    if (!file)
      throw new Error('A real existing spoken WAV is required')
    const bytes = await file.arrayBuffer()
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
    if (digest !== asset.sha256 || bytes.byteLength !== asset.bytes)
      throw new Error('WAV must match the frozen actual-media fixture')
    await fs.writeBlob(mediaPath, new Blob([bytes], { type: 'audio/wav' }))
    await fs.flush?.()
    state.loaded = true
  },
  async start(failAfterWrite: boolean, kind: 'selection' | 'import' | 'initialize' = 'selection') {
    const gate = new Promise<void>(resolve => release = resolve)
    const write = fs.writeFile.bind(fs)
    const transaction = fs.transaction?.bind(fs)
    function observe(scope: IFileSystem) {
      const original = scope.writeFile.bind(scope)
      scope.writeFile = async (path, content) => {
        await original(path, content)
        if ((kind === 'selection' && path === ledgerPath && JSON.parse(content).lines[lineId].locales[locale].selectedTake === takeId)
          || (kind === 'import' && path === 'adv/assets/audio.json' && content.includes(referenceAsset.id))
          || (kind === 'initialize' && path === 'adv.config.json')) {
          state.phase = 'waiting'
          await gate
          if (failAfterWrite)
            throw new Error('Explicit audio fixture failure after source write')
        }
      }
    }
    observe(fs)
    if (transaction) {
      fs.transaction = (operation, validate) => transaction(async (scope) => {
        observe(scope)
        await operation(scope)
      }, validate)
    }
    const service = createStudioAudioService(fs)
    state.phase = 'writing'
    completion = (async () => {
      if (kind === 'initialize')
        return initializeStudioAudioCatalog(fs, projectId)
      if (kind === 'import') {
        const before = await service.readProjectAudio()
        return service.importAsset({ expectedRevision: before.revision, asset: referenceAsset, source: { path: mediaPath, sha256: asset.sha256, bytes: asset.bytes } })
      }
      const before = await service.read()
      return service.select({ lineId, locale, takeId, expectedRevision: before.revision })
    })().then(() => {
      state.phase = 'succeeded'
    }, (error) => {
      state.phase = 'failed'
      state.error = String(error)
    }).finally(() => {
      fs.writeFile = write
      fs.transaction = transaction
    })
  },
  async selected() {
    await fs.refresh?.()
    return JSON.parse(await fs.readFile(ledgerPath)).lines[lineId].locales[locale].selectedTake
  },
  async saveAuthorSelection() {
    await fs.refresh?.()
    const current = JSON.parse(await fs.readFile(ledgerPath))
    current.lines[lineId].locales[locale].selectedTake = authorTakeId
    await fs.writeFile(ledgerPath, JSON.stringify(current))
    await fs.flush?.()
  },
  async saveAuthorWorld() {
    await fs.writeFile('adv/world.md', '# Author world saved in the other window')
    await fs.flush?.()
  },
  async world() { return await fs.exists('adv/world.md') ? fs.readFile('adv/world.md') : null },
  async sources() {
    await fs.refresh?.()
    return { files: Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])), imported: await fs.exists(importedPath), original: await fs.exists(mediaPath) }
  },
  state: () => state,
  ids: { lineId, takeId, authorTakeId, mediaPath },
  async finish() {
    release?.()
    await completion
    return state
  },
  async cleanup() {
    release?.()
    await completion
    await fs.flush?.().catch(() => {})
    if (backend === 'memory') {
      const query = db.memfsNodes.where('key').startsWith(`memfs:${projectId}:`)
      await query.delete()
      return { removed: await query.count() === 0 }
    }
    const storage = await navigator.storage.getDirectory()
    await storage.removeEntry(rootName, { recursive: true })
    try {
      await storage.getDirectoryHandle(rootName)
      throw new Error('Task-owned OPFS directory remains')
    }
    catch (error) {
      if ((error as { name?: string })?.name !== 'NotFoundError')
        throw error
    }
    return { removed: true }
  },
} })
