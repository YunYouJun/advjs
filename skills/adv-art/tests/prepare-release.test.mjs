import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'vitest'

import { prepareRelease, readWebpDimensions } from '../scripts/prepare-release.mjs'

function makeVp8x(width, height) {
  const bytes = Buffer.alloc(30)
  bytes.write('RIFF', 0, 'ascii')
  bytes.writeUInt32LE(22, 4)
  bytes.write('WEBP', 8, 'ascii')
  bytes.write('VP8X', 12, 'ascii')
  bytes.writeUInt32LE(10, 16)
  bytes.writeUIntLE(width - 1, 24, 3)
  bytes.writeUIntLE(height - 1, 27, 3)
  return bytes
}

it('readWebpDimensions reads a VP8X canvas', () => {
  assert.deepEqual(readWebpDimensions(makeVp8x(1024, 1536)), {
    height: 1536,
    width: 1024,
  })
})

it('prepareRelease creates hashed objects and a complete manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adv-art-release-'))
  const adaptationPath = join(root, 'adaptation.json')
  const assetRoot = join(root, 'art')
  const releaseRoot = join(root, 'release')
  const manifestPath = join(root, 'assets.json')

  await writeFile(adaptationPath, JSON.stringify({
    characters: [{
      id: 'hero',
      needsTachie: true,
      requiredExpressions: ['default'],
    }],
    scenes: [{
      id: 'room',
      needsBackground: true,
    }],
  }))

  await writeFile(join(root, 'character.webp'), makeVp8x(1024, 1536))
  await writeFile(join(root, 'background.webp'), makeVp8x(1536, 1024))

  await mkdir(join(assetRoot, 'characters/hero/standing'), { recursive: true })
  await mkdir(join(assetRoot, 'backgrounds'), { recursive: true })
  await copyFile(join(root, 'character.webp'), join(assetRoot, 'characters/hero/standing/default.webp'))
  await copyFile(join(root, 'background.webp'), join(assetRoot, 'backgrounds/room.webp'))

  const manifest = await prepareRelease({
    adaptationPath,
    assetRoot,
    catalogId: 'hamster',
    createdAt: '2026-07-17',
    license: 'CC BY-NC-SA 4.0',
    manifestPath,
    model: 'imagegen-built-in',
    objectPrefix: 'games/hamster/v1/',
    promptVersion: 'hamster-art-bible-v1',
    publicBaseUrl: 'https://cos.advjs.yunle.fun/',
    releaseRoot,
  })

  assert.equal(manifest.schemaVersion, 2)
  assert.equal(manifest.id, 'hamster')
  assert.equal(manifest.defaultProfile, 'production')
  assert.deepEqual(manifest.profiles.production, {
    provider: 'http',
    baseUrl: 'https://cos.advjs.yunle.fun/',
  })
  assert.deepEqual(manifest.bundles.map(bundle => bundle.id), ['characters', 'backgrounds', 'cg', 'audio'])
  assert.equal(manifest.assets.length, 2)
  assert.equal(manifest.manifestObjectKey, 'games/hamster/v1/manifests/assets.json')
  assert.deepEqual(manifest.characters, [{
    id: 'hero',
    requiredExpressions: ['default'],
  }])

  const [character, background] = manifest.assets
  assert.match(character.objectKey, /^games\/hamster\/v1\/characters\/hero\/standing\/default\.[0-9a-f]{12}\.webp$/u)
  assert.match(background.objectKey, /^games\/hamster\/v1\/backgrounds\/room\.[0-9a-f]{12}\.webp$/u)
  assert.equal(character.type, 'image')
  assert.equal(character.bundle, 'characters')
  assert.equal(character.url, undefined)
  assert.deepEqual({ height: character.height, width: character.width }, { height: 1536, width: 1024 })
  assert.deepEqual({ height: background.height, width: background.width }, { height: 1024, width: 1536 })

  assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), manifest)
  assert.deepEqual(await readFile(join(releaseRoot, character.objectKey)), makeVp8x(1024, 1536))
  assert.deepEqual(await readFile(join(releaseRoot, background.objectKey)), makeVp8x(1536, 1024))
  assert.deepEqual(
    JSON.parse(await readFile(join(releaseRoot, manifest.manifestObjectKey), 'utf8')),
    manifest,
  )

  const plan = JSON.parse(await readFile(join(root, 'cos-release.json'), 'utf8'))
  assert.equal(plan.schemaVersion, 2)
  assert.equal(plan.provider, 'tencent-cos')
  assert.equal(plan.objects.length, 3)
  assert.deepEqual(plan.objects.map(item => item.role), ['asset', 'asset', 'manifest'])
  assert.equal(plan.objects[0].headers['Content-Type'], 'image/webp')
  assert.equal(plan.objects[0].headers['Cache-Control'], 'public, max-age=31536000, immutable')
  assert.equal(plan.objects.at(-1).objectKey, 'games/hamster/v1/manifests/assets.json')
  assert.equal(plan.objects.at(-1).headers['Cache-Control'], 'public, max-age=60, must-revalidate')
})
