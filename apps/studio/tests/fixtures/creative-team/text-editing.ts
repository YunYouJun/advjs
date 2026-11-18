import { IonApp, IonicVue } from '@ionic/vue'
import { createRouter } from '@ionic/vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'
import { createMemoryHistory } from 'vue-router'
import { useContentDelete } from '../../../src/composables/useContentDelete'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import i18n from '../../../src/i18n'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import { db, dbReady } from '../../../src/utils/db'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import { whenStudioProjectWritesSettle } from '../../../src/utils/projectWriteQueue'
import EditorPage from '../../../src/views/EditorPage.vue'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import 'virtual:uno.css'

/** Real text editor, deletion dialog, shared project FS and IndexedDB. No service or model. */
async function main() {
  await dbReady
  const id = new URL(location.href).searchParams.get('id')!
  if (!/^[a-z0-9-]+$/.test(id))
    throw new Error('A task-owned project ID is required')
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useStudioStore()
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
  const owned: string[] = []
  const path = 'adv/world.md'
  const deletedPath = 'adv/characters/lin.character.md'
  async function select(projectId: string) {
    owned.push(projectId)
    const fs = new MemoryFsAdapter(projectId)
    await fs.init()
    if (!await fs.exists(path)) {
      await fs.writeFile('adv.config.json', JSON.stringify({ id: projectId, schemaVersion: 1, root: 'adv', format: 'adv-md' }))
      await fs.writeFile(path, '# Original author world')
      await fs.writeFile(deletedPath, '---\nid: lin\nname: 林舟\n---\nOriginal character')
      await fs.flush()
    }
    await store.switchProject({ projectId, name: projectId, source: 'local', lastOpened: Date.now() })
  }
  await select(id)
  await router.push({ path: '/editor', query: { file: path } })
  const Host = defineComponent({ setup() {
    const deletion = useContentDelete()
    return () => h(IonApp, {}, () => [
      h(EditorPage),
      h('button', { 'data-testid': 'delete-file', 'style': { position: 'fixed', bottom: '8px', right: '8px', zIndex: 10 }, 'onClick': () => void deletion.deleteFile(deletedPath, '删除当前林舟档案？') }, '删除林舟档案'),
    ])
  } })
  const app = createApp(Host).use(pinia).use(IonicVue, { mode: 'ios', animated: false }).use(router).use(i18n)
  i18n.global.locale.value = 'zh-CN'
  app.mount('#app')
  const content = app.runWithContext(() => useProjectContent())
  await content.whenReady()
  let release: (() => void) | undefined
  const state = { phase: 'idle' }
  Object.assign(window, { textEditingFixture: {
    path,
    deletedPath,
    async authorEdit(path: string, value: string) {
      const fs = content.getFs()!
      await fs.writeFile(path, value)
      await fs.flush?.()
    },
    async switchProject() {
      await select(`${id}-other`)
      await content.whenReady()
    },
    holdCommit(fail: boolean) {
      const fs = content.getFs()!
      const transaction = fs.transaction!.bind(fs)
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      fs.transaction = async (operation, validate) => {
        fs.transaction = transaction
        await transaction(async (scope) => {
          await operation(scope)
          state.phase = 'waiting'
          await gate
          if (fail)
            throw new Error('Explicit fixture failure before durable commit')
        }, validate)
        state.phase = 'finished'
      }
    },
    release: () => release?.(),
    state: () => state,
    async saved(projectId = id, file = path) {
      const fs = new MemoryFsAdapter(projectId)
      await fs.init()
      return await fs.exists(file) ? fs.readFile(file) : null
    },
    async cleanup() {
      release?.()
      if (content.getFs())
        await whenStudioProjectWritesSettle(content.getFs()!)
      // The old editor may have scheduled its ordinary 500 ms autosave.
      await content.getFs()?.flush?.().catch(() => {})
      app.unmount()
      for (const projectId of owned) {
        const query = db.memfsNodes.where('key').startsWith(`memfs:${projectId}:`)
        await query.delete()
        if (await query.count())
          throw new Error('Task-owned project remains')
      }
      return { removed: true, projects: owned.length }
    },
  } })
}
void main()
