#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { appendFile, lstat, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { assertDesktopVersion } from '../../apps/desktop/scripts/config.mjs'

const execFileAsync = promisify(execFile)
export const desktopTargets = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64']

export function desktopVersionFromTag(tag) {
  if (typeof tag !== 'string' || !/^(?:desktop-)?v/u.test(tag))
    throw new Error('Desktop release tag must be v<version> or desktop-v<version>')
  return assertDesktopVersion(tag.replace(/^(?:desktop-)?v/u, ''))
}

function assertCommit(sha) {
  if (typeof sha !== 'string' || !/^[a-f\d]{40}$/u.test(sha))
    throw new Error('Desktop release source must be a full Git commit SHA')
  return sha
}

export async function validateDesktopBuild({ sourceSha, version, cwd = process.cwd(), run = execFileAsync }) {
  if (version)
    assertDesktopVersion(version)
  if (sourceSha) {
    assertCommit(sourceSha)
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd })
    if (stdout.trim() !== sourceSha)
      throw new Error('Desktop build checkout does not match the candidate source commit')
  }
}

export function assertDesktopCandidateRun(run, repository) {
  if (run.repository?.full_name !== repository || run.path?.split('@')[0] !== '.github/workflows/release-candidate.yml')
    throw new Error('Desktop artifacts must come from this repository release-candidate workflow')
  if (run.status !== 'completed' || run.conclusion !== 'success')
    throw new Error('Desktop candidate workflow must have completed successfully')
}

export function desktopReleaseFromManifest(manifest) {
  const version = desktopVersionFromTag(manifest.target?.tag)
  if (version !== manifest.version)
    throw new Error('Desktop release tag does not match the verified manifest version')
  const sourceSha = assertCommit(manifest.target?.main?.sha)
  if (sourceSha !== assertCommit(manifest.source?.sha))
    throw new Error('Desktop release target does not match the candidate source commit')
  return { tag: manifest.target.tag, version, source_sha: sourceSha }
}

export function assertDesktopCandidateIdentity(manifest, { tag, sourceSha }) {
  const candidate = desktopReleaseFromManifest(manifest)
  if (candidate.version !== desktopVersionFromTag(tag) || candidate.source_sha !== assertCommit(sourceSha))
    throw new Error('Desktop candidate does not match the release source and version')
}

export async function resolveDesktopRelease({ tag, expectedSha, cwd = process.cwd(), run = execFileAsync }) {
  const version = desktopVersionFromTag(tag)
  const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd })
  const sourceSha = assertCommit(stdout.trim())
  const tagCommit = await run('git', ['rev-parse', `refs/tags/${tag}^{commit}`], { cwd })
  if (sourceSha !== tagCommit.stdout.trim())
    throw new Error('Desktop checkout does not match the release tag')
  if (expectedSha && sourceSha !== assertCommit(expectedSha))
    throw new Error('Desktop release tag does not match the promoted source commit')
  return { tag, version, source_sha: sourceSha }
}

async function desktopChecksumContents(directory, version) {
  assertDesktopVersion(version)
  const files = desktopTargets.map(target => `advjs-desktop-${version}-${target}.zip`)
  const names = (await readdir(directory)).filter(name => name !== 'SHA256SUMS.txt').sort()
  if (JSON.stringify(names) !== JSON.stringify([...files].sort()))
    throw new Error(`Desktop release requires exactly these four ZIPs: ${files.join(', ')}`)

  const checksums = []
  for (const name of files) {
    const file = resolve(directory, name)
    const info = await lstat(file)
    if (!info.isFile() || info.size === 0)
      throw new Error(`Desktop release artifact is not a nonempty regular file: ${name}`)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(file))
      hash.update(chunk)
    checksums.push(`${hash.digest('hex')}  ${name}`)
  }
  return { files: [...files, 'SHA256SUMS.txt'], contents: `${checksums.join('\n')}\n` }
}

export async function writeDesktopChecksums(directory, version) {
  const { files, contents } = await desktopChecksumContents(directory, version)
  await writeFile(resolve(directory, 'SHA256SUMS.txt'), contents)
  return files
}

