import type { ProjectTemplateDefinition } from '../../../editor/core/app/templates/types'
import { Buffer } from 'node:buffer'
import { lstat, mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { projectFolderError, projectNameError } from './project-names.js'

export function parseProjectCreationInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid project creation options')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => key !== 'name' && key !== 'folderName')
    || typeof input.name !== 'string' || typeof input.folderName !== 'string'
    || projectNameError(input.name) || projectFolderError(input.folderName)) {
    throw new Error('Invalid game name or project folder name')
  }
  return { name: input.name.trim(), folderName: input.folderName }
}

export async function suggestProjectFolder(directory: string, templateId: string) {
  const base = ({ 'starter': 'hello-advjs', 'rainy-letter': 'rainy-letter', 'adv-md': 'my-story', 'blank': 'my-game', 'flow': 'flow-game' } as Record<string, string>)[templateId] ?? 'my-game'
  for (let suffix = 1; suffix <= 1000; suffix++) {
    const name = suffix === 1 ? base : `${base}-${suffix}`
    try {
      await lstat(resolve(directory, name))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return name
      throw error
    }
  }
  throw new Error('请更换存储位置或使用其他文件夹名称。')
}

export function findProjectTemplate(templates: readonly ProjectTemplateDefinition[], id: unknown) {
  const template = typeof id === 'string' && templates.find(item => item.meta.id === id)
  if (!template)
    throw new Error('Unknown project template')
  return template
}

export async function createProjectDirectory(template: ProjectTemplateDefinition, destination: string, projectName = basename(destination)) {
  // Renderer callers provide only a known ID, never file paths or content.
  const paths = new Set<string>()
  for (const file of template.files) {
    if (!file.name || file.name.includes('\\') || file.name.split('/').some(part => !part || part === '.' || part === '..') || paths.has(file.name))
      throw new Error('Invalid project template path')
    paths.add(file.name)
  }
  const root = resolve(destination)
  try {
    // Exclusive creation rejects existing folders, files and symlinks.
    await mkdir(root)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('项目文件夹已存在，请使用新名称；现有文件未被修改。')
    throw error
  }
  for (const file of template.files) {
    const path = resolve(root, file.name)
    await mkdir(dirname(path), { recursive: true })
    const name = file.name.endsWith('.json') ? JSON.stringify(projectName).slice(1, -1) : projectName
    const content = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content.replaceAll('{{projectName}}', () => name)
    await writeFile(path, content, { flag: 'wx' })
  }
  return root
}
