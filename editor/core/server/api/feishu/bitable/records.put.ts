/**
 * PUT /api/feishu/bitable/records
 *
 * Body: { app_token?: string, table_id: string, record_id: string, fields: Partial<AdvCharacter> }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const client = useFeishuClient()
  const appToken = body.app_token || config.feishu.bitableAppToken
  const tableId = body.table_id
  const recordId = body.record_id

  if (!appToken || !tableId || !recordId) {
    throw createError({
      statusCode: 400,
      message: 'Missing required params: app_token, table_id, or record_id',
    })
  }

  const fields = characterToFields(body.fields || {})

  const res = await client.bitable.appTableRecord.update({
    path: {
      app_token: appToken,
      table_id: tableId,
      record_id: recordId,
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
