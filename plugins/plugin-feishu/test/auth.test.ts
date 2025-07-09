import { expect, it } from 'vitest'

import { createAuthUrl } from '../src'

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
