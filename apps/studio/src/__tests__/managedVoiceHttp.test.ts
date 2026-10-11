import type { VoiceAuthoringSnapshot } from '@advjs/types'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeAccessTokenGetter } from '../auth/cloudbase-session'
import { createManagedVoiceClient, selectHostedVoiceFiles } from '../utils/managedVoiceClient'
import { createManagedVoiceHttp, resolveManagedVoiceServiceUrl } from '../utils/managedVoiceHttp'

const scope = { accountId: 'author', projectId: 'project' }
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
function options() {
  return { ...scope, baseUrl: 'http://127.0.0.1:3389', getAccessToken: async () => 'session-token', assertCurrent: vi.fn() }
}
describe('managed Studio voice authentication and finite transport', () => {
  it('accepts managed HTTPS/local endpoints and refuses insecure or credential-bearing URLs', () => {
    expect(resolveManagedVoiceServiceUrl('https://managed.example/voice/')).toBe('https://managed.example/voice')
    expect(resolveManagedVoiceServiceUrl('http://127.0.0.1:3389')).toBe('http://127.0.0.1:3389')
    for (const value of ['http://remote.example', 'https://name:secret@managed.example', 'https://managed.example?token=secret', 'https://managed.example#fragment'])
      expect(resolveManagedVoiceServiceUrl(value)).toBeUndefined()
  })
  it('refreshes the existing verified session and sends only the refreshed bearer token to a scoped route', async () => {
    const session = (token: string, expires: number) => ({ data: { session: { access_token: token, refresh_token: 'refresh', expires_at: expires, user: { id: scope.accountId } } } })
    const auth = { getSession: async () => session('expired', 1), refreshSession: vi.fn(async () => session('refreshed', 9999999999)) }
    const getAccessToken = createRuntimeAccessTokenGetter(auth, { onSessionExpired: vi.fn() })
    const fetch = vi.fn(async () => response({ ok: true }))
    const client = createManagedVoiceHttp({ ...options(), getAccessToken, fetch })
    expect(await client.json('/releases/current')).toEqual({ ok: true })
    expect(auth.refreshSession).toHaveBeenCalledExactlyOnceWith('refresh')
    expect(fetch).toHaveBeenCalledExactlyOnceWith('http://127.0.0.1:3389/v1/audio/projects/project/releases/current', expect.objectContaining({ credentials: 'omit', redirect: 'error', headers: { authorization: 'Bearer refreshed' } }))
    await expect(client.json('/../other')).rejects.toThrow('ROUTE_INVALID')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('clears expired sessions on 401 and prevents delayed token refresh from crossing account/project scope', async () => {
    const expired = vi.fn()
    const fetch = vi.fn(async () => response({}, 401))
    const client = createManagedVoiceHttp({ ...options(), fetch, onSessionExpired: expired })
    await expect(client.json('/jobs')).rejects.toThrow('LOGIN_REQUIRED')
    expect(expired).toHaveBeenCalledOnce()
    let resolve!: (value: string) => void
    let current = true
    const delayed = createManagedVoiceHttp({ ...options(), fetch, getAccessToken: () => new Promise(done => resolve = done), assertCurrent: () => {
      if (!current)
        throw new Error('AUDIO_JOB_SCOPE_CHANGED')
    } })
    const pending = delayed.json('/jobs')
    current = false
    resolve('wrong-account-token')
    await expect(pending).rejects.toThrow('SCOPE_CHANGED')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('shows only structured host codes and validates media scope, length and bounded download bytes', async () => {
    const http = createManagedVoiceHttp({ ...options(), fetch: async () => response({ error: { code: 'VOICE_CONFLICT', message: 'private server path' } }, 409) })
    await expect(http.json('/sync')).rejects.toThrow(/^VOICE_CONFLICT$/u)
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-length': '3' } }))
    const media = createManagedVoiceHttp({ ...options(), fetch })
    for (const url of ['https://other.example/media/take', '/v1/audio/projects/other/jobs/job/media/task', '/v1/audio/projects/project/jobs/job/media/task?token=private'])
      await expect(media.media(url, 3)).rejects.toThrow('MEDIA_SCOPE_INVALID')
    expect(fetch).not.toHaveBeenCalled()
    expect(new Uint8Array(await media.media('/v1/audio/projects/project/jobs/job/media/task', 3))).toEqual(new Uint8Array([1, 2, 3]))
    await expect(media.media('/v1/audio/projects/project/jobs/job/media/task', 2)).rejects.toThrow('VOICE_AUDIO_CHANGED')
    await expect(media.media('/v1/audio/projects/project/jobs/job/media/task', 65 * 1024 * 1024)).rejects.toThrow('MEDIA_LIMIT')
  })
  it('rejects a foreign account response instead of restoring its jobs', async () => {
    const client = createManagedVoiceClient({ ...options(), fetch: async () => response({ ...scope, accountId: 'other', configured: true, jobs: [], providers: [], providerConcurrency: {} }) })
    await expect(client.read()).rejects.toThrow('SCOPE_MISMATCH')
  })
  it('exports only finite native author documents and explicitly referenced consent, never executable config or private records', () => {
    const snapshot = { ledger: { schemaVersion: 1, lines: {} } } as VoiceAuthoringSnapshot
    const context = { lines: [], chapters: [], unidentifiedLines: 0, profiles: { hero: { intent: {}, locales: { en: { providers: { native: { voiceId: 'voice', model: 'model', source: 'cloned' as const, rights: { consentRecord: 'rights/consent.md', subject: 'Author', license: 'CC0' } } } } } } } }
    const files = { 'adv.config.json': '{}', 'adv/assets.json': '{}', 'adv/audio/toolchain.json': '{}', 'adv/chapters/flow.chapter.json': '{}', 'rights/consent.md': 'Reviewed consent', 'adv.config.ts': 'executable', 'adv/chapters/code.chapter.ts': 'code', 'private/jobs.json': 'private task', 'adv/characters/../../secret.character.json': 'traversal' }
    expect(Object.keys(selectHostedVoiceFiles(files, context, snapshot)).sort()).toEqual(['adv.config.json', 'adv/assets.json', 'adv/audio/toolchain.json', 'adv/chapters/flow.chapter.json', 'rights/consent.md'])
    expect(() => selectHostedVoiceFiles({ ...files, 'adv/chapters/large.adv.md': 'x'.repeat(256 * 1024 + 1) }, context, snapshot)).toThrow('SNAPSHOT_LIMIT')
  })
})
