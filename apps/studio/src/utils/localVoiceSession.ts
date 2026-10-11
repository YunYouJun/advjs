import type { ManagedVoiceClient } from './managedVoiceClient'
import { computed, shallowRef } from 'vue'
import { createManagedVoiceClient } from './managedVoiceClient'

export const LOCAL_VOICE_ACCOUNT_ID = 'local-device'
export const DEFAULT_LOCAL_VOICE_URL = 'http://127.0.0.1:3389'

export interface LocalVoiceActor {
  projectId: string
  actorId: string | undefined
}
interface LocalVoiceSession extends LocalVoiceActor {
  baseUrl: string
  client: ManagedVoiceClient
}
const session = shallowRef<LocalVoiceSession>()
const connecting = shallowRef(false)
let epoch = 0
let controller: AbortController | undefined
let pendingActor: LocalVoiceActor | undefined

// A pairing credential stays only in the client closure, never in reactive data.
export const localVoiceSession = computed(() => session.value)
export const localVoiceConnecting = computed(() => connecting.value)

export function isLocalVoicePage(value = window.location.href): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password
  }
  catch { return false }
}

export function resolveLocalVoiceUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      return undefined
    }
    return url.origin
  }
  catch { return undefined }
}

export function disconnectLocalVoiceSession() {
  epoch++
  controller?.abort()
  controller = undefined
  pendingActor = undefined
  connecting.value = false
  session.value = undefined
}

/** Changing project or the surrounding signed-in actor revokes the local pairing. */
export function invalidateLocalVoiceActor(current: LocalVoiceActor) {
  const existing = session.value ?? pendingActor
  if (existing && (existing.projectId !== current.projectId || existing.actorId !== current.actorId))
    disconnectLocalVoiceSession()
}

export async function connectLocalVoiceSession(
  input: { baseUrl: string, accessToken: string },
  options: { actor: () => LocalVoiceActor, fetch?: typeof globalThis.fetch },
): Promise<void> {
  disconnectLocalVoiceSession()
  const baseUrl = resolveLocalVoiceUrl(input.baseUrl)
  const actor = options.actor()
  if (!isLocalVoicePage() || !baseUrl || !/^[a-f0-9]{64}$/u.test(input.accessToken) || !/^[\w.:-]{1,128}$/u.test(actor.projectId))
    throw new Error('AUDIO_LOCAL_CONFIG_INVALID')
  const version = epoch
  const abort = new AbortController()
  controller = abort
  pendingActor = { ...actor }
  connecting.value = true
  let active = false
  let client: ManagedVoiceClient
  const assertCurrent = () => {
    const current = options.actor()
    if (version !== epoch || abort.signal.aborted || !isLocalVoicePage()
      || current.projectId !== actor.projectId || current.actorId !== actor.actorId
      || (active && session.value?.client !== client)) {
      throw new Error('AUDIO_JOB_SCOPE_CHANGED')
    }
  }
  client = createManagedVoiceClient({
    baseUrl,
    accountId: LOCAL_VOICE_ACCOUNT_ID,
    projectId: actor.projectId,
    fetch: options.fetch,
    assertCurrent,
    getAccessToken: async () => {
      assertCurrent()
      return input.accessToken
    },
    onSessionExpired: () => version === epoch && disconnectLocalVoiceSession(),
  })
  const timeout = setTimeout(() => abort.abort(), 10_000)
  try {
    // read() verifies the host's canonical account/project and every durable job.
    await client.read(abort.signal)
    assertCurrent()
    active = true
    pendingActor = undefined
    session.value = { ...actor, baseUrl, client }
  }
  catch (cause) {
    if (version === epoch)
      disconnectLocalVoiceSession()
    const code = cause instanceof Error ? cause.message : ''
    throw new Error(/^(?:AUDIO_JOB_SCOPE_(?:CHANGED|MISMATCH)|AUDIO_SERVICE_(?:LOGIN_REQUIRED|RESPONSE_INVALID))$/u.test(code) ? code : 'AUDIO_LOCAL_CONNECTION_FAILED')
  }
  finally {
    clearTimeout(timeout)
    if (version === epoch)
      connecting.value = false
  }
}
