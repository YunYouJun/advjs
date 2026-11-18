import type cloudbase from '@cloudbase/js-sdk'
import { audioProjectMediaPath } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { IonicVue } from '@ionic/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import App from '../../../src/App.vue'
import { cloudbaseAppInjectionKey, cloudbaseAuthInjectionKey } from '../../../src/composables/useCloudbase'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import i18n from '../../../src/i18n'
import router from '../../../src/router'
import { useAuthStore } from '../../../src/stores/useAuthStore'
import { useCreativeTeamStore } from '../../../src/stores/useCreativeTeamStore'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import { dbReady } from '../../../src/utils/db'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import { createProjectFromTemplate } from '../../../src/utils/projectTemplate'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import '../../../src/theme/shared.css'
import 'virtual:uno.css'
import 'splitpanes/dist/splitpanes.css'

/** Only identity/bootstrap is substituted. The real app/router/session create every HTTP client. */
async function main() {
  const pinia = createPinia()
  setActivePinia(pinia)
  await dbReady
  const projectId = localStorage.getItem('creative-runtime-fixture-mode') === 'media' ? 'creative-runtime-browser-media' : 'creative-runtime-browser-project'
  const fs = new MemoryFsAdapter(projectId)
  await fs.init()
  if (!await fs.exists('README.md')) {
    await createProjectFromTemplate(fs, '雨夜车站 · Runtime 浏览器集成')
    await fs.persist()
  }
  await useStudioStore().switchProject({ projectId, name: '雨夜车站 · 本地真实 Runtime 接线', source: 'local', lastOpened: Date.now() })
  const session = { access_token: 'local-runtime-fixture-only', refresh_token: 'fixture-only', expires_at: 9999999999, user: { id: 'browser-runtime-author' } }
  const sdk = { getSession: async () => ({ data: { session } }), refreshSession: async () => ({ data: { session } }) } as unknown as cloudbase.auth.App
  await useAuthStore().restoreSession(sdk)
  // The identity SDK is supplied; an explicit null app keeps unrelated cloud
  // collaboration unavailable without an absent-provider framework warning.
  const app = createApp(App).use(IonicVue, { mode: 'ios' }).use(pinia).use(i18n).use(router).provide(cloudbaseAuthInjectionKey, sdk).provide(cloudbaseAppInjectionKey, null as unknown as cloudbase.app.App)
  await router.isReady()
  app.mount('#app')
  const content = useProjectContent()
  Object.assign(window, { creativeRuntimeFixture: {
    scope: 'Actual product App/router/session/clients. Identity and initial template selection are explicit test bootstrap.',
    run: () => JSON.parse(JSON.stringify(useCreativeTeamStore().run)),
    async files() {
      await content.whenReady()
      return Object.fromEntries((await content.getFs()!.collectAllFiles()).map(file => [file.path, file.content]))
    },
    async media() {
      await content.whenReady()
      const fs = content.getFs()!
      const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
      const compiled = await compileProject({ files }, { allowEmptyAssetManifest: true })
      const catalog = compiled.project.assets
      return catalog
        ? Promise.all(catalog.assets.map(async (asset) => {
            const blob = await fs.readBlob(audioProjectMediaPath(catalog, asset))
            const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
            return { id: asset.id, sha256, expectedSha256: asset.sha256, bytes: blob.size, expectedBytes: asset.bytes }
          }))
        : []
    },
  } })
}
void main()
