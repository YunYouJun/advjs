#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const DEFAULT_ORIGIN = 'https://demo.advjs.org'
const DEFAULT_CONCURRENCY = 8
const DEFAULT_TIMEOUT_MS = 30_000

function headerValue(headers, name) {
  return headers.get(name)?.trim() ?? ''
}

function normalizedHeader(value) {
  return value.toLowerCase().replaceAll(/\s+/gu, ' ').trim()
}

function cacheDirectives(value) {
  return new Set(value.toLowerCase().split(',').map(part => part.trim()).filter(Boolean))
}

function commaSeparatedValues(value) {
  return value.split(',').map(part => part.trim().toLowerCase()).filter(Boolean)
}

function sameCachePolicy(actual, expected) {
  const actualDirectives = cacheDirectives(actual)
  const expectedDirectives = cacheDirectives(expected)
  return actualDirectives.size === expectedDirectives.size
    && [...expectedDirectives].every(directive => actualDirectives.has(directive))
}

function expectedCorsMethods(plan) {
  return (plan?.policy?.cors?.allowedMethods ?? plan?.policy?.publicMethods ?? [])
    .map(method => String(method).toUpperCase())
}

function checkCorsResponse(headers, plan, origin, label, errors) {
  const allowOrigin = headerValue(headers, 'access-control-allow-origin')
  if (allowOrigin !== '*' && allowOrigin !== origin)
    errors.push(`${label}: Access-Control-Allow-Origin does not allow ${origin}`)

  const expectedExposed = (plan?.policy?.cors?.exposeHeaders ?? []).map(header => String(header).toLowerCase())
  const actualExposed = commaSeparatedValues(headerValue(headers, 'access-control-expose-headers'))
  for (const header of expectedExposed) {
    if (!actualExposed.includes(header))
      errors.push(`${label}: Access-Control-Expose-Headers is missing ${header}`)
  }
}

function checkCorsPreflight(headers, plan, origin, label, errors) {
  const allowOrigin = headerValue(headers, 'access-control-allow-origin')
  if (allowOrigin !== '*' && allowOrigin !== origin)
    errors.push(`${label}: Access-Control-Allow-Origin does not allow ${origin}`)

  const expectedMethods = expectedCorsMethods(plan)
  const actualMethods = commaSeparatedValues(headerValue(headers, 'access-control-allow-methods'))
    .map(method => method.toUpperCase())
  if (expectedMethods.length > 0 && (
    actualMethods.length !== expectedMethods.length
    || expectedMethods.some(method => !actualMethods.includes(method))
  )) {
    errors.push(`${label}: Access-Control-Allow-Methods must be exactly ${expectedMethods.join(', ')}`)
  }

  const expectedMaxAge = plan?.policy?.cors?.maxAgeSeconds
  if (Number.isInteger(expectedMaxAge)) {
    const actualMaxAge = Number.parseInt(headerValue(headers, 'access-control-max-age'), 10)
    if (actualMaxAge !== expectedMaxAge)
      errors.push(`${label}: Access-Control-Max-Age is ${Number.isNaN(actualMaxAge) ? 'missing' : actualMaxAge}, expected ${expectedMaxAge}`)
  }
}

