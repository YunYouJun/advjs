import path from 'node:path'
import fs from 'fs-extra'
import { aiFormatJSONData } from '../examples/ai-data'

const AI_FORMAT_JSON_PATH = path.resolve(import.meta.dirname, '../examples/ai-format.json')

/**
 * 生成 AI 格式的 JSON 文件
 *
 * 以便设置工作流的时候导入格式
 */
export async function genAIFormatJson() {
  await fs.writeJSON(AI_FORMAT_JSON_PATH, aiFormatJSONData, { spaces: 2, EOL: '\n' })
}

genAIFormatJson()
