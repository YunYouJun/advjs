#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export const notesStart = '<!-- ai-notes-zh:start -->'
export const notesEnd = '<!-- ai-notes-zh:end -->'
const groupStart = '<!-- ai-release-notes:start -->'
const groupEnd = '<!-- ai-release-notes:end -->'
const changelogStart = '<!-- ai-changelog:start -->'
const changelogEnd = '<!-- ai-changelog:end -->'
const changelogPrefix = `${changelogStart}\n<details>\n<summary>完整变更记录 / Full Changelog</summary>\n\n<a name="ai-release-notes-changelog"></a>\n\n`
const changelogSuffix = `\n</details>\n${changelogEnd}`
const languages = {
  'zh-CN': { code: 'zh', label: '简体中文', title: '中文更新', start: notesStart, end: notesEnd, script: /\p{Script=Han}/u },
  'en': { code: 'en', label: 'English', title: 'Release Highlights', start: '<!-- ai-notes-en:start -->', end: '<!-- ai-notes-en:end -->', script: /[A-Za-z]/u },
}

function requestedLanguages(language) {
  if (language === 'both')
    return Object.keys(languages)
  if (Object.hasOwn(languages, language))
    return [language]
  throw new Error('Language must be both, zh-CN, or en')
}

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

function markerRange(body, startMarker, endMarker) {
  const start = body.indexOf(startMarker)
  const end = body.indexOf(endMarker)
  if (start === -1 && end === -1)
    return undefined
  if (start < 0 || end < start || body.includes(startMarker, start + 1) || body.includes(endMarker, end + 1))
    throw new Error('Release note markers are incomplete, reversed, or duplicated')
  return { start, end: end + endMarker.length }
}

function generationPlan(original, language, force) {
  const requested = requestedLanguages(language)
  if (typeof original !== 'string')
    throw new Error('Release body must be a string')
  const group = markerRange(original, groupStart, groupEnd)
  const blocks = {}
  const existing = {}
  const ranges = []
  for (const [key, config] of Object.entries(languages)) {
    const range = markerRange(original, config.start, config.end)
    if (!range)
      continue
    if (group && (range.start < group.start + groupStart.length || range.end > group.end - groupEnd.length))
      throw new Error('Language markers must be inside the managed release note group')
    if (!group && key !== 'zh-CN')
      throw new Error('English markers require a managed release note group')
    ranges.push(range)
    blocks[key] = original.slice(range.start, range.end)
    existing[key] = original.slice(range.start + config.start.length, range.end - config.end.length)
      .trim()
      .replace(new RegExp(`^## ${config.title}\\r?\\n\\s*`, 'u'), '')
  }
  if (ranges.length === 2 && ranges[0].start < ranges[1].end && ranges[1].start < ranges[0].end)
    throw new Error('Language markers must not overlap')
  const markerCount = [...original.matchAll(/<!--\s*ai-(?:release-notes|notes-(?:zh|en)):/gu)].length
  if ((group && !ranges.length) || markerCount !== (ranges.length + Number(Boolean(group))) * 2)
    throw new Error('Release note markers are malformed')
  const range = group || ranges[0]
  const changelog = markerRange(original, changelogStart, changelogEnd)
  const changelogMarkerCount = [...original.matchAll(/<!--\s*ai-changelog:/gu)].length
  if (changelogMarkerCount !== Number(Boolean(changelog)) * 2 || (changelog && (!range || changelog.start < range.end)))
    throw new Error('Changelog markers must follow the managed release notes')
  let tail = range ? original.slice(range.end) : original
  if (changelog) {
    const section = original.slice(changelog.start, changelog.end)
    if (!section.startsWith(changelogPrefix) || !section.endsWith(changelogSuffix))
      throw new Error('Changelog layout is malformed; refusing to change the original text')
  }
  else if (tail.trim()) {
    // The current managed group owns this separator; retain all changelog payload bytes.
    const content = group && tail.startsWith('\n\n') ? tail.slice(2) : tail
    tail = `\n\n${changelogPrefix}${content}${changelogSuffix}`
  }
  return { prefix: range ? original.slice(0, range.start) : '', tail, hasChangelog: Boolean(tail.trim()), blocks, existing, targets: requested.filter(key => force || !blocks[key]) }
}

function referenceLinks(notes) {
  return [...new Set(notes.match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:commit\/[a-f\d]{7,40}|pull\/[1-9]\d*)\b/gu) || [])].sort()
}

function renderReleaseNotes(original, plan) {
  const present = Object.keys(languages).filter(key => plan.blocks[key])
  if (!present.length)
    return original
  // Named anchors inside details let GitHub reveal a collapsed section when navigating to it.
  const links = present.map(key => `[${languages[key].label}](#user-content-ai-release-notes-${languages[key].code})`)
  if (plan.hasChangelog)
    links.push('[完整变更记录](#user-content-ai-release-notes-changelog)')
  const sections = present.map((key) => {
    const config = languages[key]
    const open = key === 'zh-CN' || !plan.blocks['zh-CN']
    return `<details${open ? ' open' : ''}>\n<summary>${config.label}</summary>\n\n<a name="ai-release-notes-${config.code}"></a>\n\n${plan.blocks[key]}\n\n</details>`
  })
  const block = `${groupStart}\n${links.join(' · ')}\n\n${sections.join('\n\n')}\n${groupEnd}`
  const body = `${plan.prefix}${block}${plan.tail}`
  if (body.length > 60000)
    throw new Error('Combined release notes exceed the supported body size')
  return body
}

