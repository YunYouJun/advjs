#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export const notesStart = '<!-- ai-notes-zh:start -->'
export const notesEnd = '<!-- ai-notes-zh:end -->'

export function parseReleaseTag(tag) {
  const match = typeof tag === 'string' && /^(v|core-v|desktop-v)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\dA-Za-z.-]+))?(?:\+([\dA-Za-z.-]+))?$/u.exec(tag)
  if (!match || match[0] !== tag || [match[5], match[6]].some(value => value?.split('.').some(part => !part)))
    throw new Error('Release tag must be v<semver>, core-v<semver>, or desktop-v<semver>')
  if (match[5]?.split('.').some(part => /^0\d+$/u.test(part)))
    throw new Error('Numeric prerelease identifiers cannot have leading zeros')
  return { tag, prefix: match[1], major: Number(match[2]), minor: Number(match[3]), patch: Number(match[4]), prerelease: match[5] || '' }
}

export function shouldGenerateAutomatically(tag, release = {}) {
  const version = parseReleaseTag(tag)
  return !release.draft && !release.prerelease && !version.prerelease
    && version.patch === 0 && (version.major > 0 || version.minor > 0)
}

function markerRange(body) {
  const starts = [...body.matchAll(/<!-- ai-notes-zh:start -->/gu)]
  const ends = [...body.matchAll(/<!-- ai-notes-zh:end -->/gu)]
  if (!starts.length && !ends.length)
    return undefined
  if (starts.length !== 1 || ends.length !== 1 || starts[0].index >= ends[0].index)
    throw new Error('Chinese release note markers are incomplete, reversed, or duplicated')
  return { start: starts[0].index, end: ends[0].index + notesEnd.length }
}

export function mergeReleaseNotes(original, notes, force = false) {
  if (typeof original !== 'string' || typeof notes !== 'string' || !notes.trim())
    throw new Error('Release body and nonempty Chinese notes must be strings')
  if (notes.length > 12000 || !/\p{Script=Han}/u.test(notes) || /<!--\s*ai-notes-zh:/u.test(notes))
    throw new Error('Notes must contain Chinese text, fit within 12000 characters, and exclude managed markers')
  const range = markerRange(original)
  if (range && !force)
    return { body: original, changed: false }
  const block = `${notesStart}\n## 中文更新\n\n${notes.trim()}\n${notesEnd}`
  const body = range
    ? `${original.slice(0, range.start)}${block}${original.slice(range.end)}`
    : `${block}\n\n${original}`
  if (body.length > 60000)
    throw new Error('Combined release notes exceed the supported body size')
  return { body, changed: body !== original }
}

function compareVersions(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key])
      return a[key] - b[key]
  }
  if (!a.prerelease || !b.prerelease)
    return a.prerelease ? -1 : b.prerelease ? 1 : 0
  const left = a.prerelease.split('.')
  const right = b.prerelease.split('.')
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (left[index] === right[index])
      continue
    if (left[index] === undefined || right[index] === undefined)
      return left[index] === undefined ? -1 : 1
    const leftNumeric = /^\d+$/u.test(left[index])
    const rightNumeric = /^\d+$/u.test(right[index])
    if (leftNumeric && rightNumeric)
      return Number(left[index]) - Number(right[index])
    if (leftNumeric !== rightNumeric)
      return leftNumeric ? -1 : 1
    return left[index] < right[index] ? -1 : 1
  }
  return 0
}

export async function resolveReleaseRange({ tag, fromTag = '', cwd = process.cwd(), run = execFileAsync }) {
  const target = parseReleaseTag(tag)
  const git = async args => (await run('git', args, { cwd })).stdout.trim()
  const toSha = await git(['rev-parse', '--verify', `refs/tags/${tag}^{commit}`])
  let base
  if (fromTag) {
    base = parseReleaseTag(fromTag)
    if (base.prefix !== target.prefix || compareVersions(base, target) >= 0)
      throw new Error('Comparison tag must be an earlier version in the same tag series')
  }
  else {
    const tags = (await git(['tag', '--merged', toSha, '--list', `${target.prefix}*`])).split('\n').filter(Boolean)
    const candidates = tags.flatMap((candidate) => {
      try {
        return [parseReleaseTag(candidate)]
      }
      catch {
        return []
      }
    }).filter(candidate => candidate.prefix === target.prefix && compareVersions(candidate, target) < 0
      && (target.prerelease || !candidate.prerelease))
    base = candidates.sort((a, b) => compareVersions(b, a))[0]
  }
  const fromSha = base ? await git(['rev-parse', '--verify', `refs/tags/${base.tag}^{commit}`]) : ''
  if (fromSha)
    await git(['merge-base', '--is-ancestor', fromSha, toSha])
  return { tag, from_tag: base?.tag || '', from_sha: fromSha, to_sha: toSha }
}

