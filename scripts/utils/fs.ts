/**
 * File system utilities to replace fs-extra with native Node.js APIs
 */
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const newlinePattern = /\n/g

/**
 * Ensure directory exists (async)
 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

/**
 * Write JSON file (async)
 */
export interface WriteJSONOptions {
  spaces?: number
  EOL?: string
}

export async function writeJSON(
  file: string,
  data: any,
  options: WriteJSONOptions = {},
): Promise<void> {
  const { spaces = 2, EOL = '\n' } = options
  let content = JSON.stringify(data, null, spaces)
  if (EOL !== '\n') {
    content = content.replace(newlinePattern, EOL)
  }
  await ensureDir(dirname(file))
  await writeFile(file, content + EOL, 'utf-8')
}

/**
 * Copy file (async)
 */
export async function copy(src: string, dest: string): Promise<void> {
  await ensureDir(dirname(dest))
  await copyFile(src, dest)
}

/**
 * Empty directory (async)
 */
export async function emptyDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
  await ensureDir(dir)
}

// Re-export native fs functions
export { copyFile, writeFile } from 'node:fs/promises'
