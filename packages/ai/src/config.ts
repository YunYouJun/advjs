import path from 'node:path'
import fs from 'fs-extra'

export const promptsDir = path.resolve(import.meta.dirname, '../prompts')

export const dramaWriterPath = path.resolve(promptsDir, 'drama-writer.md')
export const prompts = {
  dramaWriter: fs.readFileSync(dramaWriterPath, 'utf-8'),
}

export const distDir = path.resolve(import.meta.dirname, '../dist')
export const dtsPath = path.resolve(distDir, 'index.d.ts')
export const dtsContent = fs.readFileSync(dtsPath, 'utf-8')

export const aiGeneratedDir = path.resolve(import.meta.dirname, '../examples/ai-generated')
