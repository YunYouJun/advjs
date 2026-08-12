import process from 'node:process'
import * as lark from '@larksuiteoapi/node-sdk'
import 'dotenv/config'

let client: lark.Client | undefined

export function getClient() {
  if (client)
    return client

  const appId = process.env.FEISHU_APP_ID
  const appSecret = process.env.FEISHU_APP_SECRET
  if (!appId || !appSecret)
    throw new Error('FEISHU_APP_ID and FEISHU_APP_SECRET are required')

  client = new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  })
  return client
}
