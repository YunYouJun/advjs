import type { CreativeArtifact, CreativePartnerOutput, CreativePlaytestReport, CreativeTeamRun } from '@advjs/agent'
import { assertCreativePlaytestNarrativeSource, computeAgentProjectRevision, createCreativeTeamRun, creativeMediaCanonical, creativeMilestoneChanges, creativeOutputFileChanges, creativePlaytestCandidateFiles, ManagedCreativeTeamClient, nextCreativeTeamTask, overlayCreativeChanges, parseCreativeCandidateEditRequest, parseCreativeDeliveryRequest, parseCreativeMilestoneCommand, parseCreativePartnerOutput, parseCreativePlaytestReport, parseCreativeProject, parseCreativeTeamPublicDecision, parseCreativeTeamRun, prepareCreativeCandidateEdit, prepareCreativeDirectorSummaryEvidence, prepareCreativeMilestone, prepareCreativePlaytestRepair, reduceCreativeTeamRun, requiredCreativeReviewCapabilities } from '@advjs/agent'
import { IonApp, IonContent, IonHeader, IonicVue, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { createRouter as createIonicRouter } from '@ionic/vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import frozenProject from '../../../../../packages/agent/test/fixtures/creative-team/v2/project.json'
import CreativeTeamWorkspace from '../../../src/components/creative-team/CreativeTeamWorkspace.vue'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import { creativeTeamMessages } from '../../../src/i18n/locales/creativeTeam'
import { useAuthStore } from '../../../src/stores/useAuthStore'
import { useCreativeTeamStore } from '../../../src/stores/useCreativeTeamStore'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import 'virtual:uno.css'

/** Dedicated UI fixture. No production auth, model, point ledger or network adapter is used. */
async function main() {
  const summaryMode = new URL(location.href).searchParams.get('case') === 'director-summary'
  const narrativeMode = new URL(location.href).searchParams.get('case') === 'narrative-review'
  const sourceMode = new URL(location.href).searchParams.get('case') === 'source-text'
  const sourceSyncMode = new URL(location.href).searchParams.get('case') === 'source-sync'
  const oldService = new URL(location.href).searchParams.get('legacyService') === 'old'
  const accountId = 'ui-fixture-author'
  const projectId = sourceSyncMode ? 'creative-ui-source-sync-fixture' : sourceMode ? 'creative-ui-source-text-fixture' : summaryMode ? 'creative-ui-director-summary-fixture' : narrativeMode ? 'creative-ui-narrative-review-fixture' : 'creative-ui-fixture'
  const pinia = createPinia()
  setActivePinia(pinia)
  const fs = new MemoryFsAdapter(projectId)
  await fs.init()
  if (!await fs.exists('adv.config.json')) {
    const initial = { ...frozenProject.files }
    if (narrativeMode) {
      initial['adv/world.md'] = '# 雨夜车站\n科技水平与当代相同，不存在超能力。\n'
      initial['adv/chapters/station.adv.md'] = '# 雨夜车站 {#arrival}\n\n> 林舟没有借助设备，瞬移穿过封闭的站台。\n\n> 乔雨读了一本描写超能力的小说。\n\n- [留下](stay#ending-stay)\n- [离开](leave#ending-leave)\n'
    }
    fs.bulkLoad(Object.entries(initial).map(([path, content]) => ({ path, content })))
    await fs.persist()
  }
  const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
  let facts = { revision: await computeAgentProjectRevision(files), files }
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, providerCostMicroCny: 0, chargedMicroPoints: 0 }
  const calls: string[] = []
  let loseMilestoneResponse: 'prepare' | 'confirm' | undefined
  let loseEditResponse = false
  let loseFactsResponse = false
  let heldSourceState: Promise<void> | undefined
  let releaseSourceState: (() => void) | undefined
  const editRequests: { key: string, requestFingerprint: string }[] = []
  const cacheKey = `creative-team-authoring-ui-fixture${sourceSyncMode ? '-source-sync' : sourceMode ? '-source' : summaryMode ? '-director' : narrativeMode ? '-narrative' : ''}`
  const summaryHandoffs: unknown[] = []
  const repairHandoffs: unknown[] = []
  const playtestSources: Record<string, unknown> = JSON.parse(localStorage.getItem(`${cacheKey}-playtest-sources`) || '{}')
  const playtests: Record<string, CreativePlaytestReport> = JSON.parse(localStorage.getItem(`${cacheKey}-playtests`) || '{}')
  let run: CreativeTeamRun
  async function artifact(taskId: string, output: CreativePartnerOutput): Promise<CreativeArtifact> {
    const task = run.plan.tasks.find(item => item.id === taskId)!
    const upstream = taskId === 'check' ? run.artifacts.filter(item => ['cast', 'script'].includes(item.taskId) && item.status === 'selected') : taskId === 'script' ? run.artifacts.filter(item => item.taskId === 'cast' && item.status === 'selected') : taskId === 'delivery' ? run.artifacts.filter(item => item.kind !== 'delivery-summary' && ['selected', 'adopted'].includes(item.status)) : []
    const effective = upstream.filter(item => item.status === 'selected').reduce((current, item) => overlayCreativeChanges(current, item.changes), facts.files)
    const changes = creativeOutputFileChanges(output, effective)
    const result: CreativeArtifact = {
      id: `fixture_artifact_${run.artifacts.length}`,
      runId: run.id,
      taskId,
      partner: task.partner,
      projectId,
      kind: output.kind === 'production-plan' ? 'production-brief' : output.kind,
      summary: output.summary,
      output,
      changes,
      source: { projectId, revision: facts.revision, files: facts.files, upstream: upstream.map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) },
      fingerprint: await computeAgentProjectRevision({ data: JSON.stringify({ output, changes }) }),
      status: 'candidate',
      reviewCapabilities: [],
    }
    result.reviewCapabilities = requiredCreativeReviewCapabilities(result)
    return result
  }
  async function legacyArtifact(taskId: string, content: string): Promise<CreativeArtifact> {
    const task = run.plan.tasks.find(item => item.id === taskId)!
    const upstream = taskId === 'script' ? run.artifacts.filter(item => item.taskId === 'outline' && item.status === 'selected') : []
    const effective = upstream.reduce((current, item) => overlayCreativeChanges(current, item.changes), facts.files)
    const path = taskId === 'outline' ? 'adv/outline.md' : 'adv/chapters/station.adv.md'
    const changes = [{ path, before: effective[path] ?? null, after: content }]
    const result: CreativeArtifact = {
      id: `fixture_artifact_${run.artifacts.length}`,
      runId: run.id,
      taskId,
      partner: task.partner,
      projectId,
      kind: taskId === 'outline' ? 'outline' : 'chapter',
      summary: taskId === 'outline' ? '本地 fixture 旧大纲' : '本地 fixture 旧章节',
      changes,
      source: { projectId, revision: facts.revision, files: facts.files, upstream: upstream.map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) },
      fingerprint: await computeAgentProjectRevision({ data: JSON.stringify(changes) }),
      status: 'candidate',
      reviewCapabilities: [],
    }
    result.reviewCapabilities = requiredCreativeReviewCapabilities(result)
    return result
  }
  function act(action: Parameters<typeof reduceCreativeTeamRun>[1]) {
    run = reduceCreativeTeamRun(run, action, Date.now())
  }
  function persist() {
    localStorage.setItem(cacheKey, JSON.stringify(run))
  }
  const saved = localStorage.getItem(cacheKey)
  if (saved) {
    run = parseCreativeTeamRun(JSON.parse(saved), { accountId, projectId })
  }
  else {
    run = createCreativeTeamRun({ id: 'ui_fixture_run', accountId, now: Date.now(), plan: {
      protocolVersion: 1,
      projectId,
      projectRevision: facts.revision,
      goal: '本地 UI fixture：人物和章节修订，不代表模型执行',
      limits: { maxTasks: 4, maxToolCalls: 8, maxReworkRounds: 2, maxMicroPoints: 0 },
      tasks: sourceMode
        ? [
            { id: 'outline', partner: 'director', capability: 'generate-outline', dependsOn: [], sourcePaths: Object.keys(files), instruction: '明确的旧版原文大纲 fixture', expectedOutput: '单文件原文补丁' },
            { id: 'script', partner: 'writer', capability: 'generate-chapter-draft', dependsOn: ['outline'], sourcePaths: Object.keys(files), instruction: '明确的旧版原文章节 fixture', expectedOutput: '单文件原文补丁' },
          ]
        : [
            { id: 'cast', partner: 'character-designer', capability: 'design-characters', dependsOn: [], sourcePaths: Object.keys(files), instruction: 'UI fixture 人物候选', expectedOutput: '可编辑的两位人物' },
            { id: 'script', partner: 'writer', capability: 'write-chapters', dependsOn: ['cast'], sourcePaths: Object.keys(files), instruction: 'UI fixture 章节交接', expectedOutput: '可编辑的章节' },
            ...(narrativeMode ? [{ id: 'check', partner: 'playtester' as const, capability: 'playtest-project' as const, dependsOn: ['script'], sourcePaths: Object.keys(files), instruction: '明确的本地 fixture：独立提出成对来源的剧情疑点', expectedOutput: '待作者核对的疑点及双结局计划' }] : []),
            ...(summaryMode ? [{ id: 'delivery', partner: 'director' as const, capability: 'summarize-production' as const, dependsOn: ['script'], sourcePaths: Object.keys(files), instruction: '明确的本地 fixture：作者请求后汇总实际记录', expectedOutput: '导演交付建议，仍须作者独立收尾' }] : []),
          ],
    } })
    act({ type: 'approve-plan', decisionId: 'fixture-approval' })
    const firstTask = sourceMode ? 'outline' : 'cast'
    act({ type: 'reserve-next', taskId: firstTask, quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: facts.revision })
    const output: CreativePartnerOutput = { kind: 'characters', summary: '本地 fixture 人物初稿', characters: [
      { id: 'lin', name: '林舟', description: '失物招领员', motivation: '归还信', speakingStyle: '短句', visualConstraints: ['旧制服'], voiceConstraints: ['低声'], relationships: [{ targetId: 'qiao', type: '陌生人', description: '初次相遇' }] },
      { id: 'qiao', name: '乔雨', description: '旅客', motivation: '找姐姐', speakingStyle: '克制', visualConstraints: [], voiceConstraints: [], relationships: [] },
    ] }
    act({ type: 'settle-task', taskId: firstTask, dispatchKey: run.tasks[0].dispatchKey!, status: 'completed', usage, artifacts: [sourceMode ? await legacyArtifact('outline', '# 雨夜车站\n归还信件，选择留下或离开。\n') : await artifact('cast', output)] })
    persist()
  }

  async function fixtureChapter() {
    if (nextCreativeTeamTask(run) !== 'script')
      return
    act({ type: 'reserve-next', taskId: 'script', quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: facts.revision })
    if (sourceMode) {
      const selected = run.artifacts.find(item => item.taskId === 'outline' && item.status === 'selected')!
      const clue = selected.changes[0]!.after!.includes('信封线索') ? '信封线索' : '旧信'
      const content = `# 雨夜车站 {#arrival}\n\n@lin\n这封信还没有送到。\n\n@qiao\n请再等一会儿。\n\n> 他们望向${clue}。\n\n- [留下](stay#ending-stay)\n- [离开](leave#ending-leave)\n`
      act({ type: 'settle-task', taskId: 'script', dispatchKey: run.tasks[1].dispatchKey!, status: 'completed', usage, artifacts: [await legacyArtifact('script', content)] })
      return
    }
    const selected = run.artifacts.find(item => item.taskId === 'cast' && item.status === 'selected')!
    const motivation = selected.output?.kind === 'characters' ? selected.output.characters[0].motivation : ''
    const output: CreativePartnerOutput = { kind: 'chapter', summary: '本地 fixture 章节初稿', entryChapterId: 'station', endingAddresses: ['stay#ending-stay', 'leave#ending-leave'], chapters: [{ id: 'station', title: '雨夜车站', content: `${files['adv/chapters/station.adv.md']}\n\n这是确定性 UI fixture 的交接文本：${motivation}\n` }] }
    if (narrativeMode && run.tasks.find(task => task.taskId === 'script')?.playtestRepair?.reference.findingId.startsWith('narrative:'))
      output.chapters = output.chapters.map(chapter => ({ ...chapter, content: chapter.content.replace('没有借助设备，瞬移穿过封闭的站台', '沿着通道，走到站台另一端') }))
    if (summaryMode)
      output.chapters = output.chapters.map(chapter => ({ ...chapter, content: chapter.content.replace('林舟：「你在等谁？」', '@lin\n你在等谁？').replace('乔雨：「一个还没回来的人。」', '@qiao\n一个还没回来的人。') }))
    act({ type: 'settle-task', taskId: 'script', dispatchKey: run.tasks[1].dispatchKey!, status: 'completed', usage, artifacts: [await artifact('script', output)] })
  }

  async function fixtureNarrativeReview() {
    if (!narrativeMode || nextCreativeTeamTask(run) !== 'check')
      return
    const upstream = run.artifacts.filter(item => ['cast', 'script'].includes(item.taskId) && item.status === 'selected')
    const effective = upstream.reduce((current, item) => overlayCreativeChanges(current, item.changes), facts.files)
    const path = 'adv/chapters/station.adv.md'
    const lines = effective[path].split('\n')
    const expectation = { path: 'adv/world.md', line: 2, endLine: 2, text: effective['adv/world.md'].split('\n')[1] }
    const concerns = []
    if (lines[2].includes('瞬移'))
      concerns.push({ path, line: 3, expected: '这个世界不允许人物直接使用超能力。', actual: '客观叙述直接描写人物瞬移，缺少设定允许的原因。', suggestion: '交还编剧改写动作或补足合理因果。', evidence: { expected: expectation, actual: { path, line: 3, endLine: 3, text: lines[2] } } })
    concerns.push({ path, line: 5, expected: '这个世界没有超能力。', actual: '正文出现描写超能力的小说，需要核对是否违背世界规则。', suggestion: '作者可根据虚构作品与现实事件的区别排除此疑点。', evidence: { expected: expectation, actual: { path, line: 5, endLine: 5, text: lines[4] } } })
    const output = parseCreativePartnerOutput('playtest-plan', { kind: 'playtest-plan', summary: '本地 fixture 剧情检查', scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }], concerns }, { projectId, projectRevision: facts.revision, files: effective, characterIds: ['lin', 'qiao'], limits: run.plan.limits })
    act({ type: 'reserve-next', taskId: 'check', quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: facts.revision })
    act({ type: 'settle-task', taskId: 'check', dispatchKey: run.tasks.find(task => task.taskId === 'check')!.dispatchKey!, status: 'completed', usage, artifacts: [await artifact('check', output)] })
  }

  async function fixtureDirectorSummary() {
    if (nextCreativeTeamTask(run) !== 'delivery')
      return
    const changes = creativeMilestoneChanges(run, { operation: 'adopt', artifacts: run.artifacts.filter(item => item.status === 'selected' && item.kind !== 'delivery-summary').map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) })
    const snapshot = overlayCreativeChanges(facts.files, changes)
    const evidence = prepareCreativeDirectorSummaryEvidence(run, 'delivery', facts, playtests, await computeAgentProjectRevision(snapshot))
    summaryHandoffs.push(structuredClone(evidence))
    act({ type: 'reserve-next', taskId: 'delivery', quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: await computeAgentProjectRevision({ evidence: JSON.stringify(evidence) }) })
    const output = parseCreativePartnerOutput('delivery-summary', { kind: 'delivery-summary', summary: '本地 fixture 导演交付建议', overview: '明确的本地替身建议；依据已保存实际项目、成果与核心路径记录，不能证明模型品质。', deliverables: evidence.state.artifacts.map(item => ({ artifactId: item.artifactId, fingerprint: item.fingerprint, assessment: '本地替身评价：保留实际状态，由作者判断交付范围。' })), risks: ['画面、音频及叙事品质仍未验收'], nextSteps: ['作者核对实际范围后独立决定是否结束制作组'], recommendation: 'review-current-scope' }, { projectId, projectRevision: facts.revision, files: snapshot, characterIds: ['lin', 'qiao'], limits: run.plan.limits, directorSummary: evidence })
    act({ type: 'settle-task', taskId: 'delivery', dispatchKey: run.tasks.find(task => task.taskId === 'delivery')!.dispatchKey!, status: 'completed', usage, artifacts: [await artifact('delivery', output)] })
  }

  const client = new ManagedCreativeTeamClient({ accountId, baseUrl: 'http://127.0.0.1:4198', getAccessToken: () => 'ui-fixture-only', fetch: async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url.pathname}`)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const key = new Headers(init?.headers).get('idempotency-key') ?? ''
    let value: unknown
    try {
      if (url.pathname.endsWith('/capabilities')) {
        value = { protocolVersion: 1, enabled: true, serviceVersion: 'UI fixture; no model calls', authoring: { candidateEdits: true, ...(sourceSyncMode && !oldService ? { sourceSync: true } : {}), ...(sourceMode && !oldService ? { rawTextEdits: true } : {}), milestoneAdoption: true, playtestReports: true, playtestRepair: true, playtestNarrativeReview: narrativeMode, delivery: summaryMode }, capabilities: ['playtest-project', 'design-characters', 'write-chapters', 'generate-outline', 'generate-chapter-draft', ...(summaryMode ? ['summarize-production'] : [])], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } }
      }
      else if (method === 'GET' && url.pathname.endsWith('/runs')) {
        value = { protocolVersion: 1, items: [{ id: run.id, projectId, goal: run.plan.goal, status: run.status, revision: run.revision, chargedMicroPoints: 0, reservedMicroPoints: 0, updatedAt: run.updatedAt }] }
      }
      else if (method === 'GET' && /\/playtests\/[\w-]+$/.test(url.pathname)) {
        const report = playtests[url.pathname.split('/').at(-1)!]
        if (!report)
          return new Response('{}', { status: 404 })
        value = { protocolVersion: 1, report }
      }
      else if (method === 'GET' && url.pathname.endsWith('/source-state')) {
        if (heldSourceState) {
          const pending = heldSourceState
          heldSourceState = undefined
          await pending
        }
        value = { protocolVersion: 1, run, projectRevision: facts.revision }
      }
      else if (method === 'GET') {
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/playtests')) {
        const project = parseCreativeProject(body.project)
        const report = parseCreativePlaytestReport(body.report)
        const expected = report.scope === 'candidate' ? creativePlaytestCandidateFiles(run, project, report.artifacts) : project.files
        if (report.baselineRevision !== project.revision || report.snapshotRevision !== await computeAgentProjectRevision(expected))
          throw new Error('fixture report source mismatch')
        if (report.narrativeReview)
          assertCreativePlaytestNarrativeSource(report.narrativeReview, run, expected, project.files)
        const id = `fixture_playtest_${key.replaceAll('-', '')}`
        if (!playtests[id]) {
          if (narrativeMode) {
            playtestSources[id] = { project, effectiveFiles: expected, run: structuredClone(run) }
            localStorage.setItem(`${cacheKey}-playtest-sources`, JSON.stringify(playtestSources))
          }
          playtests[id] = report
          run = { ...run, playtests: [...(run.playtests ?? []), { id, intentId: key, projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, scope: report.scope, artifacts: report.artifacts, runnerVersion: report.runnerVersion, verification: 'author-host', passed: report.executions.filter(item => item.status === 'passed').length, failed: report.executions.filter(item => item.status === 'failed').length, blocked: report.executions.filter(item => item.status === 'blocked').length, cancelled: report.executions.filter(item => item.status === 'cancelled').length, createdAt: Date.now() }], revision: run.revision + 1, updatedAt: Date.now() }
          localStorage.setItem(`${cacheKey}-playtests`, JSON.stringify(playtests))
          act({ type: 'refresh-facts', files: facts.files })
        }
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/milestones')) {
        const command = parseCreativeMilestoneCommand(body)
        if (command.type === 'prepare') {
          if (!run.milestones?.some(item => item.id === key)) {
            const prepared = prepareCreativeMilestone(run, command.request)
            facts = { revision: command.request.project.revision, files: { ...command.request.project.files } }
            act({ type: 'prepare-milestone', intent: { id: key, operation: command.request.operation, status: 'prepared', artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: facts.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: await computeAgentProjectRevision({ data: JSON.stringify(command.request) }), reason: command.request.reason, at: Date.now(), ...(command.request.operation === 'undo' ? { targetId: command.request.milestoneId } : {}) } })
          }
        }
        else {
          const intent = run.milestones!.find(item => item.id === command.milestoneId)!
          const expected = command.type === 'confirm' ? intent.afterRevision : intent.beforeRevision
          if (command.project.revision !== expected)
            throw new Error('fixture adoption source mismatch')
          if (intent.status === 'prepared') {
            if (command.type === 'confirm' && await computeAgentProjectRevision(overlayCreativeChanges(facts.files, creativeMilestoneChanges(run, intent))) !== expected)
              throw new Error('fixture adoption transformation mismatch')
            facts = { revision: command.project.revision, files: { ...command.project.files } }
            act({ type: 'resolve-milestone', milestoneId: intent.id, status: command.type === 'confirm' ? 'confirmed' : 'abandoned', files: facts.files })
          }
        }
        persist()
        if (loseMilestoneResponse === command.type) {
          loseMilestoneResponse = undefined
          return new Response(JSON.stringify({ error: { code: 'service_unavailable', message: 'Explicit fixture: response lost after durable write' } }), { status: 503 })
        }
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/facts')) {
        const project = parseCreativeProject(body)
        facts = { revision: project.revision, files: { ...project.files } }
        act({ type: 'refresh-facts', files: facts.files })
        if (loseFactsResponse) {
          loseFactsResponse = false
          persist()
          return new Response(JSON.stringify({ error: { code: 'service_unavailable', message: 'Explicit fixture: facts response lost after durable write' } }), { status: 503 })
        }
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/candidate-edits')) {
        const request = parseCreativeCandidateEditRequest(body)
        const requestFingerprint = await computeAgentProjectRevision({ data: creativeMediaCanonical(request) })
        editRequests.push({ key, requestFingerprint })
        const previous = run.decisions.find(item => item.id === key)
        if (previous?.requestFingerprint && previous.requestFingerprint !== requestFingerprint)
          throw new Error('fixture edit idempotency conflict')
        if (!previous) {
          const prepared = prepareCreativeCandidateEdit(run, request, facts)
          act({ type: 'edit-candidate', artifact: { ...prepared, id: `fixture_artifact_${run.artifacts.length}`, fingerprint: await computeAgentProjectRevision({ data: JSON.stringify(prepared) }) }, decisionId: key, reason: request.reason, requestFingerprint })
        }
        persist()
        if (loseEditResponse) {
          loseEditResponse = false
          return new Response(JSON.stringify({ error: { code: 'service_unavailable', message: 'Explicit fixture: edit response lost after durable write' } }), { status: 503 })
        }
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/delivery') && method === 'POST' && summaryMode) {
        const request = parseCreativeDeliveryRequest(body)
        const requestFingerprint = await computeAgentProjectRevision({ request: JSON.stringify(request) })
        const previous = run.decisions.find(item => item.id === key)
        if (previous?.requestFingerprint && previous.requestFingerprint !== requestFingerprint)
          throw new Error('fixture delivery idempotency conflict')
        act({ type: 'finish', request, reports: Object.values(playtests), decisionId: key, requestFingerprint })
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/decisions')) {
        const action = parseCreativeTeamPublicDecision(body, key)
        if (action.type === 'request-rework' && action.playtestRepair && !run.decisions.some(item => item.id === key)) {
          const report = playtests[action.playtestRepair.reportId]
          if (!report)
            throw new Error('fixture report not found')
          repairHandoffs.push(prepareCreativePlaytestRepair({ run, taskId: action.taskId, reference: action.playtestRepair, report, project: { id: projectId, ...facts } }))
        }
        act(action)
        await fixtureChapter()
        await fixtureNarrativeReview()
        if (summaryMode && action.type === 'request-rework' && action.taskId === 'delivery')
          await fixtureDirectorSummary()
        value = { protocolVersion: 1, run }
      }
      else {
        return new Response('{}', { status: 404 })
      }
      persist()
      return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
    }
    catch {
      return new Response(JSON.stringify({ error: { code: 'CREATIVE_EDIT_SOURCE_CONFLICT', message: 'UI fixture source conflict' } }), { status: 409 })
    }
  } })
  const auth = useAuthStore()
  auth.userInfo = { id: accountId }
  auth.session = { accessToken: 'ui-fixture-only', user: { id: accountId } }
  await useStudioStore().switchProject({ projectId, name: '候选编辑 UI fixture', source: 'local', lastOpened: Date.now() })
  const store = useCreativeTeamStore()
  store.configure({ accountId, projectId, client })
  const router = (sourceSyncMode ? createIonicRouter : createRouter)({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const Host = defineComponent({
    setup: () => () => {
      const page = h(IonPage, {}, () => [
        h(IonHeader, {}, () => h(IonToolbar, {}, () => h(IonTitle, {}, () => '本地 UI fixture · 未调用模型／未扣点'))),
        h(IonContent, {}, () => [h('p', { role: 'note', style: 'padding:16px;background:var(--adv-accent-subtle);margin:0' }, '仅验证界面与创作协议，不作为六角色真实交付。'), h(CreativeTeamWorkspace)]),
      ])
      return sourceSyncMode ? page : h(IonApp, {}, () => page)
    },
  })
  if (sourceSyncMode) {
    router.addRoute({ path: '/', component: Host })
    router.addRoute({ path: '/editor', component: () => import('../../../src/views/EditorPage.vue') })
    await router.replace('/')
  }
  const app = createApp(sourceSyncMode
    ? defineComponent({ setup: () => () => h(IonApp, {}, () => [
        h(RouterView),
        h('nav', { 'style': 'position:fixed;bottom:0;right:0;z-index:10000;background:white;padding:4px', 'aria-label': '本地 fixture 导航' }, [
          h('button', { onClick: () => router.push({ path: '/editor', query: { file: 'adv/chapters/station.adv.md' } }) }, '普通章节编辑器'),
          h('button', { onClick: () => router.push('/') }, '返回制作组 fixture'),
        ]),
      ]) })
    : Host)
  const i18n = sourceSyncMode ? (await import('../../../src/i18n')).default : createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } })
  app.use(pinia).use(IonicVue, { mode: 'ios', animated: false }).use(router).use(i18n)
  app.mount('#app')
  await store.refresh()
  const content = app.runWithContext(() => useProjectContent())
  Object.assign(window, { creativeAuthorFixture: {
    run: () => structuredClone(run),
    calls: () => [...calls],
    playtests: () => structuredClone(playtests),
    playtestSources: () => structuredClone(playtestSources),
    repairHandoffs: () => structuredClone(repairHandoffs),
    summaryHandoffs: () => structuredClone(summaryHandoffs),
    route: () => router.currentRoute.value.fullPath,
    async editSource(path: string, value: string) {
      await content.whenReady()
      const fs = content.getFs()!
      await fs.writeFile(path, value)
      await fs.flush?.()
    },
    loseMilestoneResponse: (phase: 'prepare' | 'confirm') => loseMilestoneResponse = phase,
    loseEditResponse: () => loseEditResponse = true,
    loseFactsResponse: () => loseFactsResponse = true,
    holdNextSourceState() {
      heldSourceState = new Promise<void>((resolve) => {
        releaseSourceState = resolve
      })
    },
    releaseSourceState() {
      releaseSourceState?.()
      releaseSourceState = undefined
    },
    editRequests: () => structuredClone(editRequests),
    files: async () => {
      await content.whenReady()
      return Object.fromEntries((await content.getFs()!.collectAllFiles()).map(file => [file.path, file.content]))
    },
  } })
}
void main()
