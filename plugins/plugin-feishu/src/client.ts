import process from 'node:process'
import * as lark from '@larksuiteoapi/node-sdk'
import 'dotenv/config'

export const client = new lark.Client({
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
  appType: lark.AppType.SelfBuild,
  domain: lark.Domain.Feishu,
})
