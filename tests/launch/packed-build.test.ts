// @vitest-environment node

import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPackageManifest } from '../../scripts/release/package-manifest.mjs'
import { runPnpm as executePnpm, runCommand } from '../../scripts/release/run-command.mjs'

const repositoryRoot = resolve(import.meta.dirname, '../..')

const packedBuildPackages = new Set([
  '@advjs/types',
  '@advjs/unocss',
  '@advjs/parser',
  '@advjs/core',
  '@advjs/devtools',
  '@advjs/client',
  '@advjs/theme-default',
  '@advjs/editor',
  'advjs',
])

const launchPackageManifests = [
  'packages/advjs/package.json',
  'packages/client/package.json',
  'packages/core/package.json',
  'packages/devtools/package.json',
  'packages/gui/package.json',
  'packages/mcp-server/package.json',
  'packages/parser/package.json',
  'packages/types/package.json',
  'packages/unocss/package.json',
  'themes/theme-default/package.json',
  'editor/core/package.json',
] as const

interface CommandResult {
  stderr: string
  stdout: string
}

let temporaryRoot = ''
let installRoot = ''
let advBin = ''

function cleanEnvironment() {
  const environment = { ...process.env }
  delete environment.NODE_PATH
  delete environment.PNPM_HOME
  return environment
}

async function runPnpm(args: readonly string[], cwd: string): Promise<CommandResult> {
  try {
    return await executePnpm([...args], {
      cwd,
      env: cleanEnvironment(),
      maxBuffer: 20 * 1024 * 1024,
    })
  }
  catch (error) {
    const failure = error as Error & { stderr?: string, stdout?: string }
    throw new Error(`pnpm ${args.join(' ')} failed\nstdout:\n${failure.stdout || ''}\nstderr:\n${failure.stderr || ''}`, { cause: error })
  }
}

async function runAdv(args: readonly string[], cwd: string): Promise<CommandResult> {
  return await runCommand(process.execPath, [advBin, ...args], {
    cwd,
    env: cleanEnvironment(),
    maxBuffer: 20 * 1024 * 1024,
  })
}

function contentType(file: string) {
  if (file.endsWith('.css'))
    return 'text/css; charset=utf-8'
  if (file.endsWith('.html'))
    return 'text/html; charset=utf-8'
  if (file.endsWith('.js'))
    return 'text/javascript; charset=utf-8'
  return 'application/octet-stream'
}

async function verifyStaticBuild(distDirectory: string) {
  const indexHtml = await readFile(join(distDirectory, 'index.html'), 'utf8')
  const redirects = await readFile(join(distDirectory, '_redirects'), 'utf8')
  expect(redirects).toMatch(/\*\s+\/index\.html\s+200/u)

  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
      const requestedFile = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
      const requestedPath = resolve(distDirectory, requestedFile)
      const isInsideDist = relative(distDirectory, requestedPath).split(/[\\/]/u)[0] !== '..'
      const file = isInsideDist && (await stat(requestedPath).catch(() => undefined))?.isFile()
        ? requestedPath
        : join(distDirectory, 'index.html')
      response.statusCode = 200
      response.setHeader('content-type', contentType(file))
      response.end(await readFile(file))
    }
    catch (error) {
      response.statusCode = 500
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })

  try {
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Static build server did not expose a TCP port')
    const baseUrl = `http://127.0.0.1:${address.port}`

    const entryResponse = await fetch(baseUrl)
    expect(entryResponse.status).toBe(200)
    expect(await entryResponse.text()).toBe(indexHtml)

    const assetUrls = Array.from(indexHtml.matchAll(/(?:href|src)="([^"#?]+\.(?:css|js))(?:\?[^"#]*)?"/gu), match => match[1])
    expect(assetUrls.some(url => extname(url) === '.js')).toBe(true)
    expect(assetUrls.some(url => extname(url) === '.css')).toBe(true)
    for (const assetUrl of assetUrls) {
      const assetResponse = await fetch(new URL(assetUrl, baseUrl))
      expect(assetResponse.status, assetUrl).toBe(200)
      expect((await assetResponse.arrayBuffer()).byteLength, assetUrl).toBeGreaterThan(0)
    }

    const fallbackResponse = await fetch(`${baseUrl}/launch-test/deep-link`)
    expect(fallbackResponse.status).toBe(200)
    expect(await fallbackResponse.text()).toBe(indexHtml)
  }
  finally {
    await new Promise<void>((resolveClose, reject) => {
      server.close(error => error ? reject(error) : resolveClose())
    })
  }
}

describe('launch package runtimes', () => {
  it('supports Node 22 and 24 without claiming Node 20 support', async () => {
    for (const manifestPath of launchPackageManifests) {
      const manifest = JSON.parse(await readFile(resolve(repositoryRoot, manifestPath), 'utf8'))
      expect(manifest.engines?.node, manifest.name).toBe('^22.12.0 || ^24.0.0')
    }
  })
})

describe('packed advjs build', () => {
  beforeAll(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-packed-build-'))
    installRoot = join(temporaryRoot, 'install')
    const packDirectory = join(temporaryRoot, 'packs')
    await Promise.all([
      writeFile(join(temporaryRoot, '.external-workspace'), 'outside the repository\n', 'utf8'),
      Promise.all([
        mkdir(installRoot, { recursive: true }),
        mkdir(packDirectory, { recursive: true }),
      ]),
    ])

    expect(isAbsolute(temporaryRoot)).toBe(true)
    const relativeTemporaryRoot = relative(repositoryRoot, temporaryRoot)
    expect(isAbsolute(relativeTemporaryRoot) || relativeTemporaryRoot.split(/[\\/]/u)[0] === '..').toBe(true)

    const manifest = await createPackageManifest({
      outputDirectory: packDirectory,
      root: repositoryRoot,
    })
    const tarballs: Record<string, string> = {}
    for (const item of manifest.packages) {
      if (!packedBuildPackages.has(item.name))
        continue
      if (!item.tarball)
        throw new Error(`${item.name} has no packed tarball`)
      tarballs[item.name] = join(packDirectory, item.tarball)
    }

    const dependencies = Object.fromEntries(Object.entries(tarballs).map(([name, tarball]) => [name, `file:${tarball}`]))
    await writeFile(join(installRoot, 'package.json'), `${JSON.stringify({
      name: 'advjs-packed-build-test',
      private: true,
      type: 'module',
      dependencies,
      pnpm: { overrides: dependencies },
    }, null, 2)}\n`, 'utf8')
    await runPnpm(['install', '--no-frozen-lockfile'], installRoot)

    const [canonicalInstallRoot, installedStore] = await Promise.all([
      realpath(installRoot),
      realpath(join(installRoot, 'node_modules/.pnpm')),
    ])
    expect(relative(canonicalInstallRoot, installedStore)).not.toMatch(/^\.\./u)
    advBin = join(installRoot, 'node_modules/advjs/bin/adv.mjs')
    expect((await stat(advBin)).isFile()).toBe(true)
  }, 600_000)

  afterAll(async () => {
    if (temporaryRoot)
      await rm(temporaryRoot, { force: true, recursive: true })
  }, 120_000)

  for (const template of ['default', 'galgame'] as const) {
    it(`builds and serves the ${template} template from installed tarballs`, async () => {
      const projectRoot = join(temporaryRoot, `project-${template}`)
      await runAdv(['init', projectRoot, '--template', template, '--name', `packed-${template}`], installRoot)
      await runAdv(['check'], projectRoot)
      await runAdv(['build'], projectRoot)
      await verifyStaticBuild(join(projectRoot, 'dist'))
    }, 120_000)
  }
})
