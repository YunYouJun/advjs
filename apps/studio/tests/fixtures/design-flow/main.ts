import type { AdvContext } from '@advjs/client/types'
import type cloudbase from '@cloudbase/js-sdk'
import { injectionAdvContext } from '@advjs/client/constants'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h, onMounted, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import AudioWorkspace from '../../../src/components/audio/AudioWorkspace.vue'
import FlowWorkspace from '../../../src/components/flow/FlowWorkspace.vue'
import GamePlayer from '../../../src/components/GamePlayer.vue'
import { cloudbaseAuthInjectionKey } from '../../../src/composables/useCloudbase'
import { useManagedVoiceSession } from '../../../src/composables/useManagedVoiceSession'
import { useProjectContent } from '../../../src/composables/useProjectContent'
import { exportProject } from '../../../src/composables/useProjectExport'
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
import 'virtual:uno.css'

async function main() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const localPairing = document.documentElement.dataset.voiceSession === 'local'
  const sdk = localPairing ? undefined : { getSession: async () => ({ data: { session: { access_token: 'fixture-session', expires_at: 9999999999, user: { id: 'fixture-author' } } } }) } as unknown as cloudbase.auth.App
  const fs = new MemoryFsAdapter('design-flow-project')
  await fs.init()
  if (!await fs.exists('adv.config.json')) {
    const files = await fetch('/fixture/files').then(response => response.json())
    for (const [path, content] of Object.entries(files)) await fs.writeFile(path, content as string)
    const wave = await fetch('/fixture/wave').then(response => response.blob())
    await fs.writeBlob('public/media/reference.wav', wave)
    await fs.writeBlob('public/media/music.wav', wave)
    await fs.persist()
  }
  const studio = useStudioStore()
  studio.currentProject = { projectId: 'design-flow-project', name: '声音与分支', source: 'local', lastOpened: Date.now() }
  if (sdk)
    await useAuthStore().restoreSession(sdk)
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh, en } })
  const app = createApp(defineComponent({ setup() {
    const project = useProjectContent()
    const session = useManagedVoiceSession()
    const tab = ref('flow')
    const player = ref<InstanceType<typeof GamePlayer>>()
    onMounted(async () => {
      await project.whenReady()
      const native = project.getFs()!
      Object.assign(window, { designFlowFixture: {
        sessionState: () => ({ loggedIn: useAuthStore().isLoggedIn, sdkProvided: Boolean(sdk), localPaired: session.client.value?.scope.accountId === 'local-device' }),
        snapshot: () => createStudioAudioService(native).read(),
        files: async () => Object.fromEntries((await native.collectAllFiles()).map(file => [file.path, file.content])),
        sync: () => session.client.value!.syncNativeProject(native),
        persist: () => (native as MemoryFsAdapter).persist(),
        playerSnapshot: () => {
          try {
            return player.value?.getCurrentSnapshot()
          }
          catch { return undefined }
        },
        audio: () => ((player.value as unknown as { $?: { provides: Record<symbol, AdvContext> } })?.$?.provides[injectionAdvContext])?.$audio.inspect(),
        advance: () => player.value?.next(),
        locale: (locale: 'zh-CN' | 'en') => i18n.global.locale.value = locale,
        export: async () => {
          const archive = await exportProject(native, '声音与分支')
          const result = await fetch('/fixture/handoff', { method: 'POST', body: archive }).then(response => response.json())
          if (result.error)
            throw new Error(result.error)
          return result
        },
      } })
    })
    return () => h('main', [
      h('nav', { style: tab.value === 'player' ? 'display:none' : 'display:flex;flex-wrap:wrap;gap:8px;padding:16px' }, ['flow', 'audio', 'player'].map(value => h('button', { 'type': 'button', 'aria-pressed': tab.value === value, 'style': 'min-height:48px;padding:8px 16px', 'onClick': () => tab.value = value }, value === 'flow' ? '编辑 Flow' : value === 'audio' ? '音频工作区' : '实际播放器'))),
      tab.value === 'flow' ? h(FlowWorkspace, { active: true, onPlay: () => tab.value = 'player' }) : tab.value === 'audio' ? h(AudioWorkspace, { active: true }) : h('section', { style: 'height:100dvh;min-height:360px' }, [h(GamePlayer, { ref: player, chapterFile: 'adv/chapters/intro.chapter.json' })]),
    ])
  } }))
  app.use(pinia)
  app.use(i18n)
  app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] }))
  if (sdk)
    app.provide(cloudbaseAuthInjectionKey, sdk)
  app.mount('#app')
}
void main().catch(error => document.body.textContent = String(error))
