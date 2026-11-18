import type { CreativeTeamRun } from './contracts'
import type { CreativePlaytestReport } from './playtest-contracts'
import type { CreativeTeamStartRequest } from './wire'
import { invalidateCreativeArtifacts } from './candidates'
import { matchesCreativeVoiceLineSource } from './voice-lines'
import { parseCreativeProject } from './wire'

export interface CreativeDeliveryDisposition {
  artifactId: string
  fingerprint: string
  disposition: 'adopted' | 'reference' | 'excluded'
  reason: string
}
export interface CreativeDeliveryRequest {
  project: CreativeTeamStartRequest['project']
  runRevision: number
  reason: string
  dispositions: readonly CreativeDeliveryDisposition[]
  acknowledgeUnverified: true
}
/** A historical author decision, never a model quality verdict or release certificate. */
export interface CreativeDeliveryReceipt {
  id: string
  projectRevision: string
  runRevision: number
  reason: string
  dispositions: readonly CreativeDeliveryDisposition[]
  milestoneIds: readonly string[]
  playtestIds: readonly string[]
  pendingMedia: readonly { artifactId: string, target: string }[]
  chargedMicroPoints: number
  toolCalls: number
  verification: 'author-host'
  unverified: readonly ['visual-quality', 'audio-playback', 'narrative-consistency', 'unspecified-paths', 'native-ios']
  at: number
}
export const CREATIVE_DELIVERY_UNVERIFIED = ['visual-quality', 'audio-playback', 'narrative-consistency', 'unspecified-paths', 'native-ios'] as const

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new TypeError('Invalid creative delivery object')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new TypeError('Invalid creative delivery text')
  return value
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new TypeError('Invalid creative delivery number')
  return Number(value)
}
function dispositions(value: unknown): CreativeDeliveryDisposition[] {
  if (!Array.isArray(value) || !value.length || value.length > 256)
    throw new TypeError('Invalid creative delivery scope')
  const result = value.map((value): CreativeDeliveryDisposition => {
    const item = object(value, ['artifactId', 'fingerprint', 'disposition', 'reason'])
    if (!['adopted', 'reference', 'excluded'].includes(String(item.disposition)))
      throw new TypeError('Invalid creative delivery disposition')
    return { artifactId: text(item.artifactId), fingerprint: text(item.fingerprint), disposition: item.disposition as CreativeDeliveryDisposition['disposition'], reason: text(item.reason, 4000) }
  })
  if (new Set(result.map(item => item.artifactId)).size !== result.length)
    throw new TypeError('Duplicate creative delivery input')
  return result.sort((a, b) => a.artifactId.localeCompare(b.artifactId, 'en'))
}
export function parseCreativeDeliveryRequest(value: unknown): CreativeDeliveryRequest {
  const root = object(value, ['project', 'runRevision', 'reason', 'dispositions', 'acknowledgeUnverified'])
  if (root.acknowledgeUnverified !== true || integer(root.runRevision) < 1)
    throw new TypeError('Creative delivery requires an explicit author acknowledgement')
  return { project: parseCreativeProject(root.project), runRevision: integer(root.runRevision), reason: text(root.reason, 4000), dispositions: dispositions(root.dispositions), acknowledgeUnverified: true }
}
export function parseCreativeDeliveryReceipt(value: unknown): CreativeDeliveryReceipt {
  const root = object(value, ['id', 'projectRevision', 'runRevision', 'reason', 'dispositions', 'milestoneIds', 'playtestIds', 'pendingMedia', 'chargedMicroPoints', 'toolCalls', 'verification', 'unverified', 'at'])
  const ids = (value: unknown): string[] => {
    if (!Array.isArray(value) || value.length > 128 || new Set(value).size !== value.length)
      throw new TypeError('Invalid creative delivery evidence')
    return value.map(item => text(item))
  }
  if (!Array.isArray(root.pendingMedia) || root.pendingMedia.length > 4096)
    throw new TypeError('Invalid pending delivery media')
  const pendingMedia = root.pendingMedia.map((value) => {
    const item = object(value, ['artifactId', 'target'])
    return { artifactId: text(item.artifactId), target: text(item.target, 600) }
  })
  if (root.verification !== 'author-host' || JSON.stringify(root.unverified) !== JSON.stringify(CREATIVE_DELIVERY_UNVERIFIED))
    throw new TypeError('Invalid creative delivery authority')
  return { id: text(root.id), projectRevision: text(root.projectRevision), runRevision: integer(root.runRevision), reason: text(root.reason, 4000), dispositions: dispositions(root.dispositions), milestoneIds: ids(root.milestoneIds), playtestIds: ids(root.playtestIds), pendingMedia, chargedMicroPoints: integer(root.chargedMicroPoints), toolCalls: integer(root.toolCalls), verification: 'author-host', unverified: [...CREATIVE_DELIVERY_UNVERIFIED], at: integer(root.at) }
}

