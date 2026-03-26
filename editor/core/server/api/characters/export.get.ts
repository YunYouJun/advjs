import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * GET /api/characters/export
 *
 * Exports a character as AI-friendly markdown.
 * Query: { dir: string, id: string }
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dir = query.dir as string
  const id = query.id as string

  if (!dir || !id) {
    throw createError({
      statusCode: 400,
      message: 'Missing required query params: dir, id',
    })
  }

  const filename = `${id}.character.md`
  const filepath = join(dir, filename)

  try {
    const content = await readFile(filepath, 'utf-8')
    const { parseCharacterMd, exportCharacterForAI } = await import('@advjs/parser')
    const character = parseCharacterMd(content)
    const aiMarkdown = exportCharacterForAI(character)

    return { markdown: aiMarkdown }
  }
  catch (e: any) {
    if (e.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        message: `Character file not found: ${filename}`,
      })
    }
    throw createError({
      statusCode: 500,
      message: `Failed to export character: ${e.message}`,
    })
  }
})
