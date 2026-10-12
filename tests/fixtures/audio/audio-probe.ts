/** Read-only real Web Audio observation, usable by Playwright or a QA HTML host. */
export function installPlayerParityProbe() {
  const NativeContext = window.AudioContext
  const contexts: AudioContext[] = []
  const media: HTMLMediaElement[] = []
  let analyser: AnalyserNode | undefined
  class ObservedContext extends NativeContext {
    constructor(options?: AudioContextOptions) {
      super(options)
      contexts.push(this)
      analyser = this.createAnalyser()
      analyser.fftSize = 256
      const createGain = this.createGain.bind(this)
      let master = true
      this.createGain = () => {
        const node = createGain()
        if (master) {
          master = false
          node.connect(analyser!)
        }
        return node
      }
      const createMediaSource = this.createMediaElementSource.bind(this)
      this.createMediaElementSource = (element) => {
        media.push(element)
        return createMediaSource(element)
      }
    }
  }
  window.AudioContext = ObservedContext
  const probe = {
    context: () => contexts.at(-1)?.state ?? 'not-created',
    sampleRate: () => contexts.at(-1)?.sampleRate,
    rms: () => {
      const samples = new Float32Array(256)
      analyser?.getFloatTimeDomainData(samples)
      return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
    },
  }
  Object.assign(window, { audioParityProbe: probe, __ADVJS_PLAYER_PARITY_TELEMETRY__: () => {
    const adv = (document.querySelector('#app') as any)?.__vue_app__?._context?.provides?.['$advjs-context']
    const current = adv?.store.current
    const audio = adv?.$audio.inspect()
    const game = adv?.gameConfig.value
    const lineId = current?.data?.lineId
    const locale = game?.audio?.locale ?? game?.locale ?? 'zh-CN'
    const binding = game?.audio?.voiceLedger?.lines[lineId]?.locales[locale]
    const take = binding?.takes.find((take: any) => take.id === binding.selectedTake)
    return {
      context: probe.context(),
      sampleRate: probe.sampleRate(),
      rms: probe.rms(),
      visibility: document.visibilityState,
      unlocked: audio?.unlocked ?? false,
      paused: audio?.paused ?? false,
      current: { nodeId: current?.id, lineId, locale, speakerId: current?.data?.speakerId, takeId: take?.id, assetId: take?.assetId, masterSha256: game?.audio?.assets[take?.assetId]?.sha256 },
      media: media.map(element => ({ src: element.currentSrc || element.src, playheadSeconds: element.currentTime, paused: element.paused, ended: element.ended })),
      errors: audio?.errors ?? [],
    }
  } })
}
