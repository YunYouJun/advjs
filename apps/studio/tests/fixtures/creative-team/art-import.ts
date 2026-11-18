import type { CreativeArtRequest } from '@advjs/agent'
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
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import 'virtual:uno.css'

/** Only proposal/auth/history are fixtures; uploaded bytes, transactions, storage and player are real. */
async function main() {
  const accountId = 'art-fixture-author'
  const projectId = 'creative-art-ui-fixture'
  const pinia = createPinia()
  setActivePinia(pinia)
  const fs = new MemoryFsAdapter(projectId)
  await fs.init()
  const originals = {
    'adv.config.json': '{"schemaVersion":1,"id":"creative-art-fixture","root":"adv","format":"adv-md"}',
    'adv/settings/game.json': '{"entryChapterId":"intro"}',
    'adv/characters/xiaoyun.character.md': '---\nid: xiaoyun\nname: 小云\n---\n仓库已有角色图片的独立导入示例。',
    'adv/chapters/intro.adv.md': '# 图片回流 {#start}\n\n@xiaoyun\n这张图片已经采用到项目。\n\n@xiaoyun\n重开项目后仍可继续。',
  }
  if (!await fs.exists('adv.config.json')) {
    fs.bulkLoad(Object.entries(originals).map(([path, content]) => ({ path, content })))
    await fs.persist()
  }
  const baselineRevision = await computeAgentProjectRevision(originals)
  const request: CreativeArtRequest = { assetId: 'character/xiaoyun/default', kind: 'portrait', characterId: 'xiaoyun', width: 619, height: 619, prompt: '将仓库已有小云图片按原样导入对应角色，保留来源。', constraints: ['使用现有图片验证回流，不代表雨夜车站最终美术质量'] }
  const run = createCreativeTeamRun({ id: 'art_fixture_run', accountId, now: 0, plan: { protocolVersion: 1, projectId, projectRevision: baselineRevision, goal: '本地美术方案 fixture：真实图片人工导入', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [{ id: 'art', partner: 'art-director', capability: 'direct-art', dependsOn: [], sourcePaths: Object.keys(originals), instruction: '独立素材回流示例', expectedOutput: '图片与角色绑定' }] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'art', status: 'completed', attempt: 1, artifactIds: ['art-fixture-proposal'] }]
  run.artifacts = [{ id: 'art-fixture-proposal', runId: run.id, taskId: 'art', partner: 'art-director', projectId, kind: 'art-direction', source: { projectId, revision: baselineRevision, files: originals, upstream: [] }, fingerprint: 'art-fixture-proposal-v1', summary: '已选定美术交接 fixture', output: { kind: 'art-direction', summary: '已选定美术交接 fixture', style: '保留仓库已有角色素材', requests: [request] }, changes: [], reviewCapabilities: [], status: 'selected' }]
  const calls: string[] = []
  const client = new ManagedCreativeTeamClient({ accountId, baseUrl: 'http://127.0.0.1:4198', getAccessToken: () => 'art-fixture-only', fetch: async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url.pathname}`)
    if (method !== 'GET')
      return new Response('{}', { status: 405 })
    const value = url.pathname.endsWith('/capabilities')
      ? { protocolVersion: 1, enabled: false, authoring: { candidateEdits: true, milestoneAdoption: false }, serviceVersion: 'explicit art proposal fixture; no models', capabilities: [], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'unavailable' } }
      : url.pathname.endsWith('/runs')
        ? { protocolVersion: 1, items: [{ id: run.id, projectId, goal: run.plan.goal, status: run.status, revision: run.revision, chargedMicroPoints: 0, reservedMicroPoints: 0, updatedAt: 0 }] }
        : { protocolVersion: 1, run }
    return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
  } })
  const auth = useAuthStore()
  auth.userInfo = { id: accountId }
  auth.session = { accessToken: 'art-fixture-only', user: { id: accountId } }
  await useStudioStore().switchProject({ projectId, name: '真实角色图片回流示例', source: 'local', lastOpened: Date.now() })
  const store = useCreativeTeamStore()
  store.configure({ accountId, projectId, client })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  await router.push('/')
  const Host = defineComponent({ setup: () => () => h(IonApp, {}, () => h(IonPage, {}, () => [
    h(IonHeader, {}, () => h(IonToolbar, {}, () => h(IonTitle, {}, () => '本地方案 fixture · 真实图片导入'))),
    h(IonContent, {}, () => [h('p', { role: 'note' }, '美术方案与身份是 fixture；图片、存储、事务和正式试玩组件使用真实实现。'), h(CreativeTeamWorkspace)]),
  ])) })
  const app = createApp(Host)
  app.use(pinia).use(IonicVue, { mode: 'ios', animated: false }).use(router).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { creativeTeam: creativeTeamMessages['zh-CN'] } } }))
  app.mount('#app')
  await store.refresh()
  const content = app.runWithContext(() => useProjectContent())
  Object.assign(window, { creativeArtFixture: {
    calls: () => [...calls],
    originals,
    async files() {
      await content.whenReady()
      return Object.fromEntries((await content.getFs()!.collectAllFiles()).map(file => [file.path, file.content]))
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
