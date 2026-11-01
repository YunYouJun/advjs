// @vitest-environment node

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { assertLaunchChecks } from '../../../scripts/ci/launch-required.mjs'
import { affectsNativeStudio, affectsStudio, studioChanges } from '../../../scripts/ci/studio-changes.mjs'

const execFileAsync = promisify(execFile)

describe('studio CI scope', () => {
  it('runs the native Studio job for the App, the engine closure, golden fixtures and shared setup', () => {
    for (const path of [
      'apps/studio-ios/StudioApp/App/RootView.swift',
      'apps/studio-ios/engine/src/operations.ts',
      'packages/core/src/project/templates.ts',
      'packages/parser/src/character.ts',
      'packages/assets/src/url.ts',
      'packages/audio/src/index.ts',
      'packages/types/src/index.ts',
      'packages/advjs/node/project/index.ts',
      'plugins/plugin-interactions/src/index.ts',
      'demo/hamster/adv/assets.json',
      'demo/starter/public/md/chapters/1.md',
      'examples/ai-contest/life-story/adv/chapters/1.adv.md',
      'tests/fixtures/diagnostics/broken/adv.config.json',
      'tests/launch/fixtures/golden-project/adv.config.json',
      'pnpm-lock.yaml',
      'scripts/prepare-workspace.mjs',
      '.github/workflows/ci.yml',
    ]) {
      expect(affectsNativeStudio(path), path).toBe(true)
      expect(affectsStudio(path), path).toBe(true)
    }
    for (const path of ['apps/studio/src/views/WorkspacePage.vue', 'packages/client/pages/index.vue', 'themes/theme-default/layouts/default.vue']) {
      expect(affectsNativeStudio(path), path).toBe(false)
      expect(affectsStudio(path), path).toBe(true)
    }
    for (const path of ['docs/guide/studio/roadmap.md', 'README.md', 'apps/desktop/src/main.ts', 'editor/core/app/app.vue', '.github/workflows/docs.yml']) {
      expect(affectsNativeStudio(path), path).toBe(false)
      expect(affectsStudio(path), path).toBe(false)
    }
  })

  it('compares the PR merge base and the full push range', async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), 'advjs-studio-ci-'))
    const git = async (...args: string[]) => (await execFileAsync('git', args, { cwd })).stdout.trim()
    try {
      await git('init', '-b', 'main')
      await git('config', 'user.email', 'ci@example.test')
      await git('config', 'user.name', 'CI Test')
      await writeFile(resolve(cwd, 'README.md'), '# Fixture\n')
      await git('add', '.')
      await git('commit', '-m', 'chore: initialize CI fixture')
      const initial = await git('rev-parse', 'HEAD')

      await git('switch', '-c', 'docs')
      await mkdir(resolve(cwd, 'docs'), { recursive: true })
      await writeFile(resolve(cwd, 'docs/index.md'), '# Docs\n')
      await git('add', '.')
      await git('commit', '-m', 'docs: add a page')
      const docs = await git('rev-parse', 'HEAD')
      await expect(studioChanges({ event: 'pull_request', base: initial, head: docs, cwd })).resolves.toEqual({ studio: false, native: false })

      await mkdir(resolve(cwd, 'apps/studio/src'), { recursive: true })
      await writeFile(resolve(cwd, 'apps/studio/src/App.vue'), '<template />\n')
      await git('add', '.')
      await git('commit', '-m', 'feat(studio): add the Web shell')
      const web = await git('rev-parse', 'HEAD')
      await expect(studioChanges({ event: 'push', base: initial, head: web, cwd })).resolves.toEqual({ studio: true, native: false })

      await mkdir(resolve(cwd, 'packages/core'), { recursive: true })
      await writeFile(resolve(cwd, 'packages/core/index.ts'), 'export {}\n')
      await git('add', '.')
      await git('commit', '-m', 'feat(core): add the engine entry')
      const core = await git('rev-parse', 'HEAD')
      await expect(studioChanges({ event: 'pull_request', base: initial, head: core, cwd })).resolves.toEqual({ studio: true, native: true })

      // New branches, manual runs and unreachable bases run everything.
      await expect(studioChanges({ event: 'push', base: '0'.repeat(40), head: docs, cwd })).resolves.toEqual({ studio: true, native: true })
      await expect(studioChanges({ event: 'workflow_dispatch', cwd })).resolves.toEqual({ studio: true, native: true })
      await expect(studioChanges({ event: 'push', base: 'b'.repeat(40), head: docs, cwd })).resolves.toEqual({ studio: true, native: true })
      await expect(studioChanges({ event: 'pull_request', base: 'main', head: docs, cwd })).rejects.toThrow('exact base and head')
    }
    finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})

describe('launch-required', () => {
  const success = { result: 'success', outputs: {} }
  function needs(native: string, studio: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      'quality': success,
      'browser': success,
      'platform-smoke': success,
      'vrm-pages-build': success,
      'agent-install-smoke': success,
      'studio-pages-build': { result: studio === 'true' ? 'success' : 'skipped', outputs: {} },
      'studio-changes': { result: 'success', outputs: { native, studio } },
      'studio-unit': { result: studio === 'true' ? 'success' : 'skipped', outputs: {} },
      'studio-ios': { result: native === 'true' ? 'success' : 'skipped', outputs: {} },
      ...overrides,
    }
  }

  it('requires every job, skipping Studio jobs only when studio-changes says so', () => {
    expect(() => assertLaunchChecks(needs('true', 'true'))).not.toThrow()
    expect(() => assertLaunchChecks(needs('false', 'true'))).not.toThrow()
    expect(() => assertLaunchChecks(needs('false', 'false'))).not.toThrow()
    expect(() => assertLaunchChecks(needs('true', 'true', { quality: { result: 'failure' } }))).toThrow('quality=failure')
    expect(() => assertLaunchChecks(needs('true', 'true', { 'studio-ios': { result: 'skipped' } }))).toThrow('studio-ios=skipped (expected success)')
    expect(() => assertLaunchChecks(needs('true', 'true', { 'studio-ios': { result: 'cancelled' } }))).toThrow('studio-ios=cancelled')
    expect(() => assertLaunchChecks(needs('false', 'true', { 'studio-ios': { result: 'failure' } }))).toThrow('expected skipped')
  })

  it('fails closed when change detection fails or reports nothing', () => {
    expect(() => assertLaunchChecks(needs('true', 'true', { 'studio-changes': { result: 'failure' } }))).toThrow('studio-changes=failure')
    expect(() => assertLaunchChecks(needs('true', 'true', { 'studio-changes': { result: 'success', outputs: {} } }))).toThrow('studio-changes must report')
    for (const name of ['quality', 'browser', 'platform-smoke', 'vrm-pages-build', 'agent-install-smoke', 'studio-pages-build', 'studio-unit', 'studio-ios']) {
      const missing = needs('true', 'true')
      delete missing[name]
      expect(() => assertLaunchChecks(missing), name).toThrow(`${name}=missing`)
      for (const result of ['failure', 'cancelled', 'skipped'])
        expect(() => assertLaunchChecks(needs('true', 'true', { [name]: { result } })), name).toThrow(`${name}=${result}`)
    }
    expect(() => assertLaunchChecks(needs('true', 'true', { accidental: success }))).toThrow('accidental=unknown')
  })
})
