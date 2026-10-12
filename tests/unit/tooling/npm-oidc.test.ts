// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { npmTrustConfiguration } from '../../../scripts/release/configure-npm-oidc.mjs'
import { assertOidcEnvironment, uploadNpmPackages, verifyNpmArtifact, verifySourceChecks } from '../../../scripts/release/npm-oidc.mjs'
import { LAUNCH_VERSION, PACKAGE_SPECS } from '../../../scripts/release/package-specs.mjs'

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true })
})

const environment = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'YunYouJun/advjs',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_WORKFLOW_REF: 'YunYouJun/advjs/.github/workflows/release-npm.yml@refs/heads/dev',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/token',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'test-only',
}
const packages = [
  { name: '@advjs/types', version: LAUNCH_VERSION, integrity: 'types-integrity' },
  { name: 'create-adv', version: LAUNCH_VERSION, integrity: 'create-integrity' },
]

describe('npm OIDC release', () => {
  it('rejects local, fork, pull-request, wrong-workflow, and static-token publication', () => {
    expect(() => assertOidcEnvironment(environment)).not.toThrow()
    for (const changes of [
      { GITHUB_ACTIONS: undefined },
      { GITHUB_REPOSITORY: 'someone/advjs' },
      { GITHUB_EVENT_NAME: 'pull_request' },
      { GITHUB_WORKFLOW_REF: 'YunYouJun/advjs/.github/workflows/other.yml@refs/heads/dev' },
      { ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined },
      { NODE_AUTH_TOKEN: 'test-only' },
    ]) {
      expect(() => assertOidcEnvironment({ ...environment, ...changes })).toThrow()
    }
  })

  it('requires passing checks on the exact source', () => {
    const checks = [{ name: 'launch-required', status: 'completed', conclusion: 'success' }]
    expect(() => verifySourceChecks(checks)).not.toThrow()
    expect(() => verifySourceChecks([])).toThrow()
    expect(() => verifySourceChecks([...checks, { name: 'lint', status: 'completed', conclusion: 'failure' }])).toThrow()
    expect(() => verifySourceChecks(checks, [{ context: 'deployment', state: 'pending' }])).toThrow()
  })

  it('checks all existing versions before uploading anything', async () => {
    const publish = vi.fn()
    await expect(uploadNpmPackages({ packages }, {
      lookup: async (pkg: typeof packages[number]) => ({ versions: pkg.name === 'create-adv' ? { [LAUNCH_VERSION]: { dist: { integrity: 'different' } } } : {} }),
      publish,
      accepted: {},
      save: vi.fn(),
    })).rejects.toThrow('existing immutable version differs')
    expect(publish).not.toHaveBeenCalled()
  })

  it('refuses OIDC bootstrap before any graph member is created', async () => {
    const publish = vi.fn()
    await expect(uploadNpmPackages({ packages }, {
      lookup: async (pkg: typeof packages[number]) => pkg.name === 'create-adv' ? null : { versions: {} },
      publish,
      accepted: {},
      save: vi.fn(),
    })).rejects.toThrow('Initialize all new package names')
    expect(publish).not.toHaveBeenCalled()
  })

  it('saves accepted uploads before scanning and skips them when resumed', async () => {
    const accepted: Record<string, unknown> = {}
    const publish = vi.fn()
    const save = vi.fn()
    const options = { accepted, publish, save, lookup: async () => ({ versions: {} }) }
    await uploadNpmPackages({ packages }, options)
    expect(publish.mock.calls.map(([pkg]) => pkg.name)).toEqual(['@advjs/types', 'create-adv'])
    expect(save).toHaveBeenCalledTimes(2)
    expect(accepted).toHaveProperty('create-adv')
    await uploadNpmPackages({ packages }, options)
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('rejects modified archive bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'npm-oidc-'))
    directories.push(directory)
    const manifest = { version: LAUNCH_VERSION, sourceSha: 'a'.repeat(40), packages: PACKAGE_SPECS.map(spec => ({ name: spec.name, version: LAUNCH_VERSION, tarball: 'changed.tgz', integrity: 'sha512-original' })) }
    await writeFile(join(directory, 'packages.json'), JSON.stringify(manifest))
    await writeFile(join(directory, 'changed.tgz'), 'changed archive')
    await expect(verifyNpmArtifact(directory)).rejects.toThrow('tarball integrity mismatch')
  })

  it('configures publication and tag management for the same workflow', () => {
    expect(npmTrustConfiguration()).toEqual({
      type: 'github',
      claims: { repository: 'YunYouJun/advjs', workflow_ref: { file: 'release-npm.yml' } },
      permissions: ['createPackage', 'manageDistTags'],
    })
  })

  it('grants OIDC only to writes and verifies public installs before promotion', async () => {
    const workflow = parse(await readFile(new URL('../../../.github/workflows/release-npm.yml', import.meta.url), 'utf8'))
    expect(workflow.permissions['id-token']).toBeUndefined()
    expect(workflow.jobs.publish.permissions['id-token']).toBe('write')
    expect(workflow.jobs.promote.permissions['id-token']).toBe('write')
    expect(workflow.jobs['pinned-smoke'].needs).toBe('publish')
    expect(workflow.jobs.promote.needs).toBe('pinned-smoke')
    expect(workflow.jobs['default-smoke'].needs).toBe('promote')
    expect(JSON.stringify(workflow)).not.toContain('secrets.NPM_TOKEN')
  })
})
