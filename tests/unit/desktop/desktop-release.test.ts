// @vitest-environment node

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { assertDesktopCandidateIdentity, assertDesktopCandidateRun, desktopReleaseFromManifest, desktopTargets, desktopVersionFromTag, publishDesktopAssets, resolveDesktopRelease, validateDesktopBuild, verifyDesktopChecksums, writeDesktopChecksums } from '../../../scripts/release/desktop-artifacts.mjs'

const root = resolve(import.meta.dirname, '../../..')
const sourceSha = 'a'.repeat(40)
const directories: string[] = []

async function fixture(missingTarget?: string) {
  const directory = await mkdtemp(resolve(tmpdir(), 'advjs-desktop-release-'))
  directories.push(directory)
  for (const target of desktopTargets) {
    if (target !== missingTarget)
      await writeFile(resolve(directory, `advjs-desktop-0.1.5-${target}.zip`), `archive:${target}`)
  }
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('desktop release assets', () => {
  it('rejects builds from mutable refs, mismatched checkouts and invalid versions', async () => {
    const run = async () => ({ stdout: `${sourceSha}\n` })
    await expect(validateDesktopBuild({ sourceSha, version: '0.1.5', run })).resolves.toBeUndefined()
    await expect(validateDesktopBuild({ sourceSha: 'dev', version: '0.1.5', run })).rejects.toThrow('full Git commit')
    await expect(validateDesktopBuild({ sourceSha: 'b'.repeat(40), version: '0.1.5', run })).rejects.toThrow('candidate source commit')
    await expect(validateDesktopBuild({ sourceSha, version: 'invalid', run })).rejects.toThrow('Invalid desktop version')
  })

  it('accepts only completed successful candidate runs in this repository', () => {
    const repository = 'YunYouJun/advjs'
    const run = { repository: { full_name: repository }, path: '.github/workflows/release-candidate.yml', status: 'completed', conclusion: 'success' }
    expect(() => assertDesktopCandidateRun(run, repository)).not.toThrow()
    for (const invalid of [
      { ...run, conclusion: 'failure' },
      { ...run, status: 'in_progress' },
      { ...run, path: '.github/workflows/desktop.yml' },
      { ...run, repository: { full_name: 'other/advjs' } },
    ]) {
      expect(() => assertDesktopCandidateRun(invalid, repository)).toThrow()
    }
  })

  it('accepts engine and desktop SemVer tags and rejects other or unsafe refs', () => {
    expect(desktopVersionFromTag('v0.1.5')).toBe('0.1.5')
    expect(desktopVersionFromTag('desktop-v0.1.5-beta.1+build.42')).toBe('0.1.5-beta.1+build.42')
    for (const tag of ['core-v0.1.5', 'main', 'v01.1.5', 'v0.1.5-01', 'v0.1.5\nsource_sha=evil', 'v$(pwd)', 'v0.1.5/branch'])
      expect(() => desktopVersionFromTag(tag)).toThrow()
  })

  it('derives release identity from the verified manifest without trusting mismatched metadata', () => {
    const manifest = { version: '0.1.5', target: { tag: 'v0.1.5', main: { sha: sourceSha } }, source: { sha: sourceSha } }
    expect(desktopReleaseFromManifest(manifest)).toEqual({ tag: 'v0.1.5', version: '0.1.5', source_sha: sourceSha })
    expect(() => desktopReleaseFromManifest({ ...manifest, version: '0.1.6' })).toThrow('manifest version')
    expect(() => desktopReleaseFromManifest({ ...manifest, source: { sha: 'main' } })).toThrow('full Git commit')
    expect(() => desktopReleaseFromManifest({ ...manifest, source: { sha: 'b'.repeat(40) } })).toThrow('candidate source commit')
    expect(() => assertDesktopCandidateIdentity(manifest, { tag: 'desktop-v0.1.5', sourceSha })).not.toThrow()
    expect(() => assertDesktopCandidateIdentity(manifest, { tag: 'v0.1.6', sourceSha })).toThrow('source and version')
    expect(() => assertDesktopCandidateIdentity(manifest, { tag: 'v0.1.5', sourceSha: 'b'.repeat(40) })).toThrow('source and version')
  })

  it('locks desktop builds to both the release tag and promoted source commit', async () => {
    const run = async () => ({ stdout: `${sourceSha}\n` })
    await expect(resolveDesktopRelease({ tag: 'v0.1.5', expectedSha: sourceSha, run })).resolves.toEqual({
      tag: 'v0.1.5',
      version: '0.1.5',
      source_sha: sourceSha,
    })
    await expect(resolveDesktopRelease({ tag: 'v0.1.5', expectedSha: 'b'.repeat(40), run })).rejects.toThrow('promoted source')
    const wrongCheckout = async (_command: string, args: string[]) => ({ stdout: args[1] === 'HEAD' ? sourceSha : 'b'.repeat(40) })
    await expect(resolveDesktopRelease({ tag: 'v0.1.5', run: wrongCheckout })).rejects.toThrow('checkout does not match')
  })

  it('writes checksums only when all four versioned native archives are present', async () => {
    const directory = await fixture()
    const files = await writeDesktopChecksums(directory, '0.1.5')
    expect(files).toHaveLength(5)
    const checksums = await readFile(resolve(directory, 'SHA256SUMS.txt'), 'utf8')
    for (const target of desktopTargets) {
      const hash = createHash('sha256').update(`archive:${target}`).digest('hex')
      expect(checksums).toContain(`${hash}  advjs-desktop-0.1.5-${target}.zip\n`)
    }
    await expect(writeDesktopChecksums(directory, '0.1.5')).resolves.toEqual(files)
    await expect(writeDesktopChecksums(await fixture('win32-x64'), '0.1.5')).rejects.toThrow('exactly these four ZIPs')
    await expect(writeDesktopChecksums(directory, '0.1.6')).rejects.toThrow('exactly these four ZIPs')
  })

  it('rejects empty archives and unexpected files', async () => {
    const directory = await fixture()
    await writeFile(resolve(directory, 'advjs-desktop-0.1.5-linux-x64.zip'), '')
    await expect(writeDesktopChecksums(directory, '0.1.5')).rejects.toThrow('nonempty regular file')
    await writeFile(resolve(directory, 'unexpected.zip'), 'archive')
    await expect(writeDesktopChecksums(directory, '0.1.5')).rejects.toThrow('exactly these four ZIPs')
  })

  it('verifies candidate archives without replacing their original checksums', async () => {
    const directory = await fixture()
    const files = await writeDesktopChecksums(directory, '0.1.5')
    const checksums = await readFile(resolve(directory, 'SHA256SUMS.txt'), 'utf8')
    await expect(verifyDesktopChecksums(directory, '0.1.5')).resolves.toEqual(files)
    await writeFile(resolve(directory, 'advjs-desktop-0.1.5-linux-x64.zip'), 'tampered archive')
    await expect(verifyDesktopChecksums(directory, '0.1.5')).rejects.toThrow('ZIP integrity')
    expect(await readFile(resolve(directory, 'SHA256SUMS.txt'), 'utf8')).toBe(checksums)
  })

  it('uploads complete archives and checksums to an existing published release', async () => {
    const directory = await fixture()
    const calls: { command: string, args: string[] }[] = []
    const run = async (command: string, args: string[]) => {
      calls.push({ command, args })
      if (command === 'git')
        return { stdout: `${'c'.repeat(40)}\trefs/tags/v0.1.5\n${sourceSha}\trefs/tags/v0.1.5^{}\n` }
      if (args[1] === 'view')
        return { stdout: JSON.stringify({ tagName: 'v0.1.5', isDraft: false }) }
      return { stdout: '' }
    }
    await publishDesktopAssets({ directory, tag: 'v0.1.5', sourceSha, repository: 'YunYouJun/advjs', run })
    const upload = calls.find(call => call.command === 'gh' && call.args[1] === 'upload')
    expect(upload?.args.slice(0, 3)).toEqual(['release', 'upload', 'v0.1.5'])
    expect(upload?.args.filter(arg => arg.endsWith('.zip'))).toHaveLength(4)
    expect(upload?.args).toContain(resolve(directory, 'SHA256SUMS.txt'))
  })

  it('refuses release mutations when a platform is missing, the tag moved, or the release is draft', async () => {
    const calls: string[][] = []
    const run = async (_command: string, args: string[]) => {
      calls.push(args)
      return { stdout: `${'b'.repeat(40)}\trefs/tags/v0.1.5\n` }
    }
    const options = { tag: 'v0.1.5', sourceSha, repository: 'YunYouJun/advjs', run }
    await expect(publishDesktopAssets({ ...options, directory: await fixture('darwin-arm64') })).rejects.toThrow('exactly these four ZIPs')
    expect(calls).toHaveLength(0)
    const directory = await fixture()
    await expect(publishDesktopAssets({ ...options, directory })).rejects.toThrow('moved or disappeared')
    expect(calls.every(args => args[0] === 'ls-remote')).toBe(true)

    const draftRun = async (command: string, args: string[]) => {
      calls.push(args)
      return { stdout: command === 'git' ? `${sourceSha}\trefs/tags/v0.1.5\n` : JSON.stringify({ tagName: 'v0.1.5', isDraft: true }) }
    }
    await expect(publishDesktopAssets({ ...options, directory, run: draftRun })).rejects.toThrow('published release')
    expect(calls.some(args => args[1] === 'upload')).toBe(false)
  })
})

describe('desktop workflow release boundaries', () => {
  it('gates candidate publication on the complete native matrix and reuses its artifacts at release', async () => {
    const readWorkflow = async (name: string) => parse(await readFile(resolve(root, `.github/workflows/${name}.yml`), 'utf8'))
    const [build, release, promotion, candidate] = await Promise.all(['desktop-build', 'release-desktop', 'release', 'release-candidate'].map(readWorkflow))
    const matrix = JSON.parse(build.on.workflow_call.inputs.targets.default)
    expect(matrix.map((target: { platform: string, arch: string }) => `${target.platform}-${target.arch}`).sort()).toEqual([...desktopTargets].sort())
    expect(matrix.find((target: { arch: string, platform: string }) => target.platform === 'darwin' && target.arch === 'x64').os).toBe('macos-15-intel')
    const steps = build.jobs.package.steps
    const uploadIndex = steps.findIndex((step: { name: string }) => step.name === 'Upload desktop ZIP')
    expect(steps.slice(0, uploadIndex).filter((step: { run?: string }) => step.run?.includes('verify-package.mjs'))).toHaveLength(2)
    expect(build.permissions).toEqual({ contents: 'read' })
    expect(candidate.jobs.desktop.uses).toBe('./.github/workflows/desktop-build.yml')
    expect(candidate.jobs.desktop.with.targets).toBeUndefined()
    expect(candidate.jobs.desktop.with).toMatchObject({ source_sha: `\${{ inputs.source_sha }}`, version: `\${{ inputs.version }}`, retention_days: 90 })
    expect(candidate.jobs.candidate.needs).toBe('desktop')
    expect(candidate.jobs.candidate.steps.find((step: { name?: string }) => step.name === 'Build immutable package set and manifest').run).toContain('--desktop-artifacts desktop-candidate-assets')
    expect(release.jobs.build).toBeUndefined()
    expect(release.jobs.publish.needs).toBe('prepare')
    expect(release.jobs.publish.permissions).toEqual({ actions: 'read', contents: 'write' })
    expect(release.jobs.prepare.steps[0].with.ref).toBe(`refs/tags/\${{ inputs.tag }}`)
    expect(release.on.release).toBeUndefined()
    expect(release.on.workflow_dispatch.inputs.candidate_run_id.required).toBe(true)
    const publishSteps = release.jobs.publish.steps
    const download = publishSteps.find((step: { uses?: string }) => step.uses === 'actions/download-artifact@v8')
    expect(download.with).toMatchObject({ 'run-id': `\${{ inputs.candidate_run_id }}`, 'name': `release-candidate-\${{ needs.prepare.outputs.version }}` })
    const verifyIndex = publishSteps.findIndex((step: { run?: string }) => step.run?.includes('verify-candidate'))
    const publishIndex = publishSteps.findIndex((step: { run?: string }) => step.run?.includes('desktop-artifacts.mjs publish'))
    expect(verifyIndex).toBeGreaterThan(-1)
    expect(publishIndex).toBeGreaterThan(verifyIndex)
    expect(promotion.jobs.desktop.needs).toBe('transaction')
    expect(promotion.jobs.desktop.if).toBe('inputs.operation == \'promote\' && !inputs.dry_run')
    expect(promotion.jobs.desktop.uses).toBe('./.github/workflows/release-desktop.yml')
    expect(promotion.jobs.desktop.with.source_sha).toBe(`\${{ needs.transaction.outputs.desktop_source_sha }}`)
    expect(promotion.jobs.desktop.with.candidate_run_id).toBe(`\${{ inputs.candidate_run_id }}`)
    const promotionSteps = promotion.jobs.transaction.steps
    const integrityIndex = promotionSteps.findIndex((step: { run?: string }) => step.run?.includes('--require-desktop'))
    expect(integrityIndex).toBeGreaterThan(-1)
    expect(promotionSteps.findIndex((step: { name?: string }) => step.name === 'Promote or resume the exact candidate')).toBeGreaterThan(integrityIndex)
  })
})
