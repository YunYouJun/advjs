import process from 'node:process'
import { consola } from 'consola'
import OpenAI from 'openai'
import { dtsContent, prompts } from '../config'
import { renderTemplate } from './render'
import 'dotenv/config'

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  // apiKey: '<DeepSeek API Key>'
  apiKey: process.env.DEEPSEEK_API_KEY,
})

/**
 * 生成 ADV 剧本 JSON
 */
export async function generateAdvDramaJSON(params: {
  /**
   * 故事背景
   */
  storyBackground: string
}) {
  const dramaWriterPrompt = renderTemplate(prompts.dramaWriter, {
    dts: dtsContent,
    story_background: params.storyBackground,
  })
  consola.debug('dramaWriterPrompt:', dramaWriterPrompt)
  const completion = await openai.chat.completions.create({
    messages: [
      { role: 'system', content: dramaWriterPrompt },
    ],
    model: 'deepseek-chat',
    response_format: {
      type: 'json_object',
    },
  })
  return completion.choices[0].message.content
}
