#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, normalize, relative } from 'node:path'
import process from 'node:process'

const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const HASHED_OBJECT_PATTERN = /\.[0-9a-f]{8,64}\.[a-z0-9]+$/u
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const MANIFEST_CACHE_CONTROL = 'public, max-age=60, must-revalidate'

function expectedContentType(objectKey) {
  if (objectKey.endsWith('.webp'))
    return 'image/webp'
  if (objectKey.endsWith('.ogg'))
    return 'audio/ogg'
  if (objectKey.endsWith('.json'))
    return 'application/json; charset=utf-8'
  return undefined
}

function safeReleasePath(releaseRoot, file) {
  if (typeof file !== 'string' || !file || isAbsolute(file))
    throw new Error(`file must be a relative path: ${String(file)}`)
  const path = normalize(join(releaseRoot, file))
  const fromRoot = relative(releaseRoot, path)
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot))
    throw new Error(`file escapes release root: ${file}`)
  return path
}

async function auditObject(item, plan, releaseRoot, index) {
  const errors = []
  const label = item?.id || `object ${index}`
  if (typeof item?.objectKey !== 'string' || !item.objectKey.startsWith(plan.objectPrefix))
    errors.push(`${label}: objectKey must start with objectPrefix`)
  if (item?.objectKey?.includes('/latest/'))
    errors.push(`${label}: latest/ is forbidden`)
  if (item?.file !== item?.objectKey)
    errors.push(`${label}: file must equal objectKey`)
  if (!SHA256_PATTERN.test(item?.sha256 ?? ''))
    errors.push(`${label}: sha256 must contain 64 lowercase hex characters`)
  if (!Number.isInteger(item?.bytes) || item.bytes <= 0)
    errors.push(`${label}: bytes must be a positive integer`)

  const role = item?.role ?? 'asset'
  if (role === 'manifest') {
    if (index !== plan.objects.length - 1)
      errors.push(`${label}: manifest must be the final upload object`)
    if (item?.headers?.['Cache-Control'] !== MANIFEST_CACHE_CONTROL)
      errors.push(`${label}: manifest must use the revalidating cache policy`)
  }
  else {
    const filenameHash = item?.objectKey?.match(HASHED_OBJECT_PATTERN)?.[0]?.split('.')[1]
    if (!filenameHash || !item?.sha256?.startsWith(filenameHash))
      errors.push(`${label}: immutable object filename must contain its SHA-256 prefix`)
    if (item?.headers?.['Cache-Control'] !== IMMUTABLE_CACHE_CONTROL)
      errors.push(`${label}: immutable object has an invalid cache policy`)
  }

  const contentType = expectedContentType(item?.objectKey ?? '')
  if (!contentType || item?.headers?.['Content-Type'] !== contentType)
    errors.push(`${label}: Content-Type does not match the object extension`)
  if (item?.headers?.['x-cos-meta-sha256'] !== item?.sha256)
    errors.push(`${label}: x-cos-meta-sha256 must match sha256`)

  try {
    const path = safeReleasePath(releaseRoot, item?.file)
    const bytes = await readFile(path)
    const file = await stat(path)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (file.size !== item.bytes)
      errors.push(`${label}: local byte size does not match the plan`)
    if (sha256 !== item.sha256)
      errors.push(`${label}: local SHA-256 does not match the plan`)
  }
  catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return errors
}

export async function auditCosRelease(plan, releaseRoot) {
  const errors = []
  if (plan?.schemaVersion !== 1 && plan?.schemaVersion !== 2)
    errors.push('schemaVersion must be 1 or 2')
  if (plan?.provider !== 'tencent-cos')
    errors.push('provider must be tencent-cos')
  if (typeof plan?.objectPrefix !== 'string' || plan.objectPrefix.startsWith('/') || !plan.objectPrefix.endsWith('/'))
    errors.push('objectPrefix must be a relative path ending with /')
  if (!Array.isArray(plan?.objects) || plan.objects.length === 0)
    errors.push('objects must contain at least one upload')
  if (/secret(?:id|key)|sessiontoken/iu.test(JSON.stringify(plan)))
    errors.push('release plan must not contain credential fields')

  const methods = plan?.policy?.cors?.allowedMethods
  if (!Array.isArray(methods) || methods.join(',') !== 'GET,HEAD')
    errors.push('browser CORS methods must be exactly GET and HEAD')

  const objectKeys = new Set()
  for (const [index, item] of (plan.objects ?? []).entries()) {
    if (objectKeys.has(item?.objectKey))
      errors.push(`duplicate objectKey: ${item?.objectKey}`)
    objectKeys.add(item?.objectKey)
    errors.push(...await auditObject(item, plan, releaseRoot, index))
  }
  return { objectCount: objectKeys.size, errors: errors.sort() }
}

async function main() {
  const [planPath, releaseRoot, ...extra] = process.argv.slice(2)
  if (!planPath || !releaseRoot || extra.length > 0) {
    process.stderr.write('usage: node audit-cos-release.mjs <cos-release.json> <release-root>\n')
    process.exitCode = 1
    return
  }
  try {
    const plan = JSON.parse(await readFile(planPath, 'utf8'))
    const result = await auditCosRelease(plan, releaseRoot)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.errors.length > 0)
      process.exitCode = 1
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1]?.endsWith('audit-cos-release.mjs'))
  await main()
