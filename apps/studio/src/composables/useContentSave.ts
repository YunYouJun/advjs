import type { ChapterFormData, LocationFormData, SceneFormData } from '@advjs/parser'
import type { AdvCharacter, AdvTachie } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import type { ContentType, EditorMode } from './useContentEditor'
import { stringifyChapterMd, stringifyCharacterMd, stringifyLocationMd, stringifySceneMd } from '@advjs/parser'
import { ref } from 'vue'

const DATA_URI_RE = /^data:image\/(\w+);base64,/
const SAFE_NAME_RE = /[^\w-]/g

export interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}

/**
 * Check if a file exists via IFileSystem
 */
async function fileExists(fs: IFileSystem, path: string): Promise<boolean> {
  return fs.exists(path)
}

/**
 * Current file content when editing, so fields and body text the form does
 * not manage survive the save. Unreadable files fall back to a fresh write.
 */
async function editSource(fs: IFileSystem, mode: EditorMode, path: string): Promise<string | undefined> {
  if (mode !== 'edit')
    return undefined
  try {
    return await fs.exists(path) ? await fs.readFile(path) : undefined
  }
  catch {
    return undefined
  }
}

/**
 * Convert a data URI to a Uint8Array for writing as binary
 */
function dataUriToBytes(dataUri: string): { bytes: Uint8Array, ext: string } {
  const match = DATA_URI_RE.exec(dataUri)
  const ext = match?.[1] || 'png'
  const base64 = dataUri.replace(DATA_URI_RE, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return { bytes, ext }
}

/**
 * Write a binary file via IFileSystem
 */
async function writeBinaryToFs(fs: IFileSystem, path: string, data: Uint8Array): Promise<void> {
  await fs.writeBlob(path, new Blob([data as BlobPart]))
}

/**
 * Extract and save data URI images from a character, returning updated character with file paths.
 * Saves images to adv/assets/characters/{id}/
 */
async function extractCharacterImages(
  fs: IFileSystem,
  character: AdvCharacter,
): Promise<AdvCharacter> {
  const updated = { ...character }
  const assetDir = `adv/assets/characters/${character.id}`

  // Avatar
  if (updated.avatar && DATA_URI_RE.test(updated.avatar)) {
    const { bytes, ext } = dataUriToBytes(updated.avatar)
    const filePath = `${assetDir}/avatar.${ext}`
    await writeBinaryToFs(fs, filePath, bytes)
    updated.avatar = `assets/characters/${character.id}/avatar.${ext}`
  }

  // Tachies
  if (updated.tachies) {
    const newTachies: Record<string, AdvTachie> = {}
    for (const [name, tachie] of Object.entries(updated.tachies)) {
      if (tachie.src && DATA_URI_RE.test(tachie.src)) {
        const { bytes, ext } = dataUriToBytes(tachie.src)
        const safeName = name.replace(SAFE_NAME_RE, '_')
        const filePath = `${assetDir}/${safeName}.${ext}`
        await writeBinaryToFs(fs, filePath, bytes)
        newTachies[name] = {
          ...tachie,
          src: `assets/characters/${character.id}/${safeName}.${ext}`,
        }
      }
      else {
        newTachies[name] = tachie
      }
    }
    updated.tachies = newTachies
  }

  return updated
}

/**
 * Content save composable
 * Handles serialization, duplicate detection, image extraction, and file writing
 */
export function useContentSave() {
  const isSaving = ref(false)

  async function saveContent(
    fs: IFileSystem,
    contentType: ContentType,
    mode: EditorMode,
    data: AdvCharacter | SceneFormData | ChapterFormData | LocationFormData,
    originalId?: string,
  ): Promise<SaveResult> {
    isSaving.value = true

    try {
      let filePath: string
      let content: string

      switch (contentType) {
        case 'character': {
          let char = data as AdvCharacter
          filePath = `adv/characters/${char.id}.character.md`

          // Check for duplicate path on create, or rename on edit
          if (mode === 'create') {
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `File already exists: ${filePath}. Please use a different ID.`,
              }
            }
          }
          else if (originalId && originalId !== char.id) {
            // ID changed during edit — check new path doesn't conflict
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `Cannot rename: ${filePath} already exists.`,
              }
            }
          }

          // Extract data URI images → save to assets, update paths
          char = await extractCharacterImages(fs, char)
          content = stringifyCharacterMd(char, {
            source: await editSource(fs, mode, `adv/characters/${originalId || char.id}.character.md`),
          })
          break
        }
        case 'scene': {
          const scene = data as SceneFormData
          filePath = `adv/scenes/${scene.id}.md`

          if (mode === 'create') {
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `File already exists: ${filePath}. Please use a different ID.`,
              }
            }
          }
          else if (originalId && originalId !== scene.id) {
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `Cannot rename: ${filePath} already exists.`,
              }
            }
          }

          content = stringifySceneMd(scene, {
            source: await editSource(fs, mode, `adv/scenes/${originalId || scene.id}.md`),
          })
          break
        }
        case 'chapter': {
          const chapter = data as ChapterFormData
          const filename = chapter.filename.endsWith('.adv.md')
            ? chapter.filename
            : `${chapter.filename}.adv.md`
          filePath = `adv/chapters/${filename}`

          if (mode === 'create') {
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `File already exists: ${filePath}. Please use a different filename.`,
              }
            }
          }
          else if (originalId && originalId !== chapter.filename) {
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `Cannot rename: ${filePath} already exists.`,
              }
            }
          }

          content = stringifyChapterMd(chapter)
          break
        }
        case 'location': {
          const location = data as LocationFormData
          filePath = `adv/locations/${location.id}.md`

          if (mode === 'create') {
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `File already exists: ${filePath}. Please use a different ID.`,
              }
            }
          }
          else if (originalId && originalId !== location.id) {
            if (await fileExists(fs, filePath)) {
              return {
                success: false,
                error: `Cannot rename: ${filePath} already exists.`,
              }
            }
          }

          content = stringifyLocationMd(location, {
            source: await editSource(fs, mode, `adv/locations/${originalId || location.id}.md`),
          })
          break
        }
        default:
          return { success: false, error: `Unknown content type: ${contentType}` }
      }

      await fs.writeFile(filePath, content)

      return { success: true, filePath }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, error: message }
    }
    finally {
      isSaving.value = false
    }
  }

  return {
    isSaving,
    saveContent,
  }
}
