// @vitest-environment node

import type { DeployProvider } from '../../packages/advjs/node/deploy'
import { Buffer } from 'node:buffer'
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDeploymentArtifact,
  deployArtifact,
  deployProject,
  scanCredentialLeaks,
  verifyDeploymentArtifact,
  verifyDeploymentUrl,
} from '../../packages/advjs/node/deploy'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const temporaryDirectories: string[] = []

async function projectFixture(prefix = 'advjs-cloudflare-launch-') {
  const root = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(root)
  await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  const outDir = join(root, 'dist')
  await mkdir(join(outDir, 'assets'), { recursive: true })
  await writeFile(join(outDir, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/assets/app.css"></head><body><script src="/assets/app.js"></script></body></html>\n', 'utf8')
  await writeFile(join(outDir, 'assets/app.css'), 'body { color: black; }\n', 'utf8')
  await writeFile(join(outDir, 'assets/app.js'), 'console.log("launch")\n', 'utf8')
  return { outDir, root }
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('cloudflare deployment launch recovery', () => {
  it('verifies and restores an artifact in an empty directory without rebuilding', async () => {
    const source = await projectFixture()
    const artifact = await createDeploymentArtifact({
      outDir: source.outDir,
      project: 'launch-game',
      provider: 'cloudflare-pages',
      root: source.root,
    })
    const recoveryRoot = await mkdtemp(join(tmpdir(), 'advjs-cloudflare-recovery-'))
    temporaryDirectories.push(recoveryRoot)
    const copiedArchive = join(recoveryRoot, 'release.tar.gz')
    const copiedReceipt = join(recoveryRoot, 'release.json')
    await cp(artifact.archive, copiedArchive)
    await cp(artifact.artifactReceipt, copiedReceipt)
    const deploy = vi.fn(async (input) => {
      expect(await readFile(join(input.directory, 'index.html'), 'utf8')).toContain('assets/app.js')
      return {
        accountId: 'account-one',
        deploymentId: 'recovery-deployment',
        projectId: 'launch-game',
        url: 'https://recovery.launch-game.pages.dev/',
      }
    })
    const provider: DeployProvider = { name: 'cloudflare-pages', deploy }

    await expect(verifyDeploymentArtifact({ archive: copiedArchive, receipt: copiedReceipt })).resolves.toMatchObject({
      archiveSha256: artifact.archiveSha256,
      contentRevision: artifact.contentRevision,
      files: expect.arrayContaining([expect.objectContaining({ path: 'index.html' })]),
    })
    const result = await deployArtifact({
      archive: copiedArchive,
      provider,
      receipt: copiedReceipt,
      root: recoveryRoot,
      verifyDeployment: async () => {},
    })

    expect(deploy).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      archiveSha256: artifact.archiveSha256,
      contentRevision: artifact.contentRevision,
      deploymentId: 'recovery-deployment',
      project: 'launch-game',
    })
    expect(await readFile(join(recoveryRoot, '.advjs/deploy.json'), 'utf8')).toContain('launch-game')
    expect(await readFile(result.receipt, 'utf8')).toContain('recovery-deployment')
    expect(await readFile(result.artifactReceipt, 'utf8')).toBe(await readFile(copiedReceipt, 'utf8'))
  })

  it('rejects a modified archive or receipt before invoking the provider', async () => {
    const source = await projectFixture()
    const artifact = await createDeploymentArtifact({ outDir: source.outDir, project: 'launch-game', provider: 'cloudflare-pages', root: source.root })
    const deploy = vi.fn()
    const provider: DeployProvider = { name: 'cloudflare-pages', deploy }

    await writeFile(artifact.archive, Buffer.concat([await readFile(artifact.archive), Buffer.from('tampered')]))
    await expect(deployArtifact({ archive: artifact.archive, provider, receipt: artifact.artifactReceipt, root: source.root })).rejects.toMatchObject({ code: 'ADV_VALIDATION' })
    expect(deploy).not.toHaveBeenCalled()

    const second = await projectFixture('advjs-cloudflare-tampered-receipt-')
    const valid = await createDeploymentArtifact({ outDir: second.outDir, project: 'launch-game', provider: 'cloudflare-pages', root: second.root })
    const receipt = JSON.parse(await readFile(valid.artifactReceipt, 'utf8'))
    receipt.manifestSha256 = '0'.repeat(64)
    await writeFile(valid.artifactReceipt, `${JSON.stringify(receipt)}\n`, 'utf8')
    await expect(deployArtifact({ archive: valid.archive, provider, receipt: valid.artifactReceipt, root: second.root })).rejects.toMatchObject({ code: 'ADV_VALIDATION' })
    expect(deploy).not.toHaveBeenCalled()
  })

  it('reuses one project configuration while appending deployment receipts', async () => {
    const fixture = await projectFixture()
    let sequence = 0
    const deploy = vi.fn(async (input) => {
      sequence += 1
      if (sequence === 2)
        expect(input.previousConfig).toMatchObject({ projectId: 'launch-game' })
      return { deploymentId: `deployment-${sequence}`, projectId: 'launch-game', url: `https://deployment-${sequence}.pages.dev/` }
    })
    const provider: DeployProvider = { name: 'cloudflare-pages', deploy }
    const options = {
      buildProject: async () => ({ assets: [], outDir: fixture.outDir, root: fixture.root }),
      checkProject: async () => ({ issues: [], passed: true }),
      project: 'launch-game',
      provider,
      root: fixture.root,
      verifyDeployment: async () => {},
    }

    const first = await deployProject(options)
    const second = await deployProject(options)

    expect(first.receipt).not.toBe(second.receipt)
    expect(JSON.parse(await readFile(join(fixture.root, '.advjs/deploy.json'), 'utf8'))).toMatchObject({ projectId: 'launch-game' })
    expect(deploy).toHaveBeenCalledTimes(2)
  })

  it('verifies HTML, referenced resources, MIME types, and the SPA fallback', async () => {
    const requested: string[] = []
    const responses = new Map([
      ['https://launch-game.pages.dev/', new Response('<html><head><link rel="stylesheet" href="/assets/app.css"></head><body><script src="/assets/app.js"></script></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })],
      ['https://launch-game.pages.dev/assets/app.css', new Response('body{}', { headers: { 'content-type': 'text/css' } })],
      ['https://launch-game.pages.dev/assets/app.js', new Response('console.log(1)', { headers: { 'content-type': 'application/javascript' } })],
      ['https://launch-game.pages.dev/__advjs_verify__/route', new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } })],
    ])
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      requested.push(url)
      return responses.get(url)?.clone() ?? new Response('missing', { status: 404 })
    }) as typeof fetch

    await expect(verifyDeploymentUrl({ fetch: fetchImpl, url: 'https://launch-game.pages.dev/' })).resolves.toMatchObject({
      resources: 2,
      spaFallback: true,
    })
    expect(requested).toEqual([
      'https://launch-game.pages.dev/',
      'https://launch-game.pages.dev/assets/app.css',
      'https://launch-game.pages.dev/assets/app.js',
      'https://launch-game.pages.dev/__advjs_verify__/route',
    ])

    responses.set('https://launch-game.pages.dev/assets/app.js', new Response('console.log(1)', { headers: { 'content-type': 'text/plain' } }))
    await expect(verifyDeploymentUrl({ fetch: fetchImpl, url: 'https://launch-game.pages.dev/' })).rejects.toMatchObject({ code: 'ADV_DEPLOY' })
  })

  it('detects credential-shaped values across logs, project files, builds, and CI artifacts', async () => {
    const fixture = await projectFixture()
    const ciArtifact = join(fixture.root, 'ci-artifacts')
    await mkdir(ciArtifact)
    await writeFile(join(ciArtifact, 'report.log'), 'Authorization: Bearer definitely-not-public\n', 'utf8')

    const violations = await scanCredentialLeaks([
      { content: 'stdout is clean', label: 'stdout' },
      { content: 'CLOUDFLARE_API_TOKEN=super-secret-value', label: 'stderr' },
      { label: 'project', path: join(fixture.root, 'adv') },
      { label: 'build', path: fixture.outDir },
      { label: 'ci-artifact', path: ciArtifact },
    ])

    expect(violations.map(violation => violation.label)).toEqual(['stderr', 'ci-artifact'])
    expect(JSON.stringify(violations)).not.toContain('super-secret-value')
  })
})
