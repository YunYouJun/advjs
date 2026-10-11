import type { AudioBus, RuntimeAudioState } from '@advjs/types'
import type { AudioResolvedAsset } from '../../../packages/audio/src/contracts'
import { createAudioEngine } from '../../../packages/audio/src/engine'
import { createBrowserAudioBackend } from '../../../packages/client/audio/browser'
import { resolveBrowserAudioAsset } from '../../../packages/client/audio/resolver'

function wav(seconds: number, frequency: number) {
  const sampleRate = 24000
  const count = Math.ceil(seconds * sampleRate)
  const bytes = new ArrayBuffer(44 + count * 2)
  const view = new DataView(bytes)
  function ascii(offset: number, text: string) {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + count * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, count * 2, true)
  for (let i = 0; i < count; i++)
    view.setInt16(44 + i * 2, Math.sin(i * frequency * 2 * Math.PI / sampleRate) * 1200, true)
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}

const resources: Record<string, AudioResolvedAsset> = Object.fromEntries([
  ['music', 2, 110],
  ['bed', 2, 130],
  ['weather', 2, 150],
  ['crowd', 2, 170],
  ['detail', 2, 190],
  ['voice', 1.2, 280],
  ['voice-long', 3, 320],
  ['impact', 3, 350],
  ['click', 3, 400],
].map(([id, seconds, frequency]) => [id, { assetId: String(id), url: wav(Number(seconds), Number(frequency)), duration: Number(seconds) }]))
resources['voice-opus'] = { assetId: 'voice-opus', url: '/variants/voice.webm', duration: 1.967, mime: 'audio/webm' }
resources['voice-aac'] = { assetId: 'voice-aac', url: '/variants/voice.m4a', duration: 1.96, mime: 'audio/mp4' }
resources['processed-music'] = { assetId: 'processed-music', url: '/variants/voice.webm', duration: 1.967, mime: 'audio/webm' }
let context: AudioContext | undefined
let analyser: AnalyserNode | undefined
const gainNodes: GainNode[] = []
const mediaElements: HTMLAudioElement[] = []
const buses: AudioBus[] = ['master', 'music', 'ambience', 'voice', 'sfx', 'ui']
let naturalVoiceEnds = 0
let lastAction = 'Queued until a user gesture'
let routedMediaSources = 0
let decodedSources = 0
const resolvedSources: Record<string, string> = {}
const backend = createBrowserAudioBackend({
  createMediaElement() {
    const element = new Audio()
    mediaElements.push(element)
    return element
  },
  createContext() {
    context = new AudioContext()
    analyser = context.createAnalyser()
    analyser.fftSize = 256
    const createGain = context.createGain.bind(context)
    context.createGain = () => {
      const node = createGain()
      if (!gainNodes.length)
        node.connect(analyser!)
      gainNodes.push(node)
      return node
    }
    const createMediaSource = context.createMediaElementSource.bind(context)
    context.createMediaElementSource = (element) => {
      routedMediaSources++
      return createMediaSource(element)
    }
    const createBufferSource = context.createBufferSource.bind(context)
    context.createBufferSource = () => {
      decodedSources++
      return createBufferSource()
    }
    return context
  },
})
const engine = createAudioEngine({
  backend,
  mixer: { schemaVersion: 1, buses: { master: { gain: 0.15 } }, ducking: { gain: 0.25, attackMs: 20, releaseMs: 40 } },
  resolveAsset(assetId, bus) {
    if (assetId === 'unavailable')
      return { assetId, url: '/__audio_failure__.wav' }
    const resource = resources[assetId]
    if (!resource)
      throw new Error('Fixture asset not found')
    const resolved = resolveBrowserAudioAsset(assetId, {
      src: resource.url,
      duration: resource.duration,
      mime: resource.mime,
      kind: bus === 'music' ? 'bgm' : bus,
      ...(assetId === 'processed-music'
        ? { variants: {
            opus: { src: '/variants/voice.webm', mime: 'audio/webm' },
            aac: { src: '/variants/voice.m4a', mime: 'audio/mp4' },
          } }
        : {}),
    }, bus)
    resolvedSources[assetId] = resolved.url
    return resolved
  },
})
const persistent: RuntimeAudioState = {
  bgm: { assetId: 'music', gain: 0.5 },
  ambience: Object.fromEntries(['bed', 'weather', 'crowd', 'detail'].map(slot => [slot, { assetId: slot, gain: 0.3 }])),
}
engine.onVoiceEnded(() => {
  naturalVoiceEnds++
})

