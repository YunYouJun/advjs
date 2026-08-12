import type { AdvEntryOptions, ResolvedAdvOptions } from '@advjs/types'
import type { InlineConfig, ResolvedConfig } from 'vite'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path, { join, relative, resolve } from 'node:path'
import { mergeConfig, build as viteBuild } from 'vite'
import { printInfo } from '../../cli/utils'
import { resolveOptions } from '../../options'
import { loadProject } from '../../project'
import setupIndexHtml from '../../setups/indexHtml'
import { AdvCommandError } from '../errors'
import { resolveViteConfigs } from '../shared'

export interface BuildAssetSummary {
  path: string
  bytes: number
  sha256: string
}

export interface AdvBuildResult {
  root: string
  outDir: string
  assets: BuildAssetSummary[]
}

export class BuildError extends AdvCommandError {
  constructor(message: string, options?: ErrorOptions) {
    super('ADV_BUILD', message, options)
    this.name = 'BuildError'
  }
}

function compareBuildPaths(left: string, right: string) {
  if (left < right)
    return -1
  if (left > right)
    return 1
  return 0
}

async function summarizeBuildAssets(directory: string): Promise<BuildAssetSummary[]> {
  const files: string[] = []

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => compareBuildPaths(left.name, right.name))) {
      const entryPath = join(current, entry.name)
      if (entry.isDirectory())
        await walk(entryPath)
      else if (entry.isFile())
        files.push(entryPath)
    }
  }

  await walk(directory)
  return await Promise.all(files.map(async (file) => {
    const content = await readFile(file)
    return {
      path: relative(directory, file).replaceAll('\\', '/'),
      bytes: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
    }
  }))
}

export async function build(
  options: ResolvedAdvOptions,
  viteConfig: InlineConfig = {},
) {
  const indexPath = resolve(options.userRoot, 'index.html')

  let originalIndexHTML: string | undefined
  if (existsSync(indexPath))
    originalIndexHTML = await readFile(indexPath, 'utf-8')

  await writeFile(indexPath, setupIndexHtml(options), 'utf-8')
  let config: ResolvedConfig = undefined!

  try {
    const inlineConfig = await resolveViteConfigs(
      options,
      <InlineConfig>{
        plugins: [
          {
            name: 'resolve-config',
            configResolved(_config) {
              config = _config
            },
          },
        ],
      },
      viteConfig,
      'build',
    )

    await viteBuild(inlineConfig)
  }
  finally {
    if (originalIndexHTML != null)
      await writeFile(indexPath, originalIndexHTML, 'utf-8')
    else
      await unlink(indexPath)
  }

  const outDir = resolve(options.userRoot, config.build.outDir)

  // _redirects for SPA
  const redirectsPath = resolve(outDir, '_redirects')
  if (!existsSync(redirectsPath))
    await writeFile(redirectsPath, `${config.base}*    ${config.base}index.html   200\n`, 'utf-8')

  return outDir
}

export async function advBuild(entryOptions: AdvEntryOptions): Promise<AdvBuildResult> {
  try {
    const options = await resolveOptions(entryOptions, 'build')
    const loadedProject = await loadProject({ root: options.userRoot })
    const compilationErrors = loadedProject.result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')
    if (loadedProject.config.format !== 'synthetic' && compilationErrors.length > 0) {
      throw new BuildError(
        `Project compilation failed with ${compilationErrors.length} error(s): ${compilationErrors[0].code} ${compilationErrors[0].message}`,
      )
    }

    printInfo(options)

    const mergedViteConfig = mergeConfig({
      base: options.base || '/',
      build: {
        outDir: path.resolve(options.userRoot, options.outDir || 'dist'),
      },
    }, entryOptions.vite || {})
    const outDir = await build(options, mergedViteConfig)
    return {
      root: options.userRoot,
      outDir,
      assets: await summarizeBuildAssets(outDir),
    }
  }
  catch (error) {
    if (error instanceof BuildError)
      throw error
    throw new BuildError(error instanceof Error ? error.message : String(error), { cause: error })
  }
}
