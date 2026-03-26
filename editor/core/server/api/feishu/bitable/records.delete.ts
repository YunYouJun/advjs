/**
 * DELETE /api/feishu/bitable/records
 *
 * Body: { app_token?: string, table_id: string, record_id: string }
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

  await client.bitable.appTableRecord.delete({
    path: {
      app_token: appToken,
      table_id: tableId,
      record_id: recordId,
    },
  })

  return { success: true }
})
