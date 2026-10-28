import type { ChapterFormData, LocationFormData, SceneFormData } from '@advjs/parser'
import type { AdvCharacter, AdvTachie } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import type { StudioNativeMedia } from '../utils/nativeProjectMutation'
import type { StudioContentSource } from '../utils/projectContentMutation'
import type { ContentType, EditorMode } from './useContentEditor'
import { stringifyChapterMd, stringifyCharacterMd, stringifyLocationMd, stringifySceneMd } from '@advjs/parser'
import { ref } from 'vue'
import { commitStudioProjectFiles } from '../utils/nativeProjectMutation'
import { isStudioContentConflict } from '../utils/projectContentMutation'
import { whenStudioProjectWritesSettle } from '../utils/projectWriteQueue'

export interface ContentSaveContext {
  source?: StudioContentSource
  assertCurrent?: () => void
  session?: object
}
export interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
  conflict?: boolean
  source?: StudioContentSource
  submittedData?: string
  savedId?: string
  session?: object
}

const DATA_URI_RE = /^data:(image\/([a-z0-9.+-]+));base64,/i
const ID_RE = /^[\w-]+$/

function targetPath(type: ContentType, id: string) {
  const name = type === 'chapter' ? id.replace(/\.adv\.md$/, '') : id
  if (!ID_RE.test(name))
    throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
  switch (type) {
    case 'character': return `adv/characters/${name}.character.md`
    case 'scene': return `adv/scenes/${name}.md`
    case 'location': return `adv/locations/${name}.md`
    case 'chapter': return `adv/chapters/${name}.adv.md`
    default: throw new Error('ADV_STUDIO_CONTENT_TYPE_INVALID')
  }
}
async function files(fs: IFileSystem) {
  return Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
}
async function assertFiles(fs: IFileSystem, expected: Record<string, string>) {
  const actual = await files(fs)
  if (Object.keys(actual).length !== Object.keys(expected).length || Object.entries(expected).some(([path, content]) => actual[path] !== content))
    throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
}

/** Prepare immutable bytes only; no project writes until serialization and source checks succeed. */
async function characterImages(character: AdvCharacter) {
  const media = new Map<string, StudioNativeMedia>()
  async function image(value: string, label: string) {
    const match = DATA_URI_RE.exec(value)
    if (!match)
      throw new Error('ADV_STUDIO_CONTENT_IMAGE_INVALID')
    const raw = atob(value.slice(match[0].length))
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0))
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    const name = label.replace(/[^\w-]/g, '_') || 'image'
    const extension = match[2]!.toLowerCase() === 'svg+xml' ? 'svg' : match[2]!.toLowerCase().replace(/[^\w-]/g, '_')
    const path = `adv/assets/characters/${character.id}/${name}.${sha256}.${extension}`
    const blob = new Blob([bytes], { type: match[1]!.toLowerCase() })
    media.set(path, { path, blob, sha256, bytes: bytes.byteLength })
    return path.slice(4)
  }
  const next = { ...character }
  if (next.avatar?.startsWith('data:'))
    next.avatar = await image(next.avatar, 'avatar')
  if (next.tachies) {
    const tachies: Record<string, AdvTachie> = {}
    for (const [name, tachie] of Object.entries(next.tachies))
      tachies[name] = tachie.src?.startsWith('data:') ? { ...tachie, src: await image(tachie.src, name) } : { ...tachie }
    next.tachies = tachies
  }
  return { character: next, media: [...media.values()] }
}

/** Structured forms share opened-source CAS, atomic staging and conditional compensation. */
export function useContentSave() {
  const isSaving = ref(false)
  async function saveContent(
    fs: IFileSystem,
    contentType: ContentType,
    mode: EditorMode,
    data: AdvCharacter | SceneFormData | ChapterFormData | LocationFormData,
    originalId?: string,
    context: ContentSaveContext = {},
  ): Promise<SaveResult> {
    if (isSaving.value)
      return { success: false, error: 'ADV_STUDIO_CONTENT_SAVE_BUSY' }
    isSaving.value = true
    try {
      const submittedData = JSON.stringify(data)
      const input = JSON.parse(submittedData) as typeof data
      const id = 'filename' in input ? input.filename : input.id
      let filePath = targetPath(contentType, id)
      const source = context.source
      const assertCurrent = context.assertCurrent ?? (() => {})
      assertCurrent()
      if (mode === 'edit') {
        if (!source || source.fs !== fs || source.content === null)
          throw new Error('ADV_STUDIO_EDIT_SOURCE_REQUIRED')
        const directory = filePath.slice(0, filePath.lastIndexOf('/') + 1)
        if (!source.path.startsWith(directory) || source.path.slice(directory.length).includes('/') || !source.path.endsWith(contentType === 'character' ? '.character.md' : contentType === 'chapter' ? '.adv.md' : '.md'))
          throw new Error('ADV_STUDIO_EDIT_SOURCE_REQUIRED')
        if (originalId === id)
          filePath = source.path
      }
      else if (mode !== 'create') {
        throw new Error('ADV_STUDIO_CONTENT_TYPE_INVALID')
      }
      await whenStudioProjectWritesSettle(fs)
      assertCurrent()
      await fs.refresh?.()
      assertCurrent()
      const before = await files(fs)
      assertCurrent()
      if (source && mode === 'edit' && before[source.path] !== source.content)
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
      const expected = mode === 'edit' && source!.path === filePath ? source!.content : null
      if ((before[filePath] ?? null) !== expected)
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
      let content: string
      let media: StudioNativeMedia[] = []
      switch (contentType) {
        case 'character': {
          const prepared = await characterImages(input as AdvCharacter)
          media = prepared.media
          content = stringifyCharacterMd(prepared.character, { source: source?.content ?? undefined })
          break
        }
        case 'scene':
          content = stringifySceneMd(input as SceneFormData, { source: source?.content ?? undefined })
          break
        case 'location':
          content = stringifyLocationMd(input as LocationFormData, { source: source?.content ?? undefined })
          break
        case 'chapter':
          content = stringifyChapterMd(input as ChapterFormData)
          break
        default: throw new Error('ADV_STUDIO_CONTENT_TYPE_INVALID')
      }
      const after = { ...before, [filePath]: content }
      await commitStudioProjectFiles(fs, [{ path: filePath, expected, content }], {
        assertCurrent,
        acceptsPath: path => path === filePath,
        media,
        validateCurrent: scope => assertFiles(scope, before),
        validateAfter: scope => assertFiles(scope, after),
      })
      return { success: true, filePath, source: Object.freeze({ fs, path: filePath, content }), submittedData, savedId: id, session: context.session }
    }
    catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), conflict: isStudioContentConflict(error) || (error instanceof Error && error.message === 'ADV_STUDIO_EDIT_SOURCE_REQUIRED') }
    }
    finally {
      isSaving.value = false
    }
  }
  return { isSaving, saveContent }
}
