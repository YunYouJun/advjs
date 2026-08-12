#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import process from 'node:process'

const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const HASHED_FILENAME_PATTERN = /\.([0-9a-f]{8,64})\.[a-z0-9]+$/u

function printResult(result, failed = false) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (failed)
    process.exitCode = 1
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function validateManifest(manifest) {
  const errors = []
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : []
  const characters = Array.isArray(manifest?.characters) ? manifest.characters : []
  const ids = new Set()
  const countsByKind = {}

  if (manifest?.schemaVersion !== 1 && manifest?.schemaVersion !== 2)
    errors.push('schemaVersion must be 1 or 2')

  let expectedPrefix = ''
  let objectPrefix = ''
  let publicBaseUrl = ''
  try {
    const isV2 = manifest?.schemaVersion === 2
    publicBaseUrl = isV2 ? manifest?.profiles?.production?.baseUrl : manifest?.publicBaseUrl
    objectPrefix = isV2 ? manifest?.release?.objectPrefix : manifest?.objectPrefix
    if (typeof publicBaseUrl !== 'string' || !publicBaseUrl.endsWith('/'))
      throw new Error('publicBaseUrl must be an absolute URL ending with /')
    if (typeof objectPrefix !== 'string' || objectPrefix.startsWith('/') || !objectPrefix.endsWith('/'))
      throw new Error('objectPrefix must be a relative path ending with /')
    expectedPrefix = new URL(objectPrefix, publicBaseUrl).toString()
    if (manifest.manifestObjectKey !== `${objectPrefix}manifests/assets.json`)
      errors.push('manifestObjectKey must be objectPrefix + manifests/assets.json')
  }
  catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  if (assets.length === 0)
    errors.push('assets must contain at least one entry')

  for (const asset of assets) {
    const id = typeof asset?.id === 'string' ? asset.id : ''
    if (!id)
      errors.push('asset id is required')
    else if (ids.has(id))
      errors.push(`duplicate asset id: ${id}`)
    else
      ids.add(id)

    if (typeof asset?.kind !== 'string' || !asset.kind)
      errors.push(`${id || 'unknown asset'}: kind is required`)
    else
      countsByKind[asset.kind] = (countsByKind[asset.kind] ?? 0) + 1

    if (typeof asset?.objectKey !== 'string' || !asset.objectKey.startsWith(objectPrefix))
      errors.push(`${id || 'unknown asset'}: objectKey is outside objectPrefix`)
    if (manifest.schemaVersion === 2) {
      if (asset.url !== undefined)
        errors.push(`${id || 'unknown asset'}: schema v2 derives URLs from profiles and objectKey`)
      if (typeof asset.type !== 'string' || !asset.type)
        errors.push(`${id || 'unknown asset'}: type is required by schema v2`)
      if (typeof asset.bundle !== 'string' || !asset.bundle)
        errors.push(`${id || 'unknown asset'}: bundle is required by schema v2`)
    }
    else if (typeof asset?.url !== 'string' || !expectedPrefix || !asset.url.startsWith(expectedPrefix)) {
      errors.push(`${id || 'unknown asset'}: URL is outside publicBaseUrl/objectPrefix`)
    }
    else if (typeof asset?.objectKey === 'string' && asset.url !== new URL(asset.objectKey, publicBaseUrl).toString()) {
      errors.push(`${id || 'unknown asset'}: URL must exactly match publicBaseUrl + objectKey`)
    }

    if (!SHA256_PATTERN.test(asset?.sha256 ?? ''))
      errors.push(`${id || 'unknown asset'}: sha256 must be 64 lowercase hex characters`)

    let filename = ''
    try {
      filename = asset.objectKey?.split('/').at(-1) ?? ''
    }
    catch {
      // The URL-prefix diagnostic above already explains malformed URLs.
    }
    const filenameHash = filename.match(HASHED_FILENAME_PATTERN)?.[1]
    if (!filenameHash)
      errors.push(`${id || 'unknown asset'}: object filename must contain an 8–64 character content hash`)
    else if (SHA256_PATTERN.test(asset?.sha256 ?? '') && !asset.sha256.startsWith(filenameHash))
      errors.push(`${id || 'unknown asset'}: filename content hash must match the declared sha256 prefix`)

    if (asset?.kind !== 'bgm' && (!isPositiveInteger(asset?.width) || !isPositiveInteger(asset?.height)))
      errors.push(`${id || 'unknown asset'}: width and height must be positive integers`)
    if (!isPositiveInteger(asset?.bytes))
      errors.push(`${id || 'unknown asset'}: bytes must be a positive integer`)
    if (typeof asset?.license !== 'string' || !asset.license.trim())
      errors.push(`${id || 'unknown asset'}: license is required`)

    const source = asset?.source
    if (!source || typeof source !== 'object') {
      errors.push(`${id || 'unknown asset'}: source provenance is required`)
    }
    else {
      if (typeof source.type !== 'string' || !source.type)
        errors.push(`${id || 'unknown asset'}: source.type is required`)
      if (typeof source.createdAt !== 'string' || !source.createdAt)
        errors.push(`${id || 'unknown asset'}: source.createdAt is required`)
      if (source.type === 'generated') {
        if (typeof source.model !== 'string' || !source.model)
          errors.push(`${id || 'unknown asset'}: generated source.model is required`)
        if (typeof source.promptVersion !== 'string' || !source.promptVersion)
          errors.push(`${id || 'unknown asset'}: generated source.promptVersion is required`)
      }
    }

    if (asset?.kind === 'character') {
      if (typeof asset?.characterId !== 'string' || !asset.characterId)
        errors.push(`${id || 'unknown asset'}: characterId is required for character assets`)
      if (typeof asset?.expression !== 'string' || !asset.expression)
        errors.push(`${id || 'unknown asset'}: expression is required for character assets`)
    }
    else if (asset?.kind === 'animation') {
      if (!isPositiveInteger(asset.frameWidth) || !isPositiveInteger(asset.frameHeight) || !isPositiveInteger(asset.frames))
        errors.push(`${id || 'unknown asset'}: animation frame dimensions/count must be positive integers`)
      else if (asset.width !== asset.frameWidth * asset.frames || asset.height !== asset.frameHeight)
        errors.push(`${id || 'unknown asset'}: spritesheet dimensions do not match frame metadata`)
      if (typeof asset.characterId !== 'string' || typeof asset.state !== 'string')
        errors.push(`${id || 'unknown asset'}: animation characterId and state are required`)
      if (!isPositiveInteger(asset.fps))
        errors.push(`${id || 'unknown asset'}: animation fps must be a positive integer`)
    }
    else if (asset?.kind === 'cg') {
      const thumbnail = manifest.schemaVersion === 2
        ? asset.variants?.thumbnail
        : {
            objectKey: asset.thumbnailObjectKey,
            url: asset.thumbnailUrl,
            sha256: asset.thumbnailSha256,
            width: asset.thumbnailWidth,
            height: asset.thumbnailHeight,
            bytes: asset.thumbnailBytes,
          }
      if (typeof thumbnail?.objectKey !== 'string' || !thumbnail.objectKey.startsWith(objectPrefix))
        errors.push(`${id || 'unknown asset'}: thumbnailObjectKey is outside objectPrefix`)
      if (manifest.schemaVersion === 2) {
        if (thumbnail?.url !== undefined)
          errors.push(`${id || 'unknown asset'}: schema v2 derives thumbnail URLs from profiles and objectKey`)
      }
      else if (typeof thumbnail?.url !== 'string' || !thumbnail.url.startsWith(expectedPrefix)) {
        errors.push(`${id || 'unknown asset'}: thumbnail URL is outside publicBaseUrl/objectPrefix`)
      }
      else if (typeof thumbnail.objectKey === 'string' && thumbnail.url !== new URL(thumbnail.objectKey, publicBaseUrl).toString()) {
        errors.push(`${id || 'unknown asset'}: thumbnail URL must exactly match publicBaseUrl + thumbnailObjectKey`)
      }
      if (!SHA256_PATTERN.test(thumbnail?.sha256 ?? ''))
        errors.push(`${id || 'unknown asset'}: thumbnailSha256 must be 64 lowercase hex characters`)
      const thumbnailHash = thumbnail?.objectKey?.split('/').at(-1)?.match(HASHED_FILENAME_PATTERN)?.[1]
      if (!thumbnailHash || !thumbnail?.sha256?.startsWith(thumbnailHash))
        errors.push(`${id || 'unknown asset'}: thumbnail filename content hash must match thumbnailSha256`)
      if (!isPositiveInteger(thumbnail?.width) || !isPositiveInteger(thumbnail?.height) || !isPositiveInteger(thumbnail?.bytes))
        errors.push(`${id || 'unknown asset'}: thumbnail dimensions and bytes must be positive integers`)
    }
    else if (asset?.kind === 'bgm') {
      if (asset.mimeType !== 'audio/ogg')
        errors.push(`${id || 'unknown asset'}: BGM mimeType must be audio/ogg`)
      if (typeof asset.duration !== 'number' || asset.duration <= 0)
        errors.push(`${id || 'unknown asset'}: BGM duration must be positive`)
    }
  }

  for (const character of characters) {
    const characterId = typeof character?.id === 'string' ? character.id : ''
    if (!characterId) {
      errors.push('character id is required')
      continue
    }
    if (!Array.isArray(character.requiredExpressions)) {
      errors.push(`${characterId}: requiredExpressions must be an array`)
      continue
    }

    for (const expression of character.requiredExpressions) {
      const exists = assets.some(asset => asset?.kind === 'character'
        && asset.characterId === characterId
        && asset.expression === expression)
      if (!exists)
        errors.push(`missing required character expression: ${characterId}/${expression}`)
    }
  }

  return {
    assetCount: assets.length,
    countsByKind: Object.fromEntries(Object.entries(countsByKind).sort(([a], [b]) => a.localeCompare(b))),
    errors: errors.sort(),
  }
}

async function main() {
  const [manifestPath, ...extra] = process.argv.slice(2)
  if (!manifestPath || extra.length > 0) {
    printResult({
      error: 'usage: node audit-assets.mjs <manifest.json>',
    }, true)
    return
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const result = validateManifest(manifest)
    printResult(result, result.errors.length > 0)
  }
  catch (error) {
    printResult({
      assetCount: 0,
      countsByKind: {},
      errors: [error instanceof Error ? error.message : String(error)],
    }, true)
  }
}

await main()
