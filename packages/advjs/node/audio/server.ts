import type { AdvConfig } from '@advjs/types'
import type { IncomingMessage, Server } from 'node:http'
import type { HostedVoiceJobsSnapshot, HostedVoiceReceipt } from '../../shared/hosted-audio'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { audioProjectMediaPath, canonicalAudioJson } from '@advjs/audio'
import { isAbsolute, relative, resolve } from 'pathe'
import { STUDIO_VOICE_API_PREFIX } from '../../shared/hosted-audio'
import { runVoiceDoctor, runVoiceProviders } from '../commands/voice'
import { createEditorVoiceJobsHost, editorVoiceJobsErrorCode } from '../editor/audio-jobs'
import { atomicProjectWrite } from '../editor/mutations'
import { withProjectWriteLock } from '../project/write-lock'
import { createNodeVoiceGenerationStore, defaultVoiceGenerationStoreDirectory } from './job-store'
import { createHostedVoiceProjectSync, HostedVoiceSyncError } from './server-sync'
import { createNodeVoiceAuthoringService } from './voice'
import { createNodeVoiceDesignHost } from './voice-design'
import { createVoiceDesignMirrorValidator, createVoiceTemplateSyncGuard } from './voice-design-sync'

export interface StudioVoiceProjectRegistration {
  accountId: string
  projectId: string
  root: string
  /** Actual installed provider objects and environment-backed secrets stay here. */
  config?: Partial<AdvConfig>
}

export interface StudioAudioPublicationPort {
  prepare: (input: unknown) => Promise<unknown>
  beginPrepare?: (input: unknown) => Promise<unknown>
  preparation?: (id: string) => Promise<unknown>
  preparations?: () => Promise<unknown>
  publish: (input: unknown) => Promise<unknown>
  current: () => Promise<unknown>
  close?: () => Promise<void>
}

export interface StudioVoiceServiceOptions {
  host?: string
  port?: number
  stateDirectory?: string
  allowedOrigins: string[]
  allowedHosts?: string[]
  /** Verify a real session with the identity service. Never decode an unsigned claim. */
  authenticate: (accessToken: string) => Promise<{ accountId: string } | undefined>
  projects: StudioVoiceProjectRegistration[]
  /** Optional live ACL check, also repeated by a running native job before billing. */
  authorizeProject?: (accountId: string, projectId: string) => Promise<boolean>
  publication?: (context: { accountId: string, projectId: string, root: string }) => Promise<StudioAudioPublicationPort>
}

function fail(code: string, status = 400): never {
  throw new HostedVoiceSyncError(status, code)
}
function fields(value: unknown, allowed: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)))
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[\w.:-]{1,128}$/u.test(value)
}
function inside(root: string, path: string) {
  const local = relative(root, path)
  return !isAbsolute(local) && local !== '..' && !local.startsWith('../')
}
async function bytes(request: IncomingMessage, max: number) {
  const length = Number(request.headers['content-length'])
  if (Number.isFinite(length) && length > max)
    fail('ADV_AUDIO_HTTP_BODY_LIMIT', 413)
  let total = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > max)
      fail('ADV_AUDIO_HTTP_BODY_LIMIT', 413)
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}
async function json(request: IncomingMessage, max = 64 * 1024) {
  if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')
    fail('ADV_AUDIO_HTTP_JSON_REQUIRED', 415)
  try {
    return JSON.parse((await bytes(request, max)).toString('utf8'))
  }
  catch (error) {
    if (error instanceof HostedVoiceSyncError)
      throw error
    fail('ADV_AUDIO_HTTP_JSON_INVALID')
  }
}

/** Deployable session adapter for a trusted SSO verification endpoint. */
export function createRemoteVoiceSessionAuthenticator(options: { url: string, audience: string, serviceToken?: string, fetch?: typeof fetch }) {
  const url = new URL(options.url)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    fail('ADV_AUDIO_AUTH_ENDPOINT_INVALID')
  if (!options.audience.trim())
    fail('ADV_AUDIO_AUTH_AUDIENCE_REQUIRED')
  return async (accessToken: string): Promise<{ accountId: string } | undefined> => {
    const response = await (options.fetch ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options.serviceToken ? { authorization: `Bearer ${options.serviceToken}` } : {}) },
      body: JSON.stringify({ accessToken, audience: options.audience }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    })
    if (!response.ok)
      return undefined
    const value = await response.json()
    if (!fields(value, ['accountId', 'audience', 'authenticated']) || value.authenticated !== true || value.audience !== options.audience || !validId(value.accountId))
      return undefined
    return { accountId: value.accountId }
  }
}

