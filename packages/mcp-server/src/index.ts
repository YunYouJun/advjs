import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join, relative } from 'node:path'
import process from 'node:process'
import { analyzeBranches, analyzeCoverage } from '@advjs/core'
import { parseAst, parseCharacterMd, stringifyCharacterMd } from '@advjs/parser'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadProject, resolveGameRoot, scanFiles } from 'advjs'
import { z } from 'zod'

// Re-export for external use
export { McpServer }

const _require = createRequire(import.meta.url)
const { version } = _require('../package.json') as { version: string }

/**
 * Sanitize a user-provided filename to prevent path traversal.
 * Strips directory components and rejects names with '..' segments.
 */
function sanitizeFilename(name: string): string {
  // Take only the basename to strip directory traversal
  const clean = basename(name)
  if (clean === '..' || clean === '.' || clean !== name)
    throw new Error(`Invalid filename: "${name}"`)
  return clean
}

function readOptionalFile(path: string): string | undefined {
  if (existsSync(path))
    return readFileSync(path, 'utf-8')
  return undefined
}

/** For tool/prompt callbacks: { content: [...] } */
function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

// ----------------- Asset builders (pure, no fs) -----------------

export interface CharacterCreateInput {
  id: string
  name: string
  imagePrompt?: string
  tags?: string[]
  aliases?: string[]
  personality?: string
  appearance?: string
  background?: string
  concept?: string
  speechStyle?: string
}

export interface ChapterCreateInput {
  filename: string
  title?: string
  plotSummary?: string
  content?: string
}

export interface SceneCreateInput {
  id: string
  name?: string
  imagePrompt?: string
  tags?: string[]
  description?: string
  atmosphere?: string
  chapters?: string[]
}

export interface CreateAdvMcpServerOptions {
  projectLoader?: typeof loadProject
}

/**
 * Build a chapter .adv.md file body. If `content` is provided, return as-is;
 * otherwise emit a frontmatter-only stub. Shared by `create_chapter` and the
 * bulk variant.
 */
export function buildChapterContent(params: ChapterCreateInput): string {
  if (params.content)
    return params.content
  const fmParts: string[] = []
  if (params.title)
    fmParts.push(`title: ${params.title}`)
  if (params.plotSummary)
    fmParts.push(`plotSummary: ${params.plotSummary}`)
  return fmParts.length > 0
    ? `---\n${fmParts.join('\n')}\n---\n`
    : ''
}

// YAML escape helpers. Scene frontmatter is hand-serialized to avoid pulling
// js-yaml into mcp-server — `parseSceneFrontmatter` reads id/name via regex and
// the engine never reads imagePrompt, so the format only needs to round-trip
// via standard YAML rules.

