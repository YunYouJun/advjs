import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * POST /api/characters
 *
 * Creates a new .character.md file.
 * Body: { dir: string, character: AdvCharacter }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { dir, character } = body

  if (!dir || !character?.id || !character?.name) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: dir, character.id, character.name',
    })
  }

  try {
    const { stringifyCharacterMd } = await import('@advjs/parser')

    // Ensure directory exists
    await mkdir(dir, { recursive: true })

    const filename = `${character.id}.character.md`
    const filepath = join(dir, filename)
    const content = stringifyCharacterMd({
      ...character,
      createdAt: character.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    await writeFile(filepath, content, 'utf-8')
    return { success: true, id: character.id }
  }
  catch (e: any) {
    throw createError({
      statusCode: 500,
      message: `Failed to create character: ${e.message}`,
    })
  }
})
