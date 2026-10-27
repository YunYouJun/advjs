import type { CreativePlaytestReport, CreativePlaytestScenario, CreativeProjectWorkspace, CreativeTeamRun } from '@advjs/agent'
import type { CreativePlaytestCache, CreativePlaytestCacheEntry } from '../utils/creativePlaytestCache'
import { computeAgentProjectRevision, creativePlaytestFindings, runCreativePlaytest } from '@advjs/agent'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'
import { creativePlaytestCache } from '../utils/creativePlaytestCache'

export function useCreativePlaytest(options: { run: () => CreativeTeamRun, workspace: () => Promise<CreativeProjectWorkspace>, cache?: CreativePlaytestCache }) {
  const store = useCreativeTeamStore()
  const cache = options.cache ?? creativePlaytestCache
  const report = shallowRef<CreativePlaytestReport>()
  const entries = shallowRef<CreativePlaytestCacheEntry[]>([])
  const activeEntry = shallowRef<CreativePlaytestCacheEntry>()
  const remoteReportId = shallowRef<string>()
  const storedReportId = computed(() => activeEntry.value ? options.run().playtests?.find(item => item.intentId === activeEntry.value?.id)?.id : remoteReportId.value)
  const busy = shallowRef(false)
  const repairBusy = shallowRef(false)
  const error = shallowRef<'execution' | 'storage' | 'sync' | 'scope' | 'repair'>()
  const currentRevision = shallowRef<string>()
  let epoch = 0
  let selection = 0
  let controller: AbortController | undefined
  const scope = () => ({ accountId: options.run().accountId, projectId: options.run().plan.projectId, runId: options.run().id })
  const currentScope = (before: ReturnType<typeof scope>) => {
    const current = scope()
    return before.accountId === current.accountId && before.projectId === current.projectId && before.runId === current.runId
  }
  const stale = computed(() => Boolean(report.value && ((currentRevision.value !== report.value.baselineRevision && currentRevision.value !== report.value.snapshotRevision)
    || report.value.artifacts.some(reference => !options.run().artifacts.some(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint && ['selected', 'adopted'].includes(item.status))))))
  async function checkVersion() {
    const turn = epoch
    const snapshot = await (await options.workspace()).snapshot()
    if (turn === epoch)
      currentRevision.value = snapshot.revision
  }
  async function reload() {
    const turn = epoch
    const selected = selection
    const before = scope()
    try {
      const values = await cache.list(before)
      if (turn !== epoch || selected !== selection || !currentScope(before))
        return
      entries.value = values
      activeEntry.value = values[0]
      report.value = values[0]?.report
      await checkVersion()
    }
    catch {
      if (turn === epoch)
        error.value = 'storage'
    }
  }
  watch(() => JSON.stringify(scope()), () => {
    epoch += 1
    controller?.abort()
    report.value = undefined
    remoteReportId.value = undefined
    activeEntry.value = undefined
    entries.value = []
    currentRevision.value = undefined
    error.value = undefined
    busy.value = false
    repairBusy.value = false
    void reload()
  }, { immediate: true })
  onBeforeUnmount(() => {
    epoch += 1
    controller?.abort()
  })

  async function sync(entry = activeEntry.value) {
    if (!entry || entry.synced || !currentScope(entry))
      return
    const turn = epoch
    try {
      if (await store.recordPlaytest(entry.project, entry.report, entry.id)) {
        if (turn !== epoch)
          return
        const saved = { ...entry, synced: true }
        await cache.save(saved)
        if (turn !== epoch)
          return
        activeEntry.value = saved
        entries.value = entries.value.map(item => item.id === saved.id ? saved : item)
      }
      else if (turn === epoch) {
        error.value = 'sync'
      }
    }
    catch {
      if (turn === epoch)
        error.value = 'sync'
    }
  }

  async function execute(scenarios: readonly CreativePlaytestScenario[], candidate: boolean) {
    if (busy.value || repairBusy.value || store.mutating)
      return
    const turn = epoch
    selection += 1
    const before = scope()
    const run = options.run()
    controller = new AbortController()
    const signal = controller.signal
    busy.value = true
    error.value = undefined
    try {
      const snapshot = await (await options.workspace()).snapshot()
      if (turn !== epoch || !currentScope(before))
        return
      const project = { id: snapshot.projectId, revision: snapshot.revision, files: snapshot.files }
      const references = run.artifacts.filter(item => ['selected', 'adopted'].includes(item.status)).map(item => ({ artifactId: item.id, fingerprint: item.fingerprint }))
      if (candidate && !references.length)
        throw new Error('No selected candidates')
      const result = await runCreativePlaytest({ project, scenarios, ...(candidate ? { candidate: { run, artifacts: references } } : {}) }, { signal, yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)) })
      if (turn !== epoch || !currentScope(before))
        return
      report.value = result
      remoteReportId.value = undefined
      activeEntry.value = undefined
      const entry: CreativePlaytestCacheEntry = { ...before, id: crypto.randomUUID(), project, report: result, synced: false }
      try {
        await cache.save(entry)
      }
      catch {
        error.value = 'storage'
        return
      }
      if (turn !== epoch || !currentScope(before))
        return
      activeEntry.value = entry
      entries.value = [entry, ...entries.value]
      await checkVersion()
      if (store.availability?.authoring?.playtestReports && !stale.value)
        await sync(entry)
    }
    catch {
      if (turn === epoch)
        error.value = 'execution'
    }
    finally {
      if (turn === epoch)
        busy.value = false
    }
  }

  async function open(id: string) {
    const turn = epoch
    const selected = ++selection
    try {
      const entry = entries.value.find(item => item.id === id)
      if (entry) {
        activeEntry.value = entry
        remoteReportId.value = undefined
        report.value = entry.report
      }
      else {
        const value = await store.getPlaytest(id)
        if (turn === epoch && selected === selection && value) {
          activeEntry.value = undefined
          remoteReportId.value = id
          report.value = value
        }
      }
      if (turn === epoch && selected === selection)
        await checkVersion()
    }
    catch {
      if (turn === epoch && selected === selection)
        error.value = 'sync'
    }
  }

  async function requestRepair(taskId: string, findingId: string) {
    if (busy.value || repairBusy.value || store.mutating || !report.value || !storedReportId.value)
      return false
    const turn = epoch
    const before = scope()
    const evidence = report.value
    const reportId = storedReportId.value
    const finding = creativePlaytestFindings(evidence).find(item => item.id === findingId)
    repairBusy.value = true
    error.value = undefined
    try {
      const snapshot = await (await options.workspace()).snapshot()
      if (turn !== epoch || !currentScope(before))
        return false
      currentRevision.value = snapshot.revision
      if (!finding || stale.value || snapshot.revision !== evidence.baselineRevision)
        throw new Error('Repair source changed')
      const intent = `repair_${(await computeAgentProjectRevision({ reference: JSON.stringify([reportId, taskId, findingId]) })).slice(7)}`
      if (turn !== epoch || !currentScope(before))
        return false
      const result = await store.requestPlaytestRepair({ type: 'request-rework', taskId, reason: `Author requested repair of ${findingId} from author-host report ${reportId}`, playtestRepair: { reportId, snapshotRevision: evidence.snapshotRevision, findingId } }, { id: snapshot.projectId, revision: snapshot.revision, files: snapshot.files }, intent)
      if (!result && turn === epoch)
        error.value = 'repair'
      return result
    }
    catch {
      if (turn === epoch)
        error.value = 'repair'
      return false
    }
    finally {
      if (turn === epoch)
        repairBusy.value = false
    }
  }

  return { report, repairBusy, storedReportId, requestRepair, entries, activeEntry, busy, error, stale, execute, sync, open, checkVersion, stop: () => controller?.abort() }
}
