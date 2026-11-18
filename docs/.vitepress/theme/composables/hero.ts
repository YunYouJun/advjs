import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useHomeCopy, useInView, useReducedMotion, useTimer } from './home'

export interface HeroChoice {
  label: string
  /** where the choice leads, shown under the label */
  sub: string
  link: string
  external: boolean
}

const HEAD_SPEED = 64
const LINE_SPEED = 30
const AUTO_DELAY = 5200

/**
 * The opening scene every skin plays: the headline types out, then the pitch line by line,
 * with auto-advance, a backlog and the three ways in. Each skin only draws it.
 */
export function useHero() {
  const t = useHomeCopy()
  const lines = computed(() => t.value.hero.lines)

  const choices = computed<HeroChoice[]>(() => [
    { label: t.value.hero.guide, sub: `docs.advjs.org${t.value.guide}`, link: t.value.guide, external: false },
    { label: t.value.hero.demo, sub: 'demo.advjs.org', link: 'https://demo.advjs.org', external: true },
    { label: t.value.hero.editor, sub: 'editor.advjs.org', link: 'https://editor.advjs.org', external: true },
  ])

  const headDuration = computed(() => Array.from(t.value.hero.headline).length * HEAD_SPEED)

  const stage = ref<HTMLElement>()
  const logButton = ref<HTMLButtonElement>()
  const logClose = ref<HTMLButtonElement>()
  const inView = useInView(stage)
  const reduced = useReducedMotion()
  const timer = useTimer()

  const index = ref(0)
  const advances = ref(0)
  const seen = ref(1)
  const headInstant = ref(false)
  const lineInstant = ref(false)
  const lineDone = ref(false)
  const auto = ref(true)
  const logOpen = ref(false)

  const lineDelay = computed(() => advances.value === 0 && !headInstant.value ? headDuration.value + 300 : 0)
  const backlog = computed(() => lines.value.slice(0, seen.value))

  function complete() {
    headInstant.value = true
    lineInstant.value = true
  }

  function advance() {
    if (!lineDone.value)
      return complete()
    index.value = (index.value + 1) % lines.value.length
    seen.value = Math.max(seen.value, index.value + 1)
    advances.value++
    lineInstant.value = false
    lineDone.value = false
  }

  watch([lineDone, auto, inView, logOpen], () => {
    timer.clear()
    if (lineDone.value && auto.value && inView.value && !logOpen.value)
      timer.start(advance, AUTO_DELAY)
  })

  watch(reduced, (value) => {
    if (value)
      auto.value = false
  }, { immediate: true })

  async function openLog() {
    logOpen.value = true
    await nextTick()
    logClose.value?.focus()
  }

  function closeLog() {
    logOpen.value = false
    logButton.value?.focus()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && logOpen.value)
      closeLog()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

  return {
    t,
    lines,
    choices,
    stage,
    logButton,
    logClose,
    inView,
    index,
    advances,
    headInstant,
    lineInstant,
    lineDone,
    lineDelay,
    headDuration,
    auto,
    logOpen,
    backlog,
    advance,
    openLog,
    closeLog,
    HEAD_SPEED,
    LINE_SPEED,
  }
}

/**
 * The closing scene: one last line, typed when it first comes into view, and the ways onward.
 */
export function useFinale() {
  const t = useHomeCopy()

  const choices = computed<(HeroChoice & { primary?: boolean })[]>(() => [
    { label: t.value.finale.start, sub: t.value.finale.quickStart, link: '/guide/quick-start', external: false, primary: true },
    { label: t.value.finale.github, sub: 'github.com/YunYouJun/advjs', link: 'https://github.com/YunYouJun/advjs', external: true },
    { label: t.value.finale.sponsor, sub: 'sponsors.yunyoujun.cn', link: 'https://sponsors.yunyoujun.cn', external: true },
  ])

  const root = ref<HTMLElement>()
  const inView = useInView(root, 0.5)
  const plays = ref(0)

  watch(inView, (visible) => {
    if (visible && plays.value === 0)
      plays.value++
  })

  return { t, choices, root, inView, plays }
}
