import { computeAgentProjectRevision, createCreativeTeamRun, ManagedCreativeTeamClient } from '@advjs/agent'
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
import { creativeVoiceImportCache } from '../../../src/utils/creativeVoiceImportCache'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import 'virtual:uno.css'

/** Only direction/auth/history are fixtures; external real speech, transactions, storage and playback are real. */
async function main() {
  const accountId = 'voice-fixture-author'
  const projectId = 'creative-voice-ui-fixture'
  const pinia = createPinia()
  setActivePinia(pinia)
  const fs = new MemoryFsAdapter(projectId)
  await fs.init()
  const originals = {
    'adv.config.json': '{"schemaVersion":1,"id":"creative-voice-fixture","root":"adv","format":"adv-md"}',
    'adv/settings/game.json': '{"entryChapterId":"intro","locale":"zh-CN"}',
    'adv/assets.json': '{"schemaVersion":2,"id":"creative-voice-fixture","defaultProfile":"local","profiles":{"local":{"provider":"project","root":"adv/assets"}},"includes":[]}',
    'adv/characters/lin.character.md': '---\nid: lin\nname: 林\nvoiceProfile:\n  intent:\n    speakingStyle: 平静\n  locales:\n    zh-CN:\n      providers:\n        local-system:\n          voiceId: Tingting\n          model: macos-say\n          source: system\n---\n本机系统语音外部制作示例。',
    'adv/chapters/intro.adv.md': '# 等车 {#start}\n\n@lin\n列车还没有到，我们再等一会儿。 {#line_01900400-0000-7000-8000-000000000001}\n\n@lin\n这是下一句，没有绑定配音。',
  }
  if (!await fs.exists('adv.config.json')) {
    fs.bulkLoad(Object.entries(originals).map(([path, content]) => ({ path, content })))
    await fs.persist()
  }
  const baselineRevision = await computeAgentProjectRevision(originals)
  const run = createCreativeTeamRun({ id: 'voice_fixture_run', accountId, now: 0, plan: { protocolVersion: 1, projectId, projectRevision: baselineRevision, goal: '本地配音方案 fixture：真实系统语音人工回流', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [{ id: 'voice', partner: 'voice-director', capability: 'direct-voice', dependsOn: [], sourcePaths: Object.keys(originals), instruction: '独立音频回流示例', expectedOutput: '音频与稳定台词绑定' }] } })
  const artTask = { id: 'art', partner: 'art-director' as const, capability: 'direct-art' as const, dependsOn: [], sourcePaths: Object.keys(originals), instruction: 'Existing-image recovery fixture', expectedOutput: 'Image binding' }
  run.plan = { ...run.plan, tasks: [...run.plan.tasks, artTask] }
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'voice', status: 'completed', attempt: 1, artifactIds: ['voice-fixture-proposal'] }]
  run.artifacts = [{ id: 'voice-fixture-proposal', runId: run.id, taskId: 'voice', partner: 'voice-director', projectId, kind: 'voice-direction', source: { projectId, revision: baselineRevision, files: originals, upstream: [] }, fingerprint: 'voice-fixture-proposal-v1', summary: '已选定配音交接 fixture', output: { kind: 'voice-direction', summary: '已选定配音交接 fixture', cast: [{ speakerId: 'lin', designBrief: '本机 Tingting 系统语音', performance: '以现成系统音色验证回流，不代表最终角色表演' }, { speakerId: 'narrator', designBrief: '独立旁白，尚未制作', performance: '中性' }], dictionary: [], lines: [{ path: 'adv/chapters/intro.adv.md', line: 4, speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', instruction: '平静地邀请同伴继续等待' }] }, changes: [], reviewCapabilities: ['voice-take'], status: 'selected' }]
  run.tasks = [...run.tasks, { taskId: 'art', status: 'completed', attempt: 1, artifactIds: ['voice-fixture-art'] }]
  run.artifacts = [...run.artifacts, { id: 'voice-fixture-art', runId: run.id, taskId: 'art', partner: 'art-director', projectId, kind: 'art-direction', source: { projectId, revision: baselineRevision, files: originals, upstream: [] }, fingerprint: 'voice-fixture-art-v1', summary: '图片中断恢复 fixture', output: { kind: 'art-direction', summary: '图片中断恢复 fixture', style: 'Use existing repository image only', requests: [{ assetId: 'character/lin/default', kind: 'portrait', characterId: 'lin', width: 619, height: 619, prompt: 'Existing image for recovery verification', constraints: [] }] }, changes: [], reviewCapabilities: [], status: 'selected' }]
  const calls: string[] = []
  const client = new ManagedCreativeTeamClient({ accountId, baseUrl: 'http://127.0.0.1:4198', getAccessToken: () => 'voice-fixture-only', fetch: async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url.pathname}`)
    if (method !== 'GET')
      return new Response('{}', { status: 405 })
    const value = url.pathname.endsWith('/capabilities')
      ? { protocolVersion: 1, enabled: false, authoring: { candidateEdits: true, milestoneAdoption: false }, serviceVersion: 'explicit voice proposal fixture; no models', capabilities: [], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } }
      : url.pathname.endsWith('/runs')
        ? { protocolVersion: 1, items: [{ id: run.id, projectId, goal: run.plan.goal, status: run.status, revision: run.revision, chargedMicroPoints: 0, reservedMicroPoints: 0, updatedAt: 0 }] }
        : { protocolVersion: 1, run }
    return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
  } })
  const auth = useAuthStore()
  auth.userInfo = { id: accountId }
  auth.session = { accessToken: 'voice-fixture-only', user: { id: accountId } }
  await useStudioStore().switchProject({ projectId, name: '真实对白语音回流示例', source: 'local', lastOpened: Date.now() })
  const store = useCreativeTeamStore()
  store.configure({ accountId, projectId, client })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const Host = defineComponent({ setup: () => () => h(IonApp, {}, () => h(IonPage, {}, () => [
    h(IonHeader, {}, () => h(IonToolbar, {}, () => h(IonTitle, {}, () => '本地方案 fixture · 真实对白语音导入'))),
    h(IonContent, {}, () => [h('p', { role: 'note' }, '配音方案与身份是 fixture；音频、存储、事务、试听和正式试玩组件使用真实实现。'), h(CreativeTeamWorkspace)]),
  ])) })
  const app = createApp(Host)
  app.use(pinia).use(IonicVue, { mode: 'ios', animated: false }).use(router).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } }))
  app.mount('#app')
  await store.refresh()
  const content = app.runWithContext(() => useProjectContent())
  await content.whenReady()
  const projectFs = content.getFs()!
  const writes: string[] = []
  let crashAfterText = 0
  let crashed = false
  const writeFile = projectFs.writeFile.bind(projectFs)
  const writeBlob = projectFs.writeBlob.bind(projectFs)
  projectFs.writeFile = async (path, value) => {
    writes.push(path)
    await writeFile(path, value)
    if (crashAfterText > 0 && --crashAfterText === 0) {
      await projectFs.flush?.()
      crashed = true
      // The test navigates away with an operation still alive, simulating process loss.
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
  Object.assign(window, { creativeVoiceFixture: {
    calls: () => [...calls],
    originals,
    writes: () => [...writes],
    crashAfterText: (count: number) => {
      // Explicit legacy per-file fault injection. Reload restores the current
      // atomic adapter, which must still recover a pre-existing partial journal.
      projectFs.transaction = undefined
      crashAfterText = count
    },
    crashed: () => crashed,
    loseRegistrationAck() {
      const save = creativeVoiceImportCache.save.bind(creativeVoiceImportCache)
      let lost = false
      creativeVoiceImportCache.save = async (entry) => {
        if (!lost && entry.state === 'registered') {
          lost = true
          throw new Error('Explicit fixture: local registration acknowledgement lost')
        }
        await save(entry)
      }
    },
    async journal() {
      return Promise.all((await creativeVoiceImportCache.list({ accountId, projectId, runId: run.id })).map(async (entry) => {
        const exists = await projectFs.exists(entry.review.mediaPath)
        const bytes = exists ? await (await projectFs.readBlob(entry.review.mediaPath)).arrayBuffer() : undefined
        return { id: entry.id, state: entry.state, target: entry.review.target.lineId, takeId: entry.review.takeId, mediaPath: entry.review.mediaPath, retainedBytes: entry.review.data?.byteLength ?? 0, mediaBytes: bytes?.byteLength, mediaHash: bytes ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('') : undefined }
      }))
    },
    async files() {
      await content.whenReady()
      return Object.fromEntries((await content.getFs()!.collectAllFiles()).map(file => [file.path, file.content]))
    },
    async replaceDialogue() {
      await content.whenReady()
      const fs = content.getFs()!
      const path = 'adv/chapters/intro.adv.md'
      await fs.writeFile(path, (await fs.readFile(path)).replace('列车还没有到，我们再等一会儿。', '列车已经到了，我们走吧。'))
      await fs.flush?.()
    },
    async media() {
      await content.whenReady()
      const fs = content.getFs()!
      const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
      const root = files['adv/assets.json'] ? JSON.parse(files['adv/assets.json']) : undefined
      const assets = root ? (root.assets ?? root.includes.flatMap((path: string) => JSON.parse(files[`adv/${path}`]).assets)) : []
      return Promise.all(assets.map(async (asset: { id: string, path: string, sha256: string, bytes: number }) => {
        const blob = await fs.readBlob(`adv/assets/${asset.path}`)
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
        return { id: asset.id, sha256, bytes: blob.size, expectedSha256: asset.sha256, expectedBytes: asset.bytes }
      }))
    },
  } })
}
void main()
