/* eslint-disable no-console -- CLI check: reports PASS lines to stdout. */
// Checks the files studio.advjs.org must serve for native sign-in.
// Read-only: never signs in, issues codes or touches credentials.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const origin = 'https://studio.advjs.org'
const publicDir = new URL('../../studio/public/', import.meta.url)
const paths = [
  ['/.well-known/apple-app-site-association', '.well-known/apple-app-site-association', /^application\/json/],
  ['/auth/callback', 'auth/callback/index.html', /^text\/html/],
  ['/auth/callback/clear-fragment.js', 'auth/callback/clear-fragment.js', /(?:text|application)\/javascript/],
  ['/auth/callback/style.css', 'auth/callback/style.css', /^text\/css/],
  ['/favicon.png', 'favicon.png', /^image\/png/],
]

async function main() {
  for (const [path, file, contentType] of paths) {
    const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    assert.equal(response.status, 200, `${path}: HTTPS 200 without redirects`)
    assert.match(response.headers.get('content-type') || '', contentType, `${path}: MIME type`)
    if (path.startsWith('/auth/callback')) {
      assert.equal(response.headers.get('cache-control'), 'no-store', `${path}: no caching`)
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer', `${path}: no referrer`)
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', `${path}: no indexing`)
      assert.equal(response.headers.get('x-frame-options'), 'DENY', `${path}: frame protection`)
    }
    const actual = Buffer.from(await response.arrayBuffer())
    const expected = await readFile(new URL(file, publicDir))
    assert.deepEqual(actual, expected, `${path}: deployed bytes match source`)
    console.log(`PASS ${origin}${path}`)
  }

  // iOS reads the association through Apple's CDN in production builds.
  if (process.argv.includes('--apple-cdn')) {
    const response = await fetch('https://app-site-association.cdn-apple.com/a/v1/studio.advjs.org', {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    })
    assert.equal(response.status, 200, `Apple CDN: ${response.headers.get('apple-failure-reason') || response.status}`)
    const expected = JSON.parse(await readFile(new URL('.well-known/apple-app-site-association', publicDir), 'utf8'))
    assert.deepEqual(await response.json(), expected, 'Apple CDN: association matches source')
    console.log('PASS Apple CDN association')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
