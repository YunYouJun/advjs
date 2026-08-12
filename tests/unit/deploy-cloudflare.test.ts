// @vitest-environment node

import type { DeploymentConfig, DeployProviderInput } from '../../packages/advjs/node/deploy'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveDeploymentProjectName } from '../../packages/advjs/node/cli/deploy'
import { createCloudflarePagesProvider } from '../../packages/advjs/node/deploy/cloudflare'

const fakeWrangler = resolve(import.meta.dirname, '../launch/fixtures/fake-wrangler.mjs')
const temporaryDirectories: string[] = []

async function createFixture(scenario: Record<string, unknown>) {
  const root = await mkdtemp(join(tmpdir(), 'advjs-cloudflare-provider-'))
  temporaryDirectories.push(root)
  const scenarioPath = join(root, 'scenario.json')
  const logPath = join(root, 'wrangler.log')
  const environment = {
    ADV_FAKE_WRANGLER_LOG: logPath,
    ADV_FAKE_WRANGLER_SCENARIO: scenarioPath,
  }
  await writeFile(scenarioPath, JSON.stringify(scenario), 'utf8')
  await writeFile(logPath, '', 'utf8')
  const provider = createCloudflarePagesProvider({
    command: process.execPath,
    commandArguments: [fakeWrangler],
    environment,
  })
  return {
    environment,
    logPath,
    provider,
    root,
    async logs() {
      return (await readFile(logPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { accountId: string | null, args: string[] })
    },
  }
}

function deployInput(root: string, previousConfig?: DeploymentConfig): DeployProviderInput {
  return {
    artifactReceipt: {
      archive: '.advjs/releases/release.tar.gz',
      archiveSha256: 'a'.repeat(64),
      contentRevision: 'b'.repeat(64),
      manifestSha256: 'c'.repeat(64),
      project: 'launch-game',
      provider: 'cloudflare-pages',
      schemaVersion: 1,
    },
    contentRevision: 'b'.repeat(64),
    directory: root,
    previousConfig,
    project: 'launch-game',
  }
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('cloudflare Pages deployment provider', () => {
  it('derives a safe project name and rejects ambiguous explicit names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-cloudflare-name-'))
    temporaryDirectories.push(root)
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: '@advjs/My Game' }), 'utf8')

    await expect(resolveDeploymentProjectName(root)).resolves.toBe('my-game')
    await expect(resolveDeploymentProjectName(root, 'My Game')).rejects.toBeInstanceOf(TypeError)
  })

  it('selects the only account, creates the exact project, and returns the latest production deployment', async () => {
    const fixture = await createFixture({
      accounts: [{ id: 'account-one', name: 'Primary' }],
      deployments: [
        { created_on: '2026-08-12T08:00:00.000Z', environment: 'production', id: 'deployment-old', project_name: 'launch-game', url: 'https://old.launch-game.pages.dev' },
        { created_on: '2026-08-12T09:00:00.000Z', environment: 'production', id: 'deployment-new', project_name: 'launch-game', url: 'https://new.launch-game.pages.dev' },
      ],
      projects: [],
    })

    await expect(fixture.provider.deploy(deployInput(fixture.root))).resolves.toEqual({
      accountId: 'account-one',
      deploymentId: 'deployment-new',
      projectId: 'launch-game',
      url: 'https://new.launch-game.pages.dev',
    })

    const logs = await fixture.logs()
    expect(logs.map(log => log.args)).toEqual([
      ['whoami', '--json'],
      ['pages', 'project', 'list', '--json'],
      ['pages', 'project', 'create', 'launch-game', '--production-branch', 'main'],
      ['pages', 'deploy', fixture.root, '--project-name', 'launch-game', '--branch', 'main', '--commit-dirty=true'],
      ['pages', 'deployment', 'list', '--project-name', 'launch-game', '--environment', 'production', '--json'],
    ])
    expect(logs.slice(1).every(log => log.accountId === 'account-one')).toBe(true)
  })

  it('reuses only the configured project and honors an explicit account', async () => {
    const fixture = await createFixture({
      accounts: [{ id: 'account-one' }, { id: 'account-two' }],
      deployments: [{ created_on: '2026-08-12T09:00:00.000Z', id: 'deployment-one', project_name: 'launch-game', url: 'https://launch-game.pages.dev' }],
      projects: [{ name: 'another-game' }, { name: 'launch-game' }],
    })
    const provider = createCloudflarePagesProvider({
      accountId: 'account-two',
      command: process.execPath,
      commandArguments: [fakeWrangler],
      environment: fixture.environment,
    })
    const previousConfig: DeploymentConfig = {
      accountId: 'account-two',
      project: 'launch-game',
      projectId: 'launch-game',
      provider: 'cloudflare-pages',
      schemaVersion: 1,
    }

    await expect(provider.deploy(deployInput(fixture.root, previousConfig))).resolves.toMatchObject({
      accountId: 'account-two',
      projectId: 'launch-game',
    })
    const logs = await fixture.logs()
    expect(logs[0].args).toEqual(['whoami', '--json', '--account', 'account-two'])
    expect(logs.some(log => log.args.includes('create'))).toBe(false)
    expect(logs.every(log => log.accountId === 'account-two')).toBe(true)
  })

  it('requires explicit account selection when more than one account is available', async () => {
    const fixture = await createFixture({ accounts: [{ id: 'one' }, { id: 'two' }] })

    await expect(fixture.provider.deploy(deployInput(fixture.root))).rejects.toMatchObject({ code: 'ADV_AUTH' })
    expect((await fixture.logs()).map(log => log.args)).toEqual([['whoami', '--json']])
  })

  it('runs the bundled Wrangler login once for an interactive first deployment', async () => {
    const fixture = await createFixture({
      accounts: [{ id: 'account-one' }],
      authFailuresRemaining: 1,
      deployments: [{ created_on: '2026-08-12T09:00:00.000Z', id: 'deployment-one', project_name: 'launch-game', url: 'https://launch-game.pages.dev' }],
      projects: [{ name: 'launch-game' }],
    })
    const provider = createCloudflarePagesProvider({
      command: process.execPath,
      commandArguments: [fakeWrangler],
      environment: fixture.environment,
      login: true,
    })

    await expect(provider.deploy(deployInput(fixture.root))).resolves.toMatchObject({ accountId: 'account-one' })
    expect((await fixture.logs()).slice(0, 3).map(log => log.args)).toEqual([
      ['whoami', '--json'],
      ['login'],
      ['whoami', '--json'],
    ])
  })

  it.each([
    ['auth', 'whoami', 'Not authenticated. Please login.', 'ADV_AUTH'],
    ['network', 'project list', 'fetch failed: ECONNRESET', 'ADV_NETWORK'],
    ['provider', 'pages deploy', 'Cloudflare rejected this deployment', 'ADV_DEPLOY'],
  ])('maps %s failures to stable deployment error codes', async (_name, command, message, code) => {
    const fixture = await createFixture({
      accounts: [{ id: 'account-one' }],
      failure: { command, message },
      projects: [{ name: 'launch-game' }],
    })

    await expect(fixture.provider.deploy(deployInput(fixture.root))).rejects.toMatchObject({ code })
  })

  it('rejects a receipt that points at a different provider, account, or project', async () => {
    const fixture = await createFixture({ accounts: [{ id: 'account-one' }] })
    const mismatches: DeploymentConfig[] = [
      { project: 'launch-game', provider: 'other', schemaVersion: 1 },
      { accountId: 'other-account', project: 'launch-game', provider: 'cloudflare-pages', schemaVersion: 1 },
      { accountId: 'account-one', project: 'other-game', provider: 'cloudflare-pages', schemaVersion: 1 },
    ]

    for (const previousConfig of mismatches)
      await expect(fixture.provider.deploy(deployInput(fixture.root, previousConfig))).rejects.toMatchObject({ code: 'ADV_DEPLOY' })
  })
})
