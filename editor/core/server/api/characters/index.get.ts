import { readdir, readFile } from 'node:fs/promises'
import { join, parse } from 'node:path'

/**
 * GET /api/characters
 *
 * Reads all .character.md files from the configured characters directory.
 * Returns parsed AdvCharacter array.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dir = (query.dir as string) || ''

  if (!dir) {
    throw createError({
      statusCode: 400,
      message: 'Missing required query param: dir (characters directory path)',
    })
  }

  try {
    const files = await readdir(dir)
    const mdFiles = files.filter(f => f.endsWith('.character.md'))

    const characters = await Promise.all(
      mdFiles.map(async (filename) => {
        const filepath = join(dir, filename)
        const content = await readFile(filepath, 'utf-8')
        const { parseCharacterMd } = await import('@advjs/parser')
        const character = parseCharacterMd(content)
        // Ensure id matches filename
        const fileId = parse(filename).name.replace('.character', '')
        if (!character.id)
          character.id = fileId
        return character
      }),
    )

    return { characters }
  }
  catch (e: any) {
    if (e.code === 'ENOENT') {
      return { characters: [] }
    }
    throw createError({
      statusCode: 500,
      message: `Failed to read characters: ${e.message}`,
    })
  }
})
