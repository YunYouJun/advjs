import { describe, expect, it, vi } from 'vitest'
import { useAdvBgm } from '../../packages/client/composables/useAdvBgm'

const howler = vi.hoisted(() => ({
  instances: [] as Array<{
    options: Record<string, any>
    fades: Array<[number, number, number]>
    finishFade: () => void
    flushFadeEvents: () => void
    muted: boolean
    playing: () => boolean
    stopped: boolean
    unloaded: boolean
    volume: () => number
  }>,
}))

vi.mock('howler', () => ({
  Howl: class MockHowl {
    options: Record<string, any>
    fades: Array<[number, number, number]> = []
    muted: boolean
    stopped = false
    unloaded = false
    private playingValue = false
    private volumeValue = 0
    private fadeInProgress = false
    private fadeListener?: () => void
    private queuedFadeListeners: Array<() => void> = []

    constructor(options: Record<string, any>) {
      this.options = options
      this.muted = options.mute === true
      howler.instances.push(this)
    }

    play() {
      this.playingValue = true
    }

    playing() {
      return this.playingValue
    }

    loop() {}

    volume(value?: number) {
      if (value !== undefined)
        this.volumeValue = value
      return this.volumeValue
    }

    once(event: string, listener: () => void) {
      if (event === 'fade')
        this.fadeListener = listener
    }

    off(event: string, listener: () => void) {
      if (event === 'fade' && this.fadeListener === listener)
        this.fadeListener = undefined
    }

    fade(from: number, to: number, duration: number) {
      const interruptedListener = this.fadeInProgress ? this.fadeListener : undefined
      this.fadeListener = undefined
      if (interruptedListener)
        this.queuedFadeListeners.push(interruptedListener)
      this.fades.push([from, to, duration])
      this.volumeValue = to
      this.fadeInProgress = true
    }

    finishFade() {
      const listener = this.fadeListener
      this.fadeListener = undefined
      this.fadeInProgress = false
      if (listener)
        this.queuedFadeListeners.push(listener)
    }

    flushFadeEvents() {
      const listeners = this.queuedFadeListeners.splice(0)
      for (const listener of listeners)
        listener()
    }

    stop() {
      this.playingValue = false
      this.stopped = true
      this.fadeInProgress = false
    }

    unload() {
      this.stop()
      this.unloaded = true
    }

    pause() {
      this.playingValue = false
    }

    mute(value: boolean) {
      this.muted = value
    }
  },
}))

function createBgm(gameConfig: Record<string, unknown> = {}) {
  return useAdvBgm({
    config: { value: { cdn: {} } },
    gameConfig: { value: gameConfig },
    compileDiagnostics: { value: [] },
  } as any)
}

