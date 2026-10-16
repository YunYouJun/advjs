// @vitest-environment node

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import {
  createReleaseClient,
  formatReleaseNotesLayout,
  mergeReleaseNotes,
  notesEnd,
  notesStart,
  parseReleaseTag,
  prepareReleaseNotes,
  publishReleaseNotes,
  resolveReleaseRange,
  shouldGenerateAutomatically,
  updateReleaseNotesLayout,
} from '../../../scripts/release/release-notes.mjs'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []
const notes = '### 主要更新\n\n- 支持在编辑器中预览游戏（[#42](https://github.com/example/repo/pull/42)）。'
const english = '### Highlights\n\n- Preview games in the editor ([#42](https://github.com/example/repo/pull/42)).'
const bilingual = { 'zh-CN': notes, 'en': english }
const original = '# v0.2.0\r\n\r\n## Features\r\n\r\n- add editor preview (abc123)\r\n'

function changelogBody(body: string) {
  return body.match(/<!-- ai-changelog:start -->[\s\S]*?<a name="ai-release-notes-changelog"><\/a>\n\n([\s\S]*)\n<\/details>\n<!-- ai-changelog:end -->/u)?.[1]
}

function client(body = original) {
  return {
    get: vi.fn(async () => ({ id: 42, tag_name: 'v0.2.0', draft: false, prerelease: false, body })),
    update: vi.fn(async () => ({})),
  }
}

function output(value = bilingual) {
  return { items: [{ type: 'publish_release_notes', notes_zh: value['zh-CN'], notes_en: value.en }] }
}

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'advjs-release-notes-'))
  temporaryDirectories.push(cwd)
  const git = async (...args: string[]) => (await execFileAsync('git', args, { cwd })).stdout.trim()
  await git('init', '-b', 'main')
  await git('config', 'user.email', 'release@example.test')
  await git('config', 'user.name', 'Release Test')
  const commit = async (message: string) => {
    await writeFile(join(cwd, 'changes.txt'), message)
    await git('add', '.')
    await git('commit', '-m', message)
    return await git('rev-parse', 'HEAD')
  }
  const first = await commit('feat(core): add runtime')
  await git('tag', 'v0.1.0')
  await git('tag', 'core-v0.1.0')
  const previous = await commit('fix(editor): preserve selection')
  await git('tag', 'v0.1.1')
  const current = await commit('feat(editor): add preview')
  await git('tag', 'v0.2.0')
  await git('tag', 'core-v9.0.0')
  await git('switch', '-c', 'unrelated', first)
  await commit('feat(core): add unrelated branch')
  await git('tag', 'v0.1.5')
  await git('switch', 'main')
  return { cwd, first, previous, current, git }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(cwd => rm(cwd, { recursive: true, force: true })))
})

