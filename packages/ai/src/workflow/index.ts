import path from 'node:path'
import { consola } from 'consola'
import { ensureDir, writeJSON } from '../utils/fs'
import { generateAdvDramaJSON } from './chat'

export * from './hunyuan'

export interface AdvWriterWorkflowParams {
  /**
   * 主人公
   */
  protagonist?: string
  /**
   * 故事背景
   */
  storyBackground: string

  /**
   * 是否覆盖
   * @default false
   */
  overwrite?: boolean
  /**
   * 目标文件夹
   */
  outputDir?: string
}

/**
 * 剧本工作流
 */
export async function writerWorkflow(params: AdvWriterWorkflowParams) {
  const aiStr = await generateAdvDramaJSON(params)
  try {
    const aiData = JSON.parse(aiStr || '{}')
    if (params.outputDir) {
      await ensureDir(params.outputDir)
      const fileName = params.overwrite ? 'adv.ai.json' : `adv.ai.${Date.now()}.json`
      await writeJSON(path.resolve(params.outputDir, fileName), aiData, {
        spaces: 2,
        EOL: '\n',
      })
    }
    consola.success('🔀 [ADV Writer] completed successfully.')
  }
  catch (error) {
    consola.error('🔀 [ADV Writer] failed:', error)
  }
}
