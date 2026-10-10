// @vitest-environment node

import { Buffer } from 'node:buffer'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as commandRunner from '../../../scripts/release/run-command.mjs'
import { createLaunchRegistry, readLaunchNpmDiagnostics, runLaunchCommand, shouldRemoveLaunchTemporaryRoot } from '../../launch/helpers/registry'

const temporaryRoots: string[] = []

async function createTemporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-registry-unit-'))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('launch command isolation', () => {
  it('does not restore removed workspace environment variables in child processes', async () => {
    const root = await createTemporaryRoot()
    vi.stubEnv('NODE_PATH', join(root, 'workspace-modules'))
    vi.stubEnv('PNPM_HOME', join(root, 'workspace-pnpm'))

    const result = await runLaunchCommand(process.execPath, [
      '-p',
      'JSON.stringify({ nodePath: process.env.NODE_PATH, pnpmHome: process.env.PNPM_HOME, registry: process.env.npm_config_registry })',
    ], root, 'http://127.0.0.1:12345', root)

    expect(JSON.parse(result.stdout)).toEqual({ registry: 'http://127.0.0.1:12345' })
  })

  it('includes fixture-local npm diagnostics without changing the failure budget', async () => {
    const root = await createTemporaryRoot()
    const logs = join(root, 'npm-cache', '_logs')
    await mkdir(logs, { recursive: true })
    await writeFile(join(logs, '2026-10-10T19_00_00_000Z-debug-0.log'), '10 timing reify Completed in 123ms\n')
    const failure = new Error('npx timed out')
    const npx = vi.spyOn(commandRunner, 'runNpx').mockRejectedValueOnce(failure)

    await expect(runLaunchCommand('npx', ['--version'], root, 'http://127.0.0.1:12345', root)).rejects.toThrow('10 timing reify Completed in 123ms')
    expect(npx).toHaveBeenCalledWith(['--version'], expect.objectContaining({
      env: expect.objectContaining({ npm_config_logs_dir: logs, npm_config_timing: 'true' }),
      extendEnv: false,
      timeout: 300_000,
    }))
    expect(npx.mock.calls[0]?.[1].env.pnpm_config_store_dir).toBeUndefined()
  })

  it('preserves the original failure when npm did not produce a debug log', async () => {
    const root = await createTemporaryRoot()
    const failure = new Error('npx could not start')
    vi.spyOn(commandRunner, 'runNpx').mockRejectedValueOnce(failure)

    await expect(runLaunchCommand('npx', ['--version'], root, 'http://127.0.0.1:12345', root)).rejects.toBe(failure)
  })
})

describe('launch npm diagnostics', () => {
  it('reads only the latest debug log with bounded bytes and lines', async () => {
    const root = await createTemporaryRoot()
    const logs = join(root, 'npm-cache', '_logs')
    await mkdir(logs, { recursive: true })
    await writeFile(join(logs, '2026-10-10T18_00_00_000Z-debug-0.log'), 'older invocation')
    await writeFile(join(logs, '2026-10-10T20_00_00_000Z-timing.json'), 'not a debug log')
    await writeFile(join(logs, '2026-10-10T19_00_00_000Z-debug-0.log'), `first entry\n${Array.from({ length: 300 }, (_, index) => `${index} timing ${'x'.repeat(200)}`).join('\n')}\nfinal entry\n`)

    const diagnostics = await readLaunchNpmDiagnostics(root)

    expect(diagnostics).toContain('2026-10-10T19_00_00_000Z-debug-0.log')
    expect(diagnostics).toContain('final entry')
    expect(diagnostics).not.toContain('first entry')
    expect(diagnostics).not.toContain('older invocation')
    expect(diagnostics).not.toContain('not a debug log')
    expect(diagnostics.split('\n').length).toBeLessThanOrEqual(101)
    expect(Buffer.byteLength(diagnostics)).toBeLessThan(17 * 1024)
  })

  it('returns no diagnostics when the fixture cache does not exist', async () => {
    const root = await createTemporaryRoot()
    await expect(readLaunchNpmDiagnostics(root)).resolves.toBe('')
  })
})

describe('launch registry lifecycle', () => {
  it('leaves large package-manager caches to ephemeral Windows runners', () => {
    expect(shouldRemoveLaunchTemporaryRoot('win32', 'true')).toBe(false)
    expect(shouldRemoveLaunchTemporaryRoot('win32', '1')).toBe(false)
    expect(shouldRemoveLaunchTemporaryRoot('win32', '')).toBe(true)
    expect(shouldRemoveLaunchTemporaryRoot('darwin', 'true')).toBe(true)
  })

  it('closes without waiting for incomplete client connections', async () => {
    const registry = await createLaunchRegistry({ packages: [] }, '.')
    const registryUrl = new URL(registry.url)
    const socket = createConnection({
      host: registryUrl.hostname,
      port: Number(registryUrl.port),
    })

    await once(socket, 'connect')
    socket.on('error', () => {})
    const socketClosed = new Promise<void>(resolveClose => socket.once('close', () => resolveClose()))
    socket.write('GET /incomplete HTTP/1.1\r\nHost: registry.local\r\n')

    await expect(registry.close()).resolves.toBeUndefined()
    await socketClosed
    expect(socket.destroyed).toBe(true)
  }, 5_000)
})
