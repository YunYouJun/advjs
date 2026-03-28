import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join } from 'node:path'
import process from 'node:process'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolveGameRoot } from 'advjs'
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
