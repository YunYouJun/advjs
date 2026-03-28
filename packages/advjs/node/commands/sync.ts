import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import prompts from 'prompts'
import { t } from '../cli/i18n'
import { resolveGameRoot } from './check'

export interface SyncOptions {
  root?: string
}

/**
 * Recursively collect all files in a directory, returning relative paths.
 */
function collectFiles(dir: string, base?: string): string[] {
  if (!existsSync(dir))
    return []

  const files: string[] = []
  const baseDir = base || dir

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir))
    }
    else {
      files.push(relative(baseDir, fullPath))
    }
  }

  return files
}

const log = consola.log.bind(consola)

/**
 * Error class for sync command failures.
 * Allows CLI layer to distinguish expected errors from unexpected crashes.
 */
export class SyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncError'
  }
}

async function loadCosStorage() {
  try {
    const { CosStorage } = await import('@advjs/plugin-cos')
    return new CosStorage()
  }
  catch {
    consola.warn(t('sync.cos_missing'))

    const { install } = await prompts({
      type: 'confirm',
      name: 'install',
      message: t('sync.cos_install_prompt'),
      initial: true,
    })

    if (!install) {
      throw new SyncError(t('sync.cos_install_cancelled'))
    }

    try {
      consola.start(t('sync.cos_installing'))
      execSync('pnpm add @advjs/plugin-cos', { stdio: 'inherit' })
      consola.success(t('sync.cos_installed'))
      const { CosStorage } = await import('@advjs/plugin-cos')
      return new CosStorage()
    }
    catch (installErr: unknown) {
      throw new SyncError(
        `${t('sync.cos_install_failed')}: ${installErr instanceof Error ? installErr.message : String(installErr)}`,
      )
    }
  }
}

/**
 * Push local adv/ directory to COS.
 */
export async function advPush(options: SyncOptions) {
  const cwd = process.cwd()
  const gameRoot = resolveGameRoot(cwd, options.root)

  if (!existsSync(gameRoot)) {
    consola.error(t('sync.no_root', gameRoot))
    throw new SyncError(t('sync.no_root', gameRoot))
  }

  consola.start(t('sync.push_start'))
  const cos = await loadCosStorage()
  const files = collectFiles(gameRoot)

  let uploaded = 0
  let failed = 0
  for (const file of files) {
    const localPath = join(gameRoot, file)
    try {
      await cos.upload(localPath, file)
      uploaded++
      log(colors.green(`  ↑ ${file}`))
    }
    catch (err: unknown) {
      failed++
      consola.warn(`  ✗ ${file}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  process.stdout.write('\n')
  consola.success(t('sync.push_done', uploaded, files.length))
  if (failed > 0)
    throw new SyncError(t('sync.partial_failure', failed))
}

/**
 * Pull from COS to local adv/ directory.
 */
export async function advPull(options: SyncOptions) {
  const cwd = process.cwd()
  const gameRoot = resolveGameRoot(cwd, options.root)

  if (!existsSync(gameRoot)) {
    consola.info(t('sync.no_root', gameRoot))
    mkdirSync(gameRoot, { recursive: true })
    consola.info(`Created directory: ${gameRoot}`)
  }

  consola.start(t('sync.pull_start'))
  const cos = await loadCosStorage()
  const remoteFiles = await cos.list()

  let downloaded = 0
  let failed = 0
  for (const file of remoteFiles) {
    const localPath = join(gameRoot, file)
    try {
      await cos.download(file, localPath)
      downloaded++
      log(colors.cyan(`  ↓ ${file}`))
    }
    catch (err: unknown) {
      failed++
      consola.warn(`  ✗ ${file}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  process.stdout.write('\n')
  consola.success(t('sync.pull_done', downloaded, remoteFiles.length))
  if (failed > 0)
    throw new SyncError(t('sync.partial_failure', failed))
}

/**
 * Bidirectional sync: compare timestamps and sync in both directions.
 */
export async function advSync(options: SyncOptions) {
  const cwd = process.cwd()
  const gameRoot = resolveGameRoot(cwd, options.root)

  if (!existsSync(gameRoot)) {
    consola.error(t('sync.no_root', gameRoot))
    throw new SyncError(t('sync.no_root', gameRoot))
  }

  consola.start(t('sync.sync_start'))
  const cos = await loadCosStorage()

  // Collect local files
  const localFiles = new Set(collectFiles(gameRoot))

  // Collect remote files
  const remoteFiles = new Set(await cos.list())

  // All unique files
  const allFiles = new Set([...localFiles, ...remoteFiles])

  let uploaded = 0
  let downloaded = 0
  let skipped = 0
  let failed = 0
  let conflicted = 0

  // Conflict threshold: 30 seconds to account for network latency and clock drift
  const CONFLICT_THRESHOLD_MS = 30_000

  for (const file of allFiles) {
    const localPath = join(gameRoot, file)
    const localExists = localFiles.has(file)
    const remoteExists = remoteFiles.has(file)

    try {
      if (localExists && !remoteExists) {
        // Local only → push
        await cos.upload(localPath, file)
        uploaded++
        log(colors.green(`  ↑ ${file}`))
      }
      else if (!localExists && remoteExists) {
        // Remote only → pull
        await cos.download(file, localPath)
        downloaded++
        log(colors.cyan(`  ↓ ${file}`))
      }
      else if (localExists && remoteExists) {
        // Both exist → compare timestamps with conflict detection
        const localStat = statSync(localPath)
        const remoteMtime = await cos.getLastModified(file)

        if (!remoteMtime) {
          skipped++
          continue
        }

        const timeDiff = Math.abs(localStat.mtime.getTime() - remoteMtime.getTime())

        if (timeDiff < CONFLICT_THRESHOLD_MS) {
          // Timestamps too close — potential conflict
          conflicted++
          consola.warn(colors.yellow(`  ⚠ ${file}: ${t('sync.conflict_detected')}`))
          log(colors.dim(`    local:  ${localStat.mtime.toISOString()}`))
          log(colors.dim(`    remote: ${remoteMtime.toISOString()}`))
        }
        else if (localStat.mtime > remoteMtime) {
          await cos.upload(localPath, file)
          uploaded++
          log(colors.green(`  ↑ ${file} (newer local)`))
        }
        else {
          await cos.download(file, localPath)
          downloaded++
          log(colors.cyan(`  ↓ ${file} (newer remote)`))
        }
      }
    }
    catch (err: unknown) {
      failed++
      consola.warn(`  ✗ ${file}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  process.stdout.write('\n')
  consola.success(t('sync.sync_done', uploaded, downloaded, skipped))
  if (conflicted > 0)
    consola.warn(t('sync.conflict_summary', conflicted))
  if (failed > 0)
    throw new SyncError(t('sync.partial_failure', failed))
}
