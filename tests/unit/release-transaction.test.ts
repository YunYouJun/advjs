// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  abortRelease,
  createMemoryTransactionStore,
  promoteRelease,
} from '../../scripts/release/promote.mjs'

function releaseFixture() {
  const manifest = {
    integrity: 'sha256-manifest',
    version: '0.1.2',
    source: { sha: 'b'.repeat(40), tree: 'c'.repeat(40) },
    previous: {
      main: { sha: 'a'.repeat(40), tree: 'd'.repeat(40) },
      npmDistTags: { advjs: { latest: '0.1.1', rc: '0.1.2' } },
      pagesProduction: { deploymentId: 'pages-old', project: 'advjs' },
    },
    target: {
      main: { sha: 'b'.repeat(40), tree: 'c'.repeat(40) },
      npmDistTags: { advjs: { latest: '0.1.2', rc: '0.1.2' } },
      pagesProduction: { deploymentId: null, project: 'advjs', sourceSha: 'b'.repeat(40) },
      tag: 'v0.1.2',
    },
    artifacts: { changelog: { path: 'changelog.md' } },
    packages: [{ integrity: 'sha512-package', name: 'advjs', version: '0.1.2' }],
  }
  const evidence = {
    approver: 'launch-owner',
    approvedAt: '2026-08-12T10:00:00.000Z',
    contentRevision: 'e'.repeat(64),
    deploymentId: 'rc-game-deployment',
    packageIntegrities: { advjs: 'sha512-package' },
    playUrl: 'https://rc-game.pages.dev/',
    projectDiffSha256: 'f'.repeat(64),
    rcSha: manifest.source.sha,
    scenarios: ['generate', 'edit', 'save', 'play', 'build', 'deploy'],
    skillRevision: '0.1.2',
  }
  return { evidence, manifest }
}

function fakeAdapter(fault?: 'pages' | 'npm' | 'release') {
  const fixture = releaseFixture()
  let releaseFault = fault === 'release'
  const state = {
    branchProtection: {
      allowsDirectHumanPush: false,
      normalBotActor: 'advjs-release-bot',
      requireLinearHistory: true,
      rollbackBotActor: 'advjs-release-bot',
    },
    mainSha: fixture.manifest.previous.main.sha,
    npmDistTags: structuredClone(fixture.manifest.previous.npmDistTags),
    pagesDeploymentId: fixture.manifest.previous.pagesProduction.deploymentId,
    releaseExists: false,
    tagExists: false,
  }
  const calls: string[] = []
  return {
    calls,
    clearReleaseFault() {
      releaseFault = false
    },
    state,
    async currentState() {
      return structuredClone(state)
    },
    async fastForwardMain(expected: string, target: string) {
      calls.push('fast-forward-main')
      if (state.mainSha !== expected)
        throw new Error('main CAS failed')
      state.mainSha = target
    },
    async waitForPages(sourceSha: string) {
      calls.push(`verify-pages:${sourceSha}`)
      if (fault === 'pages')
        throw new Error('Pages production failed')
      state.pagesDeploymentId = 'pages-new'
      return { deploymentId: 'pages-new', sourceSha }
    },
    async promoteNpm(target: Record<string, Record<string, string>>) {
      calls.push('promote-npm')
      state.npmDistTags = structuredClone(target)
      if (fault === 'npm')
        throw new Error('npm partial promotion failed')
    },
    async createTag() {
      calls.push('create-tag')
      state.tagExists = true
    },
    async createRelease() {
      calls.push('create-release')
      if (releaseFault)
        throw new Error('GitHub release failed')
      state.releaseExists = true
    },
    async restoreNpm(previous: Record<string, Record<string, string>>) {
      calls.push('restore-npm')
      state.npmDistTags = structuredClone(previous)
    },
    async rollbackPages(deploymentId: string) {
      calls.push('rollback-pages')
      state.pagesDeploymentId = deploymentId
    },
    async restoreMain(expected: string, previous: string) {
      calls.push('restore-main')
      if (state.mainSha !== expected)
        throw new Error('main restore CAS failed')
      state.mainSha = previous
    },
  }
}

