import type { Ref } from 'vue'
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { en, zh } from '../components/home/data/copy'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Landing page copy for the current locale.
 */
export function useHomeCopy() {
  const { localeIndex } = useData()
  return computed(() => localeIndex.value === 'en' ? en : zh)
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * Reactive `prefers-reduced-motion`. Always `false` during SSR.
 */
export function useReducedMotion() {
  const reduced = ref(false)
  let query: MediaQueryList | undefined
  const update = () => {
    reduced.value = !!query?.matches
  }

  onMounted(() => {
    query = window.matchMedia(REDUCED_MOTION_QUERY)
    update()
    query.addEventListener('change', update)
  })
  onBeforeUnmount(() => query?.removeEventListener('change', update))

  return reduced
}

/**
 * Whether the element is on screen, so demos only play while someone can see them.
 */
export function useInView(target: Ref<HTMLElement | undefined>, threshold = 0.25) {
  const inView = ref(false)
  let observer: IntersectionObserver | undefined

  onMounted(() => {
    if (!target.value)
      return
    observer = new IntersectionObserver(([entry]) => {
      inView.value = entry.isIntersecting
    }, { threshold })
    observer.observe(target.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return inView
}

/**
 * A single cancellable timeout, cleared on unmount.
 */
export function useTimer() {
  let id: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    if (id !== undefined)
      clearTimeout(id)
    id = undefined
  }
  const start = (fn: () => void, ms: number) => {
    clear()
    id = setTimeout(() => {
      id = undefined
      fn()
    }, ms)
  }
  onBeforeUnmount(clear)
  return { start, clear }
}

/**
 * Deterministic PRNG so server and client render the same scenery.
 */
export function createRandom(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Mouse depth for layered scenery. Writes the pointer's position over `target` as `--px` and
 * `--py` (each -1…1, eased toward the pointer, back to 0 when it leaves); layers then use
 * `translate: calc(var(--px, 0) * -Npx) …`, with a larger N the nearer they are.
 * Mouse only: touch and pens leave the scene still, and so does reduced motion.
 */
export function useParallax(target: Ref<HTMLElement | undefined>) {
  const reduced = useReducedMotion()
  let frame = 0
  let x = 0
  let y = 0
  let tx = 0
  let ty = 0

  const write = () => {
    target.value?.style.setProperty('--px', x.toFixed(3))
    target.value?.style.setProperty('--py', y.toFixed(3))
  }

  const step = () => {
    x += (tx - x) * 0.1
    y += (ty - y) * 0.1
    if (Math.abs(tx - x) < 0.002 && Math.abs(ty - y) < 0.002) {
      x = tx
      y = ty
      frame = 0
    }
    else {
      frame = requestAnimationFrame(step)
    }
    write()
  }

  const ease = () => {
    if (!frame)
      frame = requestAnimationFrame(step)
  }

  function onMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || reduced.value || !target.value)
      return
    const rect = target.value.getBoundingClientRect()
    tx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
    ty = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
    ease()
  }

  function onLeave() {
    tx = 0
    ty = 0
    ease()
  }

  onMounted(() => {
    target.value?.addEventListener('pointermove', onMove)
    target.value?.addEventListener('pointerleave', onLeave)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    target.value?.removeEventListener('pointermove', onMove)
    target.value?.removeEventListener('pointerleave', onLeave)
  })

  watch(reduced, (value) => {
    if (!value)
      return
    cancelAnimationFrame(frame)
    frame = x = y = tx = ty = 0
    write()
  })
}
