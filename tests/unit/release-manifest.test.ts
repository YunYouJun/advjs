// @vitest-environment node

import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReleaseManifest } from '../../scripts/release/create-manifest.mjs'
import { publishCandidate } from '../../scripts/release/publish-candidate.mjs'
import { verifyReleaseManifest } from '../../scripts/release/verify-manifest.mjs'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []

async function git(root: string, args: string[]) {
  return (await execFileAsync('git', args, { cwd: root })).stdout.trim()
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-release-manifest-'))
  temporaryDirectories.push(root)
  await git(root, ['init', '-b', 'main'])
  await git(root, ['config', 'user.email', 'release@example.test'])
  await git(root, ['config', 'user.name', 'Release Test'])
  await mkdir(join(root, 'docs/about'), { recursive: true })
  await writeFile(join(root, 'README.md'), 'base\n')
  await writeFile(join(root, 'docs/about/launch-known-limitations.md'), '# Known limitations\n')
  await git(root, ['add', '.'])
  await git(root, ['commit', '-m', 'chore: initialize release fixture'])
  const mainSha = await git(root, ['rev-parse', 'HEAD'])
  const mainTree = await git(root, ['rev-parse', 'HEAD^{tree}'])
  await git(root, ['switch', '-c', 'dev'])
  await writeFile(join(root, 'README.md'), 'candidate\n')
  await git(root, ['add', '.'])
  await git(root, ['commit', '-m', 'feat(editor): add launch workflow'])
  const sourceSha = await git(root, ['rev-parse', 'HEAD'])
  const output = join(root, 'release/0.1.2/manifest.json')
  const state = {
    schemaVersion: 1,
    main: { sha: mainSha, tree: mainTree },
    npmDistTags: { advjs: { latest: '0.1.1' } },
    pagesProduction: {
      deploymentId: 'pages-old',
      project: 'advjs',
      sourceSha: mainSha,
      url: 'https://editor.advjs.org/',
    },
  }
  return { mainSha, output, root, sourceSha, state }
}

function fakePackageFactory() {
  return vi.fn(async ({ outputDirectory }: { outputDirectory: string }) => {
    await mkdir(outputDirectory, { recursive: true })
    const content = Buffer.from('immutable package')
    await writeFile(join(outputDirectory, 'advjs-0.1.2.tgz'), content)
    return {
      entries: ['advjs'],
      packages: [{
        dependencies: {},
        integrity: `sha512-${createHash('sha512').update(content).digest('base64')}`,
        name: 'advjs',
        path: 'packages/advjs',
        publishOrder: 1,
        size: content.byteLength,
        tarball: 'advjs-0.1.2.tgz',
        version: '0.1.2',
      }],
      schemaVersion: 1,
      version: '0.1.2',
      versionStrategy: 'fixed',
    }
  })
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('immutable release manifests', () => {
  it('records exact Git, package, npm, Pages, changelog, and limitations state', async () => {
    const data = await fixture()
    const packageManifestFactory = fakePackageFactory()
    const manifest = await createReleaseManifest({
      createdAt: '2026-08-12T00:00:00.000Z',
      output: data.output,
      packageManifestFactory,
      root: data.root,
      sourceSha: data.sourceSha,
      state: data.state,
      version: '0.1.2',
    })

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      status: 'candidate',
      source: { ref: 'dev', sha: data.sourceSha },
      previous: {
        main: { sha: data.mainSha },
        npmDistTags: { advjs: { latest: '0.1.1' } },
        pagesProduction: { deploymentId: 'pages-old' },
      },
      target: {
        main: { sha: data.sourceSha },
        npmDistTags: { advjs: { latest: '0.1.2', rc: '0.1.2' } },
        pagesProduction: { deploymentId: null, project: 'advjs', sourceSha: data.sourceSha },
        tag: 'v0.1.2',
      },
      packages: [expect.objectContaining({ integrity: expect.stringMatching(/^sha512-/u), name: 'advjs' })],
      integrity: expect.stringMatching(/^sha256-/u),
    })
    expect(await readFile(join(data.root, 'release/0.1.2/changelog.md'), 'utf8')).toContain('add launch workflow')
    await expect(verifyReleaseManifest({ manifestPath: data.output, root: data.root })).resolves.toMatchObject({ integrity: manifest.integrity })
  })

  it('reuses a verified manifest without rebuilding or repacking', async () => {
    const data = await fixture()
    const packageManifestFactory = fakePackageFactory()
    const options = {
      createdAt: '2026-08-12T00:00:00.000Z',
      output: data.output,
      packageManifestFactory,
      root: data.root,
      sourceSha: data.sourceSha,
      state: data.state,
      version: '0.1.2',
    }
    const first = await createReleaseManifest(options)
    const second = await createReleaseManifest(options)

    expect(second).toEqual(first)
    expect(packageManifestFactory).toHaveBeenCalledOnce()
  })

  it('detects manifest and tarball tampering', async () => {
    const data = await fixture()
    await createReleaseManifest({ output: data.output, packageManifestFactory: fakePackageFactory(), root: data.root, sourceSha: data.sourceSha, state: data.state, version: '0.1.2' })
    await writeFile(join(data.root, 'release/0.1.2/packages/advjs-0.1.2.tgz'), 'changed')

    await expect(verifyReleaseManifest({ manifestPath: data.output, root: data.root })).rejects.toThrow('tarball integrity')
  })

  it('skips identical published packages, publishes missing ones once, and rejects conflicts', async () => {
    const data = await fixture()
    const manifest = await createReleaseManifest({ output: data.output, packageManifestFactory: fakePackageFactory(), root: data.root, sourceSha: data.sourceSha, state: data.state, version: '0.1.2' })
    const run = vi.fn()
    const metadata = { versions: { '0.1.2': { dist: { integrity: manifest.packages[0].integrity } } } }
    const sameFetch = vi.fn(async () => new Response(JSON.stringify(metadata))) as typeof fetch

    await expect(publishCandidate({ checkGit: false, fetch: sameFetch, manifestPath: data.output, registry: 'https://registry.example.test', run })).resolves.toMatchObject({
      packages: [{ status: 'already-published' }],
    })
    expect(run).not.toHaveBeenCalled()

    const missingFetch = vi.fn(async () => new Response('', { status: 404 })) as typeof fetch
    await publishCandidate({ checkGit: false, fetch: missingFetch, manifestPath: data.output, registry: 'https://registry.example.test', run })
    expect(run).toHaveBeenCalledOnce()

    const conflictFetch = vi.fn(async () => new Response(JSON.stringify({ versions: { '0.1.2': { dist: { integrity: 'sha512-other' } } } }))) as typeof fetch
    await expect(publishCandidate({ checkGit: false, fetch: conflictFetch, manifestPath: data.output, registry: 'https://registry.example.test', run })).rejects.toThrow('different integrity')
  })
})
