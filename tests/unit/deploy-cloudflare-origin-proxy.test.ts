// @vitest-environment node

import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCloudflareOriginProxyConfig,
  createCloudflareOriginProxyWorkerSource,
  deployCloudflareOriginProxy,
} from '../../packages/advjs/node/deploy/cloudflare-origin-proxy'

const fakeWrangler = resolve(import.meta.dirname, '../launch/fixtures/fake-wrangler.mjs')
const accountId = 'a'.repeat(32)
const temporaryDirectories: string[] = []

async function importWorker(origin = 'https://origin.example.com') {
  const source = createCloudflareOriginProxyWorkerSource({
    domain: 'game.advjs.org',
    origin,
  })
  const encoded = Buffer.from(source).toString('base64')
  return (await import(`data:text/javascript;base64,${encoded}`)).default as {
    fetch: (request: Request) => Promise<Response>
  }
}

afterEach(async () => {
  vi.unstubAllGlobals()
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('cloudflare origin proxy', () => {
  it('builds a locked-down Custom Domain configuration', () => {
    expect(createCloudflareOriginProxyConfig({
      accountId,
      domain: 'Game.AdvJS.org.',
    })).toEqual({
      $schema: 'node_modules/wrangler/config-schema.json',
      account_id: accountId,
      compatibility_date: '2026-08-19',
      compatibility_flags: ['nodejs_compat'],
      main: 'worker.mjs',
      name: 'advjs-game-advjs-org',
      observability: { enabled: true, head_sampling_rate: 1 },
      preview_urls: false,
      routes: [{ custom_domain: true, pattern: 'game.advjs.org' }],
      workers_dev: false,
    })
  })

  it('proxies the method, streaming body, path, query, and safe forwarding headers', async () => {
    let upstreamRequest: Request | undefined
    let started = false
    const upstreamBody = new ReadableStream({
      start() {
        started = true
      },
    })
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      upstreamRequest = request
      return new Response(upstreamBody, {
        headers: { 'content-type': 'text/plain' },
        status: 201,
      })
    }))
    const worker = await importWorker()

    const response = await worker.fetch(new Request('https://game.advjs.org/api/play?turn=3', {
      body: 'choice=left',
      headers: {
        'cf-connecting-ip': '203.0.113.8',
        'origin': 'https://game.advjs.org',
        'referer': 'https://game.advjs.org/chapter/1',
        'x-forwarded-for': '198.51.100.99',
      },
      method: 'POST',
    }))

    expect(started).toBe(true)
    expect(response.status).toBe(201)
    expect(response.body).toBeTruthy()
    expect(upstreamRequest?.url).toBe('https://origin.example.com/api/play?turn=3')
    expect(upstreamRequest?.method).toBe('POST')
    await expect(upstreamRequest?.text()).resolves.toBe('choice=left')
    expect(upstreamRequest?.headers.get('origin')).toBe('https://origin.example.com')
    expect(upstreamRequest?.headers.get('referer')).toBe('https://origin.example.com/chapter/1')
    expect(upstreamRequest?.headers.get('x-forwarded-for')).toBe('203.0.113.8')
    expect(upstreamRequest?.headers.get('x-forwarded-host')).toBe('game.advjs.org')
    expect(upstreamRequest?.headers.get('x-forwarded-proto')).toBe('https')
  })

  it('rewrites upstream redirects and cookie domains without touching external redirects', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        headers: {
          'location': 'https://origin.example.com/login?next=%2Fplay',
          'set-cookie': 'session=one; Domain=.example.com; Secure; HttpOnly',
        },
        status: 302,
      }))
      .mockResolvedValueOnce(new Response(null, {
        headers: { location: 'https://identity.example.net/login' },
        status: 302,
      }))
    vi.stubGlobal('fetch', fetch)
    const worker = await importWorker()

    const internal = await worker.fetch(new Request('https://game.advjs.org/play'))
    const external = await worker.fetch(new Request('https://game.advjs.org/login'))

    expect(internal.headers.get('location')).toBe('https://game.advjs.org/login?next=%2Fplay')
    expect(internal.headers.get('set-cookie')).toBe('session=one; Secure; HttpOnly')
    expect(external.headers.get('location')).toBe('https://identity.example.net/login')
  })

  it('rejects unexpected hosts and maps upstream failures to a quiet 502', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('private upstream detail')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', fetch)
    const worker = await importWorker()

    const unexpected = await worker.fetch(new Request('https://other.advjs.org/'))
    const failed = await worker.fetch(new Request('https://game.advjs.org/api?secret=no-log'))

    expect(unexpected.status).toBe(421)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(failed.status).toBe(502)
    await expect(failed.text()).resolves.toBe('Bad Gateway')
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"path":"/api"'))
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('secret=no-log'))
  })

  it('drops an untrusted forwarding chain when no Cloudflare client IP exists', async () => {
    let upstreamRequest: Request | undefined
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      upstreamRequest = request
      return new Response('ok')
    }))
    const worker = await importWorker()

    await worker.fetch(new Request('https://game.advjs.org/', {
      headers: { 'x-forwarded-for': '198.51.100.99' },
    }))

    expect(upstreamRequest?.headers.has('x-forwarded-for')).toBe(false)
  })

  it.each([
    [{ accountId: 'not-an-account', domain: 'game.advjs.org' }, 'account ID'],
    [{ accountId, domain: '*.advjs.org' }, 'Custom Domain'],
  ])('rejects invalid infrastructure input %#', (input, message) => {
    expect(() => createCloudflareOriginProxyConfig(input)).toThrow(message)
  })

  it('deploys through an explicit account and resolves the uploaded version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-cloudflare-proxy-test-'))
    temporaryDirectories.push(root)
    const scenarioPath = join(root, 'scenario.json')
    const logPath = join(root, 'wrangler.log')
    await writeFile(scenarioPath, JSON.stringify({
      workerDeployments: [
        { created_on: '2026-08-19T19:53:02.000Z', id: 'deployment-old' },
        { created_on: '2026-08-19T20:00:18.000Z', id: 'deployment-new' },
      ],
    }), 'utf8')
    await writeFile(logPath, '', 'utf8')

    await expect(deployCloudflareOriginProxy({
      accountId,
      command: process.execPath,
      commandArguments: [fakeWrangler],
      domain: 'game.advjs.org',
      environment: {
        ADV_FAKE_WRANGLER_LOG: logPath,
        ADV_FAKE_WRANGLER_SCENARIO: scenarioPath,
      },
      origin: 'https://origin.example.com',
    })).resolves.toEqual({
      accountId,
      deploymentId: 'deployment-new',
      domain: 'game.advjs.org',
      dryRun: false,
      name: 'advjs-game-advjs-org',
      origin: 'https://origin.example.com',
      url: 'https://game.advjs.org/',
    })

    const logs = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { accountId: string, args: string[] })
    expect(logs).toHaveLength(2)
    expect(logs[0].accountId).toBe(accountId)
    expect(logs[0].args[0]).toBe('deploy')
    expect(logs[0].args).toContain('--strict')
    expect(logs[1].args.slice(0, 4)).toEqual(['deployments', 'list', '--name', 'advjs-game-advjs-org'])
  })

  it('supports a compile-only dry run without looking up a remote version', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-cloudflare-proxy-test-'))
    temporaryDirectories.push(root)
    const scenarioPath = join(root, 'scenario.json')
    const logPath = join(root, 'wrangler.log')
    await writeFile(scenarioPath, '{}', 'utf8')
    await writeFile(logPath, '', 'utf8')

    const result = await deployCloudflareOriginProxy({
      accountId,
      command: process.execPath,
      commandArguments: [fakeWrangler],
      domain: 'game.advjs.org',
      dryRun: true,
      environment: {
        ADV_FAKE_WRANGLER_LOG: logPath,
        ADV_FAKE_WRANGLER_SCENARIO: scenarioPath,
      },
      origin: 'https://origin.example.com',
    })

    expect(result).not.toHaveProperty('deploymentId')
    expect(result.dryRun).toBe(true)
    const logs = (await readFile(logPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { args: string[] })
    expect(logs).toHaveLength(1)
    expect(logs[0].args).toContain('--dry-run')
  })
})
