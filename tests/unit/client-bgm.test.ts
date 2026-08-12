import { describe, expect, it, vi } from 'vitest'
import { useAdvBgm } from '../../packages/client/composables/useAdvBgm'

const howler = vi.hoisted(() => ({
  instances: [] as Array<{
    options: Record<string, any>
    fades: Array<[number, number, number]>
    stopped: boolean
  }>,
}))

vi.mock('howler', () => ({
  Howl: class MockHowl {
    options: Record<string, any>
    fades: Array<[number, number, number]> = []
    stopped = false
    private playingValue = false
    private volumeValue = 0
    private fadeListener?: () => void

    constructor(options: Record<string, any>) {
      this.options = options
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

    fade(from: number, to: number, duration: number) {
      this.fades.push([from, to, duration])
      this.volumeValue = to
      if (to === 0)
        this.fadeListener?.()
    }

    stop() {
      this.playingValue = false
      this.stopped = true
    }

    pause() {
      this.playingValue = false
    }

    mute() {}
  },
}))

describe('client BGM presentation', () => {
  it('crossfades between library tracks with the requested loop and fade options', () => {
    howler.instances.length = 0
    const bgm = useAdvBgm({
      config: { value: { cdn: {} } },
      gameConfig: {
        value: {
          bgm: {
            library: {
              summer: { name: 'Summer', src: 'https://assets.example/summer.ogg' },
              space: { name: 'Space', src: 'https://assets.example/space.ogg' },
            },
          },
        },
      },
      compileDiagnostics: { value: [] },
    } as any)

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
    expect(howler.instances[0].stopped).toBe(true)
    expect(howler.instances[1].options.loop).toBe(false)
    expect(howler.instances[1].fades).toEqual([[0, 0.5, 900]])
  })
})
