import * as lark from '@larksuiteoapi/node-sdk'

let _client: lark.Client | null = null

/**
 * Get or create Feishu (Lark) SDK client for server-side usage
 */
export function useFeishuClient() {
  if (!_client) {
    const config = useRuntimeConfig()
    _client = new lark.Client({
      appId: config.feishu?.appId || '',
      appSecret: config.feishu?.appSecret || '',
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    })
  }
  return _client
}
