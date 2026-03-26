import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * PUT /api/characters
 *
 * Updates an existing .character.md file.
 * Body: { dir: string, character: AdvCharacter }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { dir, character } = body

  if (!dir || !character?.id) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: dir, character.id',
    })
  }

  const filename = `${character.id}.character.md`
  const filepath = join(dir, filename)

  try {
    // Verify file exists
    await readFile(filepath, 'utf-8')

    const { stringifyCharacterMd } = await import('@advjs/parser')
    const content = stringifyCharacterMd({
      ...character,
      updatedAt: new Date().toISOString(),
    })

    await writeFile(filepath, content, 'utf-8')
    return { success: true, id: character.id }
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
      message: `Failed to update character: ${e.message}`,
    })
  }
})
