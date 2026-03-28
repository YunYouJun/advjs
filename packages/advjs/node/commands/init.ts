import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { t } from '../cli/i18n'

export interface InitOptions {
  root?: string
  name?: string
  force?: boolean
}

/**
 * Error class for init command failures.
 * Allows CLI layer to distinguish expected errors from unexpected crashes.
 */
export class InitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InitError'
  }
}

/**
 * Resolve the template directory bundled with the CLI package.
 */
function resolveTemplateDir(): string {
  const currentDir = fileURLToPath(new URL('.', import.meta.url))
  // Walk up from node/commands/ to package root, then into template/
  const packageRoot = resolve(currentDir, '..', '..')
  const templateDir = join(packageRoot, 'template')

  if (!existsSync(templateDir)) {
    throw new InitError(`Template directory not found: ${templateDir}`)
  }

  return templateDir
}

// Module-level regex (per e18e/prefer-static-regex)
const PLACEHOLDER_RE = /\{\{projectName\}\}/g

/**
 * Replace `{{projectName}}` placeholders in a file.
 */
function replaceInFile(filePath: string, name: string): void {
  const content = readFileSync(filePath, 'utf-8')
  const newContent = content.replace(PLACEHOLDER_RE, name)
  if (newContent !== content)
    writeFileSync(filePath, newContent, 'utf-8')
}

/**
 * Recursively walk a directory and return all file paths.
 */
function walkFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      files.push(...walkFiles(full))
    else
      files.push(full)
  }
  return files
}

/**
 * Core init logic — creates a new ADV.JS project from the built-in template.
 */
export async function advInit(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd()
  const targetDir = options.root ? resolve(cwd, options.root) : cwd

  // Check if target already has ADV.JS content
  const advDir = join(targetDir, 'adv')
  const configFile = join(targetDir, 'adv.config.json')

  if (!options.force && (existsSync(advDir) || existsSync(configFile))) {
    consola.error(t('init.already_exists', targetDir))
    throw new InitError(t('init.already_exists', targetDir))
  }

  const templateDir = resolveTemplateDir()

  consola.start(t('init.creating', targetDir))

  // Recursively copy template to target
  try {
    cpSync(templateDir, targetDir, { recursive: true })
  }
  catch (err) {
    throw new InitError(`Failed to copy template: ${(err as Error).message}`)
  }

  // Walk once; reuse for both placeholder replacement and file count
  const allFiles = walkFiles(targetDir)

  // Replace {{projectName}} placeholders if --name is provided
  if (options.name) {
    for (const file of allFiles)
      replaceInFile(file, options.name)
  }

  consola.log('')
  consola.success(colors.green(t('init.done', allFiles.length)))

  // Show project structure hint
  consola.log('')
  consola.info(t('init.next_steps'))
  consola.log(`  ${colors.cyan('adv check')}   — ${t('init.hint_check')}`)
  consola.log(`  ${colors.cyan('adv context')} — ${t('init.hint_context')}`)
  consola.log(`  ${colors.cyan('adv dev')}     — ${t('init.hint_dev')}`)
}
