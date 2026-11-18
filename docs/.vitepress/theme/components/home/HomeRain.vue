<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { prefersReducedMotion } from '../../composables/home'

const props = withDefaults(defineProps<{
  /** drops per 10k px² */
  density?: number
  speed?: number
  /** horizontal drift per vertical px */
  slant?: number
}>(), {
  density: 1.1,
  speed: 1,
  slant: 0.16,
})

interface Drop {
  x: number
  y: number
  len: number
  v: number
}

// Three depth layers, drawn back to front. Each is one stroke() call.
const LAYERS = [
  { alpha: 0.12, width: 0.7, len: [6, 12], v: [5, 7], share: 0.5 },
  { alpha: 0.22, width: 1, len: [12, 20], v: [8, 11], share: 0.35 },
  { alpha: 0.38, width: 1.3, len: [20, 32], v: [12, 16], share: 0.15 },
] as const

const canvas = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let layers: Drop[][] = []
let raf = 0
let last = 0
let visible = false
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min)

function spawn(layer: typeof LAYERS[number], anywhere: boolean): Drop {
  return {
    x: Math.random() * (width + height * props.slant),
    y: anywhere ? Math.random() * height : -between(layer.len) - Math.random() * 40,
    len: between(layer.len),
    v: between(layer.v) * props.speed,
  }
}

function seed() {
  const total = Math.round((width * height) / 10000 * props.density)
  layers = LAYERS.map(layer => Array.from({ length: Math.round(total * layer.share) }, () => spawn(layer, true)))
}

function draw(step: number) {
  if (!ctx)
    return
  ctx.clearRect(0, 0, width, height)
  ctx.lineCap = 'round'
  LAYERS.forEach((layer, i) => {
    ctx!.strokeStyle = `rgba(206, 226, 255, ${layer.alpha})`
    ctx!.lineWidth = layer.width
    ctx!.beginPath()
    for (const drop of layers[i]) {
      ctx!.moveTo(drop.x, drop.y)
      ctx!.lineTo(drop.x - drop.len * props.slant, drop.y + drop.len)
      if (step) {
        drop.y += drop.v * step
        drop.x -= drop.v * step * props.slant
        if (drop.y > height || drop.x < -20)
          Object.assign(drop, spawn(layer, false))
      }
    }
    ctx!.stroke()
  })
}

function loop(now: number) {
  // Normalise to 60fps steps; clamp after tab switches.
  const step = last ? Math.min((now - last) / 16.67, 3) : 1
  last = now
  draw(step)
  raf = requestAnimationFrame(loop)
}

function play() {
  if (raf || !visible || document.hidden || prefersReducedMotion())
    return
  last = 0
  raf = requestAnimationFrame(loop)
}

function pause() {
  cancelAnimationFrame(raf)
  raf = 0
}

function resize() {
  const el = canvas.value
  if (!el)
    return
  const rect = el.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = rect.width
  height = rect.height
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  ctx = el.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seed()
  draw(0)
}

function onVisibility() {
  if (document.hidden)
    pause()
  else
    play()
}

onMounted(() => {
  const el = canvas.value!
  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(el)
  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible)
      play()
    else
      pause()
  })
  intersectionObserver.observe(el)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  pause()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <canvas ref="canvas" class="h-rain" aria-hidden="true" />
</template>

<style scoped>
.h-rain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
