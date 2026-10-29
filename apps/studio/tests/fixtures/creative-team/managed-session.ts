import type { AgentRequest } from '@advjs/agent'
import type cloudbase from '@cloudbase/js-sdk'
import type { StudioSsoSdk } from '../../../src/auth/studio-sso'
import { IonicVue } from '@ionic/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createStudioIdentityCoordinator } from '../../../src/auth/identity-coordinator'
import { STUDIO_SSO_CONFIGS } from '../../../src/auth/sso-config'
import ManagedAgentConsole from '../../../src/components/agent/ManagedAgentConsole.vue'
import { cloudbaseAuthInjectionKey } from '../../../src/composables/useCloudbase'
import { useManagedAgentSession } from '../../../src/composables/useManagedAgentSession'
import { useManagedVoiceSession } from '../../../src/composables/useManagedVoiceSession'
import { studioIdentityInjectionKey } from '../../../src/composables/useStudioIdentity'
import en from '../../../src/i18n/locales/en.json'
import { useAuthStore } from '../../../src/stores/useAuthStore'
import { useManagedAgentStore } from '../../../src/stores/useManagedAgentStore'
import { useStudioStore } from '../../../src/stores/useStudioStore'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '../../../src/theme/variables.css'
import '../../../src/theme/global.css'
import 'virtual:uno.css'