export function createReleaseClient({ repository, token, apiUrl = 'https://api.github.com', request = fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository || '') || !token)
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN authentication are required')
  const call = async (path, options = {}) => {
    const response = await request(`${apiUrl}/repos/${repository}${path}`, {
      ...options,
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    })
    if (!response.ok) {
      const error = new Error(`GitHub Release API returned HTTP ${response.status}`)
      error.status = response.status
      throw error
    }
    return await response.json()
  }
  return {
    async get(tag) {
      parseReleaseTag(tag)
      try {
        return await call(`/releases/tags/${encodeURIComponent(tag)}`)
      }
      catch (error) {
        if (error.status === 404)
          return undefined
        throw error
      }
    },
    async update(id, body) {
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new Error('A valid existing release ID is required')
      return await call(`/releases/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) })
    },
  }
}

export async function prepareReleaseNotes({ tag, fromTag, automatic = false, force = false, dryRun = false, client, cwd, run }) {
  parseReleaseTag(tag)
  if (automatic && !shouldGenerateAutomatically(tag))
    return { should_run: false, reason: 'patch-or-prerelease', tag }
  const release = await client.get(tag)
  if (automatic && release && !shouldGenerateAutomatically(tag, release))
    return { should_run: false, reason: 'patch-or-prerelease', tag }
  if ((!release || release.draft) && !dryRun)
    throw new Error('An existing published GitHub Release is required; publish it first or use dry_run for a preview')
  if (release?.tag_name && release.tag_name !== tag)
    throw new Error('GitHub Release tag does not match the requested tag')
  if (release && markerRange(release.body || '') && !force)
    return { should_run: false, reason: 'already-generated', tag }
  return { should_run: true, reason: dryRun ? 'preview' : 'generate', ...await resolveReleaseRange({ tag, fromTag, cwd, run }) }
}

export async function publishReleaseNotes({ tag, output, automatic = false, force = false, dryRun = false, client }) {
  parseReleaseTag(tag)
  if (automatic && !shouldGenerateAutomatically(tag))
    throw new Error('Automatic release notes are restricted to stable major/minor releases')
  const items = output?.items?.filter(item => item.type === 'publish_release_notes') || []
  if (items.length !== 1)
    throw new Error('Exactly one publish_release_notes result is required')
  const release = await client.get(tag)
  if ((!release || release.draft) && !dryRun)
    throw new Error('Release must already be published before updating its notes')
  if (release?.tag_name && release.tag_name !== tag)
    throw new Error('GitHub Release tag does not match the requested tag')
  if (automatic && release && !shouldGenerateAutomatically(tag, release))
    throw new Error('Automatic release notes cannot update a draft or prerelease')
  const merged = mergeReleaseNotes(release?.body || '', items[0].notes, force)
  if (!merged.changed)
    return { status: 'already-generated', tag, body: merged.body }
  if (!dryRun)
    await client.update(release.id, merged.body)
  return { status: dryRun ? 'preview' : 'published', tag, body: merged.body }
}

async function main() {
  const truthy = value => value === 'true'
  const options = {
    tag: process.env.RELEASE_NOTES_TAG,
    fromTag: process.env.RELEASE_NOTES_FROM_TAG,
    automatic: truthy(process.env.RELEASE_NOTES_AUTOMATIC),
    force: truthy(process.env.RELEASE_NOTES_FORCE),
    dryRun: truthy(process.env.RELEASE_NOTES_DRY_RUN) || truthy(process.env.GH_AW_SAFE_OUTPUTS_STAGED),
    client: createReleaseClient({ repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN, apiUrl: process.env.GITHUB_API_URL }),
  }
  if (process.argv[2] === 'prepare') {
    const result = await prepareReleaseNotes(options)
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''))
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
  else if (process.argv[2] === 'publish') {
    const output = JSON.parse(await readFile(process.env.GH_AW_AGENT_OUTPUT, 'utf8'))
    const result = await publishReleaseNotes({ ...options, output })
    await writeFile('release-notes-zh-preview.md', result.body)
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `Release Notes: ${result.status} (${result.tag})\n\n${result.body}\n`)
    process.stdout.write(`${JSON.stringify({ status: result.status, tag: result.tag })}\n`)
  }
  else {
    throw new Error('Usage: node scripts/release/release-notes.mjs <prepare | publish>')
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
