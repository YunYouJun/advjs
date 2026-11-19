import type { IFileSystem } from '../utils/fs'
import { AUTHORING_GAME_SETTINGS_PATH, projectImagePath, readProjectCover, writeProjectCover } from '@advjs/core/project'
import { computed, shallowRef, watch } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'
import { useProjectContent } from './useProjectContent'

/** Resolve the portable cover from the open project, with the legacy card image as fallback. */
export function useProjectCover(isOpen: () => boolean) {
  const studio = useStudioStore()
  const content = useProjectContent()
  const coverUrl = shallowRef<string>()
  const revision = shallowRef(0)
  const currentCover = computed(() => coverUrl.value ?? studio.currentProject?.cover)

  watch([isOpen, () => studio.currentProject?.projectId, revision], async ([open, id], _, onCleanup) => {
    let active = true
    let url: string | undefined
    onCleanup(() => {
      active = false
      if (url)
        URL.revokeObjectURL(url)
    })
    coverUrl.value = undefined
    if (!open || !id)
      return
    try {
      const fs = await currentFiles(id)
      const reference = fs && readProjectCover(await readSettings(fs))
      if (reference && fs) {
        const blob = await fs.readBlob(reference)
        if (active) {
          url = URL.createObjectURL(blob)
          coverUrl.value = url
        }
      }
    }
    catch {
      // Missing project media can still use the legacy project card image.
    }
  }, { immediate: true })

  async function currentFiles(id: string): Promise<IFileSystem | null> {
    await content.whenReady()
    if (studio.currentProject?.projectId !== id)
      throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    return content.getFs()
  }

  async function uploadCover(file: File): Promise<void> {
    const project = studio.currentProject
    if (!project)
      return
    const blob = await resizeCover(file)
    const fs = await currentFiles(project.projectId)
    if (fs) {
      const sha256 = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
      const digest = Array.from(sha256, byte => byte.toString(16).padStart(2, '0')).join('')
      const path = projectImagePath('cover', '', 'cover', digest, 'jpg')
      await updateCover(fs, project.projectId, path, blob)
      studio.updateProject(project.projectId, { cover: undefined })
    }
    else {
      studio.updateProject(project.projectId, { cover: await toDataURL(blob) })
    }
    revision.value++
  }

  async function removeCover(): Promise<void> {
    const project = studio.currentProject
    if (!project)
      return
    const fs = await currentFiles(project.projectId)
    if (fs && readProjectCover(await readSettings(fs)))
      await updateCover(fs, project.projectId)
    studio.updateProject(project.projectId, { cover: undefined })
    revision.value++
  }

  async function updateCover(fs: IFileSystem, id: string, path?: string, blob?: Blob) {
    async function write(scope: IFileSystem) {
      if (studio.currentProject?.projectId !== id)
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
      const source = await readSettings(scope)
      const next = writeProjectCover(source, path)
      if (path && blob)
        await scope.writeBlob(path, blob)
      if (source !== await readSettings(scope))
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
      await scope.writeFile(AUTHORING_GAME_SETTINGS_PATH, next)
    }
    if (fs.transaction)
      await fs.transaction(write)
    else if (fs.withWriteLock)
      await fs.withWriteLock(() => write(fs))
    else
      await write(fs)
  }

  return { currentCover, uploadCover, removeCover }
}

async function readSettings(fs: IFileSystem) {
  return await fs.exists(AUTHORING_GAME_SETTINGS_PATH) ? await fs.readFile(AUTHORING_GAME_SETTINGS_PATH) : undefined
}

/** Preserve the Web cover preview size and JPEG conversion. */
async function resizeCover(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 800 / image.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('Canvas not supported')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the cover')), 'image/jpeg', 0.8)
    })
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

function toDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
