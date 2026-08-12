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
    const appId = config.feishu?.appId
    const appSecret = config.feishu?.appSecret
    if (!appId || !appSecret) {
      throw createError({
        statusCode: 503,
        message: 'Feishu integration is missing appId or appSecret',
      })
    }
    _client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    })
  }
  return _client
}
