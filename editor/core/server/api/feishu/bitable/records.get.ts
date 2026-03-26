/**
 * GET /api/feishu/bitable/records
 *
 * Query params:
 * - table_id: string (required)
 * - record_id?: string (optional, for single record)
 * - page_size?: number
 * - page_token?: string
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig()
  const client = useFeishuClient()
  const appToken = (query.app_token as string) || config.feishu.bitableAppToken
  const tableId = query.table_id as string

  if (!appToken || !tableId) {
    throw createError({
      statusCode: 400,
      message: 'Missing required params: app_token or table_id',
    })
  }

  // Single record
  if (query.record_id) {
    const res = await client.bitable.appTableRecord.get({
      path: {
        app_token: appToken,
        table_id: tableId,
        record_id: query.record_id as string,
      },
    })
    return {
      record: fieldsToCharacter(res.data?.record),
    }
  }

  // List records
  const res = await client.bitable.appTableRecord.list({
    path: {
      app_token: appToken,
      table_id: tableId,
    },
    params: {
      page_size: Number(query.page_size) || 100,
      page_token: query.page_token as string || undefined,
    },
  })

  return {
    records: (res.data?.items || []).map(fieldsToCharacter),
    total: res.data?.total,
    hasMore: res.data?.has_more,
    pageToken: res.data?.page_token,
  }
})
