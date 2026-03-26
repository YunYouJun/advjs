/**
 * 飞书 OAuth 回调处理
 *
 * 接收飞书授权回调的 code，换取 user_access_token，存入 session
 * @see https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string

  if (!code) {
    throw createError({
      statusCode: 400,
      message: 'Missing authorization code',
    })
  }

  const client = useFeishuClient()

  try {
    // 使用 Lark SDK 换取 user_access_token
    const tokenRes = await client.authen.oidcAccessToken.create({
      data: {
        grant_type: 'authorization_code',
        code,
      },
    })

    if (!tokenRes?.data) {
      throw createError({
        statusCode: 500,
        message: 'Failed to get access token from Feishu',
      })
    }

    const tokenData = tokenRes.data

    // 存入 session（复用 nuxt-auth-utils 的 setUserSession）
    const existingSession = await getUserSession(event)
    await setUserSession(event, {
      user: {
        ...existingSession?.user,
        feishu: {
          open_id: tokenData.open_id || '',
          union_id: tokenData.union_id || '',
          name: tokenData.name || '',
          avatar_url: tokenData.avatar_url || '',
          email: tokenData.email || '',
          user_access_token: tokenData.access_token || '',
          token_type: tokenData.token_type || '',
          expires_in: tokenData.expires_in || 0,
          refresh_token: tokenData.refresh_token || '',
          refresh_expires_in: tokenData.refresh_expires_in || 0,
        },
      },
      loggedInAt: new Date(),
    })

    return sendRedirect(event, '/characters')
  }
  catch (e: any) {
    console.error('Feishu OAuth callback error:', e)
    throw createError({
      statusCode: 500,
      message: `Feishu OAuth failed: ${e.message || 'Unknown error'}`,
    })
  }
})
