<!--
  QR code generator component.
  Prebuilt for future "project QR code share" feature.
  Uses `qrcode` npm package if installed, otherwise renders a placeholder pattern.
-->
<script setup lang="ts">
import { IonButton, IonIcon, toastController } from '@ionic/vue'
import { copyOutline, downloadOutline } from 'ionicons/icons'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  /** URL or text to encode */
  value: string
  /** Canvas size in pixels */
  size?: number
  /** Show action buttons */
  showActions?: boolean
}>(), {
  size: 200,
  showActions: true,
})

const { t } = useI18n()
const canvasRef = ref<HTMLCanvasElement>()
const dataUrl = ref('')

/**
 * Generate QR code using a minimal alphanumeric encoder.
 * For production, this uses the Canvas API to draw a simple
 * representation. For a full QR implementation, we dynamically
 * import a library if available.
 */
async function generateQR() {
  if (!canvasRef.value || !props.value)
    return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const size = props.size
  canvas.width = size
  canvas.height = size

  // Try to use a real QR library if installed
  try {
    const { toCanvas } = await import('qrcode')
    await toCanvas(canvas, props.value, {
      width: size,
      margin: 2,
      color: { dark: '#1e1b4b', light: '#ffffff' },
    })
  }
  catch {
    // Fallback: render a placeholder pattern
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    // Generate a simple visual hash pattern as placeholder
    ctx.fillStyle = '#1e1b4b'
    const cellSize = Math.floor(size / 25)
    const margin = Math.floor((size - cellSize * 21) / 2)

    // Draw finder patterns (top-left, top-right, bottom-left)
    drawFinderPattern(ctx, margin, margin, cellSize)
    drawFinderPattern(ctx, margin + 14 * cellSize, margin, cellSize)
    drawFinderPattern(ctx, margin, margin + 14 * cellSize, cellSize)

    // Draw data area with hash-based pattern
    const hash = simpleHash(props.value)
    for (let row = 0; row < 21; row++) {
      for (let col = 0; col < 21; col++) {
        if (isFinderArea(row, col))
          continue
        const bit = (hash[row * 21 + col] || 0) % 2
        if (bit) {
          ctx.fillRect(
            margin + col * cellSize,
            margin + row * cellSize,
            cellSize,
            cellSize,
          )
        }
      }
    }

    // Text below
    ctx.fillStyle = '#64748b'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Install qrcode for real QR', size / 2, size - 4)
  }

  dataUrl.value = canvas.toDataURL('image/png')
}

function drawFinderPattern(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  // Outer 7x7
  ctx.fillRect(x, y, 7 * cell, cell)
  ctx.fillRect(x, y + 6 * cell, 7 * cell, cell)
  ctx.fillRect(x, y, cell, 7 * cell)
  ctx.fillRect(x + 6 * cell, y, cell, 7 * cell)
  // Inner 3x3
  ctx.fillRect(x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell)
}

function isFinderArea(row: number, col: number): boolean {
  return (row < 8 && col < 8)
    || (row < 8 && col >= 13)
    || (row >= 13 && col < 8)
}

function simpleHash(str: string): number[] {
  const result: number[] = []
  for (let i = 0; i < 441; i++) {
    let h = i * 17
    for (let j = 0; j < str.length; j++)
      h = (h * 31 + str.charCodeAt(j) + i) & 0xFFFF
    result.push(h)
  }
  return result
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.value)
    const toast = await toastController.create({
      message: t('preview.shareCopied'),
      duration: 1500,
      position: 'top',
      color: 'success',
    })
    await toast.present()
  }
  catch {
    // Clipboard not available
  }
}

function handleDownload() {
  if (!dataUrl.value)
    return
  const link = document.createElement('a')
  link.href = dataUrl.value
  link.download = 'qrcode.png'
  link.click()
}

watch(() => props.value, generateQR)
onMounted(generateQR)
</script>

<template>
  <div class="qr-generator">
    <canvas ref="canvasRef" class="qr-generator__canvas" />
    <div v-if="showActions" class="qr-generator__actions">
      <IonButton size="small" fill="clear" @click="handleCopy">
        <IonIcon slot="start" :icon="copyOutline" />
        {{ t('chat.copyMessage') }}
      </IonButton>
      <IonButton size="small" fill="clear" @click="handleDownload">
        <IonIcon slot="start" :icon="downloadOutline" />
        {{ t('editor.downloaded') }}
      </IonButton>
    </div>
  </div>
</template>

<style scoped>
.qr-generator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-md);
}

.qr-generator__canvas {
  border-radius: var(--adv-radius-lg);
  box-shadow: var(--adv-shadow-subtle);
}

.qr-generator__actions {
  display: flex;
  gap: var(--adv-space-xs);
}
</style>
