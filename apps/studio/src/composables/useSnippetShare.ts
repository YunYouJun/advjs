import type { SnippetMessage } from '../components/ChatSnippetShare.vue'
import { ref } from 'vue'

/**
 * Composable for selecting chat messages and generating a share image.
 *
 * Usage:
 * 1. Call `toggleSelect(msg)` to select/deselect messages
 * 2. Call `generateShareImage(containerEl)` to render the snippet card to canvas
 * 3. The resulting blob can be shared via Web Share API or downloaded
 */
export function useSnippetShare() {
  const selectedIds = ref<Set<number>>(new Set())
  const isSelecting = ref(false)

  function startSelecting() {
    isSelecting.value = true
    selectedIds.value.clear()
  }

  function cancelSelecting() {
    isSelecting.value = false
    selectedIds.value.clear()
  }

  function toggleSelect(index: number) {
    if (selectedIds.value.has(index))
      selectedIds.value.delete(index)
    else
      selectedIds.value.add(index)
  }

  function isSelected(index: number): boolean {
    return selectedIds.value.has(index)
  }

  /**
   * Extract selected messages from a full messages array.
   */
  function getSelectedMessages<T extends { role: string, content: string }>(
    allMessages: T[],
    mapFn: (msg: T) => SnippetMessage,
  ): SnippetMessage[] {
    return Array.from(selectedIds.value)
      .sort((a, b) => a - b)
      .map(idx => allMessages[idx])
      .filter(Boolean)
      .map(mapFn)
  }

  /**
   * Render a DOM element to a PNG blob using html2canvas-style approach.
   * Falls back to a simple canvas rendering if html2canvas is not available.
   */
  async function renderToBlob(element: HTMLElement): Promise<Blob | null> {
    try {
      // Use native canvas approach: clone element, render with SVG foreignObject
      const { width, height } = element.getBoundingClientRect()
      const clone = element.cloneNode(true) as HTMLElement
      clone.style.position = 'absolute'
      clone.style.left = '-9999px'
      document.body.appendChild(clone)

      const styles = Array.from(document.querySelectorAll('style'))
        .map(s => s.outerHTML)
        .join('')

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">
              ${styles}
              ${clone.outerHTML}
            </div>
          </foreignObject>
        </svg>
      `

      document.body.removeChild(clone)

      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')
      if (!ctx)
        return null

      ctx.scale(2, 2)
      const img = new Image()
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      return new Promise((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0)
          URL.revokeObjectURL(url)
          canvas.toBlob(blob => resolve(blob), 'image/png')
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve(null)
        }
        img.src = url
      })
    }
    catch {
      return null
    }
  }

  /**
   * Share a blob via Web Share API or download as fallback.
   */
  async function shareBlob(blob: Blob, filename = 'chat-snippet.png'): Promise<void> {
    const file = new File([blob], filename, { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
    }
    else {
      // Fallback: download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return {
    selectedIds,
    isSelecting,
    startSelecting,
    cancelSelecting,
    toggleSelect,
    isSelected,
    getSelectedMessages,
    renderToBlob,
    shareBlob,
  }
}
