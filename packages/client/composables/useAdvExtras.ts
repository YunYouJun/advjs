import type { AdvExtrasUnlockKind } from '@advjs/core'
import type { AdvGameExtraItem, AdvGameReplayConfig, JsonObject, RuntimeProgram } from '@advjs/types'
import { createRuntimeRouteGraph, isReplayAvailable, musicRoomTracks, unlockedExtraIds, visibleRuntimeRouteGraph } from '@advjs/core'
import { computed, onMounted, shallowRef } from 'vue'
import { useAdvContext } from './useAdvContext'

export interface AdvExtraEntry extends AdvGameExtraItem {
  unlocked: boolean
}

export interface AdvReplayEntry extends AdvGameReplayConfig {
  available: boolean
}

/**
 * Read-only model of the extras menu, built from the host extras record and
 * stored progression. Isolated sessions such as replays never write either.
 */
export function useAdvExtras() {
  const { $adv } = useAdvContext()
  const game = computed(() => $adv.gameConfig.value)
  const program = shallowRef<RuntimeProgram>()
  // Progression is browser storage, not reactive: read it once per screen.
  const stored: JsonObject = $adv.progression?.restore(game.value.variables ?? {}) ?? {}

  onMounted(async () => {
    program.value = await $adv.loadProgram()
  })

  function unlockedIds(kind: AdvExtrasUnlockKind) {
    const config = game.value[kind]
    return new Set([
      ...$adv.extras?.[kind].value ?? [],
      ...unlockedExtraIds(config, kind, stored),
    ])
  }

  function entries(kind: AdvExtrasUnlockKind) {
    const unlocked = unlockedIds(kind)
    return (game.value[kind]?.items ?? []).map(item => ({ ...item, unlocked: unlocked.has(item.id) }))
  }

  const visited = computed(() => new Set($adv.extras?.visited.value ?? []))
  const heard = computed(() => new Set($adv.extras?.heard.value ?? []))

  const endings = computed<AdvExtraEntry[]>(() => entries('endings'))
  const achievements = computed<AdvExtraEntry[]>(() => entries('achievements'))
  const replays = computed<AdvReplayEntry[]>(() => (game.value.replays ?? []).map(replay => ({
    ...replay,
    available: Boolean(program.value) && isReplayAvailable(replay, visited.value, program.value),
  })))
  const tracks = computed(() => musicRoomTracks(game.value).map(track => ({ ...track, heard: heard.value.has(track.id) })))
  const route = computed(() => program.value ? createRuntimeRouteGraph(program.value) : undefined)
  const visibleRoute = computed(() => route.value ? visibleRuntimeRouteGraph(route.value, visited.value) : undefined)

  return {
    endings,
    achievements,
    replays,
    tracks,
    route,
    visibleRoute,
  }
}
