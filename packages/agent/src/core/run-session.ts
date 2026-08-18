import type {
  AgentEventEnvelope,
  AgentResult,
  AgentRun,
  AgentTaskSnapshot,
} from './contracts'
import { AsyncQueue } from './async-queue'
import { AgentRuntimeError, normalizeAgentRuntimeError, runtimeError } from './errors'

function resultFromSnapshot(snapshot: AgentTaskSnapshot): AgentResult {
  if (snapshot.status !== 'completed') {
    throw new AgentRuntimeError(snapshot.error ?? {
      code: snapshot.status === 'cancelled' ? 'cancelled' : 'upstream_error',
      message: snapshot.status === 'cancelled'
        ? 'The generation was cancelled.'
        : 'The generation did not complete.',
      retryable: false,
    })
  }
  if (!snapshot.usage) {
    throw runtimeError(
      'internal_error',
      'The completed task did not include settled usage.',
    )
  }
  return {
    taskId: snapshot.taskId,
    ...(snapshot.proposal ? { proposal: snapshot.proposal } : {}),
    usage: snapshot.usage,
  }
}

export function createAgentRunSession(
  taskId: string,
  source: AsyncIterable<AgentEventEnvelope>,
  getTask: () => Promise<AgentTaskSnapshot>,
): AgentRun {
  const events = new AsyncQueue<AgentEventEnvelope>()
  let lastSnapshot: AgentTaskSnapshot | undefined

  const result = (async (): Promise<AgentResult> => {
    try {
      for await (const envelope of source) {
        if (envelope.event.type === 'state.snapshot')
          lastSnapshot = envelope.event.task
        events.push(envelope)
      }
      events.close()
      const snapshot = lastSnapshot?.status === 'completed'
        ? lastSnapshot
        : await getTask()
      return resultFromSnapshot(snapshot)
    }
    catch (error) {
      const normalized = normalizeAgentRuntimeError(error)
      events.fail(normalized)
      throw normalized
    }
  })()

  // Consumers may only iterate events; keep the result rejection observable
  // without allowing it to become an unhandled promise rejection.
  void result.catch(() => {})

  return { taskId, events, result }
}
