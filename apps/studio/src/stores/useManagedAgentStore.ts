import type { AgentError, AgentRequest, AgentRuntime, AgentTaskStatus } from '../agent/core/contracts'
import type { AgentTaskState } from '../agent/core/task-store'
import type { ManagedAgentPointsAccount, ManagedAgentPointsReader } from '../agent/managed/points'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { normalizeAgentRuntimeError } from '../agent/core/errors'
import { AgentTaskStore } from '../agent/core/task-store'

const ACTIVE_STATUSES = new Set<AgentTaskStatus>([
  'authorizing',
  'queued',
  'running',
  'settling',
])

export interface ManagedAgentConnection {
  points: ManagedAgentPointsReader
  runtime: AgentRuntime
}

function cloneTaskState(state: Readonly<AgentTaskState>): AgentTaskState {
  return {
    ...state,
    snapshot: state.snapshot ? { ...state.snapshot } : undefined,
  }
}

export const useManagedAgentStore = defineStore('managed-agent', () => {
  const points = ref<ManagedAgentPointsAccount>()
  const task = ref<AgentTaskState>()
  const isRefreshing = ref(false)
  const isCancelling = ref(false)
  const isConfigured = ref(false)
  const error = ref<AgentError>()

  let runtimeStore: AgentTaskStore | undefined
  let pointsReader: ManagedAgentPointsReader | undefined
  let unsubscribeTask: (() => void) | undefined
  let lastTerminalStatus: AgentTaskStatus | undefined
  let refreshPromise: Promise<void> | undefined

  const activeTaskId = computed(() => points.value?.activeTask ?? task.value?.taskId)
  const status = computed<AgentTaskStatus | undefined>(() => task.value?.snapshot?.status)
  const hasServerActiveTask = computed(() => Boolean(points.value?.activeTask))
  const hasActiveTask = computed(() => hasServerActiveTask.value || Boolean(status.value && ACTIVE_STATUSES.has(status.value)))
  const canStartTask = computed(() => isConfigured.value && !hasActiveTask.value && !isRefreshing.value)

  function configure(connection: ManagedAgentConnection): void {
    disconnect()
    runtimeStore = new AgentTaskStore(connection.runtime)
    pointsReader = connection.points
    isConfigured.value = true
    error.value = undefined
  }

  function disconnect(): void {
    unsubscribeTask?.()
    unsubscribeTask = undefined
    runtimeStore = undefined
    pointsReader = undefined
    points.value = undefined
    task.value = undefined
    error.value = undefined
    lastTerminalStatus = undefined
    isConfigured.value = false
    isRefreshing.value = false
    isCancelling.value = false
    refreshPromise = undefined
  }

  function bindTask(taskId: string): void {
    if (!runtimeStore)
      return
    if (task.value?.taskId === taskId && unsubscribeTask)
      return
    unsubscribeTask?.()
    task.value = {
      taskId,
      streamText: '',
      connecting: false,
      recovering: false,
    }
    lastTerminalStatus = undefined
    unsubscribeTask = runtimeStore.subscribe(taskId, (next) => {
      task.value = cloneTaskState(next)
      error.value = next.error
      const nextStatus = next.snapshot?.status
      if (nextStatus && !ACTIVE_STATUSES.has(nextStatus) && nextStatus !== lastTerminalStatus) {
        lastTerminalStatus = nextStatus
        void refreshPoints({ resume: false })
      }
    })
  }

  async function refreshPoints(options: { resume?: boolean } = {}): Promise<void> {
    if (!pointsReader || !runtimeStore)
      return
    if (refreshPromise)
      return refreshPromise

    refreshPromise = (async () => {
      isRefreshing.value = true
      try {
        const account = await pointsReader!.getPoints()
        points.value = account
        error.value = undefined
        if (!account.activeTask)
          return

        bindTask(account.activeTask)
        const snapshot = await runtimeStore!.recover(account.activeTask)
        if (
          options.resume !== false
          && ACTIVE_STATUSES.has(snapshot.status)
          && !runtimeStore!.read(account.activeTask)?.connecting
        ) {
          await runtimeStore!.resume(account.activeTask, task.value?.cursor)
        }
      }
      catch (cause) {
        error.value = normalizeAgentRuntimeError(cause).detail
      }
      finally {
        isRefreshing.value = false
        refreshPromise = undefined
      }
    })()
    return refreshPromise
  }

  async function startTask<TInput>(request: AgentRequest<TInput>): Promise<string> {
    if (!runtimeStore || !pointsReader)
      throw new Error('Managed AI is not configured.')
    if (hasActiveTask.value)
      throw new Error('A managed AI task is already active.')
    try {
      const taskId = await runtimeStore.start(request)
      bindTask(taskId)
      void refreshPoints({ resume: false })
      return taskId
    }
    catch (cause) {
      error.value = normalizeAgentRuntimeError(cause).detail
      throw cause
    }
  }

  async function reconnect(): Promise<void> {
    const taskId = activeTaskId.value
    if (!runtimeStore || !taskId)
      return
    error.value = undefined
    bindTask(taskId)
    try {
      const snapshot = await runtimeStore.recover(taskId)
      if (ACTIVE_STATUSES.has(snapshot.status))
        await runtimeStore.resume(taskId, task.value?.cursor)
    }
    catch (cause) {
      error.value = normalizeAgentRuntimeError(cause).detail
    }
  }

  async function cancelActiveTask(): Promise<void> {
    const taskId = activeTaskId.value
    if (!runtimeStore || !taskId || isCancelling.value)
      return
    isCancelling.value = true
    try {
      await runtimeStore.cancel(taskId)
      await refreshPoints({ resume: false })
    }
    catch (cause) {
      error.value = normalizeAgentRuntimeError(cause).detail
    }
    finally {
      isCancelling.value = false
    }
  }

  return {
    points,
    task,
    error,
    isRefreshing,
    isCancelling,
    isConfigured,
    activeTaskId,
    status,
    hasActiveTask,
    canStartTask,
    configure,
    disconnect,
    refreshPoints,
    startTask,
    reconnect,
    cancelActiveTask,
  }
})