export function formatReleaseNotesLayout(original) {
  const body = renderReleaseNotes(original, generationPlan(original, 'both', false))
  return { body, changed: body !== original }
}

export function mergeReleaseNotes(original, notes, { language = 'both', force = false } = {}) {
  const plan = generationPlan(original, language, force)
  if (!plan.targets.length)
    return { body: original, changed: false }
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)
    || Object.keys(notes).some(key => !plan.targets.includes(key))) {
    throw new Error('Notes must contain only the languages requested for generation')
  }
  for (const key of plan.targets) {
    const value = notes[key]
    const config = languages[key]
    if (typeof value !== 'string' || !value.trim() || value.length > 12000 || !config.script.test(value)
      || /<!--\s*ai-(?:notes|release-notes|changelog)|<\/?(?:details|summary)\b/iu.test(value)) {
      throw new Error(`Nonempty ${key} notes must fit within 12000 characters and exclude managed markers and layout HTML`)
    }
    if (!referenceLinks(value).length)
      throw new Error(`${key} notes must include a linked GitHub PR or commit reference`)
    plan.blocks[key] = `${config.start}\n## ${config.title}\n\n${value.trim()}\n${config.end}`
  }
  if (plan.targets.length === 2 && JSON.stringify(referenceLinks(notes['zh-CN'])) !== JSON.stringify(referenceLinks(notes.en)))
    throw new Error('Chinese and English notes must cite the same PR and commit links')
  const body = renderReleaseNotes(original, plan)
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

export async function prepareReleaseNotes({ tag, fromTag, language = 'both', automatic = false, force = false, dryRun = false, client, cwd, run }) {
  parseReleaseTag(tag)
  requestedLanguages(language)
  if (automatic && !shouldGenerateAutomatically(tag))
    return { should_run: false, reason: 'patch-or-prerelease', tag }
  const release = await client.get(tag)
  if (automatic && release && !shouldGenerateAutomatically(tag, release))
    return { should_run: false, reason: 'patch-or-prerelease', tag }
  if ((!release || release.draft) && !dryRun)
    throw new Error('An existing published GitHub Release is required; publish it first or use dry_run for a preview')
  if (release?.tag_name && release.tag_name !== tag)
    throw new Error('GitHub Release tag does not match the requested tag')
  const plan = generationPlan(release?.body || '', language, force)
  if (!plan.targets.length)
    return { should_run: false, reason: 'already-generated', tag }
  return {
    should_run: true,
    reason: dryRun ? 'preview' : 'generate',
    generate_languages: JSON.stringify(plan.targets),
    existing_notes: JSON.stringify(plan.existing),
    ...await resolveReleaseRange({ tag, fromTag, cwd, run }),
  }
}

export async function publishReleaseNotes({ tag, output, language = 'both', automatic = false, force = false, dryRun = false, client }) {
  parseReleaseTag(tag)
  requestedLanguages(language)
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
  const notes = Object.fromEntries([['zh-CN', items[0].notes_zh], ['en', items[0].notes_en]].filter(([, value]) => value !== undefined && value !== ''))
  const merged = mergeReleaseNotes(release?.body || '', notes, { language, force })
  if (!merged.changed)
    return { status: 'already-generated', tag, body: merged.body }
  if (!dryRun)
    await client.update(release.id, merged.body)
  return { status: dryRun ? 'preview' : 'published', tag, body: merged.body }
}

export async function updateReleaseNotesLayout({ tag, dryRun = false, client }) {
  parseReleaseTag(tag)
  const release = await client.get(tag)
  if (!release || release.draft || release.tag_name !== tag)
    throw new Error('Layout updates require an existing published Release with the requested tag')
  const result = formatReleaseNotesLayout(release.body || '')
  if (result.changed && !dryRun)
    await client.update(release.id, result.body)
  return { status: !result.changed ? 'unchanged' : dryRun ? 'preview' : 'published', tag, body: result.body }
}

async function main() {
  const truthy = value => value === 'true'
  const options = {
    tag: process.env.RELEASE_NOTES_TAG,
    fromTag: process.env.RELEASE_NOTES_FROM_TAG,
    language: process.env.RELEASE_NOTES_LANGUAGE || 'both',
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
  else if (process.argv[2] === 'publish' || process.argv[2] === 'layout') {
    const result = process.argv[2] === 'layout'
      ? await updateReleaseNotesLayout(options)
      : await publishReleaseNotes({ ...options, output: JSON.parse(await readFile(process.env.GH_AW_AGENT_OUTPUT, 'utf8')) })
    await writeFile('release-notes-preview.md', result.body)
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `Release Notes: ${result.status} (${result.tag})\n\n${result.body}\n`)
    process.stdout.write(`${JSON.stringify({ status: result.status, tag: result.tag })}\n`)
  }
  else {
    throw new Error('Usage: node scripts/release/release-notes.mjs <prepare | publish | layout>')
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
