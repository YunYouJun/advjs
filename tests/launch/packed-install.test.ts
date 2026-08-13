// @vitest-environment node

import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createPackageManifest,
  LAUNCH_VERSION,
  PACKAGE_SPECS,
  validateWorkspacePackageGraph,
} from '../../scripts/release/package-manifest.mjs'
import { createLaunchRegistry, runLaunchCommand } from './helpers/registry'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const pnpmExecutable = 'pnpm'
const npxExecutable = 'npx'

let temporaryRoot = ''
let packageDirectory = ''
let installDirectory = ''
let manifest: Awaited<ReturnType<typeof createPackageManifest>>
let registry: Awaited<ReturnType<typeof createLaunchRegistry>>

function cleanEnvironment(registryUrl: string) {
  const environment = {
    ...process.env,
    CI: '1',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_registry: registryUrl,
    npm_config_update_notifier: 'false',
    npm_config_cache: temporaryRoot ? join(temporaryRoot, 'npm-cache') : undefined,
    pnpm_config_store_dir: temporaryRoot ? join(temporaryRoot, 'pnpm-store') : undefined,
  }
  delete environment.NODE_PATH
  delete environment.PNPM_HOME
  return environment
}

async function run(command: string, args: string[], cwd: string) {
  return await runLaunchCommand(command, args, cwd, registry.url, temporaryRoot)
}

async function waitForJsonLine(stream: NodeJS.ReadableStream, event: string) {
  return await new Promise<any>((resolveLine, reject) => {
    let buffer = ''
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 15_000)
    stream.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        try {
          const value = JSON.parse(line)
          if (value.event === event) {
            clearTimeout(timeout)
            resolveLine(value)
          }
        }
        catch {}
      }
    })
  })
}

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-packed-install-'))
  packageDirectory = join(temporaryRoot, 'packages')
  installDirectory = join(temporaryRoot, 'install')
  await Promise.all([mkdir(packageDirectory), mkdir(installDirectory)])
  manifest = await createPackageManifest({
    build: process.env.ADVJS_PACKED_INSTALL_SKIP_BUILD !== '1',
    outputDirectory: packageDirectory,
    root: repositoryRoot,
  })
  registry = await createLaunchRegistry(manifest, packageDirectory)
}, 300_000)

afterAll(async () => {
  await registry?.close()
  if (temporaryRoot)
    await rm(temporaryRoot, { force: true, maxRetries: 5, recursive: true, retryDelay: 200 })
}, 60_000)

describe('launch package manifest', () => {
  it('defines a complete, consistently versioned public package graph', async () => {
    expect(LAUNCH_VERSION).toBe('0.1.2')
    expect(PACKAGE_SPECS.map(spec => spec.name)).toEqual([
      '@advjs/types',
      '@advjs/unocss',
      '@advjs/parser',
      '@advjs/core',
      '@advjs/devtools',
      '@advjs/client',
      '@advjs/gui',
      '@advjs/theme-default',
      '@advjs/editor',
      'advjs',
      '@advjs/mcp-server',
    ])

    const graph = await validateWorkspacePackageGraph(repositoryRoot)
    expect(graph.packages).toHaveLength(PACKAGE_SPECS.length)
    expect(graph.packages.every(pkg => pkg.version === LAUNCH_VERSION)).toBe(true)
    expect(graph.packages.every(pkg => pkg.publishConfig?.access === 'public')).toBe(true)
    expect(graph.entries).toEqual(['advjs', '@advjs/editor', '@advjs/mcp-server'])
  })

  it('publishes a deterministic standalone Editor UI entry', async () => {
    const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'editor/core/package.json'), 'utf8'))

    expect(packageJson.private).not.toBe(true)
    expect(packageJson.bin?.['adv-editor']).toBe('./bin/adv-editor.mjs')
    expect(packageJson.files).toContain('dist')
    expect(packageJson.advjsEditor?.artifacts?.packagePublicDirectory).toBe('dist')
    expect(packageJson.advjsEditor?.artifacts?.packageServerEntry).toBe('bin/adv-editor.mjs')
    expect(packageJson.scripts.postinstall).toBeUndefined()
  })

  it('resolves npx exclusively through the isolated registry', async () => {
    const before = registry.localRequests.length
    const npx = await run(npxExecutable, ['--yes', `advjs@${LAUNCH_VERSION}`, '--version'], temporaryRoot)
    expect(npx.stdout.trim()).toBe(LAUNCH_VERSION)

    const requests = registry.localRequests.slice(before)
    expect(requests).toContain('advjs')
    expect(requests.some(request => request.includes('advjs-0.1.2.tgz'))).toBe(true)
  }, 240_000)

  it('resolves pnpm dlx exclusively through the isolated registry', async () => {
    const before = registry.localRequests.length
    const pnpm = await run(pnpmExecutable, ['dlx', `advjs@${LAUNCH_VERSION}`, '--version'], temporaryRoot)
    expect(pnpm.stdout.trim()).toBe(LAUNCH_VERSION)

    const requests = registry.localRequests.slice(before)
    expect(requests).toContain('advjs')
    expect(requests.some(request => request.includes('advjs-0.1.2.tgz'))).toBe(true)
  }, 240_000)

  it('installs and starts the Editor artifact and MCP server from registry packages', async () => {
    await writeFile(join(installDirectory, 'package.json'), `${JSON.stringify({ name: 'advjs-install-smoke', private: true }, null, 2)}\n`)
    await run(pnpmExecutable, [
      `--registry=${registry.url}`,
      'add',
      `@advjs/editor@${LAUNCH_VERSION}`,
      `@advjs/mcp-server@${LAUNCH_VERSION}`,
    ], installDirectory)

    const editorBin = join(installDirectory, 'node_modules/@advjs/editor/bin/adv-editor.mjs')
    const editor = spawn(process.execPath, [editorBin, '--host', '127.0.0.1', '--port', '0', '--json'], {
      cwd: installDirectory,
      env: cleanEnvironment(registry.url),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      const ready = await waitForJsonLine(editor.stdout, 'ready')
      const response = await fetch(ready.url)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('id="__nuxt"')
    }
    finally {
      editor.kill('SIGTERM')
      await new Promise(resolveExit => editor.once('exit', resolveExit))
    }

    const projectRoot = join(temporaryRoot, 'mcp-project')
    await mkdir(projectRoot)
    await writeFile(join(projectRoot, 'adv.config.json'), '{"root":"./adv"}\n')
    const mcpBin = join(installDirectory, 'node_modules/@advjs/mcp-server/bin/mcp-server.mjs')
    const transport = new StdioClientTransport({
      args: [mcpBin],
      command: process.execPath,
      cwd: projectRoot,
      env: cleanEnvironment(registry.url),
      stderr: 'pipe',
    })
    const client = new Client({ name: 'packed-install-smoke', version: '1.0.0' })
    try {
      await client.connect(transport)
      const resources = await client.listResources()
      expect(resources.resources.some(resource => resource.uri === 'adv://project/compiled')).toBe(true)
    }
    finally {
      await client.close()
    }
  }, 240_000)
})
