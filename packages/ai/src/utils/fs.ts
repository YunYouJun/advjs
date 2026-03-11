/**
 * File system utilities shared across packages
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const newlinePattern = /\n/g

/**
 * Ensure directory exists
 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

/**
 * Write JSON file options
 */
export interface WriteJSONOptions {
  spaces?: number
  EOL?: string
}

/**
 * Write JSON file
 */
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
