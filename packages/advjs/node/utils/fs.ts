/**
 * File system utilities to replace fs-extra with native Node.js APIs
 */
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const newlinePattern = /\n/g

/**
 * Check if a path exists (async)
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  }
  catch {
    return false
  }
}

/**
 * Check if a path exists (sync)
 */
export function pathExistsSync(path: string): boolean {
  return existsSync(path)
}

/**
 * Ensure directory exists (async)
 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

/**
 * Ensure directory exists (sync)
 */
export function ensureDirSync(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

/**
 * Read JSON file (async)
 */
export async function readJSON<T = any>(file: string): Promise<T> {
  const content = await readFile(file, 'utf-8')
  return JSON.parse(content)
}

/**
 * Read JSON file (sync)
 */
export function readJSONSync<T = any>(file: string): T {
  const content = readFileSync(file, 'utf-8')
  return JSON.parse(content)
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
 * Write JSON file (sync)
 */
export function writeJSONSync(
  file: string,
  data: any,
  options: WriteJSONOptions = {},
): void {
  const { spaces = 2, EOL = '\n' } = options
  let content = JSON.stringify(data, null, spaces)
  if (EOL !== '\n') {
    content = content.replace(newlinePattern, EOL)
  }
  ensureDirSync(dirname(file))
  writeFileSync(file, content + EOL, 'utf-8')
}

/**
 * Output file (ensure parent directory exists)
 */
export async function outputFile(
  file: string,
  data: string | Uint8Array,
  encoding: BufferEncoding = 'utf-8',
): Promise<void> {
  await ensureDir(dirname(file))
  await writeFile(file, data, encoding)
}

/**
 * Output file (sync)
 */
export function outputFileSync(
  file: string,
  data: string | Uint8Array,
  encoding: BufferEncoding = 'utf-8',
): void {
  ensureDirSync(dirname(file))
  writeFileSync(file, data, encoding)
}

/**
 * Copy file (async)
 */
export async function copy(src: string, dest: string): Promise<void> {
  await ensureDir(dirname(dest))
  await copyFile(src, dest)
}

/**
 * Copy file (sync)
 */
export function copySync(src: string, dest: string): void {
  ensureDirSync(dirname(dest))
  copyFileSync(src, dest)
}

/**
 * Remove file or directory (async)
 */
export async function remove(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
}

/**
 * Empty directory (async)
 */
export async function emptyDir(dir: string): Promise<void> {
  await remove(dir)
  await ensureDir(dir)
}

// Re-export native fs functions for convenience
export { copyFile, copyFileSync, existsSync, readFile, readFileSync, writeFile, writeFileSync } from 'node:fs'
export { mkdir, readdir, rm, stat } from 'node:fs/promises'