describe('release note eligibility', () => {
  it.each(['v0.4.0', 'v1.0.0', 'core-v1.2.0', 'desktop-v2.0.0'])('automatically summarizes stable major/minor %s', (tag) => {
    expect(shouldGenerateAutomatically(tag)).toBe(true)
  })

  it.each(['v0.4.1', 'core-v1.2.3', 'desktop-v2.0.1', 'v0.0.0', 'v1.0.0-beta.0'])('skips automatic %s', (tag) => {
    expect(shouldGenerateAutomatically(tag)).toBe(false)
  })

  it('also respects GitHub draft and prerelease flags', () => {
    expect(shouldGenerateAutomatically('v1.0.0', { draft: true })).toBe(false)
    expect(shouldGenerateAutomatically('v1.0.0', { prerelease: true })).toBe(false)
  })

  it.each(['v01.2.0', 'v1.02.0', 'v1.2', 'v1.2.0-beta..1', 'v1.2.0-01', '../v1.2.0', 'v1.2.0\nother', 'v1.2.0\n', 'V1.2.0'])('rejects invalid tag %s', (tag) => {
    expect(() => parseReleaseTag(tag)).toThrow()
  })

  it('skips automatic patches before any GitHub or model work', async () => {
    const api = client()
    expect(await prepareReleaseNotes({ tag: 'v0.2.1', automatic: true, client: api })).toMatchObject({ should_run: false })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('skips automatic GitHub drafts and prereleases with stable-looking tags', async () => {
    for (const flags of [{ draft: true }, { prerelease: true }]) {
      const api = { get: vi.fn(async () => ({ ...flags, tag_name: 'v0.2.0' })) }
      expect(await prepareReleaseNotes({ tag: 'v0.2.0', automatic: true, client: api })).toMatchObject({ should_run: false })
    }
  })
})

describe('exact release comparison', () => {
  it('plans missing languages before inference and provides existing summaries as single-line JSON', async () => {
    const data = await fixture()
    const legacy = `${notesStart}\r\n## 中文更新\r\n\r\n${notes}\r\n${notesEnd}\r\n${original}`
    const api = client(legacy)
    const result = await prepareReleaseNotes({ tag: 'v0.2.0', client: api, cwd: data.cwd })
    expect(JSON.parse(result.generate_languages!)).toEqual(['en'])
    expect(JSON.parse(result.existing_notes!)).toEqual({ 'zh-CN': notes })
    expect(result.existing_notes).not.toContain('\n')
    expect(await prepareReleaseNotes({ tag: 'v0.2.0', language: 'zh-CN', client: api })).toMatchObject({ should_run: false, reason: 'already-generated' })
    const forced = await prepareReleaseNotes({ tag: 'v0.2.0', language: 'zh-CN', force: true, client: api, cwd: data.cwd })
    expect(JSON.parse(forced.generate_languages!)).toEqual(['zh-CN'])
    const complete = client(mergeReleaseNotes(original, bilingual).body)
    expect(await prepareReleaseNotes({ tag: 'v0.2.0', client: complete })).toMatchObject({ should_run: false })
  })

  it.each(['fr', 'zh', 'Both', '', 'both\nen'])('rejects invalid language %s before reading GitHub', async (language) => {
    const api = client()
    await expect(prepareReleaseNotes({ tag: 'v0.2.0', language, client: api })).rejects.toThrow('Language')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('finds the latest earlier ancestor in the same tag series', async () => {
    const data = await fixture()
    expect(await resolveReleaseRange({ tag: 'v0.2.0', cwd: data.cwd })).toEqual({
      tag: 'v0.2.0',
      from_tag: 'v0.1.1',
      from_sha: data.previous,
      to_sha: data.current,
    })
  })

  it('supports first releases and explicit bases while rejecting unrelated history and tag families', async () => {
    const data = await fixture()
    expect(await resolveReleaseRange({ tag: 'v0.1.0', cwd: data.cwd })).toMatchObject({ from_tag: '', from_sha: '', to_sha: data.first })
    expect(await resolveReleaseRange({ tag: 'v0.2.0', fromTag: 'v0.1.0', cwd: data.cwd })).toMatchObject({ from_sha: data.first })
    await expect(resolveReleaseRange({ tag: 'v0.2.0', fromTag: 'core-v0.1.0', cwd: data.cwd })).rejects.toThrow('same tag series')
    await expect(resolveReleaseRange({ tag: 'v0.2.0', fromTag: 'v0.1.5', cwd: data.cwd })).rejects.toThrow()
  })

  it('allows manual patch previews without creating a GitHub Release', async () => {
    const data = await fixture()
    const api = { get: vi.fn(async () => undefined), update: vi.fn() }
    const result = await prepareReleaseNotes({ tag: 'v0.1.1', dryRun: true, client: api, cwd: data.cwd })
    expect(result).toMatchObject({ should_run: true, reason: 'preview', from_tag: 'v0.1.0', to_sha: data.previous })
    await expect(prepareReleaseNotes({ tag: 'v0.1.1', client: api, cwd: data.cwd })).rejects.toThrow('existing published')
    expect(api.update).not.toHaveBeenCalled()
  })
})

describe('preserving the original changelog', () => {
  it('renders bilingual navigation and collapsible sections without changing the original changelog', () => {
    const merged = mergeReleaseNotes(original, bilingual)
    expect(merged.changed).toBe(true)
    expect(changelogBody(merged.body)).toBe(original)
    expect(merged.body).toContain(`${notesStart}\n## 中文更新\n\n${notes}\n${notesEnd}`)
    for (const [label, code] of [['简体中文', 'zh'], ['English', 'en']]) {
      expect(merged.body).toContain(`[${label}](#user-content-ai-release-notes-${code})`)
      expect(merged.body).toContain(`<details${code === 'zh' ? ' open' : ''}>\n<summary>${label}</summary>\n\n<a name="ai-release-notes-${code}"></a>`)
    }
    expect(merged.body).toContain('[完整变更记录](#user-content-ai-release-notes-changelog)')
    expect(merged.body).toContain('<details>\n<summary>完整变更记录 / Full Changelog</summary>')
    expect(mergeReleaseNotes(merged.body, bilingual)).toEqual({ body: merged.body, changed: false })
  })

  it('upgrades legacy Chinese notes when adding English, preserving the entire Chinese block and surrounding bytes', () => {
    const legacy = `${notesStart}\r\n## 中文更新\r\n\r\n旧摘要\r\n${notesEnd}`
    const before = `Handwritten introduction\r\n\r\n${legacy}\r\n${original}`
    const result = mergeReleaseNotes(before, { en: english })
    expect(result.body).toContain(legacy)
    expect(result.body.startsWith('Handwritten introduction\r\n\r\n')).toBe(true)
    expect(changelogBody(result.body)).toBe(`\r\n${original}`)
    expect(result.body).toContain(english)
    expect(mergeReleaseNotes(result.body, { en: english })).toEqual({ body: result.body, changed: false })
  })

  it('replaces only the selected language on an explicit force run', () => {
    const before = `Handwritten introduction\r\n\r\n${notesStart}\n旧摘要\n${notesEnd}\r\n${original}`
    const result = mergeReleaseNotes(before, { 'zh-CN': notes }, { language: 'zh-CN', force: true })
    expect(result.body.startsWith('Handwritten introduction\r\n\r\n')).toBe(true)
    expect(changelogBody(result.body)).toBe(`\r\n${original}`)
    expect(result.body).not.toContain('旧摘要')
    expect(result.body.match(/ai-notes-zh:start/gu)).toHaveLength(1)
    const both = mergeReleaseNotes(result.body, { en: english }).body
    const replaced = mergeReleaseNotes(both, { en: `### Fixes\n\n- Preserve preview state. ([#42](https://github.com/example/repo/pull/42))` }, { language: 'en', force: true })
    expect(replaced.body).toContain(`${notesStart}\n## 中文更新\n\n${notes}\n${notesEnd}`)
    expect(replaced.body).not.toContain(english)
    expect(changelogBody(replaced.body)).toBe(`\r\n${original}`)
  })

  it.each([notesStart, notesEnd, `${notesEnd}${notesStart}`, `${notesStart}${notesEnd}${notesStart}${notesEnd}`])('refuses malformed markers %s', (body) => {
    expect(() => mergeReleaseNotes(body, bilingual, { force: true })).toThrow('markers')
  })

  it('rejects incomplete languages, invalid text, oversized results, and model-supplied layout', () => {
    for (const value of ['', 'Only English notes', '中'.repeat(12001), `${notesStart}中文`, '<details>中文</details>'])
      expect(() => mergeReleaseNotes(original, { ...bilingual, 'zh-CN': value })).toThrow()
    for (const value of ['', '只有中文', 'x'.repeat(12001), '<summary>English</summary>'])
      expect(() => mergeReleaseNotes(original, { ...bilingual, en: value })).toThrow()
    expect(() => mergeReleaseNotes(original, { en: english })).toThrow()
    expect(() => mergeReleaseNotes(original, bilingual, { language: 'en' })).toThrow('only the languages')
    expect(() => mergeReleaseNotes(original, { ...bilingual, fr: 'Bonjour' })).toThrow()
    expect(() => mergeReleaseNotes('x'.repeat(60000), bilingual)).toThrow('body size')
  })

  it.each(['zh-CN', 'en'])('renders only existing languages and can later add the missing language (%s)', (language) => {
    const one = mergeReleaseNotes(original, { [language]: bilingual[language] }, { language })
    expect(one.body.match(/<details open>/gu)).toHaveLength(1)
    const absent = language === 'en' ? 'zh-CN' : 'en'
    const absentCode = absent === 'en' ? 'en' : 'zh'
    expect(one.body).not.toContain(`(#user-content-ai-release-notes-${absentCode})`)
    const both = mergeReleaseNotes(one.body, { [absent]: bilingual[absent] })
    expect(both.body.match(/<details open>/gu)).toHaveLength(1)
    expect(changelogBody(both.body)).toBe(original)
  })

  it('requires clickable evidence and matching reference sets when generating both languages', () => {
    expect(() => mergeReleaseNotes(original, { ...bilingual, en: '### Highlights\n\n- Editor preview (abc1234, #42).' })).toThrow('linked GitHub')
    expect(() => mergeReleaseNotes(original, { ...bilingual, en: english.replace('/42', '/43') })).toThrow('same PR and commit links')
    expect(mergeReleaseNotes(original, { ...bilingual, en: `${english}\n\nSee [#42](https://github.com/example/repo/pull/42) again.` }).changed).toBe(true)
  })

  it('fails closed on misplaced, overlapping, empty-group, and malformed marker structures', () => {
    const valid = mergeReleaseNotes('', bilingual).body
    const end = '<!-- ai-release-notes:end -->'
    for (const body of [
      valid.replace(end, '') + end + notesStart + notesEnd,
      valid.replace(notesEnd, '').replace('<!-- ai-notes-en:start -->', `<!-- ai-notes-en:start -->${notesEnd}`),
      '<!-- ai-release-notes:start --><!-- ai-release-notes:end -->',
      '<!-- ai-notes-en:start -->English<!-- ai-notes-en:end -->',
      '<!-- ai-notes-zh: start -->',
    ])
      expect(() => mergeReleaseNotes(body, bilingual, { force: true })).toThrow('markers')
  })

  it('publishes through the exact release ID and never lets the agent replace the changelog', async () => {
    const api = client()
    const result = await publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: api })
    expect(result.status).toBe('published')
    expect(api.update).toHaveBeenCalledExactlyOnceWith(42, result.body)
    expect(changelogBody(result.body)).toBe(original)
  })

  it('does not write in preview mode or on repeated runs, and refuses missing releases', async () => {
    const api = client()
    expect((await publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: api, dryRun: true })).status).toBe('preview')
    expect(api.update).not.toHaveBeenCalled()
    const existing = client(mergeReleaseNotes(original, bilingual).body)
    expect((await publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: existing })).status).toBe('already-generated')
    expect(existing.update).not.toHaveBeenCalled()
    await expect(publishReleaseNotes({ tag: 'v0.2.0', output: { items: [...output().items, ...output().items] }, client: api })).rejects.toThrow('Exactly one')
    const missing = { get: vi.fn(async () => undefined), update: vi.fn() }
    await expect(publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: missing })).rejects.toThrow('already be published')
  })

  it('fills only a missing language and rechecks existing notes immediately before writing', async () => {
    const legacy = `${notesStart}\n## 中文更新\n\n${notes}\n${notesEnd}\n\n${original}`
    const api = client(legacy)
    const result = await publishReleaseNotes({ tag: 'v0.2.0', output: { items: [{ type: 'publish_release_notes', notes_en: english }] }, client: api })
    expect(result.status).toBe('published')
    expect(result.body).toContain(`${notesStart}\n## 中文更新\n\n${notes}\n${notesEnd}`)
    const incomplete = client()
    await expect(publishReleaseNotes({ tag: 'v0.2.0', output: { items: [{ type: 'publish_release_notes', notes_en: english }] }, client: incomplete })).rejects.toThrow()
    expect(incomplete.update).not.toHaveBeenCalled()
    const race = client(mergeReleaseNotes(original, bilingual).body)
    expect((await publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: race })).status).toBe('already-generated')
    expect(race.update).not.toHaveBeenCalled()
  })

  it('sends only the body field in the GitHub PATCH request', async () => {
    const request = vi.fn(async () => ({ ok: true, json: async () => ({ id: 42 }) }))
    const api = createReleaseClient({ repository: 'example/repo', token: 'test-token', request })
    await api.update(42, original)
    expect(request).toHaveBeenCalledWith('https://api.github.com/repos/example/repo/releases/42', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ body: original }),
    }))
  })

  it('reformats existing summaries without regenerating them or changing the changelog payload', () => {
    const chinese = `${notesStart}\r\n## 中文更新\r\n\r\n${notes}\r\n${notesEnd}`
    const en = `<!-- ai-notes-en:start -->\n## Release Highlights\n\n${english}\n<!-- ai-notes-en:end -->`
    const payload = `\r\n${original}\n<details><summary>Historical details</summary>Original text</details>\n\n`
    const before = `Introduction\r\n\r\n<!-- ai-release-notes:start -->\n${chinese}\n${en}\n<!-- ai-release-notes:end -->\n\n${payload}`
    const formatted = formatReleaseNotesLayout(before)
    expect(formatted.changed).toBe(true)
    expect(formatted.body.startsWith('Introduction\r\n\r\n')).toBe(true)
    expect(formatted.body).toContain(chinese)
    expect(formatted.body).toContain(en)
    expect(changelogBody(formatted.body)).toBe(payload)
    expect(formatReleaseNotesLayout(formatted.body)).toEqual({ body: formatted.body, changed: false })
    expect(formatReleaseNotesLayout(original)).toEqual({ body: original, changed: false })
    expect(mergeReleaseNotes('', bilingual).body).not.toContain('ai-changelog:')
  })

  it('rejects malformed or misplaced changelog wrappers before any update', () => {
    const valid = mergeReleaseNotes(original, bilingual).body
    for (const body of [
      valid.replace('<!-- ai-changelog:end -->', ''),
      `${valid}<!-- ai-changelog:start --><!-- ai-changelog:end -->`,
      valid.replace('完整变更记录 / Full Changelog', 'Unrecognized layout'),
      '<!-- ai-changelog:start -->Original<!-- ai-changelog:end -->',
    ])
      expect(() => formatReleaseNotesLayout(body)).toThrow()
    expect(() => mergeReleaseNotes(original, { ...bilingual, en: `English <!-- ai-changelog:start --> [#42](https://github.com/example/repo/pull/42)` })).toThrow()
  })

  it('previews and publishes layout-only updates, skips repeats, and requires the exact published Release', async () => {
    const legacy = `${notesStart}\n## 中文更新\n\n${notes}\n${notesEnd}\r\n${original}`
    const api = client(legacy)
    const preview = await updateReleaseNotesLayout({ tag: 'v0.2.0', dryRun: true, client: api })
    expect(preview.status).toBe('preview')
    expect(api.update).not.toHaveBeenCalled()
    expect(changelogBody(preview.body)).toBe(`\r\n${original}`)
    const result = await updateReleaseNotesLayout({ tag: 'v0.2.0', client: api })
    expect(result.status).toBe('published')
    expect(api.update).toHaveBeenCalledExactlyOnceWith(42, preview.body)
    const repeated = client(result.body)
    expect((await updateReleaseNotesLayout({ tag: 'v0.2.0', client: repeated })).status).toBe('unchanged')
    expect(repeated.update).not.toHaveBeenCalled()
    for (const release of [undefined, { tag_name: 'v0.2.0', draft: true }, { tag_name: 'v0.3.0' }]) {
      const invalid = { get: vi.fn(async () => release), update: vi.fn() }
      await expect(updateReleaseNotesLayout({ tag: 'v0.2.0', client: invalid })).rejects.toThrow('published Release')
      expect(invalid.update).not.toHaveBeenCalled()
    }
  })
})

