import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportCache, CreativeArtImportEntry, CreativeArtImportScope } from '../utils/creativeArtImportCache'
import type { CreativeMediaSubmit } from '../utils/creativeMediaCandidate'
import type { CreativeMediaProjectState } from '../utils/creativeMediaRecovery'
import type { IFileSystem } from '../utils/fs'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { assertCreativeArtImport, commitCreativeArtImport, inspectCreativeArtImport, recoverCreativeArtImport, reviewCreativeArtImport } from '../utils/creativeArtImport'
import { creativeArtImportCache } from '../utils/creativeArtImportCache'
import { inspectCreativeImage } from '../utils/creativeImage'
import { submitCreativeMediaCandidate } from '../utils/creativeMediaCandidate'
import { assertCreativeMediaFilesUnchanged } from '../utils/creativeMediaRecovery'

export interface CreativeArtImportHost { fs: IFileSystem, assertCurrent: () => void }

/** Own image candidates and their durable local adoption journal; reopening never writes project files. */
export function useCreativeArtImport(options: {
  run: () => CreativeTeamRun
  host: () => Promise<CreativeArtImportHost>
  cache?: CreativeArtImportCache
  inspectImage?: typeof inspectCreativeImage
  submitMedia?: () => CreativeMediaSubmit | undefined
  changed: () => void
}) {
  const cache = options.cache ?? creativeArtImportCache
  const rows = shallowRef<CreativeArtImportEntry[]>([])
  const busy = shallowRef(false)
  const error = shallowRef<'image' | 'storage' | 'source' | 'write'>()
  const inspections = shallowRef<Record<string, CreativeMediaProjectState>>({})
  let epoch = 0
  const scope = (): CreativeArtImportScope => ({ accountId: options.run().accountId, projectId: options.run().plan.projectId, runId: options.run().id })
  const sameScope = (before: CreativeArtImportScope) => JSON.stringify(before) === JSON.stringify(scope())

  async function reload() {
    const turn = epoch
    const before = scope()
    try {
      const entries = await cache.list(before)
      if (turn !== epoch || !sameScope(before))
        return
      rows.value = entries
      const host = await options.host()
      for (const entry of entries.filter(item => item.review && !item.managed)) {
        const result = await inspectCreativeArtImport(host.fs, entry, host.assertCurrent)
        if (turn !== epoch || !sameScope(before))
          return
        inspections.value = { ...inspections.value, [entry.id]: result }
      }
    }
    catch {
      if (turn === epoch)
        error.value = 'storage'
    }
  }
  watch(() => JSON.stringify(scope()), () => {
    epoch += 1
    busy.value = false
    rows.value = []
    inspections.value = {}
    error.value = undefined
    void reload()
  }, { immediate: true })
  watch(() => options.run(), () => {
    if (!busy.value)
      void reload()
  })
  onBeforeUnmount(() => epoch += 1)

  async function save(entry: CreativeArtImportEntry, turn: number) {
    await cache.save(entry)
    if (turn === epoch)
      rows.value = [entry, ...rows.value.filter(item => item.id !== entry.id)]
  }
  async function work(kind: NonNullable<typeof error.value>, action: (host: CreativeArtImportHost, turn: number) => Promise<void>) {
    if (busy.value)
      return
    const turn = epoch
    const before = scope()
    busy.value = true
    error.value = undefined
    try {
      const value = await options.host()
      const assertCurrent = () => {
        value.assertCurrent()
        if (turn !== epoch || !sameScope(before))
          throw new Error('CREATIVE_IMAGE_SCOPE_CHANGED')
      }
      assertCurrent()
      await action({ fs: value.fs, assertCurrent }, turn)
    }
    catch {
      if (turn === epoch && !error.value)
        error.value = kind
    }
    finally {
      if (turn === epoch)
        busy.value = false
    }
  }

  async function stage(input: { artifactId: string, assetId: string, file: File, attribution: string, license: string }) {
    await work('image', async (host, turn) => {
      const run = options.run()
      const artifact = run.artifacts.find(item => item.id === input.artifactId)
      const request = artifact?.output?.kind === 'art-direction' ? artifact.output.requests.find(item => item.assetId === input.assetId) : undefined
      if (!artifact || !request || !input.attribution.trim() || input.attribution.length > 1000 || input.license.length > 200)
        throw new Error('CREATIVE_IMAGE_INVALID_SOURCE')
      const { image, data } = await (options.inspectImage ?? inspectCreativeImage)(input.file)
      host.assertCurrent()
      const entry: CreativeArtImportEntry = { ...scope(), id: crypto.randomUUID(), artifactId: artifact.id, artifactFingerprint: artifact.fingerprint, request: structuredClone(request), fileName: input.file.name, attribution: input.attribution.trim(), license: input.license.trim(), image, data, createdAt: Date.now(), state: 'candidate' }
      assertCreativeArtImport(options.run(), entry)
      try {
        await save(entry, turn)
      }
      catch (cause) {
        if (turn === epoch)
          error.value = 'storage'
        throw cause
      }
    })
  }

  async function review(id: string, replaceExisting: boolean) {
    await work('source', async (host, turn) => {
      const entry = rows.value.find(item => item.id === id && item.state === 'candidate')
      if (!entry)
        throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
      const review = await reviewCreativeArtImport(host.fs, options.run(), entry, replaceExisting, host.assertCurrent)
      host.assertCurrent()
      await save({ ...entry, review }, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: 'before' }
    })
  }

  async function adopt(id: string) {
    await work('write', async (host, turn) => {
      const entry = rows.value.find(item => item.id === id)
      if (!entry?.review || !['candidate', 'submitting', 'adopting'].includes(entry.state))
        throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
      const submit = options.submitMedia?.()
      if (entry.managed || submit) {
        if (!submit || (entry.state !== 'candidate' && entry.state !== 'submitting'))
          throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
        if (!entry.managed)
          assertCreativeArtImport(options.run(), entry)
        const managed = await submitCreativeMediaCandidate({ fs: host.fs, scope: entry, parent: { artifactId: entry.artifactId, fingerprint: entry.artifactFingerprint }, target: { kind: 'image', assetId: entry.request.assetId }, review: entry.review, reason: entry.attribution, registration: entry.managed, submit, assertCurrent: host.assertCurrent, save: managed => save({ ...entry, state: 'submitting', managed }, turn) })
        await save({ ...entry, state: 'submitted', managed }, turn)
        host.assertCurrent()
        return
      }
      assertCreativeArtImport(options.run(), entry)
      const assertCurrent = () => {
        host.assertCurrent()
        assertCreativeArtImport(options.run(), entry)
      }
      if (entry.state === 'candidate' && await inspectCreativeArtImport(host.fs, entry, assertCurrent) !== 'before')
        throw new Error('CREATIVE_IMAGE_SOURCE_CHANGED')
      const pending = { ...entry, state: 'adopting' as const }
      await save(pending, turn)
      assertCurrent()
      if (entry.state === 'adopting')
        await recoverCreativeArtImport(host.fs, options.run(), pending, 'after', assertCurrent)
      else
        await commitCreativeArtImport(host.fs, pending, assertCurrent)
      if (await inspectCreativeArtImport(host.fs, pending, host.assertCurrent) !== 'after')
        throw new Error('CREATIVE_IMAGE_WRITE_INCOMPLETE')
      await save({ ...pending, state: 'adopted', data: undefined }, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: 'after' }
      options.changed()
    })
  }

  async function undo(id: string) {
    await work('write', async (host, turn) => {
      const entry = rows.value.find(item => item.id === id && ['adopted', 'undoing'].includes(item.state))
      if (entry?.managed)
        throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
      if (!entry || !['after', 'partial'].includes(await inspectCreativeArtImport(host.fs, entry, host.assertCurrent)))
        throw new Error('CREATIVE_IMAGE_SOURCE_CHANGED')
      const pending = { ...entry, state: 'undoing' as const }
      await save(pending, turn)
      host.assertCurrent()
      await recoverCreativeArtImport(host.fs, options.run(), pending, 'before', host.assertCurrent)
      if (await inspectCreativeArtImport(host.fs, pending, host.assertCurrent) !== 'before')
        throw new Error('CREATIVE_IMAGE_WRITE_INCOMPLETE')
      await save({ ...pending, state: 'undone' }, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: 'before' }
      options.changed()
    })
  }

  async function reconcile(id: string) {
    await work('storage', async (host, turn) => {
      const entry = rows.value.find(item => item.id === id)
      if (!entry)
        return
      if (entry.managed)
        throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
      const actual = await inspectCreativeArtImport(host.fs, entry, host.assertCurrent)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: actual }
      if (entry.state === 'adopting' && actual === 'after') {
        await save({ ...entry, state: 'adopted', data: undefined }, turn)
        host.assertCurrent()
        options.changed()
      }
      if (entry.state === 'undoing' && actual === 'before') {
        await save({ ...entry, state: 'undone' }, turn)
        host.assertCurrent()
        options.changed()
      }
    })
  }

  async function abandon(id: string) {
    await work('storage', async (host, turn) => {
      const entry = rows.value.find(item => item.id === id)
      if (!entry)
        return
      if (entry.managed)
        throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
      const actual = await inspectCreativeArtImport(host.fs, entry, host.assertCurrent)
      host.assertCurrent()
      if (entry.state === 'adopting' && ['before', 'conflict'].includes(actual)) {
        if (entry.review)
          await assertCreativeMediaFilesUnchanged(host.fs, entry.projectId, entry.review, 'before', host.assertCurrent)
        await save({ ...entry, state: 'candidate', review: undefined }, turn)
      }
      else if (entry.state === 'undoing' && ['after', 'conflict'].includes(actual)) {
        if (entry.review)
          await assertCreativeMediaFilesUnchanged(host.fs, entry.projectId, entry.review, 'after', host.assertCurrent)
        await save({ ...entry, state: 'adopted' }, turn)
      }
      else {
        throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
      }
      host.assertCurrent()
    })
  }

  async function restore(id: string) {
    await work('write', async (host, turn) => {
      const entry = rows.value.find(item => item.id === id && item.state === 'adopting')
      if (!entry || entry.managed)
        throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
      await recoverCreativeArtImport(host.fs, options.run(), entry, 'before', host.assertCurrent)
      host.assertCurrent()
      await save({ ...entry, state: 'candidate', review: undefined }, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: 'before' }
      options.changed()
    })
  }

  async function discard(id: string) {
    await work('storage', async (host) => {
      const entry = rows.value.find(item => item.id === id)
      if (!entry || !['candidate', 'undone'].includes(entry.state))
        throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
      host.assertCurrent()
      await cache.discard(entry)
      host.assertCurrent()
      rows.value = rows.value.filter(item => item.id !== id)
    })
  }

  return { rows, busy, error, inspections, reload, stage, review, adopt, undo, reconcile, abandon, restore, discard }
}
