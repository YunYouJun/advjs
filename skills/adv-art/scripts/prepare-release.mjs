#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

function assertWebp(buffer) {
  if (buffer.length < 20
    || buffer.toString('ascii', 0, 4) !== 'RIFF'
    || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('asset is not a RIFF WebP image')
  }
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
}

export function readWebpDimensions(buffer) {
  assertWebp(buffer)

  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const dataOffset = offset + 8

    if (chunkType === 'VP8X' && chunkSize >= 10 && dataOffset + 10 <= buffer.length) {
      return {
        height: readUint24LE(buffer, dataOffset + 7) + 1,
        width: readUint24LE(buffer, dataOffset + 4) + 1,
      }
    }

    if (chunkType === 'VP8 ' && chunkSize >= 10 && dataOffset + 10 <= buffer.length) {
      if (buffer[dataOffset + 3] !== 0x9D || buffer[dataOffset + 4] !== 0x01 || buffer[dataOffset + 5] !== 0x2A)
        throw new Error('VP8 frame header is malformed')
      return {
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3FFF,
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3FFF,
      }
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && dataOffset + 5 <= buffer.length) {
      if (buffer[dataOffset] !== 0x2F)
        throw new Error('VP8L frame header is malformed')
      const bits = buffer.readUInt32LE(dataOffset + 1)
      return {
        height: ((bits >> 14) & 0x3FFF) + 1,
        width: (bits & 0x3FFF) + 1,
      }
    }

    offset = dataOffset + chunkSize + (chunkSize % 2)
  }

  throw new Error('WebP dimensions could not be determined')
}

function validateUrlConfig(publicBaseUrl, objectPrefix) {
  const base = new URL(publicBaseUrl)
  if (!base.pathname.endsWith('/'))
    throw new Error('publicBaseUrl must end with /')
  if (objectPrefix.startsWith('/') || !objectPrefix.endsWith('/'))
    throw new Error('objectPrefix must be a relative path ending with /')
  return new URL(objectPrefix, publicBaseUrl).toString()
}

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const MANIFEST_CACHE_CONTROL = 'public, max-age=60, must-revalidate'

function contentTypeForObjectKey(objectKey) {
  if (objectKey.endsWith('.webp'))
    return 'image/webp'
  if (objectKey.endsWith('.ogg'))
    return 'audio/ogg'
  if (objectKey.endsWith('.json'))
    return 'application/json; charset=utf-8'
  throw new Error(`unsupported release object type: ${objectKey}`)
}

function releasePlanObject({ bytes, id, objectKey, role = 'asset', sha256 }) {
  return {
    id,
    role,
    objectKey,
    file: objectKey,
    bytes,
    sha256,
    headers: {
      'Content-Type': contentTypeForObjectKey(objectKey),
      'Cache-Control': role === 'manifest' ? MANIFEST_CACHE_CONTROL : IMMUTABLE_CACHE_CONTROL,
      'x-cos-meta-advjs-id': id,
      'x-cos-meta-advjs-schema': '2',
      'x-cos-meta-sha256': sha256,
    },
  }
}

