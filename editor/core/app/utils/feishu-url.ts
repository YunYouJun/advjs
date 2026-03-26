const APP_TOKEN_RE = /\/base\/([A-Za-z0-9]+)/

/**
 * 从飞书多维表格 URL 中解析 app_token 和 table_id
 *
 * 支持格式:
 * - https://xxx.feishu.cn/base/XxxAppTokenXxx?table=tblXxx
 * - https://xxx.feishu.cn/base/XxxAppTokenXxx?table=tblXxx&view=vewXxx
 * - https://xxx.larkbase.com/base/XxxAppTokenXxx?table=tblXxx
 */
export function parseFeishuBitableUrl(url: string): {
  appToken: string
  tableId: string
} | null {
  if (!url)
    return null

  try {
    const appTokenMatch = url.match(APP_TOKEN_RE)
    if (!appTokenMatch)
      return null

    const appToken = appTokenMatch[1]

    const urlObj = new URL(url)
    const tableId = urlObj.searchParams.get('table')
    if (!tableId)
      return null

    return { appToken, tableId }
  }
  catch {
    return null
  }
}
