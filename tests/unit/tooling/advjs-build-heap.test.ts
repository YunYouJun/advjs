// @vitest-environment node

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { buildNodeOptions, finishBuild, runBuild } from '../../../packages/advjs/scripts/build.mjs'

describe('advjs build process', () => {
  it('defaults only this package build to a 6 GB heap while preserving unrelated Node options', () => {
    expect(buildNodeOptions()).toBe('--max-old-space-size=6144')
    expect(buildNodeOptions('--trace-warnings')).toBe('--trace-warnings --max-old-space-size=6144')
    const pkg = JSON.parse(readFileSync(new URL('../../../packages/advjs/package.json', import.meta.url), 'utf8'))
    expect(pkg.scripts.build).toBe('node scripts/build.mjs && node scripts/prepare-skills.mjs')
  })

  it.each([
    '--max-old-space-size=4096',
    '--trace-warnings --max-old-space-size 3072',
    '--max_old_space_size=2048',
    '--max-old-space-size-percentage=60',
    '--max_old_space_size_percentage 75',
    '"--max-old-space-size=1024"',
  ])('preserves an explicit NODE_OPTIONS heap setting: %s', (options) => {
    expect(buildNodeOptions(options)).toBe(options)
  })

  it('preserves explicit Node CLI heap flags, build arguments and the rest of the environment', () => {
    const runner = vi.fn().mockReturnValue({ status: 7, signal: null })
    const result = runBuild({
      args: ['--stub', '--config', 'custom config.ts'],
      execArgv: ['--max-old-space-size=3072'],
      env: { NODE_OPTIONS: '--trace-warnings', CI: '1', PATH: '/example' },
      runner,
    })
    expect(runner).toHaveBeenCalledWith(process.execPath, [
      '--max-old-space-size=3072',
      expect.stringMatching(/[/\\]unbuild[/\\]dist[/\\]cli\.mjs$/u),
      '--stub',
      '--config',
      'custom config.ts',
    ], {
      env: { NODE_OPTIONS: '--trace-warnings', CI: '1', PATH: '/example' },
      stdio: 'inherit',
      windowsHide: true,
    })
    expect(result.status).toBe(7)
  })

  it('propagates spawn failures, exit statuses and signals without masking failure', () => {
    const error = new Error('spawn failed')
    expect(() => runBuild({ runner: () => ({ error }) })).toThrow(error)
    const host = { pid: 123, kill: vi.fn(), exitCode: undefined as number | undefined }
    finishBuild({ status: 7, signal: null }, host)
    expect(host.exitCode).toBe(7)
    finishBuild({ status: null, signal: null }, host)
    expect(host.exitCode).toBe(1)
    finishBuild({ status: null, signal: 'SIGTERM' }, host)
    expect(host.kill).toHaveBeenCalledExactlyOnceWith(123, 'SIGTERM')
  })
})