export async function writeCosReleasePlan({ manifest, manifestJson, planPath, releaseRoot }) {
  const objects = []
  for (const asset of manifest.assets) {
    objects.push(releasePlanObject({
      id: asset.id,
      objectKey: asset.objectKey,
      sha256: asset.sha256,
      bytes: asset.bytes,
    }))
    if (asset.kind === 'cg' && asset.variants?.thumbnail) {
      const thumbnail = asset.variants.thumbnail
      objects.push(releasePlanObject({
        id: `${asset.id}/thumbnail`,
        objectKey: thumbnail.objectKey,
        sha256: thumbnail.sha256,
        bytes: thumbnail.bytes,
      }))
    }
  }

  const manifestBytes = Buffer.from(manifestJson)
  const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex')
  const manifestObject = releasePlanObject({
    id: 'manifest/assets',
    role: 'manifest',
    objectKey: manifest.manifestObjectKey,
    sha256: manifestSha256,
    bytes: manifestBytes.length,
  })
  const releaseManifestPath = join(releaseRoot, manifest.manifestObjectKey)
  await mkdir(dirname(releaseManifestPath), { recursive: true })
  await writeFile(releaseManifestPath, manifestBytes)

  const plan = {
    schemaVersion: 2,
    provider: 'tencent-cos',
    publicBaseUrl: manifest.profiles.production.baseUrl,
    objectPrefix: manifest.release.objectPrefix,
    policy: {
      publicMethods: ['GET', 'HEAD'],
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'HEAD'],
        exposeHeaders: [
          'Cache-Control',
          'Content-Length',
          'Content-Type',
          'ETag',
          'x-cos-meta-advjs-id',
          'x-cos-meta-sha256',
        ],
        maxAgeSeconds: 86400,
      },
    },
    objects: [...objects, manifestObject],
  }
  await mkdir(dirname(planPath), { recursive: true })
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`)
  return plan
}

async function prepareAsset({
  assetRoot,
  characterId,
  createdAt,
  expression,
  kind,
  license,
  model,
  objectPrefix,
  promptVersion,
  releaseRoot,
  sceneId,
}) {
  const relativeSource = kind === 'character'
    ? `characters/${characterId}/standing/${expression}.webp`
    : `backgrounds/${sceneId}.webp`
  const sourcePath = join(assetRoot, relativeSource)

  let bytes
  try {
    bytes = await readFile(sourcePath)
  }
  catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT')
      throw new Error(`required ${kind} asset is missing: ${sourcePath}`)
    throw error
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const hash = sha256.slice(0, 12)
  const dimensions = readWebpDimensions(bytes)
  const relativeObject = kind === 'character'
    ? `characters/${characterId}/standing/${expression}.${hash}.webp`
    : `backgrounds/${sceneId}.${hash}.webp`
  const objectKey = `${objectPrefix}${relativeObject}`
  const releasePath = join(releaseRoot, objectKey)

  await mkdir(dirname(releasePath), { recursive: true })
  await copyFile(sourcePath, releasePath)

  return {
    id: kind === 'character'
      ? `character/${characterId}/${expression}`
      : `background/${sceneId}`,
    kind,
    type: 'image',
    bundle: kind === 'character' ? 'characters' : 'backgrounds',
    ...(characterId ? { characterId, expression } : { sceneId }),
    objectKey,
    sha256,
    width: dimensions.width,
    height: dimensions.height,
    bytes: (await stat(releasePath)).size,
    license,
    source: {
      type: 'generated',
      model,
      promptVersion,
      createdAt,
    },
  }
}

async function copyHashedFile({ sourcePath, releaseRoot, objectPrefix, relativeStem, extension }) {
  let bytes
  try {
    bytes = await readFile(sourcePath)
  }
  catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT')
      throw new Error(`required asset is missing: ${sourcePath}`)
    throw error
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const relativeObject = `${relativeStem}.${sha256.slice(0, 12)}.${extension}`
  const objectKey = `${objectPrefix}${relativeObject}`
  const releasePath = join(releaseRoot, objectKey)
  await mkdir(dirname(releasePath), { recursive: true })
  await copyFile(sourcePath, releasePath)
  return {
    bytes: (await stat(releasePath)).size,
    contents: bytes,
    objectKey,
    sha256,
  }
}

async function prepareCgAsset({ assetRoot, createdAt, license, model, objectPrefix, promptVersion, releaseRoot, spec }) {
  const primary = await copyHashedFile({
    sourcePath: join(assetRoot, `cg/${spec.id}.webp`),
    releaseRoot,
    objectPrefix,
    relativeStem: `cg/${spec.id}`,
    extension: 'webp',
  })
  const thumbnail = await copyHashedFile({
    sourcePath: join(assetRoot, `cg/${spec.id}.thumbnail.webp`),
    releaseRoot,
    objectPrefix,
    relativeStem: `cg/${spec.id}.thumbnail`,
    extension: 'webp',
  })
  const dimensions = readWebpDimensions(primary.contents)
  const thumbnailDimensions = readWebpDimensions(thumbnail.contents)
  return {
    id: `cg/${spec.id}`,
    kind: 'cg',
    type: 'image',
    bundle: 'cg',
    title: spec.title,
    alt: spec.alt,
    chapterId: spec.chapterId,
    objectKey: primary.objectKey,
    sha256: primary.sha256,
    width: dimensions.width,
    height: dimensions.height,
    bytes: primary.bytes,
    variants: {
      thumbnail: {
        objectKey: thumbnail.objectKey,
        sha256: thumbnail.sha256,
        width: thumbnailDimensions.width,
        height: thumbnailDimensions.height,
        bytes: thumbnail.bytes,
        mimeType: 'image/webp',
      },
    },
    license,
    source: { type: 'generated', model, promptVersion, createdAt },
  }
}

async function prepareAnimationAsset({ assetRoot, createdAt, license, model, objectPrefix, promptVersion, releaseRoot, spec }) {
  const file = await copyHashedFile({
    sourcePath: join(assetRoot, `characters/${spec.characterId}/animations/${spec.state}.webp`),
    releaseRoot,
    objectPrefix,
    relativeStem: `characters/${spec.characterId}/animations/${spec.state}`,
    extension: 'webp',
  })
  const dimensions = readWebpDimensions(file.contents)
  if (dimensions.width !== spec.frameWidth * spec.frames || dimensions.height !== spec.frameHeight)
    throw new Error(`animation ${spec.id} dimensions do not match its frame metadata`)
  return {
    id: `animation/${spec.id}`,
    kind: 'animation',
    type: 'image',
    bundle: 'characters',
    characterId: spec.characterId,
    state: spec.state,
    objectKey: file.objectKey,
    sha256: file.sha256,
    width: dimensions.width,
    height: dimensions.height,
    bytes: file.bytes,
    frameWidth: spec.frameWidth,
    frameHeight: spec.frameHeight,
    frames: spec.frames,
    fps: spec.fps,
    loop: spec.loop !== false,
    license,
    source: { type: 'generated', model, promptVersion, createdAt },
  }
}

async function prepareBgmAsset({ assetRoot, createdAt, license, objectPrefix, releaseRoot, spec }) {
  const file = await copyHashedFile({
    sourcePath: join(assetRoot, `audio/bgm/${spec.id}.ogg`),
    releaseRoot,
    objectPrefix,
    relativeStem: `audio/bgm/${spec.id}`,
    extension: 'ogg',
  })
  return {
    id: `bgm/${spec.id}`,
    kind: 'bgm',
    type: 'audio',
    bundle: 'audio',
    title: spec.title,
    objectKey: file.objectKey,
    sha256: file.sha256,
    bytes: file.bytes,
    duration: spec.duration,
    loop: spec.loop !== false,
    mimeType: 'audio/ogg',
    license,
    source: {
      type: 'generated',
      model: 'deterministic-additive-synthesis',
      promptVersion: 'hamster-bgm-v1',
      createdAt,
    },
  }
}

export async function prepareRelease({
  adaptationPath,
  assetRoot,
  catalogId,
  cosReleasePlanPath,
  createdAt,
  license,
  manifestPath,
  model,
  objectPrefix,
  promptVersion,
  publicBaseUrl,
  releaseRoot,
}) {
  validateUrlConfig(publicBaseUrl, objectPrefix)
  const adaptation = JSON.parse(await readFile(adaptationPath, 'utf8'))
  const characters = (adaptation.characters ?? [])
    .filter(character => character.needsTachie)
    .map(character => ({
      id: character.id,
      requiredExpressions: character.requiredExpressions ?? [],
    }))
  const scenes = (adaptation.scenes ?? []).filter(scene => scene.needsBackground)

  const assets = []
  for (const character of characters) {
    for (const expression of character.requiredExpressions) {
      assets.push(await prepareAsset({
        assetRoot,
        characterId: character.id,
        createdAt,
        expression,
        kind: 'character',
        license,
        model,
        objectPrefix,
        promptVersion,
        releaseRoot,
      }))
    }
  }
  for (const scene of scenes) {
    assets.push(await prepareAsset({
      assetRoot,
      createdAt,
      kind: 'background',
      license,
      model,
      objectPrefix,
      promptVersion,
      releaseRoot,
      sceneId: scene.id,
    }))
  }
  for (const spec of adaptation.gallery ?? []) {
    assets.push(await prepareCgAsset({
      assetRoot,
      createdAt,
      license,
      model,
      objectPrefix,
      promptVersion,
      releaseRoot,
      spec,
    }))
  }
  for (const spec of adaptation.animations ?? []) {
    assets.push(await prepareAnimationAsset({
      assetRoot,
      createdAt,
      license,
      model,
      objectPrefix,
      promptVersion,
      releaseRoot,
      spec,
    }))
  }
  for (const spec of adaptation.bgm ?? []) {
    assets.push(await prepareBgmAsset({
      assetRoot,
      createdAt,
      license,
      objectPrefix,
      releaseRoot,
      spec,
    }))
  }

  const manifest = {
    schemaVersion: 2,
    id: catalogId,
    defaultProfile: 'production',
    profiles: {
      production: {
        provider: 'http',
        baseUrl: publicBaseUrl,
      },
    },
    release: {
      provider: 'tencent-cos',
      objectPrefix,
    },
    bundles: [
      { id: 'characters' },
      { id: 'backgrounds', preload: true },
      { id: 'cg' },
      { id: 'audio' },
    ],
    manifestObjectKey: `${objectPrefix}manifests/assets.json`,
    characters,
    assets,
  }
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`
  await mkdir(dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, manifestJson)
  await writeCosReleasePlan({
    manifest,
    manifestJson,
    planPath: cosReleasePlanPath ?? join(dirname(manifestPath), 'cos-release.json'),
    releaseRoot,
  })
  return manifest
}