/** Node owns dispatch, durable receipts and mirror writes; HTTP abort never retries a supplier. */
export async function createStudioVoiceService(options: StudioVoiceServiceOptions) {
  if (typeof options.authenticate !== 'function' || !Array.isArray(options.projects) || !options.projects.length || options.projects.length > 100
    || !Array.isArray(options.allowedOrigins) || !options.allowedOrigins.length || !Number.isInteger(options.port ?? 3389) || (options.port ?? 3389) < 0 || (options.port ?? 3389) > 65535) {
    fail('ADV_AUDIO_SERVICE_CONFIG_INVALID')
  }
  const origins = new Set(options.allowedOrigins.map((origin) => {
    const url = new URL(origin)
    if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))))
      fail('ADV_AUDIO_SERVICE_ORIGIN_INVALID')
    return origin
  }))
  const stateDirectory = resolve(options.stateDirectory ?? resolve(defaultVoiceGenerationStoreDirectory(), 'hosted'))
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 })
  const privateRoot = await realpath(stateDirectory)
  const registrations = new Map<string, StudioVoiceProjectRegistration>()
  const roots: string[] = []
  for (const project of options.projects) {
    if (!validId(project.accountId) || !validId(project.projectId))
      fail('ADV_AUDIO_SERVICE_SCOPE_INVALID')
    const root = await realpath(resolve(project.root))
    if (!(await stat(root)).isDirectory() || roots.some(existing => inside(existing, root) || inside(root, existing)) || inside(root, privateRoot) || inside(privateRoot, root))
      fail('ADV_AUDIO_SERVICE_ROOT_ISOLATION_REQUIRED')
    const key = JSON.stringify([project.accountId, project.projectId])
    if (registrations.has(key))
      fail('ADV_AUDIO_SERVICE_SCOPE_DUPLICATE')
    roots.push(root)
    registrations.set(key, { ...project, root })
  }
  type NativeHost = Awaited<ReturnType<typeof createEditorVoiceJobsHost>>
  type SyncHost = Awaited<ReturnType<typeof createHostedVoiceProjectSync>>
  const hosts = new Map<string, Promise<{ host: NativeHost, design: Awaited<ReturnType<typeof createNodeVoiceDesignHost>>, sync: SyncHost, directory: string, registration: StudioVoiceProjectRegistration }>>()
  const publications = new Map<string, Promise<StudioAudioPublicationPort>>()
  const syncBusy = new Set<string>()
  const permits = new Map<string, { count: number, waiters: Array<() => void> }>()
  let server: Server | undefined
  let origin = ''
  let closing = false
  async function authorized(project: StudioVoiceProjectRegistration) {
    if (closing)
      fail('ADV_AUDIO_SERVICE_CLOSED', 503)
    if (options.authorizeProject && !await options.authorizeProject(project.accountId, project.projectId))
      fail('ADV_AUDIO_PROJECT_FORBIDDEN', 403)
  }
  async function withPermit<T>(providerId: string, signal: AbortSignal, operation: () => Promise<T>, limit: number) {
    const state = permits.get(providerId) ?? { count: 0, waiters: [] }
    permits.set(providerId, state)
    signal.throwIfAborted()
    await new Promise<void>((resolvePermit, reject) => {
      let entered = false
      function abort() {
        if (entered)
          return
        const index = state.waiters.indexOf(enter)
        if (index >= 0)
          state.waiters.splice(index, 1)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      function enter() {
        entered = true
        signal.removeEventListener('abort', abort)
        state.count++
        resolvePermit()
      }
      if (state.count < limit) {
        enter()
      }
      else {
        state.waiters.push(enter)
        signal.addEventListener('abort', abort, { once: true })
      }
    })
    try {
      signal.throwIfAborted()
      return await operation()
    }
    finally {
      state.count--
      state.waiters.shift()?.()
    }
  }
  async function context(accountId: string, projectId: string) {
    const key = JSON.stringify([accountId, projectId])
    const registration = registrations.get(key)
    if (!registration)
      fail('ADV_AUDIO_PROJECT_FORBIDDEN', 403)
    await authorized(registration)
    let pending = hosts.get(key)
    if (!pending) {
      pending = (async () => {
        const directory = resolve(privateRoot, createHash('sha256').update(key).digest('hex'))
        await mkdir(directory, { recursive: true, mode: 0o700 })
        const concurrency: Record<string, number> = {}
        const sync = await createHostedVoiceProjectSync(registration.root, { validateVoiceDesign: createVoiceDesignMirrorValidator({ root: registration.root, config: registration.config }), validateProtectedFiles: createVoiceTemplateSyncGuard({ root: registration.root, config: registration.config }) })
        const hostOptions = {
          projectRoot: registration.root,
          config: registration.config,
          storeDirectory: resolve(directory, 'jobs'),
          scope: { accountId, projectId },
          async validateProjectAccess() {
            await authorized(registration)
            if (syncBusy.has(key))
              fail('ADV_AUDIO_SYNC_IN_PROGRESS', 409)
          },
          async verifyProvider(providerId: string) {
            const provider = (await runVoiceProviders({ root: registration.root, config: registration.config })).providers.find(provider => provider.id === providerId)
            if (!provider?.capabilities?.synthesis)
              fail('ADV_AUDIO_JOB_PROVIDER_UNCONFIGURED')
            concurrency[providerId] = provider.capabilities.backend === 'local' ? 1 : 3
            // Local providers must expose a real supported/ready host diagnosis.
            // Qwen's existing adapter checks darwin arm64 and its prepared MLX runtime.
            if (provider.capabilities.backend === 'local' || provider.diagnostics) {
              const diagnosis = await runVoiceDoctor({ root: registration.root, config: registration.config, provider: providerId })
              if (!diagnosis.supported)
                fail('ADV_AUDIO_PROVIDER_HOST_UNSUPPORTED', 503)
              if ((provider.capabilities.backend === 'local' && !diagnosis.ready) || diagnosis.checks.some(check => check.status === 'fail'))
                fail('ADV_AUDIO_PROVIDER_NOT_READY', 503)
            }
          },
          withProviderPermit: <T>(providerId: string, signal: AbortSignal, operation: () => Promise<T>) => withPermit(providerId, signal, operation, concurrency[providerId] ?? 1),
        }
        const host = await createEditorVoiceJobsHost(hostOptions)
        const design = await createNodeVoiceDesignHost({ root: registration.root, config: registration.config, stateDirectory: resolve(directory, 'voice-design'), validateProjectAccess: hostOptions.validateProjectAccess, verifyProvider: hostOptions.verifyProvider, withProviderPermit: hostOptions.withProviderPermit, mediaPrefix: `${STUDIO_VOICE_API_PREFIX}/${encodeURIComponent(projectId)}/voice-design/previews` })
        return { host, design, sync, directory, registration }
      })().catch((error) => {
        hosts.delete(key)
        throw error
      })
      hosts.set(key, pending)
    }
    return { ...await pending, key }
  }
  async function receiptData(target: Awaited<ReturnType<typeof context>>, jobId: string) {
    const job = (await target.host.read()).jobs.find(job => job.id === jobId)
    if (!job)
      fail('ADV_AUDIO_JOB_NOT_FOUND', 404)
    const service = await createNodeVoiceAuthoringService({ root: target.registration.root, config: target.registration.config })
    const snapshot = await service.read()
    const store = await createNodeVoiceGenerationStore({ projectRoot: target.registration.root, directory: resolve(target.directory, 'jobs') })
    const state = await store.read()
    const receipts: HostedVoiceReceipt[] = []
    for (const task of job.tasks.filter(task => task.status === 'committed')) {
      const take = snapshot.ledger.lines[task.lineId]?.locales[task.locale]?.takes.find(take => take.id === task.takeId)
      const asset = snapshot.catalog.assets.find(asset => asset.id === task.assetId)
      const saved = state.idempotency[task.idempotencyKey]?.candidate
      if (!take || !asset || take.id !== task.takeId || take.assetId !== asset.id || take.inputFingerprint !== task.inputFingerprint)
        fail('ADV_AUDIO_RECEIPT_METADATA_REQUIRED', 409)
      await service.verifyTake?.({ lineId: task.lineId, locale: task.locale, takeId: take.id })
      // A native take imported by the author may be a verified cache hit without
      // a server dispatch record. Do not fabricate a hosted generation receipt.
      if (!saved && task.attempts === 0)
        continue
      if (!saved || take.sha256 !== saved.sha256)
        fail('ADV_AUDIO_RECEIPT_METADATA_REQUIRED', 409)
      const { path: _path, alignment: _timing, ...receipt } = saved
      const candidate = { ...receipt, ...(take.alignment ? { alignment: take.alignment } : {}) }
      const relativeAssetPath = asset.path
      if (!relativeAssetPath)
        fail('ADV_AUDIO_RECEIPT_MEDIA_REQUIRED', 409)
      const master = { id: asset.id, type: 'audio' as const, kind: 'voice', path: relativeAssetPath, sha256: saved.sha256, bytes: saved.bytes, mimeType: saved.mimeType, duration: saved.durationSeconds, characterId: task.speakerId, state: 'candidate', source: { type: 'generated', model: take.model, createdAt: take.createdAt }, ...(take.rights ? { license: take.rights.license } : {}) }
      receipts.push({ taskId: task.id, lineId: task.lineId, locale: task.locale, speakerId: task.speakerId, inputFingerprint: task.inputFingerprint, take, asset: master, candidate, assetPath: relativeAssetPath, mediaUrl: `${STUDIO_VOICE_API_PREFIX}/${encodeURIComponent(job.projectId)}/jobs/${encodeURIComponent(job.id)}/media/${encodeURIComponent(task.id)}` })
    }
    return { job, receipts, snapshot }
  }
  async function request(request: IncomingMessage, response: import('node:http').ServerResponse) {
    response.setHeader('cache-control', 'no-store')
    response.setHeader('x-content-type-options', 'nosniff')
    const callerOrigin = request.headers.origin
    if (callerOrigin && !origins.has(callerOrigin))
      fail('ADV_AUDIO_ORIGIN_FORBIDDEN', 403)
    const hostHeader = request.headers.host
    if (!hostHeader || !new Set([new URL(origin).host, ...(options.allowedHosts ?? [])]).has(hostHeader))
      fail('ADV_AUDIO_HOST_FORBIDDEN', 403)
    if (callerOrigin) {
      response.setHeader('access-control-allow-origin', callerOrigin)
      response.setHeader('vary', 'Origin')
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('access-control-allow-methods', 'GET, POST, PUT, OPTIONS')
      response.setHeader('access-control-allow-headers', 'Authorization, Content-Type, X-Advjs-Sha256')
      response.writeHead(204).end()
      return
    }
    const token = request.headers.authorization?.match(/^Bearer (\S{1,8192})$/u)?.[1]
    if (!token)
      fail('ADV_AUDIO_SESSION_REQUIRED', 401)
    const identity = await options.authenticate(token).catch(() => undefined)
    if (!identity || !validId(identity.accountId))
      fail('ADV_AUDIO_SESSION_INVALID', 401)
    const url = new URL(request.url ?? '/', origin)
    if (url.search)
      fail('ADV_AUDIO_HTTP_QUERY_UNSUPPORTED')
    const match = url.pathname.match(/^\/v1\/audio\/projects\/([\w.:%-]+)\/(jobs(?:\/[^/]+\/(?:receipts|media\/[^/]+))?|prepare|plan|enqueue|command|sync|media\/[^/]+|voice-design(?:\/(?:save|plan|execute|register|select|apply|previews\/[\w-]+(?:\/(?:media|cancel))?))?|releases\/(?:prepare|publish|current|preparations(?:\/[^/]+)?))$/u)
    if (!match)
      fail('ADV_AUDIO_HTTP_ROUTE_NOT_FOUND', 404)
    const projectId = decodeURIComponent(match[1]!)
    if (!validId(projectId))
      fail('ADV_AUDIO_SERVICE_SCOPE_INVALID')
    const path = match[2]!
    const target = await context(identity.accountId, projectId)
    let result: unknown
    if (path.startsWith('voice-design')) {
      const suffix = path.slice('voice-design'.length)
      if (!suffix && request.method === 'GET') {
        result = await target.design.read()
      }
      else if (suffix.startsWith('/previews/')) {
        const [, , id, action] = suffix.split('/')
        if (request.method === 'GET' && action === 'media') {
          const media = await target.design.readPreviewAudio(id!)
          response.writeHead(200, { 'content-type': media.mimeType, 'content-length': media.bytes.byteLength, 'x-advjs-sha256': media.sha256 }).end(media.bytes)
          return
        }
        if (request.method === 'GET' && !action)
          result = await target.design.readPreview(id!)
        else if (request.method === 'POST' && action === 'cancel')
          result = await target.design.cancelPreview(id!)
        else fail('VOICE_DESIGN_METHOD_INVALID', 405)
      }
      else if (request.method === 'POST') {
        const input = await json(request, 128 * 1024)
        const methods = { '/save': target.design.saveVersion, '/plan': target.design.planPreview, '/execute': target.design.executePreview, '/register': target.design.registerSample, '/select': target.design.selectSample, '/apply': target.design.applyProfile }
        const method = methods[suffix as keyof typeof methods]
        if (!method)
          fail('VOICE_DESIGN_METHOD_INVALID', 405)
        result = await method(input as never)
      }
      else {
        fail('VOICE_DESIGN_METHOD_INVALID', 405)
      }
    }
    else if (path === 'jobs' && request.method === 'GET') {
      const snapshot = await target.host.read()
      result = { ...snapshot, accountId: identity.accountId, projectId, canQuery: false, providerConcurrency: Object.fromEntries(snapshot.providers.map(provider => [provider.id, provider.backend === 'local' ? 1 : 3])) } satisfies HostedVoiceJobsSnapshot
    }
    else if (path === 'sync' && request.method === 'GET') {
      result = await target.sync.read()
    }
    else if (path === 'sync' && request.method === 'POST') {
      const input = await json(request, 12 * 1024 * 1024)
      if (syncBusy.has(target.key))
        fail('ADV_AUDIO_SYNC_IN_PROGRESS', 409)
      syncBusy.add(target.key)
      try {
        result = await target.sync.sync(input)
      }
      finally {
        syncBusy.delete(target.key)
      }
    }
    else if (path.startsWith('media/') && request.method === 'PUT') {
      const hash = request.headers['x-advjs-sha256']
      if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/u.test(hash))
        fail('ADV_AUDIO_SYNC_MEDIA_INVALID')
      result = await target.sync.upload(decodeURIComponent(path.slice(6)), await bytes(request, 64 * 1024 * 1024), hash, request.headers['content-type']?.split(';')[0]?.trim() ?? '')
    }
    else if (['prepare', 'plan', 'enqueue', 'command'].includes(path) && request.method === 'POST') {
      const input = await json(request)
      if (path === 'prepare') {
        result = await target.host.prepare(input)
      }
      else if (path === 'plan') {
        result = await target.host.plan(input)
      }
      else if (path === 'command') {
        result = await target.host.command(input)
      }
      else {
        if (!fields(input, ['planId', 'planHash']) || typeof input.planId !== 'string' || typeof input.planHash !== 'string')
          fail('ADV_AUDIO_JOB_REVIEW_REQUIRED')
        const path = resolve(target.directory, 'enqueue-receipts.json')
        result = await withProjectWriteLock(target.directory, async () => {
          const previous = JSON.parse(await readFile(path, 'utf8').catch(error => error.code === 'ENOENT' ? '{}' : Promise.reject(error))) as Record<string, string>
          if (previous[input.planId as string]) {
            if (previous[input.planId as string] !== input.planHash)
              fail('ADV_AUDIO_JOB_REVIEW_REQUIRED')
            const existing = (await target.host.read()).jobs.find(job => job.id === input.planId)
            if (existing)
              return existing
          }
          // Persist only an authenticated, current reviewed hash. The receipt
          // precedes job storage so a crash cannot lose successful-enqueue
          // replay authority; rejected hashes never reserve a plan ID.
          await target.host.validateEnqueue(input as { planId: string, planHash: string })
          previous[input.planId as string] = input.planHash as string
          await atomicProjectWrite(path, canonicalAudioJson(previous))
          return await target.host.enqueue(input as { planId: string, planHash: string })
        })
      }
    }
    else if (path.startsWith('jobs/') && request.method === 'GET') {
      const parts = path.split('/')
      const { job, receipts, snapshot } = await receiptData(target, decodeURIComponent(parts[1]!))
      if (parts[2] === 'receipts') {
        result = { job, receipts }
      }
      else {
        const receipt = receipts.find(receipt => receipt.taskId === decodeURIComponent(parts[3]!))
        if (!receipt)
          fail('ADV_AUDIO_RECEIPT_NOT_FOUND', 404)
        const file = await realpath(resolve(target.registration.root, audioProjectMediaPath(snapshot.catalog, receipt.asset)))
        if (!inside(target.registration.root, file))
          fail('ADV_AUDIO_RECEIPT_MEDIA_INVALID', 409)
        const content = await readFile(file)
        if (content.length !== receipt.candidate.bytes || createHash('sha256').update(content).digest('hex') !== receipt.take.sha256)
          fail('ADV_AUDIO_RECEIPT_MEDIA_INVALID', 409)
        response.writeHead(200, { 'content-type': receipt.candidate.mimeType, 'content-length': content.length, 'x-advjs-sha256': receipt.take.sha256 }).end(content)
        return
      }
    }
    else if (path.startsWith('releases/')) {
      if (!options.publication)
        fail('ADV_AUDIO_PUBLICATION_UNCONFIGURED', 503)
      let pending = publications.get(target.key)
      if (!pending) {
        pending = options.publication({ accountId: identity.accountId, projectId, root: target.registration.root }).catch((error) => {
          publications.delete(target.key)
          throw error
        })
        publications.set(target.key, pending)
      }
      const port = await pending
      if (path === 'releases/current' && request.method === 'GET') {
        result = await port.current()
      }
      else if (path === 'releases/preparations' && request.method === 'GET' && port.preparations) {
        result = await port.preparations()
      }
      else if (path.startsWith('releases/preparations/') && request.method === 'GET' && port.preparation) {
        result = await port.preparation(decodeURIComponent(path.slice('releases/preparations/'.length)))
      }
      else if (['releases/prepare', 'releases/publish'].includes(path) && request.method === 'POST') {
        const input = await json(request)
        const allowed = path === 'releases/prepare' ? ['assetIds', 'expectedSourceRevision'] : ['planId', 'expectedManifestRevision', 'expectedSourceRevision']
        if (!fields(input, allowed))
          fail('ADV_AUDIO_PUBLICATION_INPUT_INVALID')
        result = path === 'releases/prepare' ? await (port.beginPrepare ?? port.prepare)(input) : await port.publish(input)
      }
      else {
        fail('ADV_AUDIO_HTTP_METHOD_INVALID', 405)
      }
    }
    else {
      fail('ADV_AUDIO_HTTP_METHOD_INVALID', 405)
    }
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(result))
  }
  return {
    async start() {
      if (server)
        return { url: origin }
      closing = false
      server = createServer((req, res) => {
        void request(req, res).catch((error) => {
          if (res.headersSent) {
            res.end()
            return
          }
          const status = error instanceof HostedVoiceSyncError ? error.statusCode : 400
          res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: { code: editorVoiceJobsErrorCode(error) } }))
        })
      })
      await new Promise<void>((resolveReady, reject) => {
        server!.once('error', reject)
        server!.listen(options.port ?? 3389, options.host ?? '127.0.0.1', resolveReady)
      })
      const address = server.address()
      if (!address || typeof address === 'string')
        fail('ADV_AUDIO_SERVICE_LISTEN_FAILED')
      const hostname = options.host ?? '127.0.0.1'
      origin = `http://${hostname.includes(':') ? `[${hostname}]` : hostname}:${address.port}`
      return { url: origin }
    },
    async stop() {
      closing = true
      await Promise.allSettled([...hosts.values()].map(async pending => (await pending).host.close()))
      await Promise.allSettled([...hosts.values()].map(async pending => (await pending).design.close()))
      await Promise.allSettled([...publications.values()].map(async pending => (await pending).close?.()))
      const old = server
      server = undefined
      hosts.clear()
      publications.clear()
      old?.closeAllConnections()
      if (old)
        await new Promise<void>(resolveStopped => old.close(() => resolveStopped()))
    },
  }
}
