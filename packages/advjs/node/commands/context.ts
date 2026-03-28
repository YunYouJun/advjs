import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { parseCharacterMd } from '@advjs/parser'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import { t } from '../cli/i18n'
import { resolveGameRoot } from './check'
import { parseSceneFrontmatter, readOptionalFile, scanFiles } from './utils'

export interface ProjectContext {
  root: string
  world?: string
  outline?: string
  glossary?: string
  chaptersReadme?: string
  charactersReadme?: string
  scenesReadme?: string
  characters?: { id: string, name: string, file: string, content?: string }[]
  chapters?: { file: string, content?: string }[]
  scenes?: { id?: string, name?: string, file: string, content?: string }[]
}

export interface ContextOptions {
  root?: string
  full?: boolean
  chapter?: number
}

/**
 * Core function: scan project and collect context.
 * Used by both CLI (`adv context`) and MCP Server.
 */
export async function resolveProjectContext(root: string, options?: { full?: boolean, chapter?: number }): Promise<ProjectContext> {
  const chaptersDir = join(root, 'chapters')
  const charactersDir = join(root, 'characters')
  const scenesDir = join(root, 'scenes')

  const context: ProjectContext = {
    root,
    world: readOptionalFile(join(root, 'world.md')),
    outline: readOptionalFile(join(root, 'outline.md')),
    glossary: readOptionalFile(join(root, 'glossary.md')),
    chaptersReadme: readOptionalFile(join(chaptersDir, 'README.md')),
    charactersReadme: readOptionalFile(join(charactersDir, 'README.md')),
    scenesReadme: readOptionalFile(join(scenesDir, 'README.md')),
  }

  // Scan characters
  const characterFiles = scanFiles(charactersDir, '.character.md')
  context.characters = []
  for (const file of characterFiles) {
    const content = readFileSync(file, 'utf-8')
    try {
      const char = parseCharacterMd(content)
      context.characters.push({
        id: char.id,
        name: char.name,
        file: basename(file),
        ...(options?.full ? { content } : {}),
      })
    }
    catch {
      // Skip invalid character files
    }
  }

  // Scan chapters
  const chapterFiles = scanFiles(chaptersDir, '.adv.md').sort()
  context.chapters = []

  if (options?.chapter) {
    // Only include the specified chapter
    const target = chapterFiles[options.chapter - 1]
    if (target) {
      context.chapters.push({
        file: basename(target),
        content: readFileSync(target, 'utf-8'),
      })
    }
    else {
      consola.warn(`Chapter ${options.chapter} not found (total: ${chapterFiles.length})`)
    }
  }
  else {
    for (const file of chapterFiles) {
      context.chapters.push({
        file: basename(file),
        ...(options?.full ? { content: readFileSync(file, 'utf-8') } : {}),
      })
    }
  }

  // Scan scenes
  const sceneFiles = scanFiles(scenesDir, '.md')
    .filter(f => !basename(f).startsWith('README'))
  context.scenes = []
  for (const file of sceneFiles) {
    const content = readFileSync(file, 'utf-8')
    const scene = parseSceneFrontmatter(content)
    context.scenes.push({
      id: scene.id,
      name: scene.name,
      file: basename(file),
      ...(options?.full ? { content } : {}),
    })
  }

  return context
}

/**
 * Format project context as a single Markdown document for AI consumption.
 */
function formatContext(ctx: ProjectContext, options?: ContextOptions): string {
  const sections: string[] = []

  if (ctx.world) {
    sections.push('# World\n')
    sections.push(ctx.world)
    sections.push('')
  }

  if (ctx.outline) {
    sections.push('# Outline\n')
    sections.push(ctx.outline)
    sections.push('')
  }

  if (ctx.chaptersReadme) {
    sections.push('# Chapters\n')
    sections.push(ctx.chaptersReadme)
    sections.push('')
  }

  if (ctx.charactersReadme) {
    sections.push('# Characters\n')
    sections.push(ctx.charactersReadme)
    sections.push('')
  }

  if (ctx.scenesReadme) {
    sections.push('# Scenes\n')
    sections.push(ctx.scenesReadme)
    sections.push('')
  }

  if (ctx.glossary) {
    sections.push('# Glossary\n')
    sections.push(ctx.glossary)
    sections.push('')
  }

  // Full mode: include file contents
  if (options?.full || options?.chapter) {
    if (ctx.characters?.some(c => c.content)) {
      sections.push('---\n')
      sections.push('# Character Details\n')
      for (const char of ctx.characters) {
        if (char.content) {
          sections.push(`## ${char.name} (${char.file})\n`)
          sections.push(char.content)
          sections.push('')
        }
      }
    }

    if (ctx.chapters?.some(c => c.content)) {
      sections.push('---\n')
      sections.push('# Chapter Contents\n')
      for (const ch of ctx.chapters) {
        if (ch.content) {
          sections.push(`## ${ch.file}\n`)
          sections.push(ch.content)
          sections.push('')
        }
      }
    }

    if (ctx.scenes?.some(s => s.content)) {
      sections.push('---\n')
      sections.push('# Scene Details\n')
      for (const scene of ctx.scenes) {
        if (scene.content) {
          sections.push(`## ${scene.name || scene.id || scene.file}\n`)
          sections.push(scene.content)
          sections.push('')
        }
      }
    }
  }

  return sections.join('\n')
}

const log = consola.log.bind(consola)

/**
 * Error class for context command failures.
 */
export class ContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContextError'
  }
}

/**
 * CLI entry: format and output project context to stdout.
 */
export async function advContext(options: ContextOptions) {
  const cwd = process.cwd()
  const gameRoot = resolveGameRoot(cwd, options.root)

  if (!existsSync(gameRoot)) {
    consola.error(t('context.no_root', gameRoot))
    throw new ContextError(t('context.no_root', gameRoot))
  }

  consola.start(t('context.resolving'))

  const ctx = await resolveProjectContext(gameRoot, {
    full: options.full,
    chapter: options.chapter,
  })

  const output = formatContext(ctx, options)

  process.stdout.write('\n')
  log(output)

  // Print summary
  const stats: string[] = []
  if (ctx.characters?.length)
    stats.push(t('context.stat_characters', ctx.characters.length))
  if (ctx.chapters?.length)
    stats.push(t('context.stat_chapters', ctx.chapters.length))
  if (ctx.scenes?.length)
    stats.push(t('context.stat_scenes', ctx.scenes.length))

  if (stats.length) {
    process.stdout.write('\n')
    consola.info(colors.dim(stats.join(' | ')))
  }
}
