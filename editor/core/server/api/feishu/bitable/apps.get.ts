/**
 * 列出飞书多维表格下的所有数据表
 *
 * 使用用户的 user_access_token 调用飞书 API
 * 需要先通过 OAuth 授权获得 bitable:app scope
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const feishuUser = session?.user?.feishu

  if (!feishuUser?.user_access_token) {
    throw createError({
      statusCode: 401,
      message: 'Feishu authorization required. Please login with Feishu first.',
    })
  }

  const query = getQuery(event)
  const appToken = (query.app_token as string) || useRuntimeConfig().feishu.bitableAppToken

  if (!appToken) {
    throw createError({
      statusCode: 400,
      message: 'app_token is required (via query param or FEISHU_BITABLE_APP_TOKEN env)',
    })
  }

  const client = useFeishuClient()

  try {
    const res = await client.bitable.appTable.list({
      path: { app_token: appToken },
    }, {
      headers: {
        Authorization: `Bearer ${feishuUser.user_access_token}`,
      },
    })

    return {
      tables: res?.data?.items?.map(item => ({
        table_id: item.table_id,
        name: item.name,
        revision: item.revision,
      })) || [],
    }
  }
  catch (e: any) {
    console.error('Failed to list bitable tables:', e)
    throw createError({
      statusCode: 500,
      message: `Failed to list tables: ${e.message || 'Unknown error'}`,
    })
  }
})
