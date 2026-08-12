import { afterEach, expect, it, vi } from 'vitest'

import { createAuthUrl, getClient } from '../src'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('create auth url', () => {
  const clientId = 'cli_1234567890abcdef' // Replace with your actual client ID
  const url = createAuthUrl({
    clientId,
    redirectUri: 'https://example.com/api/oauth/callback',
    scope: 'bitable:app:readonly contact:contact',
    state: 'RANDOMSTRING',
  })
  expect(url).toEqual(`https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=${clientId}&redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Foauth%2Fcallback&scope=bitable:app:readonly%20contact:contact&state=RANDOMSTRING`)
})

it('loads without credentials and validates them only when the client is used', () => {
  vi.stubEnv('FEISHU_APP_ID', '')
  vi.stubEnv('FEISHU_APP_SECRET', '')
  expect(() => getClient()).toThrow('FEISHU_APP_ID and FEISHU_APP_SECRET are required')
})
