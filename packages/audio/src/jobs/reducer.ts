import type { VoiceGenerationJob, VoiceGenerationTaskStatus } from './contracts'

export type VoiceGenerationEvent
  = | { type: 'cancel' }
    | { type: 'resume' }
    | { type: 'task', taskId: string, status: VoiceGenerationTaskStatus, errorCode?: string, takeId?: string, assetId?: string }

const transitions: Record<VoiceGenerationTaskStatus, VoiceGenerationTaskStatus[]> = {
  queued: ['queued', 'running', 'committed', 'cancelled', 'failed', 'blocked', 'generated', 'unknown'],
  running: ['queued', 'generated', 'unknown', 'failed', 'committed', 'blocked'],
  unknown: ['queued', 'generated', 'committed', 'failed', 'blocked', 'unknown'],
  generated: ['committed', 'failed', 'blocked'],
  committed: ['committed'],
  failed: ['queued', 'committed', 'generated', 'blocked'],
  cancelled: ['queued', 'committed', 'blocked'],
  blocked: ['queued', 'running', 'unknown', 'generated', 'committed', 'failed', 'cancelled', 'blocked'],
}

/** Deterministic transitions never reopen committed work or erase uncertain dispatch. */
export function reduceVoiceGenerationJob(job: VoiceGenerationJob, event: VoiceGenerationEvent, now: number): VoiceGenerationJob {
  const next = structuredClone(job)
  next.updatedAt = new Date(now).toISOString()
  next.expiresAt = new Date(Math.max(Date.parse(next.expiresAt), now + next.retentionDays * 86_400_000)).toISOString()
  if (event.type === 'cancel') {
    next.cancelled = true
    for (const task of next.tasks) {
      if (task.status === 'queued' || task.status === 'blocked')
        task.status = 'cancelled'
    }
  }
  else if (event.type === 'resume') {
    next.cancelled = false
    for (const task of next.tasks) {
      if (task.status === 'cancelled')
        task.status = 'queued'
    }
  }
  else {
    const task = next.tasks.find(task => task.id === event.taskId)
    if (!task || !transitions[task.status].includes(event.status))
      throw new Error('AUDIO_JOB_TRANSITION_INVALID: Durable task state does not permit this transition')
    task.status = event.status
    delete task.errorCode
    if (event.errorCode)
      task.errorCode = event.errorCode
    if (event.takeId)
      task.takeId = event.takeId
    if (event.assetId)
      task.assetId = event.assetId
  }
  return next
}
