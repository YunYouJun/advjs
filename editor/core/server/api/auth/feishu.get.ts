/**
 * 飞书 OAuth 授权入口
 *
 * 重定向用户到飞书授权页面
 * @see https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const { appId, redirectUri } = config.feishu

  if (!appId) {
    throw createError({
      statusCode: 500,
      message: 'FEISHU_APP_ID is not configured',
    })
  }

  // 构造回调地址：优先使用配置的 redirectUri，否则根据当前请求推断
  const callbackUrl = redirectUri || `${getRequestURL(event).origin}/api/auth/feishu/callback`

  const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', callbackUrl)

  // 飞书 API 的 scope 参数需要特殊处理编码
  const authUrl = `${url.toString()}&scope=${encodeURI('bitable:app')}&state=${encodeURI('feishu-oauth')}`

  return sendRedirect(event, authUrl)
})
