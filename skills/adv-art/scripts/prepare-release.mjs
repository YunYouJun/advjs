#!/usr/bin/env node

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
  publicBaseUrl,
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
    ...(characterId ? { characterId, expression } : { sceneId }),
    objectKey,
    url: new URL(objectKey, publicBaseUrl).toString(),
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

export async function prepareRelease({
  adaptationPath,
  assetRoot,
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
        publicBaseUrl,
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
      publicBaseUrl,
      releaseRoot,
      sceneId: scene.id,
    }))
  }

  const manifest = {
    schemaVersion: 1,
    publicBaseUrl,
    objectPrefix,
    characters,
    assets,
  }
  await mkdir(dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
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
