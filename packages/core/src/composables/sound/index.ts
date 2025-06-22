/* eslint-disable new-cap */

import type { MaybeRef } from '@vueuse/core'

// @ts-nocheck
import type { Howl } from 'howler'
import type {
  ComposableOptions,
  HowlStatic,
  PlayFunction,
  PlayOptions,
  ReturnedValue,
} from './types'
import { isClient } from '@vueuse/core'
import { onMounted, ref, unref, watch } from 'vue'

export function useSound(
  url: MaybeRef<string>,
  {
    volume = 1,
    playbackRate = 1,
    soundEnabled = true,
    interrupt = false,
    onload,
    ...delegated
  }: ComposableOptions = {},
) {
  const HowlConstructor = ref<HowlStatic | null>(null)
  const isPlaying = ref<boolean>(false)
  const duration = ref<number | null>(null)
  const sound = ref<Howl | null>(null)

  onMounted(() => {
    const curUrl = unref(url)
    if (!curUrl)
      return

    if (isClient) {
      import('howler').then((mod) => {
        HowlConstructor.value = mod.Howl

        sound.value = new HowlConstructor.value({
          src: [curUrl],
          volume: unref(volume),
          rate: unref(playbackRate),
          onload: handleLoad,
          ...delegated,
        })
      })
    }
  })

  function handleLoad(this: Howl) {
    if (typeof onload === 'function')

      onload.call(this)

    duration.value = duration.value ? duration.value * 1000 : 0
  }

  watch(
    () => [url],
    () => {
      if (url && HowlConstructor && HowlConstructor.value && sound && sound.value) {
        sound.value = new HowlConstructor.value({
          src: [unref(url)],
          volume: unref(volume),
          rate: unref(playbackRate),
          onload: handleLoad,
          ...delegated,
        })
      }
    },
  )

  watch(
    () => [unref(volume), unref(playbackRate)],
    () => {
      if (sound.value) {
        sound.value.volume(unref(volume))
        sound.value.rate(unref(playbackRate))
      }
    },
  )

  const play: PlayFunction = (options?: PlayOptions) => {
    if (typeof options === 'undefined')
      options = {}

    if (!sound.value || (!soundEnabled && !options.forceSoundEnabled))
      return

    if (interrupt)
      sound.value.stop()

    if (options.playbackRate)
      sound.value.rate(options.playbackRate)

    sound.value.play(options.id)

    sound.value.once('end', () => {
      if (sound && sound.value && !sound.value.playing())
        isPlaying.value = false
    })

    isPlaying.value = true
  }

  const stop = (id?: number) => {
    if (!sound.value)
      return

    sound.value.stop(typeof id === 'number' ? id : undefined)

    isPlaying.value = false
  }

  const pause = (id?: number) => {
    if (!sound.value)
      return

    sound.value.pause(typeof id === 'number' ? id : undefined)

    isPlaying.value = false
  }

  const returnedValue: ReturnedValue = {
    play,
    sound,
    isPlaying,
    duration,
    pause,
    stop,
  }

  return returnedValue
}
