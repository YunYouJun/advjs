import { readFileSync } from 'node:fs'
import path from 'node:path'

export const promptsDir = path.resolve(import.meta.dirname, '../prompts')
export const distDir = path.resolve(import.meta.dirname, '../dist')
export const typesDir = path.resolve(import.meta.dirname, './types')

export const dramaWriterPath = path.resolve(promptsDir, 'drama-writer.md')
export const prompts = {
  dramaWriter: readFileSync(dramaWriterPath, 'utf-8'),
}

export const configTSPath = path.resolve(typesDir, 'config.ts')
export const configTSContent = readFileSync(configTSPath, 'utf-8')

export const aiGeneratedDir = path.resolve(import.meta.dirname, '../examples/ai-generated')
