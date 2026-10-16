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
  mergeReleaseNotes,
  notesEnd,
  notesStart,
  parseReleaseTag,
  prepareReleaseNotes,
  publishReleaseNotes,
  resolveReleaseRange,
  shouldGenerateAutomatically,
} from '../../../scripts/release/release-notes.mjs'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []
const notes = '### 主要更新\n\n- 支持在编辑器中预览游戏（[#42](https://github.com/example/repo/pull/42)）。'
const original = '# v0.2.0\r\n\r\n## Features\r\n\r\n- add editor preview (abc123)\r\n'

function client(body = original) {
  return {
    get: vi.fn(async () => ({ id: 42, tag_name: 'v0.2.0', draft: false, prerelease: false, body })),
    update: vi.fn(async () => ({})),
  }
}

function output(value = notes) {
  return { items: [{ type: 'publish_release_notes', notes: value }] }
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
  it('prepends Chinese notes without changing a byte of the existing changelog', () => {
    const merged = mergeReleaseNotes(original, notes)
    expect(merged.changed).toBe(true)
    expect(merged.body.endsWith(original)).toBe(true)
    expect(merged.body).toContain(`${notesStart}\n## 中文更新\n\n${notes}\n${notesEnd}`)
    expect(mergeReleaseNotes(merged.body, '新的中文说明')).toEqual({ body: merged.body, changed: false })
  })

  it('replaces only the managed block on an explicit force run', () => {
    const before = `Handwritten introduction\r\n\r\n${notesStart}\n旧摘要\n${notesEnd}\r\n${original}`
    const result = mergeReleaseNotes(before, notes, true)
    expect(result.body.startsWith('Handwritten introduction\r\n\r\n')).toBe(true)
    expect(result.body.endsWith(`\r\n${original}`)).toBe(true)
    expect(result.body).not.toContain('旧摘要')
    expect(result.body.match(/ai-notes-zh:start/gu)).toHaveLength(1)
  })

  it.each([notesStart, notesEnd, `${notesEnd}${notesStart}`, `${notesStart}${notesEnd}${notesStart}${notesEnd}`])('refuses malformed markers %s', (body) => {
    expect(() => mergeReleaseNotes(body, notes, true)).toThrow('markers')
  })

  it('rejects empty, non-Chinese, oversized, and marker-containing model results', () => {
    for (const value of ['', 'Only English notes', '中'.repeat(12001), `${notesStart}中文`])
      expect(() => mergeReleaseNotes(original, value)).toThrow()
  })

  it('publishes through the exact release ID and never lets the agent replace the changelog', async () => {
    const api = client()
    const result = await publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: api })
    expect(result.status).toBe('published')
    expect(api.update).toHaveBeenCalledExactlyOnceWith(42, result.body)
    expect(result.body.endsWith(original)).toBe(true)
  })

  it('does not write in preview mode or on repeated runs, and refuses missing releases', async () => {
    const api = client()
    expect((await publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: api, dryRun: true })).status).toBe('preview')
    expect(api.update).not.toHaveBeenCalled()
    const existing = client(mergeReleaseNotes(original, notes).body)
    expect((await publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: existing })).status).toBe('already-generated')
    expect(existing.update).not.toHaveBeenCalled()
    await expect(publishReleaseNotes({ tag: 'v0.2.0', output: { items: [...output().items, ...output().items] }, client: api })).rejects.toThrow('Exactly one')
    const missing = { get: vi.fn(async () => undefined), update: vi.fn() }
    await expect(publishReleaseNotes({ tag: 'v0.2.0', output: output(), client: missing })).rejects.toThrow('already be published')
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
    expect(workflow['safe-outputs'].jobs['publish-release-notes'].inputs).toHaveProperty('notes')
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
