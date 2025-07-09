import process from 'node:process'
import * as lark from '@larksuiteoapi/node-sdk'
import bodyParser from 'body-parser'
import express from 'express'
import { client } from './client'

/**
 *
 * ```ts
 * server.listen(3000)
 * ```
 */
export function createServer() {
  const server = express()
  server.use(bodyParser.json())

  const wsClient = new lark.WSClient({
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    loggerLevel: lark.LoggerLevel.info,
  })

  const eventDispatcher = new lark.EventDispatcher({
    encryptKey: process.env.FEISHU_ENCRYPT_KEY || '',
  }).register({
    'im.message.receive_v1': async (data) => {
      const chatId = data.message.chat_id

      const res = await client.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text: 'hello world' }),
          msg_type: 'text',
        },
      })
      return res
    },
  })

  wsClient.start({
    eventDispatcher,
  })

  server.use('/webhook/event', lark.adaptExpress(eventDispatcher, {
    autoChallenge: true,
  }))

  return server
}
