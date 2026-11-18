import type { CreativePlaytestReport, CreativeTeamRun } from '@advjs/agent'
import type { Plugin } from 'vite'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
// Match the Vite client source without rebuilding the separately frozen paid CLI dist.
import { computeAgentProjectRevision, creativeMediaCanonical, creativeMilestoneChanges, overlayCreativeMilestone, parseCreativeCandidateEditRequest, parseCreativeDeliveryRequest, parseCreativeMediaCandidateRequest, parseCreativeMilestoneCommand, parseCreativePartnerOutput, parseCreativePlaytestReport, parseCreativeProject, parseCreativeTeamPublicDecision, parseCreativeTeamRun, prepareCreativeCandidateEdit, prepareCreativeDirectorSummaryEvidence, prepareCreativeMediaCandidate, prepareCreativeMilestone, reduceCreativeTeamRun } from '../../../../../packages/agent/src/index.ts'

/** Explicit local service substitute. Uses the shared validators/reducer; no models, billing or cloud DB. */
export function creativeMediaMilestoneFixtureService(): Plugin {
  const records = new Map<string, { run: CreativeTeamRun, revision: string, files: Readonly<Record<string, string>>, reports: Record<string, CreativePlaytestReport>, reportRequests: Record<string, string> }>()
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
            const chunks: Buffer[] = []
            let bytes = 0
            for await (const chunk of request) {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
              bytes += buffer.length
              if (bytes > (url.pathname === '/__creative-media-fixture/authoring-state' ? 2 * 1024 * 1024 : 192 * 1024))
                return send(413, { error: { code: 'CREATIVE_STORAGE_LIMIT', message: 'Explicit fixture body limit' } })
              chunks.push(buffer)
            }
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          }
          if (url.pathname === '/__creative-media-fixture/authoring-state' && request.method === 'POST') {
            // Test-only handoff from the template fixture's model substitute. Media
            // commands then use the same real HTTP routes as the other media cases.
            const input = body as { run: CreativeTeamRun, project: unknown, reports: Record<string, unknown> }
            const project = parseCreativeProject(input.project)
            const run = parseCreativeTeamRun(input.run, { accountId: input.run.accountId, projectId: project.id })
            if (project.id !== 'creative-ui-template-media-fixture' || await computeAgentProjectRevision(project.files) !== project.revision)
              throw new Error('CREATIVE_SOURCE_CONFLICT')
            const previous = records.get(project.id)
            if (previous && (previous.run.id !== run.id || previous.run.revision > run.revision))
              throw new Error('CREATIVE_SOURCE_CONFLICT')
            const reports = Object.fromEntries(Object.entries(input.reports).map(([id, value]) => {
              const report = parseCreativePlaytestReport(value)
              if (report.projectId !== project.id)
                throw new Error('CREATIVE_SOURCE_CONFLICT')
              return [id, report]
            }))
            records.set(project.id, { run, revision: project.revision, files: project.files, reports, reportRequests: previous?.reportRequests ?? {} })
            return send(200, {})
          }
          if (url.pathname === '/__creative-media-fixture/seed' && request.method === 'POST') {
            const input = body as { run: CreativeTeamRun, project: unknown }
            const project = parseCreativeProject(input.project)
            const run = parseCreativeTeamRun(input.run, { accountId: input.run.accountId, projectId: project.id })
            if (project.revision !== run.plan.projectRevision || await computeAgentProjectRevision(project.files) !== project.revision)
              throw new Error('CREATIVE_SOURCE_CONFLICT')
            if (!records.has(run.plan.projectId))
              records.set(project.id, { run, revision: project.revision, files: project.files, reports: {}, reportRequests: {} })
            return send(200, {})
          }
          const projectId = url.searchParams.get('projectId') ?? ''
          const record = records.get(projectId)
          if (url.pathname === '/__creative-media-fixture/authoring-state' && request.method === 'GET')
            return send(record ? 200 : 404, record ? { run: record.run, project: { id: projectId, revision: record.revision, files: record.files } } : {})
          if (url.pathname === '/__creative-media-fixture/exists')
            return send(200, { exists: Boolean(record) })
          if (url.pathname.endsWith('/capabilities'))
            return send(200, { protocolVersion: 1, enabled: projectId === 'creative-media-delivery-story' || projectId.startsWith('creative-media-voice-plan'), authoring: { sourceSync: projectId === 'creative-media-media-source-dependencies', playtestReports: projectId === 'creative-media-delivery-story', playtestVoiceCoverage: projectId === 'creative-media-delivery-story', candidateEdits: true, voiceDirectionEdits: true, milestoneAdoption: true, milestoneMerges: true, mediaCandidates: true, delivery: projectId.startsWith('creative-media-delivery-') }, serviceVersion: 'explicit local authoring service fixture; no models', capabilities: projectId === 'creative-media-delivery-story' ? ['playtest-project', 'summarize-production'] : [], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } })
          if (!record)
            return send(404, { error: { code: 'CREATIVE_NOT_FOUND', message: 'Explicit fixture project not found' } })
          const run = record.run
          if (url.pathname === `${prefix}/runs` && request.method === 'GET')
            return send(200, { protocolVersion: 1, items: [{ id: run.id, projectId, goal: run.plan.goal, status: run.status, revision: run.revision, chargedMicroPoints: run.chargedMicroPoints, reservedMicroPoints: run.reservedMicroPoints, updatedAt: run.updatedAt }] })
          if (!url.pathname.startsWith(`${prefix}/runs/${run.id}`))
            return send(404, {})
          if (url.pathname.endsWith('/source-state') && request.method === 'GET')
            return send(200, { protocolVersion: 1, run, projectRevision: record.revision })
          const key = String(request.headers['idempotency-key'] ?? '')
          if (url.pathname.endsWith('/facts') && request.method === 'POST') {
            const project = parseCreativeProject(body)
            if (project.id !== projectId || await computeAgentProjectRevision(project.files) !== project.revision)
              throw new Error('CREATIVE_SOURCE_CONFLICT')
            if (project.revision !== record.revision)
              record.run = reduceCreativeTeamRun(run, { type: 'refresh-facts', files: project.files }, Date.now())
            record.revision = project.revision
            record.files = project.files
          }
          else if (url.pathname.endsWith('/delivery') && request.method === 'POST') {
            const input = parseCreativeDeliveryRequest(body)
            if (input.project.id !== projectId || input.project.revision !== record.revision || await computeAgentProjectRevision(input.project.files) !== input.project.revision)
              throw new Error('CREATIVE_DELIVERY_CONFLICT')
            const previous = run.decisions.find(item => item.id === key)
            if (previous && (previous.action !== 'finish' || previous.requestFingerprint !== hash(input)))
              throw new Error('CREATIVE_IDEMPOTENCY_CONFLICT')
            if (!previous)
              record.run = reduceCreativeTeamRun(run, { type: 'finish', request: input, reports: Object.values(record.reports), decisionId: key, requestFingerprint: hash(input) }, Date.now())
          }
          else if (url.pathname.includes('/playtests/') && request.method === 'GET') {
            const report = record.reports[url.pathname.split('/').at(-1)!]
            return send(report ? 200 : 404, report ? { protocolVersion: 1, report } : {})
          }
          else if (url.pathname.endsWith('/playtests') && request.method === 'POST' && projectId === 'creative-media-delivery-story') {
            const input = body as { project: unknown, report: unknown }
            const project = parseCreativeProject(input.project)
            const report = parseCreativePlaytestReport(input.report)
            if (project.id !== projectId || project.revision !== record.revision || await computeAgentProjectRevision(project.files) !== project.revision
              || report.projectId !== projectId || report.scope !== 'saved' || report.baselineRevision !== project.revision || report.snapshotRevision !== project.revision) {
              throw new Error('CREATIVE_SOURCE_CONFLICT')
            }
            const id = `report_${hash([run.id, key]).slice(0, 24)}`
            if (record.reportRequests[id] && record.reportRequests[id] !== hash(input))
              throw new Error('CREATIVE_IDEMPOTENCY_CONFLICT')
            if (!record.reports[id]) {
              record.reports[id] = report
              record.reportRequests[id] = hash(input)
              const count = (status: string) => report.executions.filter(item => item.status === status).length
              record.run = { ...run, revision: run.revision + 1, updatedAt: Date.now(), playtests: [...(run.playtests ?? []), { id, intentId: key, projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, scope: report.scope, artifacts: report.artifacts, runnerVersion: report.runnerVersion, verification: 'author-host', passed: count('passed'), failed: count('failed'), blocked: count('blocked'), cancelled: count('cancelled'), createdAt: Date.now() }] }
            }
          }
          else if (url.pathname.endsWith('/candidate-edits') && request.method === 'POST') {
            const input = parseCreativeCandidateEditRequest(body)
            const previous = run.decisions.find(item => item.id === key)
            if (previous && (previous.action !== 'edit' || previous.requestFingerprint !== hash(input)))
              throw new Error('CREATIVE_IDEMPOTENCY_CONFLICT')
            if (!previous) {
              const prepared = prepareCreativeCandidateEdit(run, input, { revision: record.revision, files: record.files })
              record.run = reduceCreativeTeamRun(run, { type: 'edit-candidate', artifact: { ...prepared, id: `author_${hash([run.id, key]).slice(0, 24)}`, fingerprint: `sha256:${hash(prepared)}` }, decisionId: key, reason: input.reason, requestFingerprint: hash(input) }, Date.now())
            }
          }
          else if (url.pathname.endsWith('/decisions') && request.method === 'POST') {
            const action = parseCreativeTeamPublicDecision(body, key)
            if (action.type === 'request-rework' && action.taskId === 'check' && projectId === 'creative-media-delivery-story') {
              const requested = reduceCreativeTeamRun(run, action, Date.now())
              const output = parseCreativePartnerOutput('playtest-plan', { kind: 'playtest-plan', summary: '当前保存版本的双结局路径', scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }], concerns: [] }, { projectId, projectRevision: record.revision, files: record.files, characterIds: ['lin', 'qiao'], limits: run.plan.limits })
              const reserved = reduceCreativeTeamRun(requested, { type: 'reserve-next', taskId: 'check', quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: record.revision }, Date.now())
              record.run = reduceCreativeTeamRun(reserved, { type: 'settle-task', taskId: 'check', dispatchKey: reserved.tasks.find(item => item.taskId === 'check')!.dispatchKey!, status: 'completed', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, providerCostMicroCny: 0, chargedMicroPoints: 0 }, artifacts: [{ id: `check_${hash(key).slice(0, 20)}`, runId: run.id, taskId: 'check', partner: 'playtester', projectId, kind: 'playtest-plan', source: { projectId, revision: record.revision, files: record.files, upstream: requested.artifacts.filter(item => ['art', 'voice'].includes(item.taskId) && ['selected', 'adopted'].includes(item.status)).map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) }, fingerprint: `sha256:${hash(output)}`, summary: output.summary, output, changes: [], reviewCapabilities: [], status: 'candidate' }] }, Date.now())
            }
            else if (action.type === 'request-rework' && action.taskId === 'delivery' && projectId === 'creative-media-delivery-story') {
              const requested = reduceCreativeTeamRun(run, action, Date.now())
              const evidence = prepareCreativeDirectorSummaryEvidence(requested, 'delivery', { revision: record.revision, files: record.files }, record.reports, record.revision)
              const output = parseCreativePartnerOutput('delivery-summary', { kind: 'delivery-summary', summary: '同项目媒体与双结局的替身导演建议', overview: '只汇总实际保存的媒体、核心路径和零模型费用；模型创作与艺术品质未验收。', deliverables: evidence.state.artifacts.map(item => ({ artifactId: item.artifactId, fingerprint: item.fingerprint, assessment: '作者核对实际采用和未完成内容。' })), risks: ['其余对白与背景未制作；叙事、图片与表演品质未验收。'], nextSteps: ['作者独立审阅后决定是否结束本次有限验证。'], recommendation: 'review-current-scope' }, { projectId, projectRevision: record.revision, files: record.files, characterIds: ['lin', 'qiao'], limits: run.plan.limits, directorSummary: evidence })
              const reserved = reduceCreativeTeamRun(requested, { type: 'reserve-next', taskId: 'delivery', quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: `sha256:${hash(evidence)}` }, Date.now())
              record.run = reduceCreativeTeamRun(reserved, { type: 'settle-task', taskId: 'delivery', dispatchKey: reserved.tasks.find(item => item.taskId === 'delivery')!.dispatchKey!, status: 'completed', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, providerCostMicroCny: 0, chargedMicroPoints: 0 }, artifacts: [{ id: `summary_${hash(key).slice(0, 20)}`, runId: run.id, taskId: 'delivery', partner: 'director', projectId, kind: 'delivery-summary', source: { projectId, revision: record.revision, files: record.files, upstream: requested.artifacts.filter(item => ['selected', 'adopted'].includes(item.status)).map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) }, fingerprint: `sha256:${hash(output)}`, summary: output.summary, output, changes: [], reviewCapabilities: [], status: 'candidate' }] }, Date.now())
            }
            else {
              if (action.type !== 'select')
                throw new Error('Fixture permits only candidate selection or the explicit story summary substitute')
              record.run = reduceCreativeTeamRun(run, action, Date.now())
            }
          }
          else if (url.pathname.endsWith('/media-candidates') && request.method === 'POST') {
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
              record.files = input.project.files
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
                record.run = reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent: { id: key, operation: command.request.operation, status: 'prepared', artifacts: prepared.artifacts, anchors: prepared.anchors, ...(command.request.operation === 'adopt' && command.request.merges ? { merges: command.request.merges } : {}), beforeRevision: command.request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: hash(command.request), reason: command.request.reason, at: Date.now(), ...(command.request.operation === 'undo' ? { targetId: command.request.milestoneId } : {}) } }, Date.now())
              }
            }
            else {
              const intent = run.milestones?.find(item => item.id === command.milestoneId)
              if (!intent || command.project.revision !== (command.type === 'confirm' ? intent.afterRevision : intent.beforeRevision) || await computeAgentProjectRevision(command.project.files) !== command.project.revision)
                throw new Error('CREATIVE_SOURCE_CONFLICT')
              if (intent.status === 'prepared') {
                // Reconstruct the immutable author resolutions with the product transform.
                const expected = creativeMilestoneChanges(run, intent)
                const reversed = expected.map(item => ({ path: item.path, before: item.after, after: item.before }))
                if (command.type === 'confirm' && await computeAgentProjectRevision(overlayCreativeMilestone(command.project.files, reversed)) !== intent.beforeRevision)
                  throw new Error('CREATIVE_SOURCE_CONFLICT')
                record.run = reduceCreativeTeamRun(run, { type: 'resolve-milestone', milestoneId: intent.id, status: command.type === 'confirm' ? 'confirmed' : 'abandoned', files: command.project.files }, Date.now())
                record.revision = command.project.revision
                record.files = command.project.files
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
