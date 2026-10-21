/* eslint-disable no-console -- CLI check: reports PASS lines to stdout. */
// Resolves public registration metadata for advjs-studio-ios and checks that
// unregistered variants fail closed. Never signs in or issues credentials.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import process from 'node:process'

const endpoint = 'https://api.yunle.fun/sso-ticket'
const origin = 'https://studio.advjs.org'
const request = {
  action: 'resolveSsoAuthorization',
  mode: 'redirect',
  clientId: 'advjs-studio-ios',
  targetOrigin: origin,
  returnUrl: `${origin}/auth/callback`,
  scope: 'identity:bootstrap',
  nonce: randomBytes(32).toString('base64url'),
  codeChallenge: createHash('sha256').update(randomBytes(32)).digest('base64url'),
  codeChallengeMethod: 'S256',
}

const cases = [
  ['registered callback', {}, 200, undefined],
  ['web client root is not a native callback', { returnUrl: `${origin}/` }, 403, 'return_url_not_allowed'],
  ['unregistered origin', { targetOrigin: 'https://example.com', returnUrl: 'https://example.com/auth/callback' }, 403, 'origin_not_allowed'],
  ['unapproved scope', { scope: 'membership:read' }, 400, 'invalid_scope'],
  ['missing PKCE', { codeChallenge: '' }, 400, 'pkce_required'],
]

async function main() {
  for (const [name, change, status, reason] of cases) {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://www.yunle.fun' },
      body: JSON.stringify({ ...request, ...change }),
    })
    const data = await response.json()
    assert.equal(response.status, status, `${name}: ${JSON.stringify(data.reason)}`)
    assert.equal(data.reason, reason, name)
    assert.equal(data.ticket, undefined, 'metadata resolution must not issue credentials')
    assert.equal(data.code, undefined, 'metadata resolution must not issue authorization codes')
    if (status === 200) {
      assert.equal(data.presentation.appId, 'advjs-studio')
      assert.equal(data.presentation.consent, 'explicit')
      assert.equal(data.request.returnUrl, request.returnUrl)
    }
    console.log(`PASS ${name}: HTTP ${status}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
