import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { resolveBundledWrangler } from './cloudflare'
import { DeployProjectError } from './index'

const execFileAsync = promisify(execFile)
const DEFAULT_COMPATIBILITY_DATE = '2026-08-19'

export interface CloudflareOriginProxyOptions {
  accountId: string
  command?: string
  commandArguments?: string[]
  compatibilityDate?: string
  domain: string
  dryRun?: boolean
  environment?: NodeJS.ProcessEnv
  name?: string
  origin: string
}

export interface CloudflareOriginProxyResult {
  accountId: string
  deploymentId?: string
  domain: string
  dryRun: boolean
  name: string
  origin: string
  url: string
}

interface CloudflareWorkerVersion {
  id?: unknown
}

function assertAccountId(accountId: string) {
  if (!/^[a-f\d]{32}$/u.test(accountId))
    throw new DeployProjectError('ADV_VALIDATION', 'Cloudflare account ID must be a 32-character hexadecimal value')
}

function normalizeDomain(domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/\.$/u, '')
  const labels = normalized.split('.')
  const validLabel = (label: string) => label.length >= 1
    && label.length <= 63
    && /^[a-z\d-]+$/u.test(label)
    && /^[a-z\d]/u.test(label)
    && /[a-z\d]$/u.test(label)
  if (normalized.length > 253 || labels.length < 2 || labels.some(label => !validLabel(label)) || !/^[a-z]/u.test(labels.at(-1) || ''))
    throw new DeployProjectError('ADV_VALIDATION', `Invalid Cloudflare Custom Domain: ${domain}`)
  return normalized
}

function normalizeOrigin(origin: string) {
  let url: URL
  try {
    url = new URL(origin)
  }
  catch {
    throw new DeployProjectError('ADV_VALIDATION', `Invalid proxy origin: ${origin}`)
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new DeployProjectError('ADV_VALIDATION', 'Proxy origin must be an HTTPS origin without credentials, path, query, or fragment')
  return url.origin
}

function normalizeWorkerName(name: string) {
  const normalized = name.trim().toLowerCase()
  if (!/^[a-z\d](?:[a-z\d-]{0,62}[a-z\d])?$/u.test(normalized))
    throw new DeployProjectError('ADV_VALIDATION', `Invalid Cloudflare Worker name: ${name}`)
  return normalized
}

function defaultWorkerName(domain: string) {
  return normalizeWorkerName(`advjs-${domain.replaceAll('.', '-')}`.slice(0, 63).replace(/-$/u, ''))
}

function parseVersions(output: string) {
  const trimmed = output.trim()
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  }
  catch {
    throw new DeployProjectError('ADV_DEPLOY', 'Wrangler returned invalid JSON for the deployed Worker version')
  }
  const versions = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { result?: unknown }).result)
      ? (value as { result: unknown[] }).result
      : []
  return versions as CloudflareWorkerVersion[]
}

function mapWranglerError(error: unknown, label: string) {
  if (error instanceof DeployProjectError)
    return error
  const candidate = error as NodeJS.ErrnoException & { stderr?: string }
  const message = (candidate.stderr || candidate.message || String(error))
    .replace(/(api[_ -]?token|authorization|password|secret)\s*[:=]\s*\S+/giu, '$1=[redacted]')
    .trim()
  if (/not authenticated|authentication failed|unauthorized|please (?:login|log in)|api token|permission denied/iu.test(message))
    return new DeployProjectError('ADV_AUTH', `${label} failed: ${message}`, { cause: error })
  if (/econn|enotfound|enetunreach|fetch failed|network|socket|timed?\s*out/iu.test(message) || ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(candidate.code || ''))
    return new DeployProjectError('ADV_NETWORK', `${label} failed: ${message}`, { cause: error })
  return new DeployProjectError('ADV_DEPLOY', `${label} failed: ${message}`, { cause: error })
}

export function createCloudflareOriginProxyConfig(options: Pick<CloudflareOriginProxyOptions, 'accountId' | 'compatibilityDate' | 'domain' | 'name'>) {
  const accountId = options.accountId
  const domain = normalizeDomain(options.domain)
  const name = normalizeWorkerName(options.name || defaultWorkerName(domain))
  assertAccountId(accountId)
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    account_id: accountId,
    compatibility_date: options.compatibilityDate || DEFAULT_COMPATIBILITY_DATE,
    compatibility_flags: ['nodejs_compat'],
    main: 'worker.mjs',
    name,
    observability: {
      enabled: true,
      head_sampling_rate: 1,
    },
    preview_urls: false,
    routes: [{ custom_domain: true, pattern: domain }],
    workers_dev: false,
  }
}

