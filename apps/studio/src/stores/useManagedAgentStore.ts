import type { AgentError, AgentRequest, AgentRuntime, AgentTaskState, AgentTaskStatus, ManagedAgentPointsAccount, ManagedAgentPointsReader } from '@advjs/agent'
import { AgentTaskStore, normalizeAgentRuntimeError } from '@advjs/agent'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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
  let generation = 0

  const activeTaskId = computed(() => points.value?.activeTask ?? task.value?.taskId)
  const status = computed<AgentTaskStatus | undefined>(() => task.value?.snapshot?.status)
  const hasServerActiveTask = computed(() => Boolean(points.value?.activeTask) || (points.value?.activeReservationCount ?? 0) > 0)
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
    generation += 1
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
    const epoch = generation
    unsubscribeTask = runtimeStore.subscribe(taskId, (next) => {
      if (epoch !== generation)
        return
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
    const epoch = generation
    const currentPoints = pointsReader
    const currentRuntime = runtimeStore

    refreshPromise = (async () => {
      isRefreshing.value = true
      try {
        const account = await currentPoints.getPoints()
        if (epoch !== generation)
          return
        points.value = account
        error.value = undefined
        if (!account.activeTask)
          return

        bindTask(account.activeTask)
        const snapshot = await currentRuntime.recover(account.activeTask)
        if (epoch !== generation)
          return
        if (
          options.resume !== false
          && ACTIVE_STATUSES.has(snapshot.status)
          && !currentRuntime.read(account.activeTask)?.connecting
        ) {
          await currentRuntime.resume(account.activeTask, task.value?.cursor)
        }
      }
      catch (cause) {
        if (epoch === generation)
          error.value = normalizeAgentRuntimeError(cause).detail
      }
      finally {
        if (epoch === generation) {
          isRefreshing.value = false
          refreshPromise = undefined
        }
      }
    })()
    return refreshPromise
  }

  async function startTask<TInput>(request: AgentRequest<TInput>): Promise<string> {
    if (!runtimeStore || !pointsReader)
      throw new Error('Managed AI is not configured.')
    if (hasActiveTask.value)
      throw new Error('A managed AI task is already active.')
    const epoch = generation
    const currentRuntime = runtimeStore
    try {
      const taskId = await currentRuntime.start(request)
      if (epoch !== generation)
        throw new Error('Managed AI session changed.')
      bindTask(taskId)
      void refreshPoints({ resume: false })
      return taskId
    }
    catch (cause) {
      if (epoch === generation)
        error.value = normalizeAgentRuntimeError(cause).detail
      throw cause
    }
  }

  async function reconnect(): Promise<void> {
    const taskId = activeTaskId.value
    if (!runtimeStore || !taskId)
      return
    const epoch = generation
    const currentRuntime = runtimeStore
    error.value = undefined
    bindTask(taskId)
    try {
      const snapshot = await currentRuntime.recover(taskId)
      if (epoch === generation && ACTIVE_STATUSES.has(snapshot.status))
        await currentRuntime.resume(taskId, task.value?.cursor)
    }
    catch (cause) {
      if (epoch === generation)
        error.value = normalizeAgentRuntimeError(cause).detail
    }
  }

  async function cancelActiveTask(): Promise<void> {
    const taskId = activeTaskId.value
    if (!runtimeStore || !taskId || isCancelling.value)
      return
    const epoch = generation
    const currentRuntime = runtimeStore
    isCancelling.value = true
    try {
      await currentRuntime.cancel(taskId)
      if (epoch === generation)
        await refreshPoints({ resume: false })
    }
    catch (cause) {
      if (epoch === generation)
        error.value = normalizeAgentRuntimeError(cause).detail
    }
    finally {
      if (epoch === generation)
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