function yamlQuoteString(value: string): string {
  // Use double quotes; escape backslashes and double quotes.
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

function yamlSerializeString(value: string, indent = 0): string {
  if (value.includes('\n')) {
    // Folded scalar with strip chomping (>-) so the field doesn't trail blank lines.
    const pad = ' '.repeat(indent + 2)
    const lines = value.split('\n').map(line => `${pad}${line}`)
    return `>-\n${lines.join('\n')}`
  }
  return yamlQuoteString(value)
}

function yamlSerializeArray(values: string[], indent = 0): string {
  const pad = ' '.repeat(indent + 2)
  return `\n${values.map(v => `${pad}- ${yamlQuoteString(v)}`).join('\n')}`
}

/**
 * Build a scene .md file: YAML frontmatter (id, name, imagePrompt, tags) plus
 * the three conventional body sections (描述 / 氛围 / 出现章节).
 *
 * The scene engine itself only reads `imagePrompt` / `id` / `name` from
 * frontmatter; body sections are for AI / human readers.
 */
export function buildSceneMd(params: SceneCreateInput): string {
  const fmLines: string[] = ['---']
  fmLines.push(`id: ${params.id}`)
  if (params.name)
    fmLines.push(`name: ${params.name}`)
  if (params.imagePrompt)
    fmLines.push(`imagePrompt: ${yamlSerializeString(params.imagePrompt)}`)
  if (params.tags?.length)
    fmLines.push(`tags:${yamlSerializeArray(params.tags)}`)
  fmLines.push('---', '')

  const bodyParts: string[] = []
  bodyParts.push(`# ${params.name || params.id}`)
  if (params.description) {
    bodyParts.push('', '## 描述', '', params.description.trim())
  }
  if (params.atmosphere) {
    bodyParts.push('', '## 氛围', '', params.atmosphere.trim())
  }
  if (params.chapters?.length) {
    bodyParts.push('', '## 出现章节', '')
    for (const ch of params.chapters)
      bodyParts.push(`- ${ch}`)
  }

  return `${fmLines.join('\n')}${bodyParts.join('\n')}\n`
}

function normalizeChapterFilename(name: string): string {
  let fname = sanitizeFilename(name)
  if (!fname.endsWith('.adv.md'))
    fname = `${fname}.adv.md`
  return fname
}

function normalizeSceneFilename(id: string): string {
  let fname = sanitizeFilename(id)
  if (!fname.endsWith('.md'))
    fname = `${fname}.md`
  return fname
}

export function buildCharacterMd(params: CharacterCreateInput): string {
  return stringifyCharacterMd({
    id: params.id,
    name: params.name,
    imagePrompt: params.imagePrompt,
    tags: params.tags,
    aliases: params.aliases,
    personality: params.personality,
    appearance: params.appearance,
    background: params.background,
    concept: params.concept,
    speechStyle: params.speechStyle,
  })
}

export interface BulkPlanEntry {
  /** Absolute filesystem path */
  path: string
  /** Path relative to the project root (for human-readable output) */
  rel: string
  /** File content to write */
  content: string
}

export interface BulkPlan {
  planned: BulkPlanEntry[]
  conflicts: string[]
}

/**
 * Compute a bulk-write plan for a batch of assets.
 *
 * Pure: never touches the filesystem itself. Callers should write the planned
 * entries only if `conflicts` is empty (atomic semantics).
 *
 * @param items input objects
 * @param resolve maps an item to its `{ relativePath, content }`, where
 *        relativePath is a stable identifier used for duplicate-detection and
 *        as the lookup for filesystem existence checks
 * @param toAbsolutePath maps the relative path to an absolute path
 * @param exists predicate that reports whether a file already exists at the
 *        absolute path; injected so this function stays pure and testable
 */
export function planBulkWrites<T>(
  items: T[],
  resolve: (item: T) => { rel: string, content: string },
  toAbsolutePath: (rel: string) => string,
  exists: (path: string) => boolean,
): BulkPlan {
  const planned: BulkPlanEntry[] = []
  const seen = new Set<string>()
  const conflicts: string[] = []
  for (const item of items) {
    const { rel, content } = resolve(item)
    if (seen.has(rel))
      conflicts.push(`Duplicate path in batch: ${rel}`)
    seen.add(rel)
    const path = toAbsolutePath(rel)
    if (exists(path))
      conflicts.push(`${rel} already exists`)
    planned.push({ path, rel, content })
  }
  return { planned, conflicts }
}

/** For resource callbacks: { contents: [{ uri, text }] } */
function resourceTextContent(uri: URL | string, text: string) {
  return { contents: [{ uri: uri.toString(), text }] }
}

/**
 * Create and start the ADV.JS MCP Server.
 */
export function createAdvMcpServer(options: CreateAdvMcpServerOptions = {}) {
  const cwd = process.cwd()
  const gameRoot = resolveGameRoot(cwd)
  const projectLoader = options.projectLoader ?? loadProject

  const server = new McpServer({
    name: 'advjs',
    version,
  })

  // --------------- Resources ---------------

  server.resource(
    'compiled-project',
    'adv://project/compiled',
    { description: 'Normalized project, diagnostics, and source map from the standard compiler' },
    async (uri: URL) => {
      const loaded = await projectLoader({ root: cwd })
      return resourceTextContent(uri, JSON.stringify(loaded.result, null, 2))
    },
  )

  server.resource(
    'project-overview',
    'adv://project/overview',
    { description: 'Project overview: world setting + story outline summary' },
    async (uri: URL) => {
      const world = readOptionalFile(join(gameRoot, 'world.md'))
      const outline = readOptionalFile(join(gameRoot, 'outline.md'))
      const parts: string[] = []
      if (world)
        parts.push('# World\n', world)
      if (outline)
        parts.push('\n# Outline\n', outline)
      return resourceTextContent(uri, parts.join('\n') || 'No world.md or outline.md found.')
    },
  )

  server.resource(
    'world',
    'adv://world',
    { description: 'World bible (world.md)' },
    async (uri: URL) => {
      const content = readOptionalFile(join(gameRoot, 'world.md'))
      return resourceTextContent(uri, content || 'world.md not found.')
    },
  )

  server.resource(
    'outline',
    'adv://outline',
    { description: 'Story outline (outline.md)' },
    async (uri: URL) => {
      const content = readOptionalFile(join(gameRoot, 'outline.md'))
      return resourceTextContent(uri, content || 'outline.md not found.')
    },
  )

  server.resource(
    'glossary',
    'adv://glossary',
    { description: 'Glossary / terminology (glossary.md)' },
    async (uri: URL) => {
      const content = readOptionalFile(join(gameRoot, 'glossary.md'))
      return resourceTextContent(uri, content || 'glossary.md not found.')
    },
  )

  server.resource(
    'characters',
    'adv://characters',
    { description: 'Characters overview (characters/README.md)' },
    async (uri: URL) => {
      const content = readOptionalFile(join(gameRoot, 'characters', 'README.md'))
      return resourceTextContent(uri, content || 'characters/README.md not found.')
    },
  )

  server.resource(
    'character',
    new ResourceTemplate('adv://characters/{id}', { list: undefined }),
    { description: 'Individual character card (.character.md)' },
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop() || ''
      // Try exact filename first, then with extension
      const candidates = [
        join(gameRoot, 'characters', `${id}.character.md`),
        join(gameRoot, 'characters', id),
      ]
      for (const path of candidates) {
        const content = readOptionalFile(path)
        if (content)
          return resourceTextContent(uri, content)
      }
      return resourceTextContent(uri, `Character "${id}" not found.`)
    },
  )

  server.resource(
    'chapters',
    'adv://chapters',
    { description: 'Chapters overview (chapters/README.md)' },
    async (uri: URL) => {
      const content = readOptionalFile(join(gameRoot, 'chapters', 'README.md'))
      return resourceTextContent(uri, content || 'chapters/README.md not found.')
    },
  )

  server.resource(
    'chapter',
    new ResourceTemplate('adv://chapters/{id}', { list: undefined }),
    { description: 'Individual chapter script (.adv.md)' },
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop() || ''
      const candidates = [
        join(gameRoot, 'chapters', `${id}.adv.md`),
        join(gameRoot, 'chapters', id),
      ]
      for (const path of candidates) {
        const content = readOptionalFile(path)
        if (content)
          return resourceTextContent(uri, content)
      }
      return resourceTextContent(uri, `Chapter "${id}" not found.`)
    },
  )

  server.resource(
    'scenes',
    'adv://scenes',
    { description: 'Scenes overview (scenes/README.md)' },
    async (uri: URL) => {
      const content = readOptionalFile(join(gameRoot, 'scenes', 'README.md'))
      return resourceTextContent(uri, content || 'scenes/README.md not found.')
    },
  )

  // Resolve a chapter id (with or without the .adv.md suffix) to its file.
  const resolveChapterPath = (id: string): string | undefined => {
    for (const path of [join(gameRoot, 'chapters', `${id}.adv.md`), join(gameRoot, 'chapters', id)]) {
      if (existsSync(path))
        return path
    }
    return undefined
  }

  server.resource(
    'chapter-branches',
    new ResourceTemplate('adv://branches/{id}', { list: undefined }),
    { description: 'Branch graph (nodes + edges) for a chapter, as JSON' },
    async (uri: URL) => {
      const id = decodeURIComponent(uri.pathname.split('/').pop() || '')
      const path = resolveChapterPath(id)
      if (!path)
        return resourceTextContent(uri, `Chapter "${id}" not found.`)
      const ast = await parseAst(readFileSync(path, 'utf-8'))
      const graph = analyzeBranches(ast as Parameters<typeof analyzeBranches>[0])
      return resourceTextContent(uri, JSON.stringify({ chapter: id, ...graph }, null, 2))
    },
  )

  server.resource(
    'chapter-coverage',
    new ResourceTemplate('adv://coverage/{id}', { list: undefined }),
    { description: 'Branch coverage report for a chapter, as JSON' },
    async (uri: URL) => {
      const id = decodeURIComponent(uri.pathname.split('/').pop() || '')
      const path = resolveChapterPath(id)
      if (!path)
        return resourceTextContent(uri, `Chapter "${id}" not found.`)
      const ast = await parseAst(readFileSync(path, 'utf-8'))
      const report = analyzeCoverage(analyzeBranches(ast as Parameters<typeof analyzeBranches>[0]))
      return resourceTextContent(uri, JSON.stringify({ chapter: id, ...report }, null, 2))
    },
  )

  // --------------- Tools ---------------

  server.tool(
    'adv_validate',
    'Validate project: check script syntax, character references, and scene completeness',
    {
      root: z.string().optional().describe('Game content root directory (default: auto-detect)'),
    },
    async ({ root }: { root?: string }) => {
      // Dynamic import to avoid bundling all of advjs
      const { runCheck } = await import('advjs')
      const result = await runCheck({ root, cwd })

      if (result.passed) {
        return textContent(
          `All checks passed!\n`
          + `- ${result.scriptCount} scripts checked\n`
          + `- ${result.characterRefCount} character references\n`
          + `- ${result.sceneRefCount} scene references`,
        )
      }

      const lines = [`Found ${result.issues.length} issue(s):\n`]
      for (const issue of result.issues) {
        const icon = issue.type === 'error' ? '✗' : '⚠'
        lines.push(`${icon} [${issue.category}] ${issue.file}: ${issue.message}`)
      }
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        isError: true,
      }
    },
  )

  // --- list_files ---
  server.tool(
    'list_files',
    'List project files by category (characters, chapters, scenes, locations, knowledge, audio)',
    {
      category: z.enum(['characters', 'chapters', 'scenes', 'locations', 'knowledge', 'audio']).optional().describe('File category to list. Omit to get an overview of all categories.'),
    },
    async ({ category }: { category?: string }) => {
      const extMap: Record<string, { dir: string, ext: string }> = {
        characters: { dir: 'characters', ext: '.character.md' },
        chapters: { dir: 'chapters', ext: '.adv.md' },
        scenes: { dir: 'scenes', ext: '.md' },
        locations: { dir: 'locations', ext: '.md' },
        knowledge: { dir: 'knowledge', ext: '.md' },
        audio: { dir: 'audio', ext: '' },
      }

      if (category) {
        const cfg = extMap[category]
        if (!cfg)
          return textContent(`Unknown category: ${category}`)
        const dir = join(gameRoot, cfg.dir)
        const files = scanFiles(dir, cfg.ext)
        if (files.length === 0)
          return textContent(`No files found in ${cfg.dir}/`)
        const lines = files.map((f) => {
          const rel = relative(gameRoot, f)
          const size = statSync(f).size
          return `${rel} (${size} bytes)`
        })
        return textContent(lines.join('\n'))
      }

      // Overview of all categories
      const lines: string[] = []
      for (const [cat, cfg] of Object.entries(extMap)) {
        const dir = join(gameRoot, cfg.dir)
        const count = scanFiles(dir, cfg.ext).length
        lines.push(`${cat}: ${count} file(s)`)
      }
      return textContent(lines.join('\n'))
    },
  )

  // --- create_character ---
  server.tool(
    'create_character',
    'Create a new character card (.character.md) in the project',
    {
      id: z.string().describe('Character ID (lowercase, no spaces, used as filename)'),
      name: z.string().describe('Character display name'),
      imagePrompt: z.string().optional().describe('AI image prompt for the character portrait/tachie (English keywords recommended)'),
      tags: z.array(z.string()).optional().describe('Character tags'),
      aliases: z.array(z.string()).optional().describe('Alternative names'),
      personality: z.string().optional().describe('Personality description'),
      appearance: z.string().optional().describe('Appearance description'),
      background: z.string().optional().describe('Background story'),
      concept: z.string().optional().describe('Core concept or beliefs'),
      speechStyle: z.string().optional().describe('Speaking style description'),
    },
    async (params: CharacterCreateInput) => {
      const dir = join(gameRoot, 'characters')
      const filePath = join(dir, `${sanitizeFilename(params.id)}.character.md`)

      if (existsSync(filePath))
        return { content: [{ type: 'text', text: `Character "${params.id}" already exists at ${relative(gameRoot, filePath)}. Use edit_character to modify.` }], isError: true }

      mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, buildCharacterMd(params), 'utf-8')
      return textContent(`Created character "${params.name}" at characters/${params.id}.character.md`)
    },
  )

  // --- edit_character ---
  server.tool(
    'edit_character',
    'Edit an existing character card (.character.md)',
    {
      id: z.string().describe('Character ID to edit'),
      name: z.string().optional().describe('New display name'),
      imagePrompt: z.string().optional().describe('New AI image prompt for the character portrait/tachie'),
      tags: z.array(z.string()).optional().describe('Replace tags'),
      aliases: z.array(z.string()).optional().describe('Replace aliases'),
      personality: z.string().optional().describe('New personality description'),
      appearance: z.string().optional().describe('New appearance description'),
      background: z.string().optional().describe('New background story'),
      concept: z.string().optional().describe('New concept or beliefs'),
      speechStyle: z.string().optional().describe('New speaking style'),
    },
    async (params: {
      id: string
      name?: string
      imagePrompt?: string
      tags?: string[]
      aliases?: string[]
      personality?: string
      appearance?: string
      background?: string
      concept?: string
      speechStyle?: string
    }) => {
      const safeId = sanitizeFilename(params.id)
      const filePath = join(gameRoot, 'characters', `${safeId}.character.md`)

      if (!existsSync(filePath))
        return { content: [{ type: 'text', text: `Character "${params.id}" not found at characters/${safeId}.character.md` }], isError: true }

      const existing = readFileSync(filePath, 'utf-8')
      const character = parseCharacterMd(existing)

      // Merge updates
      const { id: _id, ...updates } = params
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined)
          (character as any)[key] = value
      }

      const content = stringifyCharacterMd(character)
      writeFileSync(filePath, content, 'utf-8')
      return textContent(`Updated character "${character.name}" at characters/${safeId}.character.md`)
    },
  )

  // --- create_chapter ---
  server.tool(
    'create_chapter',
    'Create a new chapter script (.adv.md) in the project',
    {
      filename: z.string().describe('Chapter filename (e.g. "chapter_01" or "chapter_01.adv.md")'),
      title: z.string().optional().describe('Chapter title'),
      plotSummary: z.string().optional().describe('Brief plot summary for frontmatter'),
      content: z.string().optional().describe('Full chapter content in .adv.md format. If provided, title/plotSummary are ignored.'),
    },
    async (params: ChapterCreateInput) => {
      const dir = join(gameRoot, 'chapters')
      const fname = normalizeChapterFilename(params.filename)

      const filePath = join(dir, fname)
      if (existsSync(filePath))
        return { content: [{ type: 'text', text: `Chapter "${fname}" already exists. Use edit_chapter to modify.` }], isError: true }

      mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, buildChapterContent(params), 'utf-8')
      return textContent(`Created chapter at chapters/${fname}`)
    },
  )

  // --- edit_chapter ---
  server.tool(
    'edit_chapter',
    'Edit an existing chapter script (.adv.md)',
    {
      filename: z.string().describe('Chapter filename (e.g. "chapter_01" or "chapter_01.adv.md")'),
      content: z.string().describe('New full chapter content (replaces entire file)'),
    },
    async (params: { filename: string, content: string }) => {
      let fname = sanitizeFilename(params.filename)
      if (!fname.endsWith('.adv.md'))
        fname = `${fname}.adv.md`

      const filePath = join(gameRoot, 'chapters', fname)
      if (!existsSync(filePath))
        return { content: [{ type: 'text', text: `Chapter "${fname}" not found.` }], isError: true }

      writeFileSync(filePath, params.content, 'utf-8')
      return textContent(`Updated chapter at chapters/${fname}`)
    },
  )

  // --- create_scene ---
  server.tool(
    'create_scene',
    'Create a new scene file (scenes/<id>.md) with optional imagePrompt for AI image generation. When you have a vivid visual description, always populate imagePrompt so downstream tooling can render the scene.',
    {
      id: z.string().describe('Scene ID (used as filename; lowercase with dashes recommended)'),
      name: z.string().optional().describe('Display name (Chinese OK)'),
      imagePrompt: z.string().optional().describe('AI image-generation prompt. English keywords work best (style + subject + mood + lighting).'),
      tags: z.array(z.string()).optional().describe('Free-form tags (e.g. 内景, 户外, 夜晚)'),
      description: z.string().optional().describe('Reader-facing scene description (rendered as the "## 描述" body section)'),
      atmosphere: z.string().optional().describe('Mood/atmosphere notes (rendered as the "## 氛围" body section)'),
      chapters: z.array(z.string()).optional().describe('Chapter references (rendered as a "## 出现章节" bullet list)'),
    },
    async (params: SceneCreateInput) => {
      const dir = join(gameRoot, 'scenes')
      const fname = normalizeSceneFilename(params.id)
      const filePath = join(dir, fname)
      if (existsSync(filePath))
        return { content: [{ type: 'text', text: `Scene "${params.id}" already exists at scenes/${fname}. Use edit_scene to modify.` }], isError: true }

      mkdirSync(dir, { recursive: true })
      writeFileSync(filePath, buildSceneMd(params), 'utf-8')
      return textContent(`Created scene "${params.name || params.id}" at scenes/${fname}`)
    },
  )

  // --- edit_scene ---
  //
  // Like edit_chapter: replaces the whole file with the supplied content. The
  // scene markdown body is free-form so a field-level merge would need a
  // dedicated parser; AI agents that want field-level edits can call
  // get_resource → modify → edit_scene.
  server.tool(
    'edit_scene',
    'Edit an existing scene file (scenes/<id>.md) by replacing its full content',
    {
      id: z.string().describe('Scene ID (filename without .md)'),
      content: z.string().describe('New full scene content (replaces entire file)'),
    },
    async (params: { id: string, content: string }) => {
      const fname = normalizeSceneFilename(params.id)
      const filePath = join(gameRoot, 'scenes', fname)
      if (!existsSync(filePath))
        return { content: [{ type: 'text', text: `Scene "${params.id}" not found at scenes/${fname}` }], isError: true }
      writeFileSync(filePath, params.content, 'utf-8')
      return textContent(`Updated scene at scenes/${fname}`)
    },
  )

  // --- create_characters (bulk) ---
  //
  // Atomic: validates the entire batch first (no duplicate ids, no existing
  // files), then writes everything. Any conflict aborts the write so the
  // project tree stays consistent.
  server.tool(
    'create_characters',
    'Create multiple character cards atomically. Validates the whole batch first — if any item would conflict (duplicate id within the batch, or file already exists), nothing is written.',
    {
      items: z.array(z.object({
        id: z.string(),
        name: z.string(),
        imagePrompt: z.string().optional(),
        tags: z.array(z.string()).optional(),
        aliases: z.array(z.string()).optional(),
        personality: z.string().optional(),
        appearance: z.string().optional(),
        background: z.string().optional(),
        concept: z.string().optional(),
        speechStyle: z.string().optional(),
      })).min(1).describe('List of characters to create'),
    },
    async ({ items }: { items: CharacterCreateInput[] }) => {
      const dir = join(gameRoot, 'characters')
      const { planned, conflicts } = planBulkWrites(
        items,
        item => ({ rel: `characters/${sanitizeFilename(item.id)}.character.md`, content: buildCharacterMd(item) }),
        rel => join(gameRoot, rel),
        existsSync,
      )
      if (conflicts.length)
        return { content: [{ type: 'text', text: `Aborted (no files written):\n${conflicts.join('\n')}` }], isError: true }
      mkdirSync(dir, { recursive: true })
      for (const p of planned)
        writeFileSync(p.path, p.content, 'utf-8')
      return textContent(`Created ${planned.length} character(s):\n${planned.map(p => `  + ${p.rel}`).join('\n')}`)
    },
  )

  // --- create_chapters (bulk) ---
  server.tool(
    'create_chapters',
    'Create multiple chapter scripts atomically. See create_characters for atomicity semantics.',
    {
      items: z.array(z.object({
        filename: z.string(),
        title: z.string().optional(),
        plotSummary: z.string().optional(),
        content: z.string().optional(),
      })).min(1),
    },
    async ({ items }: { items: ChapterCreateInput[] }) => {
      const dir = join(gameRoot, 'chapters')
      const { planned, conflicts } = planBulkWrites(
        items,
        item => ({ rel: `chapters/${normalizeChapterFilename(item.filename)}`, content: buildChapterContent(item) }),
        rel => join(gameRoot, rel),
        existsSync,
      )
      if (conflicts.length)
        return { content: [{ type: 'text', text: `Aborted (no files written):\n${conflicts.join('\n')}` }], isError: true }
      mkdirSync(dir, { recursive: true })
      for (const p of planned)
        writeFileSync(p.path, p.content, 'utf-8')
      return textContent(`Created ${planned.length} chapter(s):\n${planned.map(p => `  + ${p.rel}`).join('\n')}`)
    },
  )

  // --- create_scenes (bulk) ---
  server.tool(
    'create_scenes',
    'Create multiple scenes atomically. Encourage filling imagePrompt for every scene — that is the single biggest accelerant for downstream AI image generation.',
    {
      items: z.array(z.object({
        id: z.string(),
        name: z.string().optional(),
        imagePrompt: z.string().optional(),
        tags: z.array(z.string()).optional(),
        description: z.string().optional(),
        atmosphere: z.string().optional(),
        chapters: z.array(z.string()).optional(),
      })).min(1),
    },
    async ({ items }: { items: SceneCreateInput[] }) => {
      const dir = join(gameRoot, 'scenes')
      const { planned, conflicts } = planBulkWrites(
        items,
        item => ({ rel: `scenes/${normalizeSceneFilename(item.id)}`, content: buildSceneMd(item) }),
        rel => join(gameRoot, rel),
        existsSync,
      )
      if (conflicts.length)
        return { content: [{ type: 'text', text: `Aborted (no files written):\n${conflicts.join('\n')}` }], isError: true }
      mkdirSync(dir, { recursive: true })
      for (const p of planned)
        writeFileSync(p.path, p.content, 'utf-8')
      return textContent(`Created ${planned.length} scene(s):\n${planned.map(p => `  + ${p.rel}`).join('\n')}`)
    },
  )

  // --- project_stats ---
  server.tool(
    'project_stats',
    'Get project statistics: file counts, character count, word count',
    {
      root: z.string().optional().describe('Game content root directory (default: auto-detect)'),
    },
    async (_params: { root?: string }) => {
      const categories = [
        { label: 'Characters', dir: 'characters', ext: '.character.md' },
        { label: 'Chapters', dir: 'chapters', ext: '.adv.md' },
        { label: 'Scenes', dir: 'scenes', ext: '.md' },
        { label: 'Locations', dir: 'locations', ext: '.md' },
        { label: 'Knowledge', dir: 'knowledge', ext: '.md' },
        { label: 'Audio', dir: 'audio', ext: '' },
      ]

      const lines: string[] = ['# Project Statistics\n']
      let totalWordCount = 0

      for (const cat of categories) {
        const dir = join(gameRoot, cat.dir)
        const files = scanFiles(dir, cat.ext)
          .filter(f => !basename(f).startsWith('README'))
        lines.push(`${cat.label}: ${files.length} file(s)`)
      }

      // Word count from chapters
      const chapterFiles = scanFiles(join(gameRoot, 'chapters'), '.adv.md')
      for (const f of chapterFiles) {
        const text = readFileSync(f, 'utf-8')
        totalWordCount += text.length
      }

      lines.push(`\nTotal chapter content: ${totalWordCount} characters`)

      // Check key files
      const hasWorld = existsSync(join(gameRoot, 'world.md'))
      const hasOutline = existsSync(join(gameRoot, 'outline.md'))
      const hasGlossary = existsSync(join(gameRoot, 'glossary.md'))
      lines.push(`\nworld.md: ${hasWorld ? '✓' : '✗'}`)
      lines.push(`outline.md: ${hasOutline ? '✓' : '✗'}`)
      lines.push(`glossary.md: ${hasGlossary ? '✓' : '✗'}`)

      return textContent(lines.join('\n'))
    },
  )

  // --- search_content ---
  server.tool(
    'search_content',
    'Full-text search across project files',
    {
      query: z.string().describe('Search query (case-insensitive substring match)'),
      category: z.enum(['characters', 'chapters', 'scenes', 'locations', 'knowledge']).optional().describe('Limit search to a specific category'),
    },
    async (params: { query: string, category?: string }) => {
      const searchDirs: { dir: string, ext: string }[] = []
      const categoryMap: Record<string, { dir: string, ext: string }> = {
        characters: { dir: 'characters', ext: '.character.md' },
        chapters: { dir: 'chapters', ext: '.adv.md' },
        scenes: { dir: 'scenes', ext: '.md' },
        locations: { dir: 'locations', ext: '.md' },
        knowledge: { dir: 'knowledge', ext: '.md' },
      }

      if (params.category) {
        const cfg = categoryMap[params.category]
        if (cfg)
          searchDirs.push(cfg)
      }
      else {
        searchDirs.push(...Object.values(categoryMap))
      }

      // Also search root .md files (world.md, outline.md, glossary.md)
      const rootFiles = ['world.md', 'outline.md', 'glossary.md']

      const queryLower = params.query.toLowerCase()
      const results: string[] = []
      const MAX_RESULTS = 50

      // Search root files
      if (!params.category) {
        for (const name of rootFiles) {
          if (results.length >= MAX_RESULTS)
            break
          const filePath = join(gameRoot, name)
          const content = readOptionalFile(filePath)
          if (!content)
            continue
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_RESULTS)
              break
            if (lines[i].toLowerCase().includes(queryLower))
              results.push(`${name}:${i + 1}: ${lines[i].trim()}`)
          }
        }
      }

      // Search category files
      for (const cfg of searchDirs) {
        if (results.length >= MAX_RESULTS)
          break
        const dir = join(gameRoot, cfg.dir)
        const files = scanFiles(dir, cfg.ext)
        for (const f of files) {
          if (results.length >= MAX_RESULTS)
            break
          const content = readFileSync(f, 'utf-8')
          const rel = relative(gameRoot, f)
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_RESULTS)
              break
            if (lines[i].toLowerCase().includes(queryLower))
              results.push(`${rel}:${i + 1}: ${lines[i].trim()}`)
          }
        }
      }

      if (results.length === 0)
        return textContent(`No results found for "${params.query}"`)

      const header = results.length >= MAX_RESULTS
        ? `Found ${MAX_RESULTS}+ matches (showing first ${MAX_RESULTS}):\n\n`
        : `Found ${results.length} match(es):\n\n`
      return textContent(header + results.join('\n'))
    },
  )

  // --------------- Prompts ---------------

  server.prompt(
    'write-chapter',
    'Generate context and instructions for writing a new chapter',
    {
      chapterNumber: z.string().describe('Chapter number to write (e.g. "3")'),
      summary: z.string().optional().describe('Brief summary of what should happen in this chapter'),
    },
    async ({ chapterNumber, summary }: { chapterNumber: string, summary?: string }) => {
      const world = readOptionalFile(join(gameRoot, 'world.md')) || ''
      const outline = readOptionalFile(join(gameRoot, 'outline.md')) || ''
      const chaptersReadme = readOptionalFile(join(gameRoot, 'chapters', 'README.md')) || ''
      const glossary = readOptionalFile(join(gameRoot, 'glossary.md')) || ''
      const charsReadme = readOptionalFile(join(gameRoot, 'characters', 'README.md')) || ''

      const prompt = [
        'You are writing a chapter for an ADV.JS visual novel game.',
        'Use the .adv.md format: Markdown with @CharacterName for dialogue, > for narration, --- for scene breaks.',
        '',
        '## World Setting',
        world,
        '',
        '## Story Outline',
        outline,
        '',
        '## Chapter Status',
        chaptersReadme,
        '',
        '## Characters',
        charsReadme,
        '',
        glossary ? `## Glossary\n${glossary}\n` : '',
        '## Task',
        `Write Chapter ${chapterNumber}.`,
        summary ? `Summary: ${summary}` : '',
        '',
        'Output a complete .adv.md file with frontmatter (plotSummary) and dialogue.',
        'Ensure character names match existing .character.md files.',
        'Use 【Place，Time，Interior/Exterior】 for scene headings.',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text: prompt } }] }
    },
  )

  server.prompt(
    'create-character',
    'Generate context and template for creating a new character card',
    {
      name: z.string().describe('Character name'),
      role: z.string().optional().describe('Character role (e.g. "protagonist", "supporting")'),
    },
    async ({ name, role }: { name: string, role?: string }) => {
      const world = readOptionalFile(join(gameRoot, 'world.md')) || ''
      const charsReadme = readOptionalFile(join(gameRoot, 'characters', 'README.md')) || ''

      const prompt = [
        'You are creating a character card for an ADV.JS visual novel game.',
        'Use the .character.md format: YAML frontmatter (id, name, tags, aliases) + Markdown body.',
        '',
        '## World Setting',
        world,
        '',
        '## Existing Characters',
        charsReadme,
        '',
        '## Task',
        `Create a character card for: ${name}`,
        role ? `Role: ${role}` : '',
        '',
        'Output a complete .character.md file with:',
        '- YAML frontmatter: id (lowercase, no spaces), name, tags, aliases',
        '- Markdown sections: ## Personality, ## Appearance, ## Background, ## Relationships',
        'The character should fit naturally into the existing world setting.',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text: prompt } }] }
    },
  )

  server.prompt(
    'review-script',
    'Generate context and checklist for reviewing a chapter script',
    {
      chapterFile: z.string().optional().describe('Chapter filename to review (e.g. "chapter_01.adv.md")'),
    },
    async ({ chapterFile }: { chapterFile?: string }) => {
      const world = readOptionalFile(join(gameRoot, 'world.md')) || ''
      const glossary = readOptionalFile(join(gameRoot, 'glossary.md')) || ''
      const charsReadme = readOptionalFile(join(gameRoot, 'characters', 'README.md')) || ''

      let chapterContent = ''
      if (chapterFile) {
        const safeFile = sanitizeFilename(chapterFile)
        chapterContent = readOptionalFile(join(gameRoot, 'chapters', safeFile)) || ''
      }

      const prompt = [
        'You are reviewing a visual novel script for quality and consistency.',
        '',
        '## World Setting',
        world,
        '',
        glossary ? `## Glossary\n${glossary}\n` : '',
        '## Characters',
        charsReadme,
        '',
        chapterContent ? `## Script to Review\n\`\`\`markdown\n${chapterContent}\n\`\`\`\n` : '',
        '## Review Checklist',
        '1. **Dialogue quality**: Is the dialogue natural and in-character?',
        '2. **Character consistency**: Do characters behave according to their personality?',
        '3. **Terminology**: Are terms consistent with the glossary?',
        '4. **Pacing**: Is the scene pacing appropriate?',
        '5. **Scene descriptions**: Are narration and scene transitions smooth?',
        '6. **Technical format**: Is the .adv.md syntax correct?',
        '7. **Branch logic**: Do choices make sense and lead to meaningful outcomes?',
        '',
        'Provide specific feedback with line references where possible.',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text: prompt } }] }
    },
  )

  return server
}

/**
 * Start the MCP server with stdio transport.
 * Called from the CLI bin entry point.
 */
export async function startMcpServer() {
  const server = createAdvMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