describe('release promotion transaction', () => {
  it('dry-runs the ordered plan without mutation or evidence', async () => {
    const { manifest } = releaseFixture()
    const adapter = fakeAdapter()
    const result = await promoteRelease({ adapter, dryRun: true, manifest, store: createMemoryTransactionStore() })

    expect(result.actions).toEqual(['fast-forward-main', 'verify-pages', 'promote-npm', 'create-tag', 'create-release'])
    expect(adapter.calls).toEqual([])
    expect(adapter.state.mainSha).toBe(manifest.previous.main.sha)
  })

  it('promotes in order and records a released terminal state', async () => {
    const { evidence, manifest } = releaseFixture()
    const adapter = fakeAdapter()
    const store = createMemoryTransactionStore()
    const result = await promoteRelease({ adapter, evidence, manifest, store })

    expect(result.stage).toBe('released')
    expect(adapter.calls).toEqual(['fast-forward-main', `verify-pages:${manifest.source.sha}`, 'promote-npm', 'create-tag', 'create-release'])
    expect(store.events.map(event => event.stage)).toEqual(['initialized', 'main-promoted', 'pages-verified', 'npm-promoted', 'tag-created', 'released'])
  })

  it('restores main after a Pages failure before the irreversible point', async () => {
    const { evidence, manifest } = releaseFixture()
    const adapter = fakeAdapter('pages')
    const store = createMemoryTransactionStore()

    await expect(promoteRelease({ adapter, evidence, manifest, store })).rejects.toThrow('Pages production failed')
    expect(adapter.state.mainSha).toBe(manifest.target.main.sha)
    await expect(abortRelease({ adapter, manifest, store })).resolves.toMatchObject({ stage: 'aborted' })
    expect(adapter.state.mainSha).toBe(manifest.previous.main.sha)
    expect(adapter.calls).toContain('restore-main')
  })

  it('restores npm, Pages, and main after a partial npm promotion', async () => {
    const { evidence, manifest } = releaseFixture()
    const adapter = fakeAdapter('npm')
    const store = createMemoryTransactionStore()

    await expect(promoteRelease({ adapter, evidence, manifest, store })).rejects.toThrow('npm partial promotion failed')
    await abortRelease({ adapter, manifest, store })

    expect(adapter.state).toMatchObject({
      mainSha: manifest.previous.main.sha,
      npmDistTags: manifest.previous.npmDistTags,
      pagesDeploymentId: manifest.previous.pagesProduction.deploymentId,
    })
    expect(adapter.calls.slice(-3)).toEqual(['restore-npm', 'rollback-pages', 'restore-main'])
  })

  it('refuses rollback after a visible tag and resumes the same RC to completion', async () => {
    const { evidence, manifest } = releaseFixture()
    const adapter = fakeAdapter('release')
    const store = createMemoryTransactionStore()

    await expect(promoteRelease({ adapter, evidence, manifest, store })).rejects.toThrow('GitHub release failed')
    await expect(abortRelease({ adapter, manifest, store })).rejects.toThrow('irreversible point')
    expect(adapter.calls).not.toContain('restore-main')

    adapter.clearReleaseFault()
    await expect(promoteRelease({ adapter, evidence, manifest, store })).resolves.toMatchObject({ stage: 'released' })
    expect(adapter.state.releaseExists).toBe(true)
  })

  it('refuses a non-fast-forward restore when main no longer equals the RC SHA', async () => {
    const { evidence, manifest } = releaseFixture()
    const adapter = fakeAdapter('pages')
    const store = createMemoryTransactionStore()
    await expect(promoteRelease({ adapter, evidence, manifest, store })).rejects.toThrow()
    adapter.state.mainSha = '9'.repeat(40)

    await expect(abortRelease({ adapter, manifest, store })).rejects.toThrow('main restore CAS')
    expect(adapter.state.mainSha).toBe('9'.repeat(40))
  })
})
