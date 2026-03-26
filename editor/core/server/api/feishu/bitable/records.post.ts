/**
 * POST /api/feishu/bitable/records
 *
 * Body: { app_token?: string, table_id: string, fields: Partial<AdvCharacter> }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const client = useFeishuClient()
  const appToken = body.app_token || config.feishu.bitableAppToken
  const tableId = body.table_id

  if (!appToken || !tableId) {
    throw createError({
      statusCode: 400,
      message: 'Missing required params: app_token or table_id',
    })
  }

  const fields = characterToFields(body.fields || {})

  const res = await client.bitable.appTableRecord.create({
    path: {
      app_token: appToken,
      table_id: tableId,
    },
    data: {
      fields,
    },
  })

  return {
    record_id: res.data?.record?.record_id,
    fields: res.data?.record?.fields,
  }
})
