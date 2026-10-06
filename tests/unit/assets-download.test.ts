// @vitest-environment node

import type { AdvAssetManifest } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { normalizeAdvAssetManifest, planAdvAssetDownloads } from '@advjs/assets'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { join, resolve } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { manageAdvAssetCache } from '../../packages/advjs/node/commands/assets-download'
import cliOutputSchema from '../launch/contracts/cli-output.schema.json'

const roots: string[] = []
const servers: ReturnType<typeof createServer>[] = []
const preview = Buffer.from('lightweight preview')
const original = Buffer.from('authoring original')
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex')

async function project(split: boolean = false) {
  let requests = 0
  let damaged = false
  const server = createServer((request, response) => {
    requests++
    const data = damaged ? Buffer.from('corrupt') : request.url === '/original.png' ? original : preview
    response.end(data)
  })
  servers.push(server)
  await new Promise<void>(resolveReady => server.listen(0, '127.0.0.1', resolveReady))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing fixture port')
  const root = await mkdtemp(join(tmpdir(), 'adv-download-'))
  roots.push(root)
  await mkdir(join(root, 'adv/assets'), { recursive: true })
  await writeFile(join(root, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv' }))
  const manifest: AdvAssetManifest = {
    schemaVersion: 2,
    id: 'download-test',
    defaultProfile: 'local',
    profiles: { local: { provider: 'project', root: 'adv/assets' } },
    download: { source: { provider: 'http', baseUrl: `http://127.0.0.1:${address.port}/` } },
    assets: [{
      id: 'background',
      kind: 'background',
      type: 'image',
      path: 'preview.webp',
      objectKey: 'preview.webp',
      sha256: digest(preview),
      bytes: preview.length,
      variants: { original: { cachePath: '.advjs/originals/original.png', objectKey: 'original.png', sha256: digest(original), bytes: original.length } },
    }],
  }
  const save = async () => {
    if (split) {
      const { assets, ...base } = manifest
      await writeFile(join(root, 'adv/assets.json'), JSON.stringify({ ...base, includes: ['assets/backgrounds.json'] }))
      await writeFile(join(root, 'adv/assets/backgrounds.json'), JSON.stringify({ schemaVersion: 2, assets }))
    }
    else {
      await writeFile(join(root, 'adv/assets.json'), JSON.stringify(manifest))
    }
  }
  await save()
  return { root, manifest, save, requests: () => requests, damage: () => damaged = true }
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise<void>((resolveClosed, reject) => server.close(error => error ? reject(error) : resolveClosed()))
  }
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('native asset downloads', () => {
  it('normalizes download metadata, pulls split catalogs and reuses verified files offline', async () => {
    const fixture = await project(true)
    expect(normalizeAdvAssetManifest(fixture.manifest).download).toEqual(fixture.manifest.download)
    const before = await manageAdvAssetCache('status', { root: fixture.root, allVariants: true })
    expect(before.missing).toBe(2)
    const first = await manageAdvAssetCache('pull', { root: fixture.root })
    expect(first).toMatchObject({ downloaded: 1, verified: 1, missing: 0 })
    expect(fixture.requests()).toBe(1)
    await expect(readFile(join(fixture.root, '.advjs/originals/original.png'))).rejects.toMatchObject({ code: 'ENOENT' })
    await fixture.save()
    delete fixture.manifest.download
    await fixture.save()
    const offline = await manageAdvAssetCache('pull', { root: fixture.root })
    expect(offline.downloaded).toBe(0)
    expect(fixture.requests()).toBe(1)
    await expect(manageAdvAssetCache('verify', { root: fixture.root })).resolves.toMatchObject({ verified: 1 })
  })

  it('selects authoring originals explicitly without requiring or writing runtime previews', async () => {
    const fixture = await project()
    await expect(manageAdvAssetCache('pull', { root: fixture.root, variants: ['original'] })).resolves.toMatchObject({ downloaded: 1 })
    expect(await readFile(join(fixture.root, '.advjs/originals/original.png'))).toEqual(original)
    await expect(readFile(join(fixture.root, 'adv/assets/preview.webp'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(manageAdvAssetCache('verify', { root: fixture.root })).rejects.toThrow('missing')
    await expect(manageAdvAssetCache('verify', { root: fixture.root, variants: ['original'] })).resolves.toMatchObject({ verified: 1 })
  })

  it('reports corruption and refuses to overwrite it or download another missing file', async () => {
    const fixture = await project()
    await writeFile(join(fixture.root, 'adv/assets/preview.webp'), Buffer.alloc(preview.length))
    await expect(manageAdvAssetCache('status', { root: fixture.root, allVariants: true })).resolves.toMatchObject({ corrupt: 1, missing: 1 })
    await expect(manageAdvAssetCache('pull', { root: fixture.root, allVariants: true })).rejects.toThrow('corrupt')
    expect(fixture.requests()).toBe(0)
    expect(await readFile(join(fixture.root, 'adv/assets/preview.webp'))).toEqual(Buffer.alloc(preview.length))
  })

  it('rejects damaged responses and removes temporary files', async () => {
    const fixture = await project()
    fixture.damage()
    await expect(manageAdvAssetCache('pull', { root: fixture.root })).rejects.toThrow('checksum mismatch')
    expect(await readdir(join(fixture.root, 'adv/assets'))).toEqual([])
  })

  it('rejects escaping paths, unselected unsafe variants, duplicate caches and signed catalog URLs', async () => {
    const fixture = await project()
    fixture.manifest.assets[0].variants!.original.cachePath = '../outside.png'
    expect(() => planAdvAssetDownloads(fixture.manifest)).toThrow('Invalid asset download path')
    fixture.manifest.assets[0].variants!.original.cachePath = 'adv/assets/preview.webp'
    expect(() => planAdvAssetDownloads(fixture.manifest)).toThrow('Duplicate')
    fixture.manifest.assets[0].variants!.original.cachePath = '.advjs/originals/original.png'
    fixture.manifest.assets[0].objectKey = 'preview.webp?secret=token'
    expect(() => planAdvAssetDownloads(fixture.manifest)).toThrow('Invalid asset download path')
    fixture.manifest.assets[0].objectKey = 'preview.webp'
    fixture.manifest.download!.source = { provider: 'http', baseUrl: 'https://example.com/?secret=token' }
    expect(() => planAdvAssetDownloads(fixture.manifest)).toThrow('unsigned')
    expect(fixture.requests()).toBe(0)
  })

  it('refuses cache symlinks without writing outside the project', async () => {
    const fixture = await project()
    const outside = await mkdtemp(join(tmpdir(), 'adv-download-outside-'))
    roots.push(outside)
    await rm(join(fixture.root, 'adv/assets'), { recursive: true })
    await symlink(outside, join(fixture.root, 'adv/assets'), 'dir')
    await expect(manageAdvAssetCache('pull', { root: fixture.root })).rejects.toThrow(/sym(?:bolic )?link/u)
    expect(await readdir(outside)).toEqual([])
    expect(fixture.requests()).toBe(0)
  })

  it('does not expose signed URLs from download failures', async () => {
    const fixture = await project()
    await expect(manageAdvAssetCache('pull', {
      root: fixture.root,
      resolveUrl: async () => 'https://127.0.0.1:1/object?credential=private-token',
    })).rejects.toThrow(/^Cannot download asset: background \(default\)$/u)
  })

  it('preserves a conflicting file created during the download', async () => {
    const fixture = await project()
    const conflicting = Buffer.alloc(preview.length)
    await expect(manageAdvAssetCache('pull', {
      root: fixture.root,
      resolveUrl: async (item, source) => {
        await writeFile(join(fixture.root, item.path), conflicting)
        if (source.provider !== 'http')
          throw new Error('Unexpected provider')
        return new URL(item.objectKey!, source.baseUrl).href
      },
    })).rejects.toThrow('corrupt')
    expect(await readFile(join(fixture.root, 'adv/assets/preview.webp'))).toEqual(conflicting)
    expect(await readdir(join(fixture.root, 'adv/assets'))).toEqual(['preview.webp'])
  })

  it('keeps native CLI JSON output to one envelope, including validation failures', async () => {
    const fixture = await project()
    const tsx = fileURLToPath(import.meta.resolve('tsx/cli'))
    const entry = resolve(import.meta.dirname, '../../packages/advjs/node/cli/index.ts')
    const run = (args: string[]) => new Promise<{ stdout: string, code: number | null }>((resolveResult, reject) => {
      const child = spawn(process.execPath, [tsx, entry, 'assets', ...args, '--root', fixture.root, '--json'], {
        cwd: fixture.root,
        stdio: ['ignore', 'pipe', 'pipe'],
        signal: AbortSignal.timeout(15_000),
      })
      let stdout = ''
      child.stdout.on('data', chunk => stdout += chunk)
      child.stderr.resume()
      child.on('error', reject)
      child.on('close', code => resolveResult({ stdout, code }))
    })
    const success = await run(['pull'])
    expect(success.code, success.stdout).toBe(0)
    expect(success.stdout.trim().split('\n')).toHaveLength(1)
    expect(JSON.parse(success.stdout)).toMatchObject({ command: 'assets', ok: true, data: { downloaded: 1, verified: 1 } })
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    addFormats(ajv)
    ajv.addSchema(cliOutputSchema)
    const validate = ajv.getSchema(`${cliOutputSchema.$id}#/$defs/assetsSuccess`)!
    expect(validate(JSON.parse(success.stdout)), ajv.errorsText(validate.errors)).toBe(true)
    const failure = await run(['verify', '--variant', 'original'])
    expect(failure.code).toBe(1)
    expect(failure.stdout.trim().split('\n')).toHaveLength(1)
    expect(JSON.parse(failure.stdout)).toMatchObject({ command: 'assets', ok: false, errors: [{ code: 'ADV_VALIDATION' }] })
  }, 20_000)
})