function inspect() {
  const data = new Float32Array(analyser?.fftSize ?? 256)
  if (analyser)
    analyser.getFloatTimeDomainData(data)
  const energy = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length)
  return {
    ...engine.inspect(),
    contextState: context?.state ?? 'not-created',
    graphGains: Object.fromEntries(buses.map((bus, index) => [bus, gainNodes[index]?.gain.value ?? null])),
    energy,
    naturalVoiceEnds,
    routedMediaSources,
    decodedSources,
    resolvedSources: { ...resolvedSources },
    streamingMedia: mediaElements.map(element => ({
      src: element.currentSrc || element.src,
      paused: element.paused,
      currentTime: element.currentTime,
      readyState: element.readyState,
      error: element.error?.code ?? null,
      duration: Number.isFinite(element.duration) ? element.duration : null,
    })),
  }
}

function render() {
  document.querySelector('#status')!.textContent = lastAction
  document.querySelector('#inspection')!.textContent = JSON.stringify(inspect(), null, 2)
}

function action(id: string, label: string, run: () => Promise<unknown> | void) {
  document.querySelector(`#${id}`)!.addEventListener('click', () => {
    // Invoke synchronously so AudioContext.resume remains inside the user gesture.
    const result = run()
    void Promise.resolve(result).then(() => {
      lastAction = label
      render()
    }).catch((error: unknown) => {
      lastAction = `Fixture action failed: ${String(error)}`
      render()
    })
  })
}

action('unlock', 'Audio unlocked', () => engine.unlock())
action('layers', 'Music and four ambience layers playing', () => engine.syncState(persistent))
action('voice', 'Dialogue voice playing', () => engine.playVoice({ assetId: 'voice', lineId: 'fixture-line', locale: 'zh-CN' }))
action('voice-opus', 'Processed Opus/WebM voice playing', () => engine.playVoice({ assetId: 'voice-opus', lineId: 'opus-line', locale: 'zh-CN' }))
action('voice-aac', 'Processed AAC/M4A voice playing', () => engine.playVoice({ assetId: 'voice-aac', lineId: 'aac-line', locale: 'zh-CN' }))
action('music-opus', 'Processed Opus/WebM streaming music playing', () => engine.syncState({ bgm: { assetId: 'voice-opus', loop: true }, ambience: {} }))
action('music-aac', 'Processed AAC/M4A streaming music playing', () => engine.syncState({ bgm: { assetId: 'voice-aac', loop: true }, ambience: {} }))
action('music-compatible', 'Compatible processed variant selected for streaming music', () => engine.syncState({ bgm: { assetId: 'processed-music', loop: true }, ambience: {} }))
action('clear', 'All persistent layers cleared', () => engine.syncState({ bgm: null, ambience: {} }))
action('transients', 'Voice, SFX and UI playing', () => Promise.all([
  engine.playVoice({ assetId: 'voice-long', lineId: 'history-line', locale: 'zh-CN' }),
  engine.playSfx({ assetId: 'impact', group: 'environment' }),
  engine.playUi({ assetId: 'click' }),
]))
action('history', 'History restored; transient story audio cancelled', () => engine.syncState(persistent, { reason: 'history' }))
action('failure', 'Unavailable audio contained as a diagnostic', () => engine.playSfx({ assetId: 'unavailable' }))
action('dispose', 'Audio disposed', () => {
  engine.dispose()
  for (const resource of Object.values(resources))
    URL.revokeObjectURL(resource.url)
})

void engine.syncState({ bgm: persistent.bgm, ambience: {} })
setInterval(render, 50)
render()

Object.assign(window, { audioFixture: { inspect, engine } })
