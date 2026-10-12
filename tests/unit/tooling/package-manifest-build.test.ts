// @vitest-environment node

import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import { buildLaunchPackages, createPackageManifest, inspectPackedTarball, LAUNCH_VERSION, PACKAGE_SPECS } from '../../../scripts/release/package-manifest.mjs'

const root = resolve(import.meta.dirname, '../../..')

function packageArchive(files: Record<string, string>) {
  const records = Object.entries(files).flatMap(([name, content]) => {
    const body = Buffer.from(content)
    const header = Buffer.alloc(512)
    header.write(`package/${name}`)
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124)
    header.write('0', 156)
    header.fill(32, 148, 156)
    const checksum = header.reduce((sum, byte) => sum + byte, 0)
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148)
    return [header, body, Buffer.alloc((512 - body.length % 512) % 512)]
  })
  return gzipSync(Buffer.concat([...records, Buffer.alloc(1024)]))
}

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
      'packages/audio',
      'packages/assets',
      'packages/unocss',
      'packages/parser',
      'packages/core',
      'packages/devtools',
      'packages/gui',
      'packages/advjs',
      'packages/mcp-server',
      'packages/create-adv',
      'editor/core',
    ])
    expect(new Set(builtPaths).size).toBe(PACKAGE_SPECS.filter(spec => spec.build).length)

    const manifest = await createPackageManifest({ pack: false, root })
    const editor = manifest.packages.find(pkg => pkg.name === '@advjs/editor')!
    const cli = manifest.packages.find(pkg => pkg.name === 'advjs')!
    expect(editor.publishOrder).toBeLessThan(cli.publishOrder)
    expect(cli.dependencies).toHaveProperty('@advjs/editor')
  })

  it('includes the scaffolder in the release that supplies its generated projects', async () => {
    const manifest = await createPackageManifest({ pack: false, root })
    const scaffolder = manifest.packages.find(pkg => pkg.name === 'create-adv')
    const engine = manifest.packages.find(pkg => pkg.name === 'advjs')!

    expect(scaffolder).toMatchObject({ path: 'packages/create-adv', version: LAUNCH_VERSION })
    expect(scaffolder!.version).toBe(engine.version)
    expect(scaffolder!.publishOrder).toBeGreaterThan(engine.publishOrder)
  })

  it.each(['dist/index.mjs', 'templates/template-adv/package.json', 'templates/template-plugin/package.json'])(
    'rejects a scaffolder release missing %s',
    (missing) => {
      const spec = PACKAGE_SPECS.find(pkg => pkg.name === 'create-adv')!
      const files = Object.fromEntries(spec.requiredFiles.map(file => [file, '']))
      files['package.json'] = JSON.stringify({ name: 'create-adv', version: LAUNCH_VERSION })
      delete files[missing]

      expect(() => inspectPackedTarball(packageArchive(files), spec)).toThrow(`create-adv tarball is missing required file ${missing}`)
    },
  )

  it('stops before building the Editor if a runtime prerequisite fails', async () => {
    const runner = vi.fn(async (_cwd: string, args: string[]) => {
      if (args[1] === 'packages/advjs')
        throw new Error('CLI build failed')
    })

    await expect(buildLaunchPackages(root, { runner })).rejects.toThrow('CLI build failed')
    expect(runner.mock.calls.some(([, args]) => args[1] === 'editor/core')).toBe(false)
  })
})
