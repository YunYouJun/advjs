/* eslint-disable no-console */
import process from 'node:process'
import { colors } from 'consola/utils'

/**
 * create auth url
 * [获取授权码](https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code)
 * @example https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=cli_a5d611352af9d00b&redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Foauth%2Fcallback&scope=bitable:app:readonly%20contact:contact&state=RANDOMSTRING
 */
export function createAuthUrl(params: {
  clientId?: string
  redirectUri?: string
  scope?: string
  state?: string
}) {
  const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize')
  const searchParams = url.searchParams
  searchParams.set('client_id', params.clientId || process.env.FEISHU_APP_ID || '')
  searchParams.set('redirect_uri', params.redirectUri || process.env.FEISHU_REDIRECT_URI || '')
  // 飞书 api 这里没转译 `:`，感觉是 bug
  // searchParams.set('scope', 'bitable:app:readonly contact:contact')
  // searchParams.set('state', '')
  return `${url.toString()}&scope=${encodeURI(params.scope || 'bitable:app')}`
    + `&state=${encodeURI(params.state || '')}`
}

/**
 * 开始授权流程（通过浏览器打开授权链接）
 */
export async function authorize(params: {
  redirectUri: string
  scope?: string
  state?: string
}) {
  const authUrl = createAuthUrl({
    clientId: process.env.FEISHU_APP_ID,
    redirectUri: params.redirectUri || 'http://localhost:3000/api/oauth/callback',
    scope: params.scope || 'bitable:app',
    state: params.state || 'RANDOMSTRING',
  })
  console.log()
  console.log(colors.green('请在浏览器中打开以下链接进行授权：'))
  console.log(colors.blue(authUrl))
  console.log()
}