export async function verifyDesktopChecksums(directory, version) {
  const { files, contents } = await desktopChecksumContents(directory, version)
  if (await readFile(resolve(directory, 'SHA256SUMS.txt'), 'utf8') !== contents)
    throw new Error('Desktop candidate ZIP integrity does not match its checksums')
  return files
}

export async function publishDesktopAssets({ directory, tag, sourceSha, repository, cwd = process.cwd(), run = execFileAsync }) {
  const version = desktopVersionFromTag(tag)
  assertCommit(sourceSha)
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository || ''))
    throw new Error('GITHUB_REPOSITORY must identify the release repository')
  // Hash every expected target before any release mutation. Missing platforms fail closed.
  const files = await writeDesktopChecksums(directory, version)
  const remote = await run('git', ['ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`], { cwd })
  const refs = new Map(remote.stdout.trim().split('\n').filter(Boolean).map((line) => {
    const [sha, ref] = line.split(/\s+/u)
    return [ref, sha]
  }))
  const remoteSha = refs.get(`refs/tags/${tag}^{}`) || refs.get(`refs/tags/${tag}`)
  if (remoteSha !== sourceSha)
    throw new Error('Release tag moved or disappeared while desktop artifacts were building')

  const result = await run('gh', ['release', 'view', tag, '--repo', repository, '--json', 'tagName,isDraft'], { cwd })
  const release = JSON.parse(result.stdout)
  if (release.tagName !== tag || release.isDraft)
    throw new Error('Desktop assets can only be attached to the expected published release')
  await run('gh', ['release', 'upload', tag, ...files.map(file => resolve(directory, file)), '--repo', repository, '--clobber'], { cwd })
  return { tag, sourceSha, files }
}

async function outputRelease(release) {
  const output = Object.entries(release).map(([key, value]) => `${key}=${value}\n`).join('')
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, output)
  process.stdout.write(output)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  const [command, path] = process.argv.slice(2)
  if (command === 'validate-build') {
    await validateDesktopBuild({ sourceSha: process.env.DESKTOP_SOURCE_SHA, version: process.env.ADVJS_DESKTOP_VERSION })
  }
  else if (command === 'verify-run') {
    const runId = process.env.DESKTOP_CANDIDATE_RUN_ID
    if (!/^[1-9]\d*$/u.test(runId || ''))
      throw new Error('Desktop candidate run ID must be a positive integer')
    const repository = process.env.GITHUB_REPOSITORY
    const { stdout } = await execFileAsync('gh', ['api', `repos/${repository}/actions/runs/${runId}`])
    assertDesktopCandidateRun(JSON.parse(stdout), repository)
  }
  else if (command === 'resolve') {
    await outputRelease(await resolveDesktopRelease({ tag: process.env.DESKTOP_RELEASE_TAG, expectedSha: process.env.DESKTOP_RELEASE_SOURCE_SHA }))
  }
  else if (command === 'manifest') {
    if (!path)
      throw new Error('Usage: desktop-artifacts.mjs manifest <verified manifest>')
    await outputRelease(desktopReleaseFromManifest(JSON.parse(await readFile(path, 'utf8'))))
  }
  else if (command === 'verify-candidate') {
    if (!path)
      throw new Error('Usage: desktop-artifacts.mjs verify-candidate <candidate manifest>')
    const { verifyReleaseManifest } = await import('./verify-manifest.mjs')
    const manifest = await verifyReleaseManifest({ manifestPath: path, checkGit: false, requireDesktop: true })
    assertDesktopCandidateIdentity(manifest, { tag: process.env.DESKTOP_RELEASE_TAG, sourceSha: process.env.DESKTOP_RELEASE_SOURCE_SHA })
  }
  else if (command === 'publish') {
    if (!path)
      throw new Error('Usage: desktop-artifacts.mjs publish <artifact directory>')
    const result = await publishDesktopAssets({ directory: resolve(path), tag: process.env.DESKTOP_RELEASE_TAG, sourceSha: process.env.DESKTOP_RELEASE_SOURCE_SHA, repository: process.env.GITHUB_REPOSITORY })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
  else {
    throw new Error('Usage: desktop-artifacts.mjs <validate-build | verify-run | resolve | manifest | verify-candidate | publish>')
  }
}
