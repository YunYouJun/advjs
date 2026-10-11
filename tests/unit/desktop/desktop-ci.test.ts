// @vitest-environment node

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { affectsDesktopPackage, desktopPackagingChanged } from '../../../scripts/ci/desktop-changes.mjs'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '../../..')

describe('desktop CI scope', () => {
  it('packages desktop code, runtime dependencies, templates and build configuration changes', () => {
    for (const path of [
      'apps/desktop/src/main.ts',
      'editor/core/app/app.vue',
      'packages/core/src/runtime/create.ts',
      'plugins/plugin-three/src/index.ts',
      'themes/theme-default/components/menu.vue',
      'demo/starter/adv/scenes/intro.md',
      'patches/electron.patch',
      'scripts/prepare-workspace.mjs',
      '.github/workflows/desktop-build.yml',
      '.github/workflows/release-candidate.yml',
      'tests/launch/fixtures/golden-project/adv.config.json',
      'pnpm-lock.yaml',
      'tsconfig.json',
    ]) {
      expect(affectsDesktopPackage(path), path).toBe(true)
    }
    for (const path of ['docs/guide/editor/desktop.md', 'apps/studio/src/App.vue', 'README.md', '.github/workflows/docs.yml'])
      expect(affectsDesktopPackage(path), path).toBe(false)
  })

  it('compares the entire push range and the PR merge base, including deleted and renamed desktop files', async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), 'advjs-desktop-ci-'))
    const git = async (...args: string[]) => (await execFileAsync('git', args, { cwd })).stdout.trim()
    try {
      await git('init', '-b', 'main')
      await git('config', 'user.email', 'ci@example.test')
      await git('config', 'user.name', 'CI Test')
      await mkdir(resolve(cwd, 'apps/desktop'), { recursive: true })
      await writeFile(resolve(cwd, 'apps/desktop/package.json'), '{}\n')
      await git('add', '.')
      await git('commit', '-m', 'chore(desktop): initialize CI fixture')
      const initial = await git('rev-parse', 'HEAD')
      await expect(desktopPackagingChanged({ event: 'push', base: 'a'.repeat(40), head: initial, cwd })).resolves.toBe(true)
      await git('switch', '-c', 'feature')
      await git('mv', 'apps/desktop/package.json', 'old-desktop.json')
      await git('commit', '-m', 'refactor(desktop): move fixture manifest')
      const moved = await git('rev-parse', 'HEAD')
      await writeFile(resolve(cwd, 'README.md'), '# Documentation\n')
      await git('add', '.')
      await git('commit', '-m', 'docs: describe CI fixture')
      const head = await git('rev-parse', 'HEAD')
      await expect(desktopPackagingChanged({ event: 'push', base: initial, head, cwd })).resolves.toBe(true)
      await expect(desktopPackagingChanged({ event: 'push', base: moved, head, cwd })).resolves.toBe(false)

      await git('switch', 'main')
      await writeFile(resolve(cwd, 'apps/desktop/base-only.ts'), '// base branch only\n')
      await git('add', '.')
      await git('commit', '-m', 'feat(desktop): add base branch fixture')
      const base = await git('rev-parse', 'HEAD')
      await expect(desktopPackagingChanged({ event: 'pull_request', base, head, cwd })).resolves.toBe(true)
      await git('switch', '-c', 'docs-only', initial)
      await writeFile(resolve(cwd, 'README.md'), '# Docs only\n')
      await git('add', '.')
      await git('commit', '-m', 'docs: add documentation fixture')
      const docsHead = await git('rev-parse', 'HEAD')
      await expect(desktopPackagingChanged({ event: 'pull_request', base, head: docsHead, cwd })).resolves.toBe(false)
    }
    finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('keeps manual runs and initial branch pushes conservative', async () => {
    await expect(desktopPackagingChanged({ event: 'workflow_dispatch' })).resolves.toBe(true)
    await expect(desktopPackagingChanged({ event: 'push', base: '0'.repeat(40) })).resolves.toBe(true)
    await expect(desktopPackagingChanged({ event: 'pull_request', base: 'main', head: 'dev' })).rejects.toThrow('exact base and head')
  })

  it('keeps ordinary PR checks lightweight and runs the complete matrix only on manual dispatch', async () => {
    const ci = parse(await readFile(resolve(root, '.github/workflows/desktop.yml'), 'utf8'))
    expect(ci.on.pull_request.paths).toBeUndefined()
    expect(ci.jobs.build.steps.some((step: { run?: string }) => step.run === 'node apps/desktop/scripts/build.mjs')).toBe(true)
    expect(ci.jobs.build.steps.some((step: { run?: string }) => step.run?.includes('desktop:make'))).toBe(false)
    expect(ci.jobs['linux-package'].if).toBe('github.event_name != \'workflow_dispatch\' && needs.build.outputs.package == \'true\'')
    expect(JSON.parse(ci.jobs['linux-package'].with.targets)).toEqual([{ os: 'ubuntu-22.04', platform: 'linux', arch: 'x64' }])
    expect(ci.jobs['full-matrix'].if).toBe('github.event_name == \'workflow_dispatch\'')
    expect(ci.jobs['full-matrix'].with?.targets).toBeUndefined()
    expect(ci.permissions).toEqual({ contents: 'read' })
  })
})
