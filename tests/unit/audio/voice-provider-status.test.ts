// @vitest-environment node
import type { AdvVoiceDoctorResult } from '@advjs/types'
import { rm } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setVoiceProviderEnabled } from '../../../packages/advjs/node/audio/provider-state'
import { createVoiceProviderStatus } from '../../../packages/advjs/node/audio/provider-status'
import { createEditorBridge } from '../../../packages/advjs/node/editor'
import { createEditorVoiceJobsFixture } from '../../fixtures/audio/editor-voice-jobs'

const roots: string[] = []
async function fixture() {
  const value = await createEditorVoiceJobsFixture()
  roots.push(value.directory)
  return { ...value, service: createVoiceProviderStatus({ root: value.root, config: value.config }) }
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('official catalog provider status', () => {
  it('reads only validated registration metadata and never invokes environment or model probes', async () => {
    const f = await fixture()
    const doctor = vi.fn<() => Promise<AdvVoiceDoctorResult>>()
    const running = vi.fn()
    f.provider.doctor = doctor
    Object.assign(f.provider.capabilities, { secret: 'private credential' })
    Object.assign(f.provider, { installation: { root: '/unreadable-model-directory', isRunning: running } })
    expect(await f.service.read()).toEqual({ configured: true, providers: [{ id: f.provider.id, enabled: true, diagnostics: true, capabilities: { backend: 'local', synthesis: true, voiceCreation: false, offline: true, models: [{ id: 'fixture-model', modes: ['system'], formats: ['audio/wav'], streaming: false }] } }] })
    expect(doctor).not.toHaveBeenCalled()
    expect(running).not.toHaveBeenCalled()
    expect(f.calls).toHaveLength(0)
    expect(await createVoiceProviderStatus({ root: f.root, config: {} }).read()).toEqual({ configured: false, providers: [] })
  })

  it('distinguishes absent registration, disabled providers, and unavailable diagnostics', async () => {
    const f = await fixture()
    expect((await f.service.doctor('not-installed')).state).toBe('unconfigured')
    expect((await f.service.doctor(f.provider.id)).state).toBe('diagnostics-unavailable')
    const doctor = vi.fn()
    f.provider.doctor = doctor
    await setVoiceProviderEnabled(f.root, f.provider.id, false)
    expect((await f.service.read()).providers[0]).toMatchObject({ enabled: false, diagnostics: true })
    expect((await f.service.doctor(f.provider.id)).state).toBe('disabled')
    expect(doctor).not.toHaveBeenCalled()
  })

  it('only diagnoses on request, preserves platform/readiness outcomes and removes all raw diagnostic strings', async () => {
    const f = await fixture()
    const doctor = vi.fn().mockResolvedValue({ provider: f.provider.id, supported: true, ready: true, environmentDirectory: '/private/environment', checks: [
      { id: 'environment', status: 'pass', message: 'sk-private-token /private/path and raw spawn exception' },
      { id: 'secret-check-id', status: 'warn', message: 'Bearer private-secret' },
    ] })
    f.provider.doctor = doctor
    await f.service.read()
    expect(doctor).not.toHaveBeenCalled()
    const result = await f.service.doctor(f.provider.id)
    expect(result.state).toBe('ready')
    expect(result.checks).toEqual([
      { id: 'environment', status: 'pass', message: 'Prepared Python environment.' },
      { id: 'additional-2', status: 'warn', message: 'Additional provider diagnostic.' },
    ])
    expect(JSON.stringify(result)).not.toMatch(/private|secret|spawn/u)
    doctor.mockResolvedValue({ supported: false, ready: false, checks: [] })
    expect((await f.service.doctor(f.provider.id)).state).toBe('unsupported')
    doctor.mockResolvedValue({ supported: true, ready: false, checks: [{ id: 'credentials', status: 'pass', message: 'key-secret' }, { id: 'connectivity', status: 'warn', message: 'not verified' }] })
    const cloud = await f.service.doctor(f.provider.id)
    expect(cloud.state).toBe('not-ready')
    expect(cloud.checks[0]?.message).toContain('remote access and quota remain unverified')
    expect(f.calls).toHaveLength(0)
  })

  it('bounds client cancellation and never exposes raw provider exceptions', async () => {
    const f = await fixture()
    f.provider.doctor = vi.fn().mockRejectedValue(new Error('key-secret from /private/environment command'))
    await expect(f.service.doctor(f.provider.id)).rejects.toThrow(/^VOICE_PROVIDER_DIAGNOSTICS_FAILED$/u)
    const invoked = vi.fn()
    f.provider.doctor = async ({ signal }) => {
      invoked()
      return await new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason), { once: true }))
    }
    const abort = new AbortController()
    const pending = f.service.doctor(f.provider.id, abort.signal)
    const rejected = expect(pending).rejects.toThrow()
    await vi.waitFor(() => expect(invoked).toHaveBeenCalledOnce())
    abort.abort()
    await rejected
    await expect(f.service.doctor('')).rejects.toThrow('INPUT_INVALID')
  })

  it('authenticates finite bridge reads and explicit checks, rejects arbitrary fields, and sanitizes errors', async () => {
    const f = await fixture()
    const doctor = vi.fn().mockResolvedValue({ provider: f.provider.id, supported: true, ready: true, checks: [{ id: 'loaded-model', status: 'pass', message: 'secret-key' }] })
    f.provider.doctor = doctor
    const bridge = await createEditorBridge({ projectRoot: f.root, publicRoot: f.publicRoot, port: 0, audioJobs: { config: f.config, storeDirectory: f.storeDirectory } })
    const ready = await bridge.start()
    const origin = new URL(ready.url).origin
    const request = (path: string, input?: unknown, headers = { authorization: `Bearer ${bridge.token}` }) => fetch(`${origin}/__advjs/api/audio/provider-status${path}`, { method: input === undefined ? 'GET' : 'POST', headers: { ...headers, 'content-type': 'application/json' }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) })
    try {
      expect((await request('', undefined, { authorization: '' })).status).toBe(401)
      expect((await request('')).status).toBe(200)
      expect(doctor).not.toHaveBeenCalled()
      expect((await request('/doctor', { providerId: f.provider.id, root: '/elsewhere' })).status).toBe(409)
      expect((await request('/doctor?root=/elsewhere', { providerId: f.provider.id })).status).toBe(409)
      const result = await request('/doctor', { providerId: f.provider.id })
      expect(await result.json()).toMatchObject({ state: 'ready', checks: [{ id: 'loaded-model', status: 'pass' }] })
      doctor.mockRejectedValue(new Error('secret-key /private/env'))
      const failure = await request('/doctor', { providerId: f.provider.id })
      expect(failure.status).toBe(409)
      expect(await failure.json()).toEqual({ error: 'VOICE_PROVIDER_DIAGNOSTICS_FAILED' })
      expect(f.calls).toHaveLength(0)
    }
    finally {
      await bridge.stop()
    }
  })
})
