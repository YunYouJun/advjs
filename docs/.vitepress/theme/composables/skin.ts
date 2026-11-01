import type { InjectionKey, Ref } from 'vue'
import type { SkinId } from '../components/home/data/skin-ids'
import { inject, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { preloadSkin } from '../components/home/data/skin-components'
import { DEFAULT_SKIN, isSkin, SKIN_STORAGE_KEY, SKIN_TRANSITIONS } from '../components/home/data/skin-ids'
import { prefersReducedMotion } from './home'

/** Short fade used for reduced motion, and when a new pick interrupts a transition. */
const QUICK_ENTER = 220

export type SkinPhase = 'idle' | 'exit' | 'enter'

export interface HomeSkin {
  skin: Ref<SkinId>
  /** False until hydration, while SSR markup still shows the default skin. */
  ready: Ref<boolean>
  /** Where a switch is: the old skin leaving, or the new one arriving. */
  phase: Ref<SkinPhase>
  /** The skin on its way in, while the old one exits. */
  incoming: Ref<SkinId | undefined>
  /** Length of the current phase, for CSS. */
  duration: Ref<number>
  set: (id: SkinId) => void
  preload: (id: SkinId) => void
}

const key: InjectionKey<HomeSkin> = Symbol('home-skin')

/**
 * The landing page skin. SSR always renders the default; after hydration the page shows the
 * skin the head script picked, without a transition. Later switches play as a scene change:
 * the old skin's exit, then the new skin's entrance. `<html data-adv-skin>` is the single
 * source for skin CSS; `.adv-home[data-phase]` drives the transition.
 */
export function provideHomeSkin(): HomeSkin {
  const skin = ref<SkinId>(DEFAULT_SKIN)
  const ready = ref(false)
  const phase = ref<SkinPhase>('idle')
  const incoming = ref<SkinId>()
  const duration = ref(0)
  let timer: ReturnType<typeof setTimeout> | undefined
  /** Bumped by every pick, so a stale switch stops where it is. */
  let token = 0

  onMounted(() => {
    const picked = document.documentElement.dataset.advSkin
    if (isSkin(picked))
      skin.value = picked
    else
      document.documentElement.dataset.advSkin = DEFAULT_SKIN
    ready.value = true
  })

  onBeforeUnmount(() => clearTimeout(timer))

  function apply(id: SkinId) {
    skin.value = id
    document.documentElement.dataset.advSkin = id
  }

  function enter(id: SkinId, ms: number) {
    apply(id)
    incoming.value = undefined
    duration.value = ms
    phase.value = 'enter'
    timer = setTimeout(() => {
      phase.value = 'idle'
    }, ms)
  }

  function set(id: SkinId) {
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, id)
    }
    catch {}

    const mine = ++token
    clearTimeout(timer)

    // Reduced motion, or a pick while a switch is still playing: go straight to the latest
    // pick with a short fade.
    if (prefersReducedMotion() || phase.value !== 'idle') {
      void preloadSkin(id).then(() => {
        if (mine === token)
          enter(id, QUICK_ENTER)
      })
      return
    }

    incoming.value = id
    duration.value = SKIN_TRANSITIONS[skin.value].exit
    phase.value = 'exit'
    const exited = new Promise(resolve => timer = setTimeout(resolve, duration.value))
    void Promise.all([exited, preloadSkin(id)]).then(() => {
      if (mine === token)
        enter(id, SKIN_TRANSITIONS[id].enter.duration)
    })
  }

  const value = { skin, ready, phase, incoming, duration, set, preload: (id: SkinId) => void preloadSkin(id) }
  provide(key, value)
  return value
}

export function useHomeSkin(): HomeSkin {
  return inject(key)!
}
