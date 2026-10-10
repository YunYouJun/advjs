// @vitest-environment node

import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildLaunchPackages, createPackageManifest, PACKAGE_SPECS } from '../../../scripts/release/package-manifest.mjs'

const root = resolve(import.meta.dirname, '../../..')

describe('launch package build order', () => {
  it('builds the CLI runtime before the Editor exactly once while preserving publish order', async () => {
    const builtPaths: string[] = []
    const runner = vi.fn(async (cwd: string, args: string[], options: Record<string, unknown>) => {
      expect(cwd).toBe(root)
      expect(args[0]).toBe('-C')
      expect(args[2]).toBe('build')
      expect(options).toEqual({ forwardOutput: true })
      if (args[1] === 'editor/core')
        expect(builtPaths).toContain('packages/advjs')
      builtPaths.push(args[1])
    })

    await buildLaunchPackages(root, { runner })

    expect(builtPaths).toEqual([
      'packages/types',
      'packages/assets',
      'packages/unocss',
      'packages/parser',
      'packages/core',
      'packages/devtools',
      'packages/gui',
      'packages/advjs',
      'packages/mcp-server',
      'editor/core',
    ])
    expect(new Set(builtPaths).size).toBe(PACKAGE_SPECS.filter(spec => spec.build).length)

    const manifest = await createPackageManifest({ pack: false, root })
    const editor = manifest.packages.find(pkg => pkg.name === '@advjs/editor')!
    const cli = manifest.packages.find(pkg => pkg.name === 'advjs')!
    expect(editor.publishOrder).toBeLessThan(cli.publishOrder)
    expect(cli.dependencies).toHaveProperty('@advjs/editor')
  })

  it('stops before building the Editor if a runtime prerequisite fails', async () => {
    const runner = vi.fn(async (_cwd: string, args: string[]) => {
      if (args[1] === 'packages/advjs')
        throw new Error('CLI build failed')
    })

    await expect(buildLaunchPackages(root, { runner })).rejects.toThrow('CLI build failed')
    expect(runner.mock.calls.some(([, args]) => args[1] === 'editor/core')).toBe(false)
  })
})
