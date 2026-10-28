import { computeAgentProjectRevision, createCreativeTeamRun, creativeOutputFileChanges, ManagedCreativeTeamClient } from '@advjs/agent'
import { IonApp, IonContent, IonHeader, IonicVue, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import CreativeTeamWorkspace from '../../../src/components/creative-team/CreativeTeamWorkspace.vue'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import { creativeTeamMessages } from '../../../src/i18n/locales/creativeTeam'
import { useAuthStore } from '../../../src/stores/useAuthStore'
import { useCreativeTeamStore } from '../../../src/stores/useCreativeTeamStore'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import { creativeAdoptionJournal } from '../../../src/utils/creativeAdoptionJournal'
import { creativeArtImportCache } from '../../../src/utils/creativeArtImportCache'
import { creativePlaytestCache } from '../../../src/utils/creativePlaytestCache'
import { creativeVoiceImportCache } from '../../../src/utils/creativeVoiceImportCache'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import 'virtual:uno.css'

/** Read-only startup evidence for diagnosing an interrupted page reopen. */
const boot = { stage: 'imports-loaded', timeline: [] as { stage: string, at: number }[] }
Object.assign(window, { creativeMediaBoot: boot })
function mark(stage: string) {
  boot.stage = stage
  boot.timeline.push({ stage, at: performance.now() })
}

/** Proposals, identities and service storage are explicit fixtures; media and product transactions are real. */
async function main() {
  mark('starting')
  const variant = new URL(location.href).searchParams.get('case')?.replace(/[^a-z0-9-]/gi, '').slice(0, 60) ?? 'batch'
  const accountId = 'media-milestone-fixture-author'
  const projectId = `creative-media-${variant}`
  const runId = `media_${variant}`
  const scope = { accountId, projectId, runId }
  const pinia = createPinia()
  setActivePinia(pinia)
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
  const originals: Record<string, string> = {
    'adv.config.json': json({ schemaVersion: 1, id: projectId, root: 'adv', format: 'adv-md' }),
    'adv/settings/game.json': json({ entryChapterId: 'intro', locale: 'zh-CN' }),
    'adv/assets.json': json({ schemaVersion: 2, id: projectId, defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, includes: ['assets/audio.json', 'assets/other.json'] }),
    'adv/assets/audio.json': json({ schemaVersion: 2, assets: [] }),
    'adv/assets/other.json': json({ schemaVersion: 2, assets: [] }),
    'adv/characters/lin.character.md': '---\nid: lin\nname: 林\nvoiceProfile:\n  intent:\n    speakingStyle: 平静\n  locales:\n    zh-CN:\n      providers:\n        local-system:\n          voiceId: Tingting\n          model: macos-say\n          source: system\n---\n外部系统语音和既有小云图片的真实媒体回流验证，不表示人物美术或表演品质。',
    'adv/chapters/intro.adv.md': '# 等车 {#start}\n\n@lin\n列车还没有到，我们再等一会儿。 {#line_01900400-0000-7000-8000-000000000001}\n\n@lin\n这是下一句，没有绑定配音。',
  }
  const multilineNarration = variant === 'markdown-narration-selected'
  const multilineDialogue = variant === 'markdown-dialogue-selected'
  const markdownBlock = multilineNarration ? '> 列车还没有到，\n> 我们再**等一会儿**。 {#line_01900400-0000-7000-8000-000000000001}' : '@lin\n列车还没有到，\n我们再**等一会儿**。 {#line_01900400-0000-7000-8000-000000000001}'
  if (multilineDialogue || multilineNarration)
    originals['adv/chapters/intro.adv.md'] = `# 等车 {#start}\n\n${multilineNarration ? '@lin\n这是第一句，尚未配置配音。 {#line_01900400-0000-7000-8000-000000000002}\n\n' : ''}${markdownBlock}`
  if (multilineNarration)
    originals['adv/audio/voice-profiles.json'] = json({ schemaVersion: 1, revision: 1, narrator: { intent: { speakingStyle: '独立系统旁白，不借用角色 Profile' }, locales: { 'zh-CN': { providers: { 'local-system': { voiceId: 'Tingting', model: 'macos-say', source: 'system' } } } } } })
  if (variant.startsWith('voice-plan')) {
    originals['adv/chapters/intro.adv.md'] += '\n\n> 站台上的灯亮了。 {#line_01900400-0000-7000-8000-000000000003}'
    originals['adv/audio/pronunciation.json'] = json({ schemaVersion: 1, revision: 4, replacements: { ADV: '冒险' }, locales: { 'en': { replacements: { station: 'station' } }, 'zh-CN': { replacements: { 车站: '车站' } } } })
    originals['adv/audio/voice-profiles.json'] = json({ schemaVersion: 1, revision: 2, narrator: { intent: { temperament: ['从容'], speakingStyle: '既有旁白' } } })
  }
  if (variant === 'voice-plan-flow' || variant === 'flow-selected-playback') {
    originals['adv.config.json'] = json({ schemaVersion: 1, id: projectId, root: 'adv', format: 'flow' })
    delete originals['adv/chapters/intro.adv.md']
    originals['adv/chapters/intro.chapter.json'] = json({ schemaVersion: 1, id: 'intro', title: '全部 Flow 配音', nodes: [{ id: 'start', type: 'dialogues', dialogues: [{ speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', lineId: 'line_01900400-0000-7000-8000-000000000001' }, { speakerId: 'lin', text: '这是方案未列出的 Flow 对白。', lineId: 'line_01900400-0000-7000-8000-000000000002' }] }, { id: 'narration', type: 'narration', text: '站台上的灯亮了。', lineId: 'line_01900400-0000-7000-8000-000000000003' }] })
  }
  if (variant === 'flow-selected-playback') {
    const chapter = JSON.parse(originals['adv/chapters/intro.chapter.json']!)
    chapter.nodes[0].dialogues[0].text = '这是第一句，尚未配置配音。'
    chapter.nodes[0].dialogues[1].text = '列车还没有到，我们再等一会儿。'
    originals['adv/chapters/intro.chapter.json'] = json(chapter)
  }
  const fs = new MemoryFsAdapter(projectId)
  mark('filesystem-init')
  await fs.init()
  mark('filesystem-ready')
  if (!await fs.exists('adv.config.json')) {
    fs.bulkLoad(Object.entries(originals).map(([path, content]) => ({ path, content })))
    await fs.persist()
  }
  mark('source-ready')
  const baselineRevision = await computeAgentProjectRevision(originals)
  const run = createCreativeTeamRun({ id: runId, accountId, now: 0, plan: { protocolVersion: 1, projectId, projectRevision: baselineRevision, goal: '明确的本地服务 fixture：真实 WebP 与 WAV 通过同一里程碑', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [
    { id: 'art', partner: 'art-director', capability: 'direct-art', dependsOn: [], sourcePaths: Object.keys(originals), instruction: 'Existing image only', expectedOutput: 'Image binding' },
    { id: 'voice', partner: 'voice-director', capability: 'direct-voice', dependsOn: [], sourcePaths: Object.keys(originals), instruction: 'Existing real speech only', expectedOutput: 'Unselected take registration' },
  ] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'art', status: 'completed', attempt: 1, artifactIds: ['art-direction'] }, { taskId: 'voice', status: 'completed', attempt: 1, artifactIds: ['voice-direction'] }]
  const source = { projectId, revision: baselineRevision, files: originals, upstream: [] }
  run.artifacts = [
    { id: 'art-direction', runId, taskId: 'art', partner: 'art-director', projectId, kind: 'art-direction', source, fingerprint: 'art-v1', summary: '既有图片回流方案 fixture', output: { kind: 'art-direction', summary: '既有图片回流方案 fixture', style: 'Preserve the repository image', requests: [{ assetId: 'character/lin/default', kind: 'portrait', characterId: 'lin', width: 619, height: 619, prompt: 'Existing image for protocol verification', constraints: [] }] }, changes: [], reviewCapabilities: [], status: 'selected' },
    { id: 'voice-direction', runId, taskId: 'voice', partner: 'voice-director', projectId, kind: 'voice-direction', source, fingerprint: 'voice-v1', summary: '真实系统语音回流方案 fixture', output: { kind: 'voice-direction', summary: '真实系统语音回流方案 fixture', cast: [{ speakerId: 'lin', designBrief: 'Tingting system voice', performance: 'Calm' }, { speakerId: 'narrator', designBrief: 'Independent narrator', performance: 'Not produced' }], dictionary: [], lines: [{ path: 'adv/chapters/intro.adv.md', line: 4, speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', instruction: '平静地邀请同伴继续等待' }] }, changes: [], reviewCapabilities: ['voice-take'], status: 'selected' },
  ]
  if (multilineDialogue || multilineNarration) {
    const output = run.artifacts[1]!.output!
    if (output.kind === 'voice-direction')
      output.lines = [{ path: 'adv/chapters/intro.adv.md', lineId: 'line_01900400-0000-7000-8000-000000000001', source: { line: multilineNarration ? 6 : 3, endLine: multilineNarration ? 7 : 5, text: markdownBlock }, speakerId: multilineNarration ? 'narrator' : 'lin', text: '列车还没有到，\n我们再等一会儿。', instruction: '完整多行原文，保留独立身份与换行' }]
  }
  if (variant.startsWith('voice-plan')) {
    const output = run.artifacts[1]!.output!
    if (output.kind === 'voice-direction') {
      output.dictionary = [{ term: '列车', pronunciation: '火车' }]
    }
  }
  if (variant === 'voice-plan-flow' || variant === 'flow-selected-playback') {
    const output = run.artifacts[1]!.output!
    if (output.kind === 'voice-direction')
      output.lines = [{ path: 'adv/chapters/intro.chapter.json', lineId: variant === 'flow-selected-playback' ? 'line_01900400-0000-7000-8000-000000000002' : 'line_01900400-0000-7000-8000-000000000001', speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', instruction: '按既有稳定身份回流，不猜测 JSON 行号' }]
  }
  if (variant.startsWith('source-merge')) {
    run.plan = { ...run.plan, tasks: ['writer-a', 'writer-b'].map(id => ({ id, partner: 'writer' as const, capability: 'write-chapters' as const, dependsOn: [], sourcePaths: Object.keys(originals), instruction: 'Explicit candidate input fixture', expectedOutput: 'Reviewed source' })) }
    run.tasks = run.plan.tasks.map(task => ({ taskId: task.id, status: 'completed', attempt: 1, artifactIds: [task.id] }))
    run.artifacts = run.plan.tasks.map((task, index) => {
      const output = { kind: 'chapter' as const, summary: index ? '候选乙：主动归还信件' : '候选甲：等待末班车', entryChapterId: 'intro', endingAddresses: ['intro#start'], chapters: [{ id: 'intro', title: '等车', content: `# 等车 {#start}\n\n@lin\n${index ? '先归还信件。' : '等到末班车。'}` }] }
      return { id: task.id, runId, taskId: task.id, partner: 'writer' as const, projectId, kind: 'chapter' as const, source, fingerprint: `${task.id}-v1`, summary: output.summary, output, changes: creativeOutputFileChanges(output, originals), reviewCapabilities: ['modify-source' as const, 'candidate-preview' as const], status: 'selected' as const }
    })
  }
  mark('service-seed')
  const exists = await fetch(`/__creative-media-fixture/exists?projectId=${encodeURIComponent(projectId)}`)
  if (!(await exists.json()).exists) {
    const seeded = await fetch('/__creative-media-fixture/seed', { method: 'POST', body: JSON.stringify(run) })
    if (!seeded.ok)
      throw new Error(`Fixture seed failed: ${await seeded.text()}`)
  }
  const calls: Array<{ method: string, path: string, body?: unknown, key?: string }> = []
  let lose: 'register' | 'prepare' | 'confirm' | 'delivery' | undefined
  const client = new ManagedCreativeTeamClient({ accountId, baseUrl: 'http://127.0.0.1:4198', getAccessToken: () => 'explicit-media-fixture-only', fetch: async (input, init) => {
    const url = new URL(String(input))
    // Availability is account-wide in production. This explicit local service
    // hosts several independent UI cases and needs their fixture identity only.
    if (url.pathname.endsWith('/capabilities'))
      url.searchParams.set('projectId', projectId)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method: init?.method ?? 'GET', path: url.pathname, body, key: new Headers(init?.headers).get('idempotency-key') ?? undefined })
    const response = await fetch(url, init)
    const phase = url.pathname.endsWith('/media-candidates') ? 'register' : url.pathname.endsWith('/delivery') ? 'delivery' : body?.type
    if (response.ok && lose && phase === lose) {
      lose = undefined
      throw new Error('Explicit fixture: response lost after local service commit')
    }
    return response
  } })
  const auth = useAuthStore()
  auth.userInfo = { id: accountId }
  auth.session = { accessToken: 'explicit-media-fixture-only', user: { id: accountId } }
  mark('project-switch')
  await useStudioStore().switchProject({ projectId, name: '真实媒体统一采用验证', source: 'local', lastOpened: Date.now() })
  mark('project-ready')
  const store = useCreativeTeamStore()
  store.configure({ accountId, projectId, client })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const Host = defineComponent({ setup: () => () => h(IonApp, {}, () => h(IonPage, {}, () => [
    h(IonHeader, {}, () => h(IonToolbar, {}, () => h(IonTitle, {}, () => '明确的本地服务 fixture · 真实媒体统一采用'))),
    h(IonContent, {}, () => [h('p', { role: 'note' }, '方案、身份与服务存储是 fixture；共享协议、HTTP 客户端、媒体解码、项目事务和 IndexedDB 使用实际实现。无模型或计费。'), h(CreativeTeamWorkspace)]),
  ])) })
  const app = createApp(Host)
  app.use(pinia).use(IonicVue, { mode: 'ios', animated: false }).use(router).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } }))
  app.mount('#app')
  mark('mounted')
  await store.refresh()
  mark('run-ready')
  const content = app.runWithContext(() => useProjectContent())
  await content.whenReady()
  mark('content-ready')
  const projectFs = content.getFs()!
  const writes: string[] = []
  let crashAfter = 0
  let crashed = false
  const writeFile = projectFs.writeFile.bind(projectFs)
  const writeBlob = projectFs.writeBlob.bind(projectFs)
  projectFs.writeFile = async (path, value) => {
    writes.push(path)
    await writeFile(path, value)
    if (crashAfter > 0 && --crashAfter === 0) {
      await projectFs.flush?.()
      crashed = true
      await new Promise<void>(() => {})
    }
  }
  projectFs.writeBlob = async (path, value) => {
    writes.push(path)
    await writeBlob(path, value)
  }
  // Observe the real isolated view as well as direct author writes.
  const transaction = projectFs.transaction?.bind(projectFs)
  if (transaction) {
    projectFs.transaction = async (operation, validate) => transaction(async (scope) => {
      const text = scope.writeFile.bind(scope)
      const binary = scope.writeBlob.bind(scope)
      scope.writeFile = async (path, value) => {
        writes.push(path)
        await text(path, value)
      }
      scope.writeBlob = async (path, value) => {
        writes.push(path)
        await binary(path, value)
      }
      await operation(scope)
    }, validate)
  }
  Object.assign(window, { creativeMediaFixture: {
    originals,
    async pendingDeliveryWrite(pending: boolean) {
      await creativeAdoptionJournal.save({ ...scope, runId: 'other-run', intentId: 'pending-other-run', state: pending ? 'preparing' : 'abandoned', request: {} as never, review: {} as never })
    },
    async editSource(path: string, content: string) {
      await projectFs.writeFile(path, content)
      await projectFs.flush?.()
    },
    calls: () => [...calls],
    writes: () => [...writes],
    lose: (phase: typeof lose) => { lose = phase },
    crashAfterText: (count: number) => {
      // Explicit legacy per-file fault injection. Reload restores the current
      // atomic adapter, which must still recover a pre-existing partial journal.
      projectFs.transaction = undefined
      crashAfter = count
    },
    crashed: () => crashed,
    run: () => store.run,
    reports: () => creativePlaytestCache.list(scope),
    journal: () => creativeAdoptionJournal.load(scope),
    async candidates() {
      const [image, voice] = await Promise.all([creativeArtImportCache.list(scope), creativeVoiceImportCache.list(scope)])
      return { image: image.map(item => ({ id: item.id, state: item.state, retainedBytes: item.data?.byteLength ?? 0, managed: item.managed })), voice: voice.map(item => ({ id: item.id, state: item.state, retainedBytes: item.review.data?.byteLength ?? 0, managed: item.managed })) }
    },
    async files() { return Object.fromEntries((await projectFs.collectAllFiles()).map(file => [file.path, file.content])) },
    async media() {
      const files = Object.fromEntries((await projectFs.collectAllFiles()).map(file => [file.path, file.content]))
      const root = JSON.parse(files['adv/assets.json'])
      const assets = root.includes.flatMap((path: string) => JSON.parse(files[`adv/${path}`]).assets)
      return Promise.all(assets.map(async (asset: { id: string, path: string, sha256: string, bytes: number }) => {
        const blob = await projectFs.readBlob(`adv/assets/${asset.path}`)
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
        return { id: asset.id, sha256, bytes: blob.size, expectedSha256: asset.sha256, expectedBytes: asset.bytes }
      }))
    },
  } })
  mark('ready')
}
void main()