export function createCloudflareOriginProxyWorkerSource(options: Pick<CloudflareOriginProxyOptions, 'domain' | 'origin'>) {
  const domain = normalizeDomain(options.domain)
  const origin = normalizeOrigin(options.origin)

  return `const ORIGIN = new URL(${JSON.stringify(origin)})
const PUBLIC_HOSTNAME = ${JSON.stringify(domain)}

function rewriteUrlHeader(value, publicUrl) {
  if (!value)
    return value
  try {
    const url = new URL(value)
    if (url.origin !== publicUrl.origin)
      return value
    url.protocol = ORIGIN.protocol
    url.host = ORIGIN.host
    return url.toString()
  }
  catch {
    return value
  }
}

function rewriteLocation(value, publicUrl) {
  if (!value)
    return value
  try {
    const url = new URL(value, ORIGIN)
    if (url.origin !== ORIGIN.origin)
      return value
    url.protocol = publicUrl.protocol
    url.host = publicUrl.host
    return url.toString()
  }
  catch {
    return value
  }
}

function rewriteSetCookies(headers) {
  if (typeof headers.getSetCookie !== 'function')
    return
  const cookies = headers.getSetCookie()
  if (cookies.length === 0)
    return
  headers.delete('set-cookie')
  for (const cookie of cookies)
    headers.append('set-cookie', cookie.replace(/;\\s*domain=[^;]+/giu, ''))
}

export default {
  async fetch(request) {
    const publicUrl = new URL(request.url)
    if (publicUrl.hostname !== PUBLIC_HOSTNAME)
      return new Response('Misdirected Request', { status: 421 })

    const targetUrl = new URL(request.url)
    targetUrl.protocol = ORIGIN.protocol
    targetUrl.host = ORIGIN.host

    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('host')
    requestHeaders.set('x-forwarded-host', publicUrl.host)
    requestHeaders.set('x-forwarded-proto', publicUrl.protocol.slice(0, -1))
    for (const name of ['origin', 'referer']) {
      const value = rewriteUrlHeader(requestHeaders.get(name), publicUrl)
      if (value)
        requestHeaders.set(name, value)
    }

    try {
      const upstream = await fetch(new Request(targetUrl, {
        headers: requestHeaders,
        method: request.method,
        redirect: 'manual',
        signal: request.signal,
        ...(request.method === 'GET' || request.method === 'HEAD'
          ? {}
          : { body: request.body, duplex: 'half' }),
      }))
      const responseHeaders = new Headers(upstream.headers)
      const location = rewriteLocation(responseHeaders.get('location'), publicUrl)
      if (location)
        responseHeaders.set('location', location)
      rewriteSetCookies(responseHeaders)
      const init = {
        headers: responseHeaders,
        status: upstream.status,
        statusText: upstream.statusText,
      }
      if (upstream.webSocket)
        init.webSocket = upstream.webSocket
      return new Response(upstream.body, init)
    }
    catch (error) {
      console.error(JSON.stringify({
        event: 'advjs.origin_proxy.fetch_failed',
        error: error instanceof Error ? error.name : 'UnknownError',
        method: request.method,
        path: publicUrl.pathname,
      }))
      return new Response('Bad Gateway', { status: 502 })
    }
  },
}
`
}

export async function deployCloudflareOriginProxy(options: CloudflareOriginProxyOptions): Promise<CloudflareOriginProxyResult> {
  const origin = normalizeOrigin(options.origin)
  const config = createCloudflareOriginProxyConfig(options)
  const domain = config.routes[0].pattern
  if (new URL(origin).hostname === domain)
    throw new DeployProjectError('ADV_VALIDATION', 'Proxy origin and Custom Domain must use different hostnames')

  const root = await mkdtemp(join(tmpdir(), 'advjs-cloudflare-origin-proxy-'))
  const configPath = join(root, 'wrangler.json')
  const command = options.command || process.execPath
  const commandArguments = options.commandArguments || [resolveBundledWrangler()]
  const run = async (args: string[], label: string) => {
    try {
      return await execFileAsync(command, [...commandArguments, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          ...options.environment,
          CLOUDFLARE_ACCOUNT_ID: options.accountId,
        },
        maxBuffer: 10 * 1024 * 1024,
      })
    }
    catch (error) {
      throw mapWranglerError(error, label)
    }
  }

  try {
    await writeFile(join(root, 'worker.mjs'), createCloudflareOriginProxyWorkerSource({ domain, origin }), 'utf8')
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    await run(
      ['deploy', '--config', configPath, '--strict', ...(options.dryRun ? ['--dry-run'] : [])],
      `Cloudflare Worker deployment for ${config.name}`,
    )

    if (options.dryRun) {
      return {
        accountId: options.accountId,
        domain,
        dryRun: true,
        name: config.name,
        origin,
        url: `https://${domain}/`,
      }
    }

    const versions = parseVersions((await run(
      ['versions', 'list', '--name', config.name, '--config', configPath, '--json'],
      `Cloudflare Worker version lookup for ${config.name}`,
    )).stdout)
    const deploymentId = versions.find(version => typeof version.id === 'string')?.id
    if (typeof deploymentId !== 'string')
      throw new DeployProjectError('ADV_DEPLOY', `Cloudflare returned no deployed version for ${config.name}`)

    return {
      accountId: options.accountId,
      deploymentId,
      domain,
      dryRun: false,
      name: config.name,
      origin,
      url: `https://${domain}/`,
    }
  }
  finally {
    await rm(root, { force: true, recursive: true })
  }
}
