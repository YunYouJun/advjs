import type { AdvCharacter } from '@advjs/types'
import { stringifyCharacterMd } from '@advjs/parser'
import { createApp, h } from 'vue'
import CharacterShareCard from '../components/CharacterShareCard.vue'

/**
 * Render a DOM element to PNG blob using modern-screenshot.
 */
async function domToPngBlob(element: HTMLElement): Promise<Blob> {
  const { domToPng } = await import('modern-screenshot')
  const dataUrl = await domToPng(element, {
    scale: 2,
    quality: 0.95,
  })
  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Share a character as a PNG image.
 *
 * 1. Mount CharacterShareCard to a hidden container
 * 2. Screenshot via modern-screenshot
 * 3. Share via Web Share API or download
 * 4. Cleanup hidden container
 */
export async function shareCharacterAsImage(
  character: AdvCharacter,
): Promise<{ blob: Blob, shared: boolean }> {
  // Create hidden container
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;pointer-events:none;'
  document.body.appendChild(container)

  // Mount CharacterShareCard
  const app = createApp({
    render: () => h(CharacterShareCard, { character }),
  })
  app.mount(container)

  // Wait for render
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  try {
    const cardEl = container.querySelector('.share-card') as HTMLElement
    if (!cardEl)
      throw new Error('CharacterShareCard not rendered')

    const blob = await domToPngBlob(cardEl)
    const fileName = `${character.id || character.name}-card.png`

    // Try native share with file
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: 'image/png' })
      const shareData = { files: [file], title: character.name }
      if (navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData)
          return { blob, shared: true }
        }
        catch {
          // User cancelled — fall through to download
        }
      }
    }

    // Fallback: download blob directly
    downloadBlob(blob, fileName)
    return { blob, shared: false }
  }
  finally {
    app.unmount()
    document.body.removeChild(container)
  }
}

/**
 * Export a character as a standalone .character.md file download.
 */
export function shareCharacterAsMd(character: AdvCharacter): void {
  const md = stringifyCharacterMd(character)
  const fileName = `${character.id || 'character'}.character.md`
  downloadAsFile(md, fileName, 'text/markdown;charset=utf-8')
}

/**
 * Copy character summary text to clipboard.
 */
export async function copyCharacterInfo(character: AdvCharacter): Promise<boolean> {
  const lines: string[] = [
    `【${character.name}】`,
  ]
  if (character.faction)
    lines.push(`阵营：${character.faction}`)
  if (character.tags?.length)
    lines.push(`标签：${character.tags.join('、')}`)
  if (character.personality)
    lines.push(`性格：${character.personality.slice(0, 100)}`)
  if (character.concept)
    lines.push(`理念：${character.concept.slice(0, 80)}`)
  lines.push('')
  lines.push('— Created with ADV.JS Studio')

  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    return true
  }
  catch {
    return false
  }
}

/**
 * Trigger a browser file download from in-memory text content.
 */
function downloadAsFile(
  content: string,
  filename: string,
  type = 'text/markdown',
): void {
  const blob = new Blob([content], { type })
  downloadBlob(blob, filename)
}

/**
 * Download a Blob as a file.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
