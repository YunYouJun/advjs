import type { InjectionKey, Ref, ShallowRef } from 'vue'
import type { StoryLocale } from '../../../../packages/ai/src'
import type { AiRun } from '../components/home/ai/run'
import type { StoryPlayer } from './player'
import { inject, ref, shallowRef } from 'vue'

/**
 * The only piece of AI mode in the page's first load: an on/off state and a loader. The run
 * controller, compiler, parser, highlighter and settings dialog arrive on first use.
 */
export interface AiMode {
  /** The tram plays the generated run instead of the hand-written story. */
  on: Ref<boolean>
  loading: Ref<boolean>
  settingsOpen: Ref<boolean>
  run: ShallowRef<AiRun | undefined>
  locale: StoryLocale
  /** Gives AI mode the player it drives; call once the player exists. */
  attach: (player: StoryPlayer) => void
  /** Turns AI mode on: starts a run, or asks for settings first. */
  enter: () => Promise<void>
  /** Starts a fresh run with the saved settings. */
  begin: () => Promise<void>
  /** Replays the pre-generated sample run, if there is one. */
  sample: () => Promise<void>
  leave: () => void
}

const loadRun = () => import('../components/home/ai/run')
const loadSettings = () => import('../components/home/ai/settings')
let pending: Promise<[Awaited<ReturnType<typeof loadRun>>, Awaited<ReturnType<typeof loadSettings>>]> | undefined

/** Loads the AI chunk once; a failed load (offline, a new deploy) is tried again next time. */
function loadAi() {
  return pending ??= Promise.all([loadRun(), loadSettings()]).catch((error) => {
    pending = undefined
    throw error
  })
}

/** Fetches the AI chunk ahead of a click (hover or focus on the toggle). */
export function preloadAi(): void {
  loadAi().catch(() => {})
}

export function createAiMode(locale: StoryLocale): AiMode {
  const on = ref(false)
  const loading = ref(false)
  const settingsOpen = ref(false)
  const run = shallowRef<AiRun>()
  let player: StoryPlayer | undefined

  async function ensure() {
    loading.value = true
    try {
      const [{ createAiRun }, settings] = await loadAi()
      if (!player)
        throw new Error('AI mode needs a player; call attach() first')
      run.value ??= createAiRun({ player, locale })
      return { run: run.value, settings }
    }
    finally {
      loading.value = false
    }
  }

  return {
    on,
    loading,
    settingsOpen,
    run,
    locale,

    attach(next) {
      player = next
    },

    async enter() {
      let loaded: Awaited<ReturnType<typeof ensure>>
      try {
        loaded = await ensure()
      }
      catch (error) {
        console.warn('[home] AI mode failed to load', error)
        return
      }
      const { run, settings } = loaded
      on.value = true
      if (settings.loadSettings())
        await run.start()
      else
        settingsOpen.value = true
    },

    async begin() {
      const { run } = await ensure()
      on.value = true
      settingsOpen.value = false
      await run.start()
    },

    async sample() {
      const { run } = await ensure()
      on.value = true
      settingsOpen.value = false
      await run.startSample()
    },

    leave() {
      run.value?.dispose()
      run.value = undefined
      settingsOpen.value = false
      on.value = false
    },
  }
}

export const aiModeKey: InjectionKey<AiMode> = Symbol('ai-mode')

export function useAiMode(): AiMode | undefined {
  return inject(aiModeKey, undefined)
}
