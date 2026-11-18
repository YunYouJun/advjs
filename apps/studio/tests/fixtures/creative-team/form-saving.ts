import type { InjectionKey } from 'vue'
import type { IFileSystem } from '../../../src/utils/fs'
import { IonApp, IonicVue } from '@ionic/vue'
import { createRouter } from '@ionic/vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'
import { createMemoryHistory, RouterView } from 'vue-router'
import { cloudbaseAppInjectionKey } from '../../../src/composables/useCloudbase'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import i18n from '../../../src/i18n'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import { db, dbReady } from '../../../src/utils/db'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import { whenStudioProjectWritesSettle } from '../../../src/utils/projectWriteQueue'
import CharactersPage from '../../../src/views/workspace/CharactersPage.vue'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import 'virtual:uno.css'

async function main() {
  await dbReady
  const id = new URL(location.href).searchParams.get('id')!
  if (!/^[a-z0-9-]+$/.test(id))
    throw new Error('Task-owned ID required')
  const path = 'adv/characters/lin.character.md'
  const original = '---\nid: lin\nname: 林舟\nopaque: preserve-me\n---\nUnmanaged author preamble\n\n## 性格\n谨慎\n'
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useStudioStore()
  const owned = [id]
  const instances = new Set<IFileSystem>()
  const seed = new MemoryFsAdapter(id)
  await seed.init()
  if (!await seed.exists('adv.config.json')) {
    await seed.writeFile('adv.config.json', JSON.stringify({ schemaVersion: 1, id, root: 'adv', format: 'adv-md' }))
    await seed.writeFile(path, original)
    await seed.writeFile('adv/scenes/platform.md', '---\nid: platform\nname: 站台\nopaque: keep-scene\n---\nExact scene body')
    await seed.writeFile('adv/locations/station.md', '---\nid: station\nname: 雨夜车站\nopaque: keep-location\n---\nExact location body')
    await seed.flush()
  }
  await store.switchProject({ projectId: id, name: 'Actual form saving fixture', source: 'local', lastOpened: Date.now() })
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/tabs/workspace/characters', component: CharactersPage },
    { path: '/tabs/workspace/scenes', component: () => import('../../../src/views/workspace/ScenesPage.vue') },
    { path: '/tabs/workspace/chapters', component: () => import('../../../src/views/workspace/ChaptersPage.vue') },
    { path: '/tabs/workspace/locations', component: () => import('../../../src/views/workspace/LocationsPage.vue') },
    { path: '/tabs/workspace/locations/:id', component: () => import('../../../src/views/workspace/LocationDetailPage.vue') },
  ] })
  await router.push('/tabs/workspace/characters')
  const app = createApp(defineComponent({ setup: () => () => h(IonApp, {}, () => h(RouterView)) }))
    .use(pinia)
    .use(IonicVue, { mode: 'ios', animated: false })
    .use(router)
    .use(i18n)
  i18n.global.locale.value = 'zh-CN'
  // Explicitly unavailable: collaboration performs no CloudBase initialization or network calls.
  app.provide(cloudbaseAppInjectionKey as InjectionKey<unknown>, null)
  app.mount('#app')
  const content = app.runWithContext(() => useProjectContent())
  await content.whenReady()
  instances.add(content.getFs()!)
  let release: (() => void) | undefined
  const state = { phase: 'idle' }
  Object.assign(window, { formSavingFixture: {
    path,
    original,
    async navigate(kind: 'scene' | 'location' | 'locations' | 'chapter') {
      const paths = { scene: '/tabs/workspace/scenes', location: '/tabs/workspace/locations/station', locations: '/tabs/workspace/locations', chapter: '/tabs/workspace/chapters' }
      await router.push(paths[kind])
    },
    async authorEdit() {
      const fs = content.getFs()!
      await fs.writeFile(path, original.replace('name: 林舟', 'name: 新作者的人物').replace('谨慎', '新作者的性格'))
      await fs.flush?.()
    },
    async authorEditFile(target: string, value: string) {
      await content.getFs()!.writeFile(target, value)
      await content.getFs()!.flush?.()
    },
    async switchProject() {
      const other = `${id}-other`
      const fs = new MemoryFsAdapter(other)
      await fs.init()
      await fs.writeFile('adv.config.json', JSON.stringify({ schemaVersion: 1, id: other, root: 'adv', format: 'adv-md' }))
      await fs.writeFile(path, original)
      await fs.flush()
      owned.push(other)
      await store.switchProject({ projectId: other, name: other, source: 'local', lastOpened: Date.now() })
      await content.whenReady()
      instances.add(content.getFs()!)
    },
    async seedMaster() {
      const file = (document.querySelector('#original-image') as HTMLInputElement).files?.[0]
      if (!file)
        throw new Error('Existing real image required')
      await content.getFs()!.writeBlob('adv/assets/characters/lin/avatar.webp', file)
      await content.getFs()!.flush?.()
    },
    async media() {
      const fs = new MemoryFsAdapter(id)
      await fs.init()
      const paths = await fs.listFilesByExts('adv/assets/characters/lin', ['.webp', '.png', '.jpeg', '.jpg'])
      return Promise.all(paths.map(async (path) => {
        const bytes = await (await fs.readBlob(path)).arrayBuffer()
        return { path, bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('') }
      }))
    },
    holdWrite(fail: boolean) {
      const fs = content.getFs()!
      const transaction = fs.transaction?.bind(fs)
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      function observe(scope: IFileSystem) {
        const write = scope.writeFile.bind(scope)
        scope.writeFile = async (target, value) => {
          await write(target, value)
          if (target === path) {
            state.phase = 'waiting'
            await gate
            if (fail)
              throw new Error('Explicit fixture failure after source write')
          }
        }
      }
      observe(fs)
      if (transaction) {
        fs.transaction = (operation, validate) => transaction(async (scope) => {
          observe(scope)
          await operation(scope)
        }, validate)
      }
    },
    release: () => release?.(),
    state: () => state,
    async saved(target = path, project = id) {
      const fs = new MemoryFsAdapter(project)
      await fs.init()
      return fs.readFile(target)
    },
    async cleanup() {
      release?.()
      for (const fs of instances) {
        await whenStudioProjectWritesSettle(fs)
        await fs.flush?.().catch(() => {})
      }
      app.unmount()
      for (const project of owned) {
        const query = db.memfsNodes.where('key').startsWith(`memfs:${project}:`)
        await query.delete()
        if (await query.count())
          throw new Error('Task-owned files remain')
      }
      return { removed: true, projects: owned.length }
    },
  } })
}
void main()
