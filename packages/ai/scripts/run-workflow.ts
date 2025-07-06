import path from 'node:path'
import { aiGeneratedDir } from '../src/config'
import { writerWorkflow } from '../src/workflow'

writerWorkflow({
  storyBackground: '全世界前端水平下降一万倍，只有我不变。',
  outputDir: path.resolve(aiGeneratedDir, 'frontend'),
})
