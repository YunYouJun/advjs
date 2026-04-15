import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join, relative } from 'node:path'
import process from 'node:process'
import { parseCharacterMd, stringifyCharacterMd } from '@advjs/parser'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveGameRoot, scanFiles } from 'advjs'
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

/** For resource callbacks: { contents: [{ uri, text }] } */
function resourceTextContent(uri: URL | string, text: string) {
  return { contents: [{ uri: uri.toString(), text }] }
}

/**
 * Create and start the ADV.JS MCP Server.
 */
export function createAdvMcpServer() {
  const cwd = process.cwd()
  const gameRoot = resolveGameRoot(cwd)

  const server = new McpServer({
    name: 'advjs',
    version,
  })

  // --------------- Resources ---------------

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
      tags: z.array(z.string()).optional().describe('Character tags'),
      aliases: z.array(z.string()).optional().describe('Alternative names'),
      personality: z.string().optional().describe('Personality description'),
      appearance: z.string().optional().describe('Appearance description'),
      background: z.string().optional().describe('Background story'),
      concept: z.string().optional().describe('Core concept or beliefs'),
      speechStyle: z.string().optional().describe('Speaking style description'),
    },
    async (params: {
      id: string
      name: string
      tags?: string[]
      aliases?: string[]
      personality?: string
      appearance?: string
      background?: string
      concept?: string
      speechStyle?: string
    }) => {
      const dir = join(gameRoot, 'characters')
      const filePath = join(dir, `${sanitizeFilename(params.id)}.character.md`)

      if (existsSync(filePath))
        return { content: [{ type: 'text', text: `Character "${params.id}" already exists at ${relative(gameRoot, filePath)}. Use edit_character to modify.` }], isError: true }

      mkdirSync(dir, { recursive: true })

      const content = stringifyCharacterMd({
        id: params.id,
        name: params.name,
        tags: params.tags,
        aliases: params.aliases,
        personality: params.personality,
        appearance: params.appearance,
        background: params.background,
        concept: params.concept,
        speechStyle: params.speechStyle,
      })

      writeFileSync(filePath, content, 'utf-8')
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
    async (params: { filename: string, title?: string, plotSummary?: string, content?: string }) => {
      const dir = join(gameRoot, 'chapters')
      let fname = sanitizeFilename(params.filename)
      if (!fname.endsWith('.adv.md'))
        fname = `${fname}.adv.md`

      const filePath = join(dir, fname)
      if (existsSync(filePath))
        return { content: [{ type: 'text', text: `Chapter "${fname}" already exists. Use edit_chapter to modify.` }], isError: true }

      mkdirSync(dir, { recursive: true })

      let fileContent: string
      if (params.content) {
        fileContent = params.content
      }
      else {
        // Generate from frontmatter
        const fmParts: string[] = []
        if (params.title)
          fmParts.push(`title: ${params.title}`)
        if (params.plotSummary)
          fmParts.push(`plotSummary: ${params.plotSummary}`)
        fileContent = fmParts.length > 0
          ? `---\n${fmParts.join('\n')}\n---\n`
          : ''
      }

      writeFileSync(filePath, fileContent, 'utf-8')
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
