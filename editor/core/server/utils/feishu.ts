import type { Client } from '@larksuiteoapi/node-sdk'
import { assertEditorServerCapability } from './capabilities'

let _client: Client | null = null

/**
 * Get or create Feishu (Lark) SDK client for server-side usage
 */
export async function useFeishuClient() {
  assertEditorServerCapability('feishu')
  if (!_client) {
    const lark = await import('@larksuiteoapi/node-sdk')
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
