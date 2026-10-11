import type { AudioBus, AudioBusSettings, AudioUserSettings } from '@advjs/types'
import { canonicalAudioJson, parseAudioUserSettings } from '@advjs/audio'
import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'

/** Device preferences are shared by the player hosts, outside project files and saves. */
export const useAudioStore = defineStore('@advjs/client/audio', () => {
  const settings = useStorage<AudioUserSettings>('advjs:audio:v1', {}, undefined, {
    serializer: {
      read(value) {
        try {
          return parseAudioUserSettings(JSON.parse(value))
        }
        catch { return {} }
      },
      write: value => JSON.stringify(parseAudioUserSettings(JSON.parse(JSON.stringify(value)))),
    },
  })
  function replace(value: AudioUserSettings) {
    const parsed = parseAudioUserSettings(JSON.parse(JSON.stringify(value)))
    if (canonicalAudioJson(parsed) !== canonicalAudioJson(settings.value))
      settings.value = parsed
  }
  return {
    settings,
    replace,
    setBus(bus: AudioBus, value: AudioBusSettings) {
      replace({ buses: { ...settings.value.buses, [bus]: { ...settings.value.buses?.[bus], ...value } } })
    },
    reset() { replace({}) },
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAudioStore, import.meta.hot))
