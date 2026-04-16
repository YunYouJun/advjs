import { computed } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'

/**
 * Composable for managing project cover images.
 *
 * Supports:
 * - Manual file upload (converts to data URL for localStorage persistence)
 * - Clearing existing cover
 * - Future: AI-generated covers via image service
 */
export function useProjectCover() {
  const studioStore = useStudioStore()

  const currentCover = computed(() => studioStore.currentProject?.cover)

  /**
   * Upload a cover image from a File input.
   * Resizes to max 800px width and converts to JPEG data URL.
   */
  async function uploadCover(file: File): Promise<string | null> {
    const project = studioStore.currentProject
    if (!project)
      return null

    const dataUrl = await resizeAndConvert(file, 800, 0.8)
    studioStore.updateProject(project.projectId, { cover: dataUrl })
    return dataUrl
  }

  /**
   * Remove the cover image from current project.
   */
  function removeCover(): void {
    const project = studioStore.currentProject
    if (!project)
      return
    studioStore.updateProject(project.projectId, { cover: undefined })
  }

  return {
    currentCover,
    uploadCover,
    removeCover,
  }
}

/**
 * Resize image to max width and convert to JPEG data URL.
 */
function resizeAndConvert(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}
