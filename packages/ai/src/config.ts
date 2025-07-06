import path from 'node:path'
import fs from 'fs-extra'

export const promptsDir = path.resolve(import.meta.dirname, '../prompts')
export const distDir = path.resolve(import.meta.dirname, '../dist')
export const typesDir = path.resolve(import.meta.dirname, './types')

export const dramaWriterPath = path.resolve(promptsDir, 'drama-writer.md')
export const prompts = {
  dramaWriter: fs.readFileSync(dramaWriterPath, 'utf-8'),
}

export const configTSPath = path.resolve(typesDir, 'config.ts')
export const configTSContent = fs.readFileSync(configTSPath, 'utf-8')

export const aiGeneratedDir = path.resolve(import.meta.dirname, '../examples/ai-generated')
