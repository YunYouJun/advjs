import type { AudioBus, AudioMixerConfig, AudioUserSettings } from '@advjs/types'
import { audioBuses, parseAudioMixerConfig, parseAudioUserSettings } from './schema'

export function createAudioMixer(config: AudioMixerConfig, apply: (bus: AudioBus, gain: number, rampMs: number) => void) {
  const project = parseAudioMixerConfig(config)
  let user: AudioUserSettings = {}
  let ducked = false

  function inspect() {
    const settings = Object.fromEntries(audioBuses.map(bus => [bus, {
      gain: user.buses?.[bus]?.gain ?? project.buses?.[bus]?.gain ?? 1,
      muted: user.buses?.[bus]?.muted ?? project.buses?.[bus]?.muted ?? false,
      solo: user.buses?.[bus]?.solo ?? project.buses?.[bus]?.solo ?? false,
    }])) as Record<AudioBus, { gain: number, muted: boolean, solo: boolean }>
    const solo = audioBuses.some(bus => bus !== 'master' && settings[bus].solo)
    const master = settings.master.muted ? 0 : settings.master.gain
    return Object.fromEntries(audioBuses.map((bus) => {
      const setting = settings[bus]
      const silent = setting.muted || (bus !== 'master' && solo && !setting.solo)
      const duck = ducked && (bus === 'music' || bus === 'ambience') ? project.ducking?.gain ?? 0.35 : 1
      const output = silent ? 0 : setting.gain * duck
      return [bus, { ...setting, output, effectiveGain: output * (bus === 'master' ? 1 : master) }]
    })) as Record<AudioBus, { gain: number, output: number, effectiveGain: number, muted: boolean, solo: boolean }>
  }

  function refresh(rampMs = 0) {
    const current = inspect()
    for (const bus of audioBuses)
      apply(bus, current[bus].output, (bus === 'music' || bus === 'ambience') ? rampMs : 0)
  }

  refresh()
  return {
    inspect,
    setUserSettings(settings: AudioUserSettings) {
      user = parseAudioUserSettings(settings)
      refresh()
    },
    setVoiceActive(active: boolean) {
      const next = active && project.ducking?.enabled !== false
      if (next === ducked)
        return
      ducked = next
      refresh(next ? project.ducking?.attackMs ?? 120 : project.ducking?.releaseMs ?? 300)
    },
    get ducking() { return ducked },
    config: project,
  }
}