function parseArgs(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined)
      throw new Error('arguments must be provided as --name value pairs')
    values[flag.slice(2)] = value
  }
  return values
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2))
    const required = [
      'adaptation',
      'asset-root',
      'catalog-id',
      'created-at',
      'license',
      'manifest',
      'model',
      'object-prefix',
      'prompt-version',
      'public-base-url',
      'release-root',
    ]
    const missing = required.filter(key => !args[key])
    if (missing.length > 0)
      throw new Error(`missing required arguments: ${missing.join(', ')}`)

    const manifest = await prepareRelease({
      adaptationPath: args.adaptation,
      assetRoot: args['asset-root'],
      catalogId: args['catalog-id'],
      cosReleasePlanPath: args['cos-release-plan'],
      createdAt: args['created-at'],
      license: args.license,
      manifestPath: args.manifest,
      model: args.model,
      objectPrefix: args['object-prefix'],
      promptVersion: args['prompt-version'],
      publicBaseUrl: args['public-base-url'],
      releaseRoot: args['release-root'],
    })
    process.stdout.write(`${JSON.stringify({
      assetCount: manifest.assets.length,
      cosReleasePlan: args['cos-release-plan'] ?? join(dirname(args.manifest), 'cos-release.json'),
      manifest: args.manifest,
      releaseRoot: args['release-root'],
    }, null, 2)}\n`)
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await main()