describe('copilot workflow wiring', () => {
  it('makes historical release commits available in the analysis checkout', async () => {
    const root = resolve(import.meta.dirname, '../../..')
    const generated = parse(await readFile(join(root, '.github/workflows/release-notes-zh.lock.yml'), 'utf8'))
    const checkout = generated.jobs.agent.steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/checkout@'))
    const depth = checkout.with?.['fetch-depth'] ?? 1
    const data = await fixture()
    const directory = join(data.cwd, 'analysis')
    const args = ['clone', '--quiet', '--single-branch', '--branch', 'main']
    if (depth > 0)
      args.push('--depth', String(depth))
    args.push(pathToFileURL(data.cwd).href, directory)
    await execFileAsync('git', args)
    const result = await execFileAsync('git', ['show', '--format=%H', '--no-patch', data.first], { cwd: directory })
    expect(result.stdout.trim()).toBe(data.first)
  })

  it('uses keyless inference, gates before the agent, and preserves the existing release transaction', async () => {
    const root = resolve(import.meta.dirname, '../../..')
    const source = await readFile(join(root, '.github/workflows/release-notes-zh.md'), 'utf8')
    const workflow = parse(source.split('---')[1])
    expect(workflow.permissions['copilot-requests']).toBe('write')
    expect(source).not.toContain('secrets.')
    expect(workflow.if).toBe('needs.pre_activation.outputs.should_run == \'true\'')
    expect(workflow.on.steps.at(-1).run).toBe('node scripts/release/release-notes.mjs prepare')
    expect(workflow.on.workflow_dispatch.inputs.language).toMatchObject({ type: 'choice', default: 'both', options: ['both', 'zh-CN', 'en'] })
    expect(workflow.on.workflow_call.inputs.language).toMatchObject({ type: 'string', default: 'both' })
    expect(workflow['safe-outputs'].jobs['publish-release-notes'].inputs).toHaveProperty('notes_zh')
    expect(workflow['safe-outputs'].jobs['publish-release-notes'].inputs).toHaveProperty('notes_en')
    const languageExpression = `$${'{'}{ inputs.language || 'both' }}`
    expect(workflow.on.steps.at(-1).env.RELEASE_NOTES_LANGUAGE).toBe(languageExpression)
    expect(workflow['safe-outputs'].jobs['publish-release-notes'].steps[1].env.RELEASE_NOTES_LANGUAGE).toBe(languageExpression)
    expect(workflow['safe-outputs']).not.toHaveProperty('update-release')
    const release = parse(await readFile(join(root, '.github/workflows/release.yml'), 'utf8'))
    expect(release.jobs['release-notes']).toMatchObject({
      needs: ['transaction', 'desktop'],
      uses: './.github/workflows/release-notes-zh.lock.yml',
      with: { automatic: true },
      permissions: { 'copilot-requests': 'write' },
    })
    expect(release.jobs.transaction.steps.some((step: { run?: string }) => step.run?.includes('scripts/release/promote.mjs'))).toBe(true)
    const compiled = await readFile(join(root, '.github/workflows/release-notes-zh.lock.yml'), 'utf8')
    expect(compiled).toContain(`COPILOT_GITHUB_TOKEN: $${'{'}{ github.token }}`)
    expect(compiled).not.toContain('secrets.COPILOT_GITHUB_TOKEN')
    const generated = parse(compiled)
    expect(generated.jobs.pre_activation.permissions).toEqual({ contents: 'read' })
    expect(generated.jobs.publish_release_notes.if).toContain('needs.detection.outputs.detection_success == \'true\'')
    const levels: Record<string, number> = { none: 0, read: 1, write: 2 }
    for (const job of Object.values(generated.jobs) as { permissions?: Record<string, string> }[]) {
      for (const [scope, level] of Object.entries(job.permissions || {}))
        expect(levels[release.jobs['release-notes'].permissions[scope] || 'none']).toBeGreaterThanOrEqual(levels[level])
    }
  })
})
