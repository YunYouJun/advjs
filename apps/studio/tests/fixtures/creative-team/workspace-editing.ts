import type { InjectionKey } from 'vue'
import type { IFileSystem } from '../../../src/utils/fs'
import { IonApp, IonicVue } from '@ionic/vue'
import { createRouter } from '@ionic/vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h } from 'vue'
import { createMemoryHistory, RouterView } from 'vue-router'
import masterImageUrl from '../../../../../demo/love/public/img/characters/yun-alpha-compressed.webp?url'
import { cloudbaseAppInjectionKey } from '../../../src/composables/useCloudbase'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import i18n from '../../../src/i18n'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import { dbReady } from '../../../src/utils/db'
import { BrowserFsAdapter } from '../../../src/utils/fs/BrowserFsAdapter'
import { whenStudioProjectWritesSettle } from '../../../src/utils/projectWriteQueue'
import WorkspacePage from '../../../src/views/WorkspacePage.vue'
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
  const storage = await navigator.storage.getDirectory()
  const folder = `advjs-workspace-edit-${id}`
  const root = await storage.getDirectoryHandle(folder, { create: true })
  const fs = new BrowserFsAdapter(root)
  await fs.writeFile('adv.config.json', JSON.stringify({ schemaVersion: 1, id, root: 'adv', format: 'adv-md' }))
  await fs.writeBlob('adv/assets/master.webp', await (await fetch(masterImageUrl)).blob())
  await fs.writeFile('README.md', '# Original README\n')
  await fs.writeFile('LICENSE', 'Original license text\n')
  await fs.writeFile('adv/world.md', '# Original world\n')
  await fs.writeFile('adv/chapters/first.adv.md', '# First chapter\n')
  await fs.writeFile('adv/chapters/second.adv.md', '# Second chapter\n')
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useStudioStore()
  await store.switchProject({ projectId: id, name: 'Actual workspace fixture', source: 'local', dirHandle: root, lastOpened: Date.now() })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tabs/workspace', component: WorkspacePage }, { path: '/tabs/workspace/creative-team', component: { render: () => h('p', 'Service intentionally unavailable in filesystem fixture') } }] })
  await router.push('/tabs/workspace')
  const app = createApp(defineComponent({ setup: () => () => h(IonApp, {}, () => h(RouterView)) }))
    .use(pinia)
    .use(IonicVue, { mode: 'ios', animated: false })
    .use(router)
    .use(i18n)
  i18n.global.locale.value = 'zh-CN'
  app.provide(cloudbaseAppInjectionKey as InjectionKey<unknown>, null)
  app.mount('#app')
  const content = app.runWithContext(() => useProjectContent())
  await content.whenReady()
  const adapters = new Set<IFileSystem>([content.getFs()!])
  const ownedFolders = [folder]
  const reading = new Set<Promise<unknown>>()
  let releaseRead: (() => void) | undefined
  const getFile = FileSystemFileHandle.prototype.getFile
  const createWritable = FileSystemFileHandle.prototype.createWritable
  let release: (() => void) | undefined
  const closes = new Set<Promise<void>>()
  const state = { phase: 'idle' }
  Object.assign(window, { workspaceEditingFixture: {
    async binary(path = 'adv/assets/master.webp') {
      const bytes = await (await fs.readBlob(path)).arrayBuffer()
      return { bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('') }
    },
    async switchProject(back = false) {
      const nextId = back ? id : `${id}-other`
      const nextFolder = back ? folder : `${folder}-other`
      const nextRoot = await storage.getDirectoryHandle(nextFolder, { create: true })
      if (!ownedFolders.includes(nextFolder)) {
        ownedFolders.push(nextFolder)
        const nextFs = new BrowserFsAdapter(nextRoot)
        await nextFs.writeFile('adv.config.json', JSON.stringify({ schemaVersion: 1, id: nextId, root: 'adv', format: 'adv-md' }))
        await nextFs.writeFile('README.md', '# Other project README\n')
      }
      await store.switchProject({ projectId: nextId, name: back ? 'Actual workspace fixture' : 'Other workspace fixture', source: 'local', dirHandle: nextRoot, lastOpened: Date.now() })
      await content.whenReady()
      adapters.add(content.getFs()!)
    },
    holdRead(path: string, fail = false) {
      const adapter = content.getFs()!
      const read = adapter.readFile.bind(adapter)
      let armed = true
      const gate = new Promise<void>(resolve => releaseRead = resolve)
      adapter.readFile = (target) => {
        const operation = (async () => {
          if (target !== path || !armed)
            return read(target)
          armed = false
          if (fail)
            throw new DOMException('Explicit fixture unknown read', 'NotAllowedError')
          const value = await read(target)
          state.phase = 'read-waiting'
          await gate
          return value
        })()
        reading.add(operation)
        return operation
      }
    },
    holdNativeRead(path: string) {
      let armed = true
      const gate = new Promise<void>(resolve => releaseRead = resolve)
      FileSystemFileHandle.prototype.getFile = async function () {
        const file = await getFile.call(this)
        const resolved = await root.resolve(this)
        const operation = (async () => {
          if (armed && resolved?.join('/') === path) {
            armed = false
            state.phase = 'native-read-waiting'
            await gate
          }
          return file
        })()
        reading.add(operation)
        return operation
      }
    },
    releaseRead: () => releaseRead?.(),
    async readOther(path: string) {
      const other = new BrowserFsAdapter(await storage.getDirectoryHandle(`${folder}-other`))
      return other.readFile(path)
    },
    async exists(path: string) { return fs.exists(path) },
    async read(path: string) { return await fs.exists(path) ? fs.readFile(path) : null },
    async externalEdit(path: string, value: string) { await fs.writeFile(path, value) },
    holdWrite(path: string, fail: boolean) {
      let armed = true
      const gate = new Promise<void>(resolve => release = resolve)
      FileSystemFileHandle.prototype.createWritable = async function (options) {
        const writable = await createWritable.call(this, options)
        const resolved = await root.resolve(this)
        if (!armed || resolved?.join('/') !== path)
          return writable
        armed = false
        return new Proxy(writable, {
          get(target, key) {
            if (key === 'close') {
              return () => {
                const operation = (async () => {
                  state.phase = 'waiting'
                  await gate
                  await target.close()
                  state.phase = 'closed'
                  if (fail)
                    throw new Error('Explicit fixture failure after actual native close')
                })()
                closes.add(operation)
                return operation
              }
            }
            const value = Reflect.get(target, key, target)
            return typeof value === 'function' ? value.bind(target) : value
          },
        })
      }
    },
    state: () => state,
    release: () => release?.(),
    async cleanup() {
      release?.()
      releaseRead?.()
      await Promise.allSettled([...closes, ...reading])
      FileSystemFileHandle.prototype.getFile = getFile
      FileSystemFileHandle.prototype.createWritable = createWritable
      for (const adapter of adapters)
        await whenStudioProjectWritesSettle(adapter)
      app.unmount()
      for (const owned of ownedFolders) {
        await storage.removeEntry(owned, { recursive: true })
        try {
          await storage.getDirectoryHandle(owned)
          throw new Error('Task-owned directory still exists')
        }
        catch (error) {
          if ((error as DOMException).name !== 'NotFoundError')
            throw error
        }
      }
      return { removed: true, folders: ownedFolders }
    },
  } })
}
void main()
