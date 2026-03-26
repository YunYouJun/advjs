import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * DELETE /api/characters
 *
 * Deletes a .character.md file.
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
    await unlink(filepath)
    return { success: true, id }
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
      message: `Failed to delete character: ${e.message}`,
    })
  }
})
