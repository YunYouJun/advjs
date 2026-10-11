import type { HostedVoiceJobsSnapshot, HostedVoiceReceipts, HostedVoiceReviewedPlan } from '../../../packages/advjs/shared/hosted-audio'
import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { createLocalVoiceServiceOptions } from '../../../packages/advjs/node/audio/local-session'
import { createStudioVoiceService } from '../../../packages/advjs/node/audio/server'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'

const origin = 'http://localhost:3388'
const projectId = 'local-project'
const prefix = `/v1/audio/projects/${projectId}`
const session = () => ({ accessToken: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() })

describe('local audio pairing on the shared service', () => {
  it('limits the operator configuration, expiry and local identity before starting a server', async () => {
    const pairing = session()
    const input = { ...pairing, allowedOrigins: [origin], projects: [{ projectId, root: '/operator/project' }] }
    const options = createLocalVoiceServiceOptions(input)
    expect(options.host).toBe('127.0.0.1')
    expect(options.projects[0]!.accountId).toBe('local-device')
    expect(await options.authenticate(pairing.accessToken)).toEqual({ accountId: 'local-device' })
    expect(await options.authenticate(randomBytes(32).toString('hex'))).toBeUndefined()
    expect(await options.authorizeProject!('cloud-user', projectId)).toBe(false)
    expect(await options.authorizeProject!('local-device', 'different-project')).toBe(false)
    for (const override of [
      { accessToken: 'weak-token' },
      { expiresAt: new Date(Date.now() - 1).toISOString() },
      { expiresAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString() },
      { expiresAt: 'invalid' },
      { host: '0.0.0.0' },
      { allowedOrigins: ['https://studio.example.com'] },
      { allowedOrigins: ['http://localhost.evil.test:3388'] },
      { allowedOrigins: ['http://localhost:3388/path'] },
      { projects: [{ projectId, root: '/operator/project', accountId: 'browser-account' }] },
    ]) {
      expect(() => createLocalVoiceServiceOptions({ ...input, ...override })).toThrow('ADV_AUDIO_LOCAL_SESSION_CONFIG_INVALID')
    }
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(pairing.expiresAt))
    try {
      expect(await options.authenticate(pairing.accessToken)).toBeUndefined()
      expect(await options.authorizeProject!('local-device', projectId)).toBe(false)
    }
    finally { clock.mockRestore() }
  })

  it('uses the existing jobs and publication routes, preserves receipts across token rotation and rejects other scopes', async () => {
    const source = await createEditorVoiceJobsFixture()
    source.provider.doctor = async () => ({ provider: source.provider.id, ready: true, supported: true, checks: [] })
    let pairing = session()
    let publications = 0
    const configuration = () => createLocalVoiceServiceOptions({
      ...pairing,
      port: 0,
      stateDirectory: source.storeDirectory,
      allowedOrigins: [origin],
      projects: [{ projectId, root: source.root, config: source.config }],
      publication: async (context) => {
        expect(context).toEqual({ accountId: 'local-device', projectId, root: source.root })
        publications++
        return { prepare: async () => ({}), publish: async () => ({}), current: async () => null }
      },
    })
    let service = await createStudioVoiceService(configuration())
    let url = (await service.start()).url
    async function request(path: string, method = 'GET', body?: unknown, token = pairing.accessToken, headers: Record<string, string> = {}) {
      return fetch(`${url}${path}`, { method, headers: { origin, authorization: `Bearer ${token}`, ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    }
    async function success<T>(path: string, method = 'GET', body?: unknown) {
      const response = await request(path, method, body)
      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text).not.toContain(pairing.accessToken)
      expect(text).not.toContain(source.root)
      return JSON.parse(text) as T
    }
    try {
      expect((await request(`${prefix}/jobs`, 'GET', undefined, 'bad')).status).toBe(401)
      expect((await request(`${prefix}/jobs`, 'GET', undefined, pairing.accessToken, { origin: 'https://evil.example' })).status).toBe(403)
      const reboundHost = await new Promise<number | undefined>((resolve, reject) => {
        const attempt = httpRequest(`${url}${prefix}/jobs`, { headers: { origin, host: 'evil.example', authorization: `Bearer ${pairing.accessToken}` } }, (response) => {
          response.resume()
          response.on('end', () => resolve(response.statusCode))
        })
        attempt.on('error', reject)
        attempt.end()
      })
      expect(reboundHost).toBe(403)
      expect((await request('/v1/audio/projects/not-registered/jobs')).status).toBe(403)
      expect((await request(`${prefix}/releases/current`, 'GET', undefined, 'bad')).status).toBe(401)
      expect(publications).toBe(0)
      const state = await success<HostedVoiceJobsSnapshot>(`${prefix}/jobs`)
      expect(state).toMatchObject({ accountId: 'local-device', projectId, configured: true })
      expect(source.calls).toHaveLength(0)
      expect(await success(`${prefix}/releases/current`)).toBeNull()
      expect(publications).toBe(1)
      const review = await success<HostedVoiceReviewedPlan>(`${prefix}/plan`, 'POST', { lineIds: [editorJobLineIds[0]], locale: 'zh-CN', providerId: source.provider.id, budget: { maxCharacters: 1000, allowUnknownCost: true, concurrency: 1 } })
      await success(`${prefix}/enqueue`, 'POST', { planId: review.plan.id, planHash: review.planHash })
      await success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      for (let attempt = 0; attempt < 100; attempt++) {
        const job = (await success<HostedVoiceJobsSnapshot>(`${prefix}/jobs`)).jobs.find(job => job.id === review.plan.id)!
        if (job.tasks.every(task => task.status === 'committed'))
          break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      const generated = await success<HostedVoiceReceipts>(`${prefix}/jobs/${review.plan.id}/receipts`)
      expect(generated.receipts).toHaveLength(1)
      expect(generated.receipts[0]!.asset.id).toBe(generated.receipts[0]!.take.assetId)
      expect(source.calls).toHaveLength(1)
      await service.stop()
      const oldToken = pairing.accessToken
      pairing = session()
      service = await createStudioVoiceService(configuration())
      url = (await service.start()).url
      expect((await request(`${prefix}/jobs`, 'GET', undefined, oldToken)).status).toBe(401)
      const recovered = await success<HostedVoiceReceipts>(`${prefix}/jobs/${review.plan.id}/receipts`)
      expect(recovered.receipts[0]!.take.id).toBe(generated.receipts[0]!.take.id)
      expect(recovered.receipts[0]!.take.sha256).toBe(generated.receipts[0]!.take.sha256)
      await success(`${prefix}/command`, 'POST', { jobId: review.plan.id, action: 'run' })
      expect(source.calls).toHaveLength(1)
      const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(pairing.expiresAt))
      try {
        expect((await request(`${prefix}/jobs`)).status).toBe(401)
      }
      finally { clock.mockRestore() }
    }
    finally {
      await service.stop()
      await rm(source.directory, { recursive: true, force: true })
    }
  })
})
