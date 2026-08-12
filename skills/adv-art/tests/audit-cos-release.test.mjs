import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'vitest'
import { auditCosRelease } from '../scripts/audit-cos-release.mjs'

it('audits a content-hashed object followed by its stable manifest', async () => {
  const releaseRoot = await mkdtemp(join(tmpdir(), 'adv-cos-release-'))
  const image = Buffer.from('image')
  const manifest = Buffer.from('{"schemaVersion":1}\n')
  const imageSha = createHash('sha256').update(image).digest('hex')
  const manifestSha = createHash('sha256').update(manifest).digest('hex')
  const imageKey = `games/example/v1/backgrounds/room.${imageSha.slice(0, 12)}.webp`
  const manifestKey = 'games/example/v1/manifests/assets.json'

  await mkdir(join(releaseRoot, 'games/example/v1/backgrounds'), { recursive: true })
  await mkdir(join(releaseRoot, 'games/example/v1/manifests'), { recursive: true })
  await writeFile(join(releaseRoot, imageKey), image)
  await writeFile(join(releaseRoot, manifestKey), manifest)

  const plan = {
    schemaVersion: 2,
    provider: 'tencent-cos',
    objectPrefix: 'games/example/v1/',
    policy: { cors: { allowedMethods: ['GET', 'HEAD'] } },
    objects: [
      {
        id: 'background/room',
        role: 'asset',
        objectKey: imageKey,
        file: imageKey,
        bytes: image.length,
        sha256: imageSha,
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-cos-meta-sha256': imageSha,
        },
      },
      {
        id: 'manifest/assets',
        role: 'manifest',
        objectKey: manifestKey,
        file: manifestKey,
        bytes: manifest.length,
        sha256: manifestSha,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=60, must-revalidate',
          'x-cos-meta-sha256': manifestSha,
        },
      },
    ],
  }

  assert.deepEqual(await auditCosRelease(plan, releaseRoot), {
    objectCount: 2,
    errors: [],
  })
})