async function fetchWithTimeout(url, init, timeoutMs) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function auditRemoteObject(item, plan, options) {
  const errors = []
  const label = item?.id || item?.objectKey || 'unknown object'
  const url = new URL(item.objectKey, plan.publicBaseUrl).href
  const requestHeaders = {
    'Accept-Encoding': 'identity',
    'Origin': options.origin,
  }

  let getResponse
  let bytes
  try {
    getResponse = await fetchWithTimeout(url, { headers: requestHeaders }, options.timeoutMs)
    if (!getResponse.ok)
      errors.push(`${label}: GET returned ${getResponse.status}`)
    bytes = Buffer.from(await getResponse.arrayBuffer())
  }
  catch (error) {
    errors.push(`${label}: GET failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (getResponse) {
    const expectedType = item?.headers?.['Content-Type'] ?? ''
    const actualType = headerValue(getResponse.headers, 'content-type')
    if (normalizedHeader(actualType) !== normalizedHeader(expectedType))
      errors.push(`${label}: GET Content-Type is ${actualType || 'missing'}, expected ${expectedType}`)

    const expectedCache = item?.headers?.['Cache-Control'] ?? ''
    const actualCache = headerValue(getResponse.headers, 'cache-control')
    if (!sameCachePolicy(actualCache, expectedCache))
      errors.push(`${label}: GET Cache-Control is ${actualCache || 'missing'}, expected ${expectedCache}`)

    if (bytes) {
      if (bytes.byteLength !== item.bytes)
        errors.push(`${label}: GET returned ${bytes.byteLength} bytes, expected ${item.bytes}`)
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      if (sha256 !== item.sha256)
        errors.push(`${label}: GET SHA-256 does not match the release plan`)
    }
    checkCorsResponse(getResponse.headers, plan, options.origin, `${label} GET`, errors)
  }

  let headResponse
  try {
    headResponse = await fetchWithTimeout(url, { method: 'HEAD', headers: requestHeaders }, options.timeoutMs)
    if (!headResponse.ok)
      errors.push(`${label}: HEAD returned ${headResponse.status}`)
  }
  catch (error) {
    errors.push(`${label}: HEAD failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  let schema
  if (headResponse) {
    const contentLength = Number.parseInt(headerValue(headResponse.headers, 'content-length'), 10)
    if (contentLength !== item.bytes)
      errors.push(`${label}: HEAD Content-Length is ${Number.isNaN(contentLength) ? 'missing' : contentLength}, expected ${item.bytes}`)

    const remoteSha = headerValue(headResponse.headers, 'x-cos-meta-sha256')
    if (remoteSha !== item.sha256)
      errors.push(`${label}: HEAD x-cos-meta-sha256 does not match the release plan`)

    const expectedType = item?.headers?.['Content-Type'] ?? ''
    const actualType = headerValue(headResponse.headers, 'content-type')
    if (normalizedHeader(actualType) !== normalizedHeader(expectedType))
      errors.push(`${label}: HEAD Content-Type is ${actualType || 'missing'}, expected ${expectedType}`)

    const expectedCache = item?.headers?.['Cache-Control'] ?? ''
    const actualCache = headerValue(headResponse.headers, 'cache-control')
    if (!sameCachePolicy(actualCache, expectedCache))
      errors.push(`${label}: HEAD Cache-Control is ${actualCache || 'missing'}, expected ${expectedCache}`)

    checkCorsResponse(headResponse.headers, plan, options.origin, `${label} HEAD`, errors)
    schema = headerValue(headResponse.headers, 'x-cos-meta-advjs-schema') || 'missing'
  }

  try {
    const preflightResponse = await fetchWithTimeout(url, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'HEAD',
        'Origin': options.origin,
      },
    }, options.timeoutMs)
    if (!preflightResponse.ok)
      errors.push(`${label}: OPTIONS returned ${preflightResponse.status}`)
    checkCorsPreflight(preflightResponse.headers, plan, options.origin, `${label} OPTIONS`, errors)
  }
  catch (error) {
    errors.push(`${label}: OPTIONS failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { errors, schema }
}

async function mapConcurrent(items, concurrency, work) {
  const results = Array.from({ length: items.length })
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await work(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

export async function auditCosRemote(plan, options = {}) {
  if (!Array.isArray(plan?.objects) || plan.objects.length === 0)
    return { objectCount: 0, schemaVersions: {}, errors: ['objects must contain at least one upload'] }
  if (typeof plan?.publicBaseUrl !== 'string' || !/^https?:\/\//u.test(plan.publicBaseUrl))
    return { objectCount: plan.objects.length, schemaVersions: {}, errors: ['publicBaseUrl must be an HTTP(S) URL'] }

  const resolvedOptions = {
    concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    origin: options.origin ?? DEFAULT_ORIGIN,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
  const results = await mapConcurrent(
    plan.objects,
    resolvedOptions.concurrency,
    item => auditRemoteObject(item, plan, resolvedOptions),
  )
  const schemaVersions = {}
  for (const result of results) {
    schemaVersions[result.schema] = (schemaVersions[result.schema] ?? 0) + 1
  }
  return {
    objectCount: plan.objects.length,
    schemaVersions,
    errors: results.flatMap(result => result.errors).sort(),
  }
}

async function main() {
  const [planPath, ...extra] = process.argv.slice(2)
  if (!planPath || extra.length > 0) {
    process.stderr.write('usage: node audit-cos-remote.mjs <cos-release.json>\n')
    process.exitCode = 1
    return
  }

  try {
    const plan = JSON.parse(await readFile(planPath, 'utf8'))
    const result = await auditCosRemote(plan, {
      concurrency: Number.parseInt(process.env.ADV_ASSET_AUDIT_CONCURRENCY ?? '', 10) || DEFAULT_CONCURRENCY,
      origin: process.env.ADV_ASSET_AUDIT_ORIGIN || DEFAULT_ORIGIN,
      timeoutMs: Number.parseInt(process.env.ADV_ASSET_AUDIT_TIMEOUT_MS ?? '', 10) || DEFAULT_TIMEOUT_MS,
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.errors.length > 0)
      process.exitCode = 1
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main()
