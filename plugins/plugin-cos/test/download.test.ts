// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CosStorage, createCosDownloadResolver } from '../src'

const roots: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('cOS download authorization', () => {
  it('signs an exact object key with explicit credentials without network calls', () => {
    const storage = new CosStorage({ secretId: 'fixture-id', secretKey: 'fixture-key', bucket: 'fixture-1234567890', region: 'ap-shanghai', prefix: '' })
    const url = new URL(storage.getDownloadUrl('private/reference.webp'))
    expect(url.protocol).toBe('https:')
    expect(url.pathname).toBe('/private/reference.webp')
    expect(url.search).toContain('q-signature=')
  })

  it('supports an explicitly configured external signer and sanitizes its failures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'adv-cos-signer-'))
    roots.push(root)
    const signer = join(root, 'signer.mjs')
    vi.stubEnv('ADV_COS_SIGNER', signer)
    await writeFile(signer, 'process.stdout.write(JSON.stringify({success: true, url: "https://example.com/object?temporary=secret"}))')
    const authorize = createCosDownloadResolver({ bucket: 'fixture-1234567890', region: 'ap-shanghai' })
    await expect(authorize('private/reference.webp')).resolves.toContain('temporary=secret')
    await writeFile(signer, 'process.stderr.write("private credential"); process.exit(1)')
    await expect(authorize('private/reference.webp')).rejects.toThrow(/^Cannot authorize COS download; check ADV_COS_SIGNER configuration$/u)
    await expect(authorize('../escape')).rejects.toThrow('invalid path segment')
    expect(process.env.ADV_COS_SIGNER).toBe(signer)
  })
})
