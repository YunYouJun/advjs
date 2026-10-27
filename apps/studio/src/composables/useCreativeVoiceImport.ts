import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeMediaSubmit } from '../utils/creativeMediaCandidate'
import type { CreativeMediaProjectState } from '../utils/creativeMediaRecovery'
import type { CreativeVoiceReview } from '../utils/creativeVoiceImport'
import type { CreativeVoiceImportCache, CreativeVoiceImportEntry } from '../utils/creativeVoiceImportCache'
import type { CreativeArtImportHost } from './useCreativeArtImport'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { creativeVoiceMediaTarget, submitCreativeMediaCandidate } from '../utils/creativeMediaCandidate'
import { assertCreativeMediaFilesUnchanged, inspectCreativeMediaWrite } from '../utils/creativeMediaRecovery'
import { assertCreativeVoiceReview, commitCreativeVoiceImport, recoverCreativeVoiceImport, reviewCreativeVoiceSelection } from '../utils/creativeVoiceImport'
import { creativeVoiceImportCache } from '../utils/creativeVoiceImportCache'

/** Persist intent before the first project write; reopening never registers or selects a take. */
export function useCreativeVoiceImport(options: { run: () => CreativeTeamRun, host: () => Promise<CreativeArtImportHost>, changed: () => void, cache?: CreativeVoiceImportCache, submitMedia?: () => CreativeMediaSubmit | undefined }) {
  const cache = options.cache ?? creativeVoiceImportCache
  const rows = shallowRef<CreativeVoiceImportEntry[]>([])
  const inspections = shallowRef<Record<string, CreativeMediaProjectState>>({})
  const busy = shallowRef(false)
  const loading = shallowRef(false)
  const error = shallowRef(false)
  let epoch = 0
  const scope = () => ({ accountId: options.run().accountId, projectId: options.run().plan.projectId, runId: options.run().id })
  const scopeKey = () => JSON.stringify(scope())
  function inspect(host: CreativeArtImportHost, entry: CreativeVoiceImportEntry) {
    return inspectCreativeMediaWrite(host.fs, entry.projectId, entry.review, entry.review, host.assertCurrent)
  }
  async function reload() {
    const turn = epoch
    const key = scopeKey()
    loading.value = true
    try {
      const entries = await cache.list(scope())
      if (turn !== epoch || key !== scopeKey())
        return
      rows.value = entries
      const host = await options.host()
      const result: Record<string, CreativeMediaProjectState> = {}
      for (const entry of entries.filter(item => !item.managed))
        result[entry.id] = await inspect(host, entry)
      host.assertCurrent()
      if (turn === epoch && key === scopeKey())
        inspections.value = result
    }
    catch {
      if (turn === epoch)
        error.value = true
    }
    finally {
      if (turn === epoch)
        loading.value = false
    }
  }
  watch(scopeKey, () => {
    epoch++
    rows.value = []
    inspections.value = {}
    busy.value = false
    error.value = false
    void reload()
  }, { immediate: true })
  watch(() => options.run(), () => {
    if (!busy.value)
      void reload()
  })
  onBeforeUnmount(() => epoch++)
  async function save(entry: CreativeVoiceImportEntry, turn: number) {
    await cache.save(entry)
    if (turn === epoch)
      rows.value = [entry, ...rows.value.filter(item => item.id !== entry.id)]
  }
  async function work(action: (host: CreativeArtImportHost, turn: number) => Promise<void>): Promise<boolean> {
    if (busy.value || loading.value)
      return false
    const turn = epoch
    const key = scopeKey()
    busy.value = true
    error.value = false
    try {
      const host = await options.host()
      const assertCurrent = () => {
        host.assertCurrent()
        if (turn !== epoch || key !== scopeKey())
          throw new Error('CREATIVE_MEDIA_SCOPE_CHANGED')
      }
      assertCurrent()
      await action({ fs: host.fs, assertCurrent }, turn)
      return true
    }
    catch {
      if (turn === epoch)
        error.value = true
      return false
    }
    finally {
      if (turn === epoch)
        busy.value = false
    }
  }
  async function stage(review: CreativeVoiceReview) {
    return work(async (host, turn) => {
      assertCreativeVoiceReview(options.run(), review)
      const entry: CreativeVoiceImportEntry = { ...scope(), id: crypto.randomUUID(), review, state: 'reviewed', createdAt: Date.now() }
      if (await inspect(host, entry) !== 'before')
        throw new Error('CREATIVE_MEDIA_RECOVERY_CONFLICT')
      host.assertCurrent()
      await save(entry, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [entry.id]: 'before' }
    })
  }
  async function select(id: string) {
    return work(async (host, turn) => {
      const entry = rows.value.find(item => item.id === id && item.state === 'registered' && item.phase !== 'selected' && item.managed?.artifact)
      if (!entry || !options.submitMedia?.())
        throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
      const registered = options.run().artifacts.find(item => item.id === entry.managed!.artifact!.artifactId && item.status === 'adopted')
      if (!registered)
        throw new Error('CREATIVE_MEDIA_REGISTRATION_REQUIRED')
      const review = await reviewCreativeVoiceSelection(host.fs, options.run(), entry.review, host.assertCurrent)
      host.assertCurrent()
      const selected: CreativeVoiceImportEntry = { ...scope(), id: crypto.randomUUID(), createdAt: Date.now(), state: 'reviewed', phase: 'selected', review: { ...review, data: undefined } }
      await save(selected, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [selected.id]: 'before' }
    })
  }
  async function register(id: string) {
    return work(async (host, turn) => {
      const entry = rows.value.find(item => item.id === id && ['reviewed', 'submitting', 'registering'].includes(item.state))
      if (!entry)
        throw new Error('CREATIVE_MEDIA_RECOVERY_REQUIRED')
      const submit = options.submitMedia?.()
      if (entry.managed || submit) {
        if (!submit || (entry.state !== 'reviewed' && entry.state !== 'submitting'))
          throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
        if (!entry.managed)
          assertCreativeVoiceReview(options.run(), entry.review)
        const managed = await submitCreativeMediaCandidate({ fs: host.fs, scope: entry, parent: { artifactId: entry.review.target.artifactId, fingerprint: entry.review.target.artifactFingerprint }, target: { ...creativeVoiceMediaTarget(entry.review), kind: 'voice', phase: entry.phase ?? 'registered' }, review: entry.review, reason: entry.review.attribution, registration: entry.managed, submit, assertCurrent: host.assertCurrent, save: managed => save({ ...entry, state: 'submitting', managed }, turn) })
        await save({ ...entry, state: 'submitted', managed }, turn)
        host.assertCurrent()
        return
      }
      assertCreativeVoiceReview(options.run(), entry.review)
      if (entry.managed)
        throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
      const actual = await inspect(host, entry)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: actual }
      if ((entry.state === 'reviewed' && actual !== 'before') || actual === 'conflict')
        throw new Error('CREATIVE_MEDIA_RECOVERY_CONFLICT')
      const pending = { ...entry, state: 'registering' as const }
      await save(pending, turn)
      host.assertCurrent()
      const assertCurrent = () => {
        host.assertCurrent()
        assertCreativeVoiceReview(options.run(), pending.review)
      }
      if (entry.state === 'reviewed') {
        if (!entry.review.data)
          throw new Error('CREATIVE_MEDIA_RECOVERY_BYTES_REQUIRED')
        await commitCreativeVoiceImport(host.fs, options.run(), { ...entry.review, data: entry.review.data }, assertCurrent)
      }
      else {
        await recoverCreativeVoiceImport(host.fs, options.run(), entry.review, 'after', assertCurrent)
      }
      if (await inspect(host, entry) !== 'after')
        throw new Error('CREATIVE_MEDIA_RECOVERY_INCOMPLETE')
      host.assertCurrent()
      await save({ ...pending, state: 'registered', review: { ...entry.review, data: undefined } }, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: 'after' }
      options.changed()
    })
  }
  async function reconcile(id: string) {
    return work(async (host, turn) => {
      const entry = rows.value.find(item => item.id === id)
      if (!entry)
        return
      if (entry.managed)
        throw new Error('CREATIVE_MEDIA_MILESTONE_REQUIRED')
      const actual = await inspect(host, entry)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: actual }
      if (entry.state === 'registering' && actual === 'after')
        await save({ ...entry, state: 'registered', review: { ...entry.review, data: undefined } }, turn)
      if (entry.state === 'restoring' && actual === 'before')
        await save({ ...entry, state: 'restored' }, turn)
      host.assertCurrent()
      if ((entry.state === 'registering' && actual === 'after') || (entry.state === 'restoring' && actual === 'before'))
        options.changed()
    })
  }
  async function restore(id: string) {
    return work(async (host, turn) => {
      const entry = rows.value.find(item => item.id === id && ['registering', 'restoring'].includes(item.state))
      if (!entry || entry.managed)
        throw new Error('CREATIVE_MEDIA_RECOVERY_REQUIRED')
      await save({ ...entry, state: 'restoring' }, turn)
      host.assertCurrent()
      await recoverCreativeVoiceImport(host.fs, options.run(), entry.review, 'before', host.assertCurrent)
      host.assertCurrent()
      await save({ ...entry, state: 'restored' }, turn)
      host.assertCurrent()
      inspections.value = { ...inspections.value, [id]: 'before' }
      options.changed()
    })
  }
  async function discard(id: string) {
    return work(async (host) => {
      const entry = rows.value.find(item => item.id === id && ['reviewed', 'restored', 'abandoned'].includes(item.state))
      if (!entry)
        throw new Error('CREATIVE_MEDIA_RECOVERY_REQUIRED')
      host.assertCurrent()
      await cache.discard(entry)
      host.assertCurrent()
      rows.value = rows.value.filter(item => item.id !== id)
    })
  }
  async function abandon(id: string) {
    return work(async (host, turn) => {
      const entry = rows.value.find(item => item.id === id && ['registering', 'restoring'].includes(item.state))
      if (!entry || entry.managed)
        throw new Error('CREATIVE_MEDIA_RECOVERY_REQUIRED')
      await assertCreativeMediaFilesUnchanged(host.fs, entry.projectId, entry.review, 'before', host.assertCurrent)
      await save({ ...entry, state: 'abandoned' }, turn)
      host.assertCurrent()
    })
  }
  return { rows, inspections, busy, loading, error, reload, stage, select, register, reconcile, restore, abandon, discard }
}
