import type cloudbase from '@cloudbase/js-sdk'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h, onMounted, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import AudioWorkspace from '../../../src/components/audio/AudioWorkspace.vue'
import { cloudbaseAuthInjectionKey } from '../../../src/composables/useCloudbase'
import { useManagedVoiceSession } from '../../../src/composables/useManagedVoiceSession'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import en from '../../../src/i18n/locales/en.json'
import zh from '../../../src/i18n/locales/zh-CN.json'
import { useAuthStore } from '../../../src/stores/useAuthStore'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import { MemoryFsAdapter } from '../../../src/utils/fs/MemoryFsAdapter'
import { createStudioAudioService } from '../../../src/utils/projectAudio'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import '../../../src/theme/shared.css'

async function main() {
  const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
  const pinia = createPinia()
  setActivePinia(pinia)
  // Test-only SDK session adapter; production uses the installed CloudBase SDK.
  const sdk = { getSession: async () => ({ data: { session: { access_token: 'fixture-session', expires_at: 9999999999, user: { id: 'fixture-author' } } } }) } as unknown as cloudbase.auth.App
  const fs = new MemoryFsAdapter('hosted-project')
  await fs.init()
  if (!await fs.exists('adv.config.json')) {
    const files = await fetch('/fixture/files').then(response => response.json())
    for (const [path, content] of Object.entries(files))
      await fs.writeFile(path, content as string)
    await fs.writeFile('adv/chapters/intro.adv.md', `@Hero\n浏览器最新对白。 {#${lineId}}`)
    await fs.persist()
  }
  const studio = useStudioStore()
  studio.currentProject = { projectId: 'hosted-project', name: 'Managed voice acceptance', source: 'local', lastOpened: Date.now() }
  await useAuthStore().restoreSession(sdk)
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh, en } })
  const app = createApp(defineComponent({
    setup() {
      const project = useProjectContent()
      const session = useManagedVoiceSession()
      const dialogue = ref('浏览器最新对白。')
      const key = ref(0)
      onMounted(async () => {
        await project.whenReady()
        const native = project.getFs()!
        Object.assign(window, { hostedAudioFixture: {
          snapshot: () => createStudioAudioService(native).read(),
          verify: async () => {
            const service = createStudioAudioService(native)
            const next = await service.read()
            const take = next.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
            await service.verifyTake?.({ lineId, locale: 'zh-CN', takeId: take.id })
          },
          sync: () => session.client.value!.syncNativeProject(native),
          persist: () => (native as MemoryFsAdapter).persist(),
          logout: () => useAuthStore().clearSession(),
          locale: (locale: 'zh-CN' | 'en') => { i18n.global.locale.value = locale },
        } })
      })
      async function save() {
        await project.getFs()!.writeFile('adv/chapters/intro.adv.md', `@Hero\n${dialogue.value} {#${lineId}}`)
        await (project.getFs() as MemoryFsAdapter).persist()
        key.value++
      }
      return () => h('main', [
        h('section', { style: 'max-width:1040px;margin:16px auto;padding:16px' }, [
          h('label', ['测试作者对白', h('textarea', {
            'aria-label': '测试作者对白',
            'value': dialogue.value,
            'onInput': (event: Event) => {
              dialogue.value = (event.target as HTMLTextAreaElement).value
            },
          })]),
          h('button', { onClick: save }, '保存对白'),
        ]),
        h(AudioWorkspace, { active: true, key: key.value }),
      ])
    },
  }))
  app.use(pinia)
  app.use(i18n)
  app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }, { path: '/login', component: { render: () => null } }] }))
  app.provide(cloudbaseAuthInjectionKey, sdk)
  app.mount('#app')
}
void main().catch((error) => {
  document.body.textContent = String(error)
})
