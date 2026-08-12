import type { DeploymentConfig, DeployProvider, DeployProviderInput, DeployProviderResult } from './index'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'
import { promisify } from 'node:util'
import { DeployProjectError } from './index'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)

interface CloudflareAccount {
  id: string
  name?: string
}

interface CloudflareProject {
  id?: string
  name: string
}

interface CloudflareDeployment {
  created_on?: string
  environment?: string
  id: string
  project_name?: string
  url: string
}

export interface CloudflarePagesProviderOptions {
  accountId?: string
  branch?: string
  command?: string
  commandArguments?: string[]
  environment?: NodeJS.ProcessEnv
  login?: boolean
  productionBranch?: string
}

export interface CloudflarePagesProvider extends DeployProvider {
  name: 'cloudflare-pages'
}

function parseJsonOutput<T>(output: string, label: string): T {
  const trimmed = output.trim()
  try {
    return JSON.parse(trimmed) as T
  }
  catch {
    const starts = [trimmed.indexOf('{'), trimmed.indexOf('[')].filter(index => index >= 0)
    const start = starts.length > 0 ? Math.min(...starts) : -1
    const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'))
    if (start >= 0 && end >= start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T
      }
      catch {}
    }
    throw new DeployProjectError('ADV_DEPLOY', `Wrangler returned invalid JSON for ${label}`)
  }
}

function redactWranglerMessage(message: string) {
  return message
    .replace(/(api[_ -]?token|authorization|password|secret)\s*[:=]\s*\S+/giu, '$1=[redacted]')
    .trim()
}

function mapWranglerError(error: unknown, label: string): DeployProjectError {
  if (error instanceof DeployProjectError)
    return error
  const candidate = error as NodeJS.ErrnoException & { stderr?: string, stdout?: string }
  const rawMessage = candidate.stderr || candidate.message || String(error)
  const message = redactWranglerMessage(rawMessage)
  if (/not authenticated|authentication failed|unauthorized|please (?:login|log in)|api token|permission denied/iu.test(message))
    return new DeployProjectError('ADV_AUTH', `${label} failed: ${message}`, { cause: error })
  if (/econn|enotfound|enetunreach|fetch failed|network|socket|timed?\s*out/iu.test(message) || ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(candidate.code || ''))
    return new DeployProjectError('ADV_NETWORK', `${label} failed: ${message}`, { cause: error })
  return new DeployProjectError('ADV_DEPLOY', `${label} failed: ${message}`, { cause: error })
}

function getAccounts(value: unknown): CloudflareAccount[] {
  if (!value || typeof value !== 'object')
    return []
  const accounts = (value as { accounts?: unknown }).accounts
  if (!Array.isArray(accounts))
    return []
  return accounts.flatMap((account) => {
    if (!account || typeof account !== 'object' || typeof (account as { id?: unknown }).id !== 'string')
      return []
    const candidate = account as { id: string, name?: unknown }
    return [{ id: candidate.id, ...(typeof candidate.name === 'string' ? { name: candidate.name } : {}) }]
  })
}

function getProjects(value: unknown): CloudflareProject[] {
  const projects = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { result?: unknown }).result)
      ? (value as { result: unknown[] }).result
      : []
  return projects.flatMap((project) => {
    if (!project || typeof project !== 'object' || typeof (project as { name?: unknown }).name !== 'string')
      return []
    const candidate = project as { id?: unknown, name: string }
    return [{ name: candidate.name, ...(typeof candidate.id === 'string' ? { id: candidate.id } : {}) }]
  })
}

function getDeployments(value: unknown): CloudflareDeployment[] {
  const deployments = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { result?: unknown }).result)
      ? (value as { result: unknown[] }).result
      : []
  return deployments.flatMap((deployment) => {
    if (!deployment || typeof deployment !== 'object')
      return []
    const candidate = deployment as Record<string, unknown>
    if (typeof candidate.id !== 'string' || typeof candidate.url !== 'string')
      return []
    return [{
      id: candidate.id,
      url: candidate.url,
      ...(typeof candidate.created_on === 'string' ? { created_on: candidate.created_on } : {}),
      ...(typeof candidate.environment === 'string' ? { environment: candidate.environment } : {}),
      ...(typeof candidate.project_name === 'string' ? { project_name: candidate.project_name } : {}),
    }]
  })
}

