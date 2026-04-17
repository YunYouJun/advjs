import type { SnippetMessage } from '../components/ChatSnippetShare.vue'
import type { ConversationTheme } from '../utils/conversationHtml'
import { ref } from 'vue'

/**
 * Composable for selecting chat messages and generating a share image.
 *
 * Usage:
 * 1. Call `toggleSelect(msg)` to select/deselect messages
 * 2. Call `renderToBlob(containerEl)` to render the snippet card to canvas
 * 3. The resulting blob can be shared via Web Share API or downloaded
 *
 * Rendering uses `modern-screenshot` for reliable cross-platform output
 * (better than naive SVG foreignObject which breaks on complex CSS).
 */
export function useSnippetShare() {
  const selectedIds = ref<Set<number>>(new Set())
  const isSelecting = ref(false)
  const theme = ref<ConversationTheme>('dark')

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

  /** Select the last N messages (quick-share shortcut). */
  function selectLastN<T>(allMessages: T[], n: number) {
    selectedIds.value.clear()
    const start = Math.max(0, allMessages.length - n)
    for (let i = start; i < allMessages.length; i++)
      selectedIds.value.add(i)
  }

  /** Select a contiguous range [from, to] inclusive. */
  function selectRange(from: number, to: number) {
    selectedIds.value.clear()
    const [lo, hi] = from <= to ? [from, to] : [to, from]
    for (let i = lo; i <= hi; i++)
      selectedIds.value.add(i)
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
   * Render a DOM element to a PNG blob using modern-screenshot.
   * Falls back to SVG foreignObject approach if modern-screenshot fails.
   */
  async function renderToBlob(element: HTMLElement): Promise<Blob | null> {
    try {
      const { domToBlob } = await import('modern-screenshot')
      return await domToBlob(element, {
        scale: 2,
        backgroundColor: undefined, // inherit from element
      })
    }
    catch (err) {
      console.warn('[useSnippetShare] modern-screenshot failed, trying fallback:', err)
      return renderViaSvgFallback(element)
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
    theme,
    startSelecting,
    cancelSelecting,
    toggleSelect,
    isSelected,
    selectLastN,
    selectRange,
    getSelectedMessages,
    renderToBlob,
    shareBlob,
  }
}

/**
 * Fallback: render DOM via SVG foreignObject.
 * Works when modern-screenshot fails (e.g. CSP restrictions).
 */
async function renderViaSvgFallback(element: HTMLElement): Promise<Blob | null> {
  try {
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
