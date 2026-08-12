// @vitest-environment node

import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDeploymentArtifact,
  deployProject,
  DeployProjectError,
  safeDeploymentId,
} from '../../packages/advjs/node/deploy'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const temporaryDirectories: string[] = []

async function projectFixture() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-deploy-contract-'))
  temporaryDirectories.push(root)
  await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  const outDir = join(root, 'dist')
  await mkdir(join(outDir, 'assets'), { recursive: true })
  await writeFile(join(outDir, 'index.html'), '<script src="/assets/app.js"></script>\n', 'utf8')
  await writeFile(join(outDir, 'assets/app.js'), 'console.log("launch")\n', 'utf8')
  return { outDir, root }
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('deployment contracts', () => {
  it('creates deterministic archives and immutable artifact receipts', async () => {
    const { outDir, root } = await projectFixture()
    const first = await createDeploymentArtifact({ outDir, project: 'launch-game', provider: 'fake', root })
    const second = await createDeploymentArtifact({ outDir, project: 'launch-game', provider: 'fake', root })

    expect(second).toEqual(first)
    expect(first.contentRevision).toMatch(/^[a-f0-9]{64}$/u)
    expect(first.archiveSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(await readFile(first.archive)).toEqual(await readFile(second.archive))
    expect(JSON.parse(await readFile(first.artifactReceipt, 'utf8'))).toMatchObject({
      archiveSha256: first.archiveSha256,
      contentRevision: first.contentRevision,
      project: 'launch-game',
      provider: 'fake',
      schemaVersion: 1,
    })
  })

  it('never uploads a stale dist when check or build fails', async () => {
    const { root } = await projectFixture()
    const providerDeploy = vi.fn()
    const provider = { name: 'fake', deploy: providerDeploy }
    const buildProject = vi.fn()

    await expect(deployProject({
      buildProject,
      checkProject: async () => ({ passed: false, issues: [{ message: 'invalid project' }] }),
      project: 'launch-game',
      provider,
      root,
      verifyDeployment: async () => {},
    })).rejects.toMatchObject({ code: 'ADV_VALIDATION' })
    expect(buildProject).not.toHaveBeenCalled()
    expect(providerDeploy).not.toHaveBeenCalled()

    await expect(deployProject({
      buildProject: async () => { throw new Error('fresh build failed') },
      checkProject: async () => ({ passed: true, issues: [] }),
      project: 'launch-game',
      provider,
      root,
    })).rejects.toMatchObject({ code: 'ADV_BUILD' })
    expect(providerDeploy).not.toHaveBeenCalled()
  })

  it('writes separate append-only deployment receipts without credentials', async () => {
    const { outDir, root } = await projectFixture()
    let sequence = 0
    const provider = {
      name: 'fake',
      async deploy() {
        sequence += 1
        return {
          deploymentId: sequence === 1 ? 'branch/release' : 'branch_release',
          projectId: 'public-project-id',
          url: `https://deployment-${sequence}.example.test/`,
        }
      },
    }
    const options = {
      buildProject: async () => ({ assets: [], outDir, root }),
      checkProject: async () => ({ issues: [], passed: true }),
      project: 'launch-game',
      provider,
      root,
      verifyDeployment: async () => {},
    }
    const first = await deployProject(options)
    const second = await deployProject(options)

    expect(first.receipt).not.toBe(second.receipt)
    expect(safeDeploymentId('branch/release')).not.toBe(safeDeploymentId('branch_release'))
    const serialized = `${await readFile(first.receipt, 'utf8')}\n${await readFile(second.receipt, 'utf8')}\n${await readFile(join(root, '.advjs/deploy.json'), 'utf8')}`
    expect(serialized).not.toMatch(/token|secret|password|credential/iu)
    expect(JSON.parse(await readFile(first.receipt, 'utf8'))).toMatchObject({
      deploymentId: 'branch/release',
      projectId: 'public-project-id',
    })
  })

  it('rejects provider results containing invalid URLs or unsafe state', async () => {
    const { outDir, root } = await projectFixture()
    await expect(deployProject({
      buildProject: async () => ({ assets: [], outDir, root }),
      checkProject: async () => ({ issues: [], passed: true }),
      project: 'launch-game',
      provider: {
        name: 'fake',
        async deploy() {
          return { deploymentId: 'one', url: 'http://insecure.example.test', token: 'blocked' }
        },
      },
      root,
    })).rejects.toBeInstanceOf(DeployProjectError)
  })
})