function assertCompatibleReceipt(previous: DeploymentConfig | undefined, project: string, accountId?: string) {
  if (!previous)
    return
  if (previous.provider !== 'cloudflare-pages')
    throw new DeployProjectError('ADV_DEPLOY', `Deployment receipt belongs to provider ${previous.provider}, not cloudflare-pages`)
  if (previous.project !== project || (previous.projectId && previous.projectId !== project))
    throw new DeployProjectError('ADV_DEPLOY', `Deployment receipt belongs to project ${previous.project}, not ${project}`)
  if (accountId && previous.accountId && previous.accountId !== accountId)
    throw new DeployProjectError('ADV_DEPLOY', `Deployment receipt belongs to Cloudflare account ${previous.accountId}, not ${accountId}`)
}

export function resolveBundledWrangler() {
  return require.resolve('wrangler')
}

export function createCloudflarePagesProvider(options: CloudflarePagesProviderOptions = {}): CloudflarePagesProvider {
  const command = options.command || process.execPath
  const commandArguments = options.commandArguments || [resolveBundledWrangler()]
  const configuredAccountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID
  const branch = options.branch || options.productionBranch || 'main'
  const productionBranch = options.productionBranch || 'main'
  const login = options.login ?? Boolean(process.stdin.isTTY)

  async function run(args: string[], label: string, accountId?: string) {
    try {
      const result = await execFileAsync(command, [...commandArguments, ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          ...options.environment,
          ...(accountId ? { CLOUDFLARE_ACCOUNT_ID: accountId } : {}),
        },
        maxBuffer: 10 * 1024 * 1024,
      })
      return result.stdout
    }
    catch (error) {
      throw mapWranglerError(error, label)
    }
  }

  return {
    name: 'cloudflare-pages',
    async deploy(input: DeployProviderInput): Promise<DeployProviderResult> {
      assertCompatibleReceipt(input.previousConfig, input.project, configuredAccountId)

      const whoamiArgs = ['whoami', '--json', ...(configuredAccountId ? ['--account', configuredAccountId] : [])]
      let whoamiOutput: string
      try {
        whoamiOutput = await run(whoamiArgs, 'Cloudflare account discovery', configuredAccountId)
      }
      catch (error) {
        if (!(error instanceof DeployProjectError) || error.code !== 'ADV_AUTH' || !login)
          throw error
        await run(['login'], 'Cloudflare login')
        whoamiOutput = await run(whoamiArgs, 'Cloudflare account discovery', configuredAccountId)
      }
      const accounts = getAccounts(parseJsonOutput<unknown>(whoamiOutput, 'Cloudflare account discovery'))
      let accountId = configuredAccountId
      if (!accountId) {
        if (accounts.length === 0)
          throw new DeployProjectError('ADV_AUTH', 'No Cloudflare account is available; authenticate Wrangler before deploying')
        if (accounts.length > 1)
          throw new DeployProjectError('ADV_AUTH', 'More than one Cloudflare account is available; pass --account-id explicitly')
        accountId = accounts[0].id
      }
      else if (accounts.length > 0 && !accounts.some(account => account.id === accountId)) {
        throw new DeployProjectError('ADV_AUTH', `Cloudflare account ${accountId} is not available to the current identity`)
      }
      assertCompatibleReceipt(input.previousConfig, input.project, accountId)

      const projects = getProjects(parseJsonOutput<unknown>(
        await run(['pages', 'project', 'list', '--json'], 'Cloudflare Pages project discovery', accountId),
        'Cloudflare Pages project discovery',
      ))
      const existingProject = projects.find(project => project.name === input.project)
      if (!existingProject) {
        await run(
          ['pages', 'project', 'create', input.project, '--production-branch', productionBranch],
          `Cloudflare Pages project creation for ${input.project}`,
          accountId,
        )
      }

      await run(
        ['pages', 'deploy', input.directory, '--project-name', input.project, '--branch', branch, '--commit-dirty=true'],
        `Cloudflare Pages deployment for ${input.project}`,
        accountId,
      )
      const deployments = getDeployments(parseJsonOutput<unknown>(
        await run(
          ['pages', 'deployment', 'list', '--project-name', input.project, '--environment', 'production', '--json'],
          `Cloudflare Pages deployment lookup for ${input.project}`,
          accountId,
        ),
        `Cloudflare Pages deployment lookup for ${input.project}`,
      ))
        .filter(deployment => !deployment.project_name || deployment.project_name === input.project)
        .sort((left, right) => (right.created_on || '').localeCompare(left.created_on || ''))
      const deployment = deployments[0]
      if (!deployment)
        throw new DeployProjectError('ADV_DEPLOY', `Cloudflare returned no production deployment for ${input.project}`)

      return {
        accountId,
        deploymentId: deployment.id,
        projectId: existingProject?.name || input.project,
        url: deployment.url,
      }
    },
  }
}