/** Pending requests stay visible even when the author retains a plan as reference. */
export function creativeDeliveryPendingMedia(run: CreativeTeamRun, files: Readonly<Record<string, string>>): CreativeDeliveryReceipt['pendingMedia'] {
  return run.artifacts.filter(item => ['selected', 'adopted'].includes(item.status)).flatMap((artifact) => {
    const media = run.artifacts.filter(item => item.status === 'adopted' && item.media?.parent.artifactId === artifact.id && item.media.parent.fingerprint === artifact.fingerprint).map(item => item.media!)
    if (artifact.output?.kind === 'art-direction')
      return artifact.output.requests.filter(request => !media.some(item => item.target.kind === 'image' && item.target.assetId === request.assetId)).map(request => ({ artifactId: artifact.id, target: request.assetId }))
    if (artifact.output?.kind === 'voice-direction')
      return artifact.output.lines.filter(line => !media.some(item => item.target.kind === 'voice' && item.target.phase === 'selected' && matchesCreativeVoiceLineSource(line, files, item.target.lineId))).map(line => ({ artifactId: artifact.id, target: `${line.path}:${line.lineId ?? line.line}` }))
    return []
  })
}

/** Derive receipts from persisted records. A caller cannot supply costs, evidence or task success. */
export function prepareCreativeDelivery(run: CreativeTeamRun, request: CreativeDeliveryRequest, id: string, now: number, reports: readonly CreativePlaytestReport[] = []): CreativeDeliveryReceipt {
  if (run.revision !== request.runRevision || run.plan.projectId !== request.project.id)
    throw new Error('CREATIVE_DELIVERY_CONFLICT')
  if (['awaiting_plan_review', 'completed', 'cancelled', 'cancel_requested'].includes(run.status)
    || run.tasks.some(task => task.status !== 'completed') || run.reservedMicroPoints
    || run.milestones?.some(item => item.status === 'prepared')) {
    throw new Error('CREATIVE_DELIVERY_PENDING')
  }
  const current = run.artifacts.filter(item => ['selected', 'adopted'].includes(item.status))
  if (!current.length || request.dispositions.length !== current.length
    || invalidateCreativeArtifacts(run.artifacts, request.project.files, run).some(item => current.some(selected => selected.id === item.id) && item.status === 'stale')) {
    throw new Error('CREATIVE_DELIVERY_CONFLICT')
  }
  const milestones = run.milestones?.filter(item => item.status === 'confirmed') ?? []
  const playtests = run.playtests?.filter(item => item.scope === 'saved' && item.snapshotRevision === request.project.revision) ?? []
  for (const item of request.dispositions) {
    const artifact = current.find(artifact => artifact.id === item.artifactId && artifact.fingerprint === item.fingerprint)
    if (!artifact)
      throw new Error('CREATIVE_DELIVERY_CONFLICT')
    if (artifact.status === 'adopted') {
      if (item.disposition !== 'adopted' || !milestones.some(milestone => milestone.operation === 'adopt' && milestone.artifacts.some(reference => reference.artifactId === artifact.id && reference.fingerprint === artifact.fingerprint)
        && !milestones.some(undo => undo.operation === 'undo' && undo.targetId === milestone.id))) {
        throw new Error('CREATIVE_DELIVERY_CONFLICT')
      }
    }
    else if (item.disposition === 'adopted' || (item.disposition === 'reference' && artifact.changes.length)) {
      throw new Error('CREATIVE_DELIVERY_DISPOSITION_REQUIRED')
    }
    if (item.disposition === 'reference' && artifact.output?.kind === 'playtest-plan') {
      const currentReports = reports.filter(report => report.projectId === request.project.id && report.scope === 'saved' && report.snapshotRevision === request.project.revision && report.executions.length > 0 && report.executions.every(item => item.status === 'passed'))
      if (!playtests.some(report => report.passed > 0 && !report.failed && !report.blocked && !report.cancelled)
        || artifact.output.scenarios.some(scenario => !currentReports.some(report => report.executions.some(execution => execution.scenario.id === scenario.id && execution.scenario.expectedEnding === scenario.expectedEnding && JSON.stringify(execution.scenario.choices) === JSON.stringify(scenario.choices))))) {
        throw new Error('CREATIVE_DELIVERY_PLAYTEST_REQUIRED')
      }
    }
  }
  return { id, projectRevision: request.project.revision, runRevision: run.revision, reason: request.reason, dispositions: structuredClone(request.dispositions), milestoneIds: milestones.map(item => item.id), playtestIds: playtests.map(item => item.id), pendingMedia: creativeDeliveryPendingMedia(run, request.project.files), chargedMicroPoints: run.chargedMicroPoints, toolCalls: run.toolCalls, verification: 'author-host', unverified: [...CREATIVE_DELIVERY_UNVERIFIED], at: now }
}