/** Only the SDK identity is a fixture. Real clients make HTTP requests to the intercepted local service. */
async function main() {
  const coordinated = new URLSearchParams(location.search).has('coordinator')
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  const store = useManagedAgentStore()
  const studio = useStudioStore()
  const outcome = ref('ready')
  const tokenState = ref('ready')
  const logoutState = ref('ready')
  const hostState = ref('ready')
  const writeState = ref('ready')
  const identityCalls = ref<string[]>([])
  let holdHost = false
  let holdWrite = false
  let releaseHost: (() => void) | undefined
  let releaseWrite: (() => void) | undefined
  let actor = 'author'
  let hold = false
  let release: (() => void) | undefined
  let releaseLogout: (() => void) | undefined
  let notifyIdentity: (() => void) | undefined
  const session = (id: string) => ({ data: { session: id ? { access_token: `${id}-fixture-token`, refresh_token: 'fixture-only', expires_at: 9999999999, user: { id } } : null } })
  const sdk = {
    async getSession() {
      const value = session(actor)
      if (hold) {
        hold = false
        tokenState.value = 'held'
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return value
    },
    async signOut() {
      if (coordinated) {
        identityCalls.value.push('signout')
        actor = ''
        return {}
      }
      logoutState.value = 'held'
      await new Promise<void>((resolve) => {
        releaseLogout = resolve
      })
      return {}
    },
    async signInWithCustomTicket(getTicket: () => Promise<string>) {
      const ticket = await getTicket()
      identityCalls.value.push(`signin:${ticket}`)
      if (holdWrite) {
        holdWrite = false
        writeState.value = 'held'
        await new Promise<void>((resolve) => {
          releaseWrite = resolve
        })
      }
      actor = ticket
      notifyIdentity?.()
      return {}
    },
  } as unknown as cloudbase.auth.App
  await auth.restoreSession(sdk)
  const setProject = (projectId: string) => {
    studio.currentProject = { projectId, name: projectId, lastOpened: 0 }
  }
  setProject('station')
  async function setActor(id: string) {
    actor = id
    await auth.restoreSession(sdk)
  }
  const request: AgentRequest = { clientRequestId: 'explicit-fixture-intent', capability: 'generate-outline', input: { premise: 'private fixture premise' }, locale: 'en', project: { id: 'station', revision: 'fixture-r1', files: { 'adv/world.md': '# Private fixture world' } } }
  async function perform(action: () => Promise<unknown>) {
    outcome.value = 'pending'
    try {
      const result = await action()
      outcome.value = result === false ? 'superseded' : 'complete'
    }
    catch {
      outcome.value = 'blocked'
    }
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }, { path: '/login', component: { render: () => null } }] })
  await router.push('/')
  let requestedActor = 'author'
  const sso: StudioSsoSdk = {
    async requestHostSsoAuthorization() {
      const code = requestedActor
      if (holdHost) {
        holdHost = false
        hostState.value = 'held'
        await new Promise<void>((resolve) => {
          releaseHost = resolve
        })
      }
      return { ok: true, code, issuer: STUDIO_SSO_CONFIGS.production.ssoOrigin, clientId: STUDIO_SSO_CONFIGS.production.clientId, scope: STUDIO_SSO_CONFIGS.production.scope, redirectUri: STUDIO_SSO_CONFIGS.production.redirectUri, nonce: 'fixture-only', codeVerifier: 'fixture-only' }
    },
    async adoptSsoCode(adoption, authorization) {
      await adoption.signInWithCustomTicket(async () => authorization.code)
      return true
    },
    hasSsoRedirectResult: () => false,
    consumeSsoRedirect: () => null,
    startSsoRedirect: async () => {},
  }
  const identity = coordinated
    ? createStudioIdentityCoordinator({
        auth: sdk,
        mirror: auth,
        config: STUDIO_SSO_CONFIGS.production,
        sdk: sso,
        navigate: target => router.replace(target),
      })
    : undefined
  if (identity) {
    notifyIdentity = () => {
      void identity.refresh()
    }
    window.addEventListener('ylf:identityChanged', () => {
      void identity.synchronizeHost()
    })
    await identity.initialize()
  }
  function changeHost(id: string) {
    requestedActor = id
    window.dispatchEvent(new Event('ylf:identityChanged'))
  }
  const app = createApp(defineComponent({
    setup() {
      useManagedAgentSession()
      const voice = useManagedVoiceSession()
      const button = (name: string, action: () => unknown) => h('button', { type: 'button', onClick: action }, name)
      return () => h('main', { style: 'max-width:800px;margin:16px auto;padding:12px' }, [
        h('h1', 'Managed session fixture'),
        h('p', 'Local SDK and HTTP fixtures; no production account, model or point ledger.'),
        h('p', { 'data-testid': 'actor' }, auth.userId ?? 'signed out'),
        h('p', { 'data-testid': 'scope' }, `${voice.client.value?.scope.accountId ?? 'none'}@${voice.client.value?.scope.projectId ?? 'none'}`),
        h('p', { 'data-testid': 'token' }, tokenState.value),
        h('p', { 'data-testid': 'logout' }, logoutState.value),
        h('p', { 'data-testid': 'outcome' }, outcome.value),
        ...(coordinated
          ? [
              h('p', { 'data-testid': 'host' }, hostState.value),
              h('p', { 'data-testid': 'write' }, writeState.value),
              h('p', { 'data-testid': 'identity-calls' }, identityCalls.value.join(',')),
              h('nav', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
                button('Hold host response', () => { holdHost = true }),
                button('Host author', () => changeHost('author')),
                button('Host next account', () => changeHost('next-author')),
                button('Release host response', () => {
                  releaseHost?.()
                  hostState.value = 'released'
                }),
                button('Hold SDK write', () => { holdWrite = true }),
                button('Release SDK write', () => {
                  releaseWrite?.()
                  writeState.value = 'released'
                }),
                button('Coordinator logout', () => perform(() => identity!.logout())),
              ]),
            ]
          : []),
        h('nav', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px' }, [
          button('Hold next token', () => { hold = true }),
          button('Release old token', () => {
            release?.()
            release = undefined
            tokenState.value = 'released'
          }),
          button('Submit AI', () => perform(() => store.startTask(request))),
          button('Refresh identity', () => perform(() => auth.restoreSession(sdk))),
          button('Clear login', () => auth.clearSession()),
          button('Sign out', () => perform(() => auth.logout(sdk))),
          button('Release old logout', () => {
            releaseLogout?.()
            releaseLogout = undefined
            logoutState.value = 'released'
          }),
          button('Switch account', () => setActor('next-author')),
          button('Return author', () => setActor('author')),
          button('Other project', () => setProject('other')),
          button('Station project', () => setProject('station')),
          button('Refresh balance', () => perform(() => store.refreshPoints())),
          button('Upload voice source', () => perform(() => voice.client.value!.request('/sync', 'POST', { files: request.project.files }))),
          button('Read voice jobs', () => perform(() => voice.client.value!.request('/jobs'))),
        ]),
        h(ManagedAgentConsole, { loggedIn: auth.isLoggedIn }),
      ])
    },
  }))
  app.use(pinia).use(IonicVue).use(router).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
  app.provide(cloudbaseAuthInjectionKey, sdk)
  if (identity)
    app.provide(studioIdentityInjectionKey, identity)
  app.mount('#app')
}
void main()