describe('client BGM presentation', () => {
  it('crossfades between library tracks with the requested loop and fade options', () => {
    howler.instances.length = 0
    const bgm = createBgm({
      bgm: {
        library: {
          summer: { name: 'Summer', src: 'https://assets.example/summer.ogg' },
          space: { name: 'Space', src: 'https://assets.example/space.ogg' },
        },
      },
    })

    bgm.syncWithOptions('summer', { fadeIn: 1200, fadeOut: 700, loop: true })
    expect(howler.instances).toHaveLength(1)
    expect(howler.instances[0].options).toMatchObject({
      src: ['https://assets.example/summer.ogg'],
      loop: true,
      volume: 0,
    })
    expect(howler.instances[0].fades).toEqual([[0, 0.5, 1200]])

    bgm.syncWithOptions('space', { fadeIn: 900, fadeOut: 650, loop: false })
    expect(howler.instances).toHaveLength(2)
    expect(howler.instances[0].fades.at(-1)).toEqual([0.5, 0, 650])
    expect(howler.instances[0].stopped).toBe(false)
    howler.instances[0].finishFade()
    howler.instances[0].flushFadeEvents()
    expect(howler.instances[0].stopped).toBe(true)
    expect(howler.instances[0].unloaded).toBe(true)
    expect(howler.instances[1].options.loop).toBe(false)
    expect(howler.instances[1].fades).toEqual([[0, 0.5, 900]])
  })

  it('stops only the active track while the previous crossfade retires', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fadeIn: 0, fadeOut: 650 })
    bgm.syncWithOptions('', { fadeOut: 250 })

    expect(howler.instances[0].unloaded).toBe(false)
    expect(howler.instances[0].fades).toEqual([[0.5, 0, 650]])
    expect(howler.instances[1].fades.at(-1)).toEqual([0.5, 0, 250])

    howler.instances[0].finishFade()
    howler.instances[0].flushFadeEvents()
    expect(howler.instances[0].unloaded).toBe(true)
  })

  it('keeps earlier retirements intact across rapid track switches', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fadeIn: 0, fadeOut: 650 })
    bgm.playBgmBySrc('https://assets.example/rain.ogg', { fadeIn: 0, fadeOut: 250 })

    expect(howler.instances[0].unloaded).toBe(false)
    expect(howler.instances[0].fades).toEqual([[0.5, 0, 650]])
    expect(howler.instances[1].fades.at(-1)).toEqual([0.5, 0, 250])
    expect(howler.instances[2].playing()).toBe(true)
  })

  it('keeps direct-source playback exclusive', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fade: 0 })

    expect(howler.instances).toHaveLength(2)
    expect(howler.instances[0].playing()).toBe(false)
    expect(howler.instances[0].stopped).toBe(true)
    expect(howler.instances[0].unloaded).toBe(true)
    expect(howler.instances[1].playing()).toBe(true)
  })

  it('finishes stopping when a completed fade callback is still queued', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    const summerSrc = 'https://assets.example/summer.ogg'
    bgm.playBgmBySrc(summerSrc, { fade: 0 })
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fadeIn: 0, fadeOut: 650 })
    howler.instances[0].finishFade()

    bgm.stopBgmBySrc(summerSrc, { fade: 650 })
    howler.instances[0].flushFadeEvents()

    expect(howler.instances[0].playing()).toBe(false)
    expect(howler.instances[0].stopped).toBe(true)
  })

  it('does not resume a paused track after switching sources', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    bgm.pauseBgmBySrc('https://assets.example/summer.ogg')
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fade: 0 })
    bgm.play()

    expect(howler.instances[0].playing()).toBe(false)
    expect(howler.instances[0].stopped).toBe(true)
    expect(howler.instances[1].playing()).toBe(true)
  })

  it('resumes only the active track during a crossfade', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    const summerSrc = 'https://assets.example/summer.ogg'
    const spaceSrc = 'https://assets.example/space.ogg'
    bgm.playBgmBySrc(summerSrc, { fade: 0 })
    bgm.playBgmBySrc(spaceSrc, { fadeIn: 0, fadeOut: 650 })
    bgm.pauseBgmBySrc(summerSrc)
    bgm.pauseBgmBySrc(spaceSrc)

    bgm.play()

    expect(howler.instances[0].playing()).toBe(false)
    expect(howler.instances[1].playing()).toBe(true)
  })

  it('changes volume without reviving a retiring track', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fadeIn: 0, fadeOut: 650 })
    bgm.setVolume(0.8)

    expect(howler.instances[0].volume()).toBe(0)
    expect(howler.instances[1].volume()).toBe(0.8)
  })

  it('restores the active track volume when unmuted', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.mute()
    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    expect(howler.instances[0].muted).toBe(true)
    expect(howler.instances[0].volume()).toBe(0.5)

    bgm.unmute()

    expect(howler.instances[0].muted).toBe(false)
    expect(howler.instances[0].volume()).toBe(0.5)
  })

  it('unmutes every track participating in a crossfade without changing its volume', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fadeIn: 900, fadeOut: 650 })
    const volumesBeforeMute = howler.instances.map(instance => instance.volume())

    bgm.mute()
    expect(howler.instances.map(instance => instance.muted)).toEqual([true, true])

    bgm.unmute()
    expect(howler.instances.map(instance => instance.muted)).toEqual([false, false])
    expect(howler.instances.map(instance => instance.volume())).toEqual(volumesBeforeMute)
  })

  it('releases active and retiring tracks when disposed', () => {
    howler.instances.length = 0
    const bgm = createBgm()

    bgm.playBgmBySrc('https://assets.example/summer.ogg', { fade: 0 })
    bgm.playBgmBySrc('https://assets.example/space.ogg', { fadeIn: 0, fadeOut: 650 })

    bgm.dispose()
    bgm.dispose()

    expect(howler.instances[0].unloaded).toBe(true)
    expect(howler.instances[1].unloaded).toBe(true)
  })

  it('does not let a stale fade-out stop a track selected again', () => {
    howler.instances.length = 0
    const bgm = createBgm({
      bgm: {
        library: {
          summer: { name: 'Summer', src: 'https://assets.example/summer.ogg' },
          space: { name: 'Space', src: 'https://assets.example/space.ogg' },
        },
      },
    })

    bgm.syncWithOptions('summer', { fade: 0 })
    bgm.syncWithOptions('space', { fadeIn: 0, fadeOut: 650 })
    howler.instances[0].finishFade()
    bgm.syncWithOptions('summer', { fadeIn: 250, fadeOut: 650 })

    howler.instances[0].flushFadeEvents()
    expect(howler.instances[0].playing()).toBe(true)
    expect(howler.instances[0].stopped).toBe(false)
    expect(howler.instances[0].fades.at(-1)).toEqual([0, 0.5, 250])
  })
})
