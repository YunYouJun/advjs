import type { CreativeArtifact, CreativePartnerOutput, CreativePlaytestReport, CreativeTeamRun } from '@advjs/agent'
import { computeAgentProjectRevision, createCreativeTeamRun, creativeMilestoneChanges, creativeOutputFileChanges, creativePlaytestCandidateFiles, ManagedCreativeTeamClient, nextCreativeTeamTask, overlayCreativeChanges, parseCreativeCandidateEditRequest, parseCreativeMilestoneCommand, parseCreativePlaytestReport, parseCreativeProject, parseCreativeTeamPublicDecision, parseCreativeTeamRun, prepareCreativeCandidateEdit, prepareCreativeMilestone, reduceCreativeTeamRun, requiredCreativeReviewCapabilities } from '@advjs/agent'
import { IonApp, IonContent, IonHeader, IonicVue, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
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
  const accountId = 'ui-fixture-author'
  const projectId = 'creative-ui-fixture'
  const pinia = createPinia()
  setActivePinia(pinia)
  const fs = new MemoryFsAdapter(projectId)
  await fs.init()
  if (!await fs.exists('adv.config.json')) {
    fs.bulkLoad(Object.entries(frozenProject.files).map(([path, content]) => ({ path, content })))
    await fs.persist()
  }
  const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
  let facts = { revision: await computeAgentProjectRevision(files), files }
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, providerCostMicroCny: 0, chargedMicroPoints: 0 }
  const calls: string[] = []
  let loseMilestoneResponse: 'prepare' | 'confirm' | undefined
  const cacheKey = 'creative-team-authoring-ui-fixture'
  const playtests: Record<string, CreativePlaytestReport> = JSON.parse(localStorage.getItem(`${cacheKey}-playtests`) || '{}')
  let run: CreativeTeamRun
  async function artifact(taskId: string, output: CreativePartnerOutput): Promise<CreativeArtifact> {
    const task = run.plan.tasks.find(item => item.id === taskId)!
    const upstream = taskId === 'script' ? run.artifacts.filter(item => item.taskId === 'cast' && item.status === 'selected') : []
    const effective = upstream.reduce((current, item) => overlayCreativeChanges(current, item.changes), facts.files)
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
      tasks: [
        { id: 'cast', partner: 'character-designer', capability: 'design-characters', dependsOn: [], sourcePaths: Object.keys(files), instruction: 'UI fixture 人物候选', expectedOutput: '可编辑的两位人物' },
        { id: 'script', partner: 'writer', capability: 'write-chapters', dependsOn: ['cast'], sourcePaths: Object.keys(files), instruction: 'UI fixture 章节交接', expectedOutput: '可编辑的章节' },
      ],
    } })
    act({ type: 'approve-plan', decisionId: 'fixture-approval' })
    act({ type: 'reserve-next', taskId: 'cast', quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: facts.revision })
    const output: CreativePartnerOutput = { kind: 'characters', summary: '本地 fixture 人物初稿', characters: [
      { id: 'lin', name: '林舟', description: '失物招领员', motivation: '归还信', speakingStyle: '短句', visualConstraints: ['旧制服'], voiceConstraints: ['低声'], relationships: [{ targetId: 'qiao', type: '陌生人', description: '初次相遇' }] },
      { id: 'qiao', name: '乔雨', description: '旅客', motivation: '找姐姐', speakingStyle: '克制', visualConstraints: [], voiceConstraints: [], relationships: [] },
    ] }
    act({ type: 'settle-task', taskId: 'cast', dispatchKey: run.tasks[0].dispatchKey!, status: 'completed', usage, artifacts: [await artifact('cast', output)] })
    persist()
  }

  async function fixtureChapter() {
    if (nextCreativeTeamTask(run) !== 'script')
      return
    act({ type: 'reserve-next', taskId: 'script', quotedMicroPoints: 0, toolCalls: 0, inputFingerprint: facts.revision })
    const selected = run.artifacts.find(item => item.taskId === 'cast' && item.status === 'selected')!
    const motivation = selected.output?.kind === 'characters' ? selected.output.characters[0].motivation : ''
    const output: CreativePartnerOutput = { kind: 'chapter', summary: '本地 fixture 章节初稿', entryChapterId: 'station', endingAddresses: ['stay#ending-stay', 'leave#ending-leave'], chapters: [{ id: 'station', title: '雨夜车站', content: `${files['adv/chapters/station.adv.md']}\n\n这是确定性 UI fixture 的交接文本：${motivation}\n` }] }
    act({ type: 'settle-task', taskId: 'script', dispatchKey: run.tasks[1].dispatchKey!, status: 'completed', usage, artifacts: [await artifact('script', output)] })
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
        value = { protocolVersion: 1, enabled: true, serviceVersion: 'UI fixture; no model calls', authoring: { candidateEdits: true, milestoneAdoption: true, playtestReports: true }, capabilities: ['design-characters', 'write-chapters'], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } }
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
      else if (method === 'GET') {
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/playtests')) {
        const project = parseCreativeProject(body.project)
        const report = parseCreativePlaytestReport(body.report)
        const expected = report.scope === 'candidate' ? creativePlaytestCandidateFiles(run, project, report.artifacts) : project.files
        if (report.baselineRevision !== project.revision || report.snapshotRevision !== await computeAgentProjectRevision(expected))
          throw new Error('fixture report source mismatch')
        const id = `fixture_playtest_${key.replaceAll('-', '')}`
        if (!playtests[id]) {
          playtests[id] = report
          run = { ...run, playtests: [...(run.playtests ?? []), { id, projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, scope: report.scope, artifacts: report.artifacts, runnerVersion: report.runnerVersion, verification: 'author-host', passed: report.executions.filter(item => item.status === 'passed').length, failed: report.executions.filter(item => item.status === 'failed').length, blocked: report.executions.filter(item => item.status === 'blocked').length, cancelled: report.executions.filter(item => item.status === 'cancelled').length, createdAt: Date.now() }], revision: run.revision + 1, updatedAt: Date.now() }
          localStorage.setItem(`${cacheKey}-playtests`, JSON.stringify(playtests))
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
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/candidate-edits')) {
        const request = parseCreativeCandidateEditRequest(body)
        const prepared = prepareCreativeCandidateEdit(run, request, facts)
        act({ type: 'edit-candidate', artifact: { ...prepared, id: `fixture_artifact_${run.artifacts.length}`, fingerprint: await computeAgentProjectRevision({ data: JSON.stringify(prepared) }) }, decisionId: key, reason: request.reason, requestFingerprint: await computeAgentProjectRevision({ data: JSON.stringify(request) }) })
        value = { protocolVersion: 1, run }
      }
      else if (url.pathname.endsWith('/decisions')) {
        act(parseCreativeTeamPublicDecision(body, key))
        await fixtureChapter()
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
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const Host = defineComponent({
    setup: () => () => h(IonApp, {}, () => h(IonPage, {}, () => [
      h(IonHeader, {}, () => h(IonToolbar, {}, () => h(IonTitle, {}, () => '本地 UI fixture · 未调用模型／未扣点'))),
      h(IonContent, {}, () => [h('p', { role: 'note', style: 'padding:16px;background:var(--adv-accent-subtle);margin:0' }, '仅验证界面与创作协议，不作为六角色真实交付。'), h(CreativeTeamWorkspace)]),
    ])),
  })
  const app = createApp(Host)
  app.use(pinia).use(IonicVue, { mode: 'ios', animated: false }).use(router).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } }))
  app.mount('#app')
  await store.refresh()
  const content = app.runWithContext(() => useProjectContent())
  Object.assign(window, { creativeAuthorFixture: {
    run: () => structuredClone(run),
    calls: () => [...calls],
    playtests: () => structuredClone(playtests),
    route: () => router.currentRoute.value.fullPath,
    async editSource(path: string, value: string) {
      await content.whenReady()
      const fs = content.getFs()!
      await fs.writeFile(path, value)
      await fs.flush?.()
    },
    loseMilestoneResponse: (phase: 'prepare' | 'confirm') => loseMilestoneResponse = phase,
    files: async () => {
      await content.whenReady()
      return Object.fromEntries((await content.getFs()!.collectAllFiles()).map(file => [file.path, file.content]))
    },
  } })
}
void main()
