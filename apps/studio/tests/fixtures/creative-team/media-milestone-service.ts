import type { CreativeTeamRun } from '@advjs/agent'
import type { Plugin } from 'vite'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { computeAgentProjectRevision, creativeMediaCanonical, overlayCreativeMilestone, parseCreativeMediaCandidateRequest, parseCreativeMilestoneCommand, parseCreativeTeamRun, prepareCreativeMediaCandidate, prepareCreativeMilestone, reduceCreativeTeamRun } from '@advjs/agent'

/** Explicit local service substitute. Uses the shared validators/reducer; no models, billing or cloud DB. */
export function creativeMediaMilestoneFixtureService(): Plugin {
  const records = new Map<string, { run: CreativeTeamRun, revision: string }>()
  const hash = (value: unknown) => createHash('sha256').update(creativeMediaCanonical(value)).digest('hex')
  return {
    name: 'creative-media-milestone-fixture-service',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1:4198')
        const prefix = '/ai/v2/apps/advjs-studio-web/creative-team'
        if (!url.pathname.startsWith(prefix) && !url.pathname.startsWith('/__creative-media-fixture'))
          return next()
        const send = (status: number, value: unknown) => {
          response.statusCode = status
          response.setHeader('content-type', 'application/json')
          response.end(JSON.stringify(value))
        }
        try {
          let body: unknown
          if (request.method === 'POST') {
            let text = ''
            for await (const chunk of request) {
              text += chunk.toString()
              if (Buffer.byteLength(text) > 192 * 1024)
                return send(413, { error: { code: 'CREATIVE_STORAGE_LIMIT', message: 'Explicit fixture body limit' } })
            }
            body = JSON.parse(text)
          }
          if (url.pathname === '/__creative-media-fixture/seed' && request.method === 'POST') {
            const input = body as CreativeTeamRun
            const run = parseCreativeTeamRun(input, { accountId: input.accountId, projectId: input.plan.projectId })
            if (!records.has(run.plan.projectId))
              records.set(run.plan.projectId, { run, revision: run.plan.projectRevision })
            return send(200, {})
          }
          const projectId = url.searchParams.get('projectId') ?? ''
          const record = records.get(projectId)
          if (url.pathname === '/__creative-media-fixture/exists')
            return send(200, { exists: Boolean(record) })
          if (url.pathname.endsWith('/capabilities'))
            return send(200, { protocolVersion: 1, enabled: false, authoring: { candidateEdits: true, milestoneAdoption: true, mediaCandidates: true }, serviceVersion: 'explicit local media service fixture; no models', capabilities: [], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } })
          if (!record)
            return send(404, { error: { code: 'CREATIVE_NOT_FOUND', message: 'Explicit fixture project not found' } })
          const run = record.run
          if (url.pathname === `${prefix}/runs` && request.method === 'GET')
            return send(200, { protocolVersion: 1, items: [{ id: run.id, projectId, goal: run.plan.goal, status: run.status, revision: run.revision, chargedMicroPoints: run.chargedMicroPoints, reservedMicroPoints: run.reservedMicroPoints, updatedAt: run.updatedAt }] })
          if (!url.pathname.startsWith(`${prefix}/runs/${run.id}`))
            return send(404, {})
          const key = String(request.headers['idempotency-key'] ?? '')
          if (url.pathname.endsWith('/media-candidates') && request.method === 'POST') {
            const input = parseCreativeMediaCandidateRequest(body)
            if (input.project.id !== projectId || await computeAgentProjectRevision(input.project.files) !== input.project.revision)
              throw new Error('CREATIVE_SOURCE_CONFLICT')
            const previous = run.decisions.find(item => item.id === key)
            if (previous && previous.requestFingerprint !== hash(input))
              throw new Error('CREATIVE_IDEMPOTENCY_CONFLICT')
            if (!previous) {
              const current = record.revision === input.project.revision ? run : reduceCreativeTeamRun(run, { type: 'refresh-facts', files: input.project.files }, Date.now())
              const prepared = prepareCreativeMediaCandidate(current, input, hash)
              const id = `media_${hash([run.id, key]).slice(0, 24)}`
              record.run = reduceCreativeTeamRun(current, { type: 'register-media', artifact: { ...prepared, id, fingerprint: `sha256:${hash(prepared)}` }, decisionId: key, reason: input.reason, requestFingerprint: hash(input) }, Date.now())
              record.revision = input.project.revision
            }
          }
          else if (url.pathname.endsWith('/milestones') && request.method === 'POST') {
            const command = parseCreativeMilestoneCommand(body)
            if (command.type === 'prepare') {
              const previous = run.milestones?.find(item => item.id === key)
              if (previous && previous.requestFingerprint !== hash(command.request))
                throw new Error('CREATIVE_IDEMPOTENCY_CONFLICT')
              if (!previous) {
                const prepared = prepareCreativeMilestone(run, command.request)
                record.run = reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent: { id: key, operation: command.request.operation, status: 'prepared', artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: command.request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: hash(command.request), reason: command.request.reason, at: Date.now(), ...(command.request.operation === 'undo' ? { targetId: command.request.milestoneId } : {}) } }, Date.now())
              }
            }
            else {
              const intent = run.milestones?.find(item => item.id === command.milestoneId)
              if (!intent || command.project.revision !== (command.type === 'confirm' ? intent.afterRevision : intent.beforeRevision) || await computeAgentProjectRevision(command.project.files) !== command.project.revision)
                throw new Error('CREATIVE_SOURCE_CONFLICT')
              if (intent.status === 'prepared') {
                const selected = intent.operation === 'adopt' ? intent : run.milestones!.find(item => item.id === intent.targetId)!
                // The real Runtime performs its own immutable reconstruction; reuse the shared transform here.
                const changes = selected.artifacts.flatMap(reference => run.artifacts.find(item => item.id === reference.artifactId)!.changes)
                const expected = intent.operation === 'adopt' ? changes : changes.map(item => ({ path: item.path, before: item.after, after: item.before }))
                const reversed = expected.map(item => ({ path: item.path, before: item.after, after: item.before }))
                if (command.type === 'confirm' && await computeAgentProjectRevision(overlayCreativeMilestone(command.project.files, reversed)) !== intent.beforeRevision)
                  throw new Error('CREATIVE_SOURCE_CONFLICT')
                record.run = reduceCreativeTeamRun(run, { type: 'resolve-milestone', milestoneId: intent.id, status: command.type === 'confirm' ? 'confirmed' : 'abandoned', files: command.project.files }, Date.now())
                record.revision = command.project.revision
              }
            }
          }
          else if (request.method !== 'GET') {
            return send(405, { error: { code: 'CREATIVE_DISABLED', message: 'No model or billing route exists in this fixture' } })
          }
          send(200, { protocolVersion: 1, run: record.run })
        }
        catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Fixture request failed'
          send(cause instanceof TypeError ? 400 : 409, { error: { code: 'CREATIVE_SOURCE_CONFLICT', message } })
        }
      })
    },
  }
}
