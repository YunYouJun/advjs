/** Sample-level observations only. These values do not establish perceptual MOS. */
export function observePcm(samples, sampleRate, options = {}) {
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0 || !samples.length)
    throw new Error('AUDIO_QUALITY_PCM_INVALID')
  const silenceDb = options.silenceDb ?? -50
  const windowMs = options.windowMs ?? 10
  const threshold = 10 ** (silenceDb / 20)
  const window = Math.max(1, Math.round(sampleRate * windowMs / 1000))
  let sum = 0
  let squares = 0
  let peak = 0
  let clipped = 0
  let nearClipped = 0
  let run = 0
  let longestRun = 0
  for (const value of samples) {
    if (!Number.isFinite(value))
      throw new Error('AUDIO_QUALITY_PCM_INVALID')
    sum += value
    squares += value ** 2
    peak = Math.max(peak, Math.abs(value))
    if (Math.abs(value) >= 1 - 1 / 32768) {
      clipped++
      longestRun = Math.max(longestRun, ++run)
    }
    else {
      run = 0
    }
    if (Math.abs(value) >= 10 ** (-0.1 / 20))
      nearClipped++
  }
  const windows = []
  for (let start = 0; start < samples.length; start += window) {
    const end = Math.min(samples.length, start + window)
    let energy = 0
    for (let i = start; i < end; i++)
      energy += samples[i] ** 2
    windows.push({ frames: end - start, silent: Math.sqrt(energy / (end - start)) <= threshold })
  }
  let leading = 0
  for (const item of windows) {
    if (!item.silent)
      break
    leading += item.frames
  }
  let trailing = 0
  for (const item of [...windows].reverse()) {
    if (!item.silent)
      break
    trailing += item.frames
  }
  const rms = Math.sqrt(squares / samples.length)
  const tail = samples.slice(Math.max(0, samples.length - Math.round(sampleRate * 0.05)))
  const tailRms = Math.sqrt(tail.reduce((total, value) => total + value ** 2, 0) / tail.length)
  return {
    frames: samples.length,
    durationSeconds: samples.length / sampleRate,
    sampleRate,
    rms,
    rmsDbfs: rms > 0 ? 20 * Math.log10(rms) : null,
    samplePeak: peak,
    samplePeakDbfs: peak > 0 ? 20 * Math.log10(peak) : null,
    dcOffset: sum / samples.length,
    dcDbfs: sum ? 20 * Math.log10(Math.abs(sum / samples.length)) : null,
    clippedSamples: clipped,
    nearClippedSamples: nearClipped,
    longestClippedRun: longestRun,
    silence: { thresholdDbfs: silenceDb, resolutionMs: windowMs, leadingSeconds: leading / sampleRate, trailingSeconds: trailing / sampleRate, totalSeconds: windows.filter(item => item.silent).reduce((total, item) => total + item.frames, 0) / sampleRate },
    final50MsRms: tailRms,
  }
}

/** Gain-compensated, delay-aligned numerical comparison, not a listening score. */
export function comparePcm(reference, candidate, sampleRate, options = {}) {
  if (!reference.length || !candidate.length || reference.length / sampleRate > 60 || candidate.length / sampleRate > 60)
    throw new Error('AUDIO_QUALITY_COMPARISON_LIMIT')
  const maximumLag = Math.min(Math.round(sampleRate * (options.maximumLagSeconds ?? 0.25)), Math.floor(Math.min(reference.length, candidate.length) / 4))
  const stride = Math.max(1, Math.floor(sampleRate / 2000))
  function correlation(lag, step) {
    const start = Math.max(0, -lag)
    const end = Math.min(reference.length, candidate.length - lag)
    let xx = 0
    let yy = 0
    let xy = 0
    for (let i = start; i < end; i += step) {
      const x = reference[i]
      const y = candidate[i + lag]
      xx += x * x
      yy += y * y
      xy += x * y
    }
    return xx && yy ? xy / Math.sqrt(xx * yy) : -1
  }
  let lag = 0
  let best = -Infinity
  for (let position = -maximumLag; position <= maximumLag; position += stride) {
    const score = correlation(position, stride)
    if (score > best) {
      best = score
      lag = position
    }
  }
  const coarse = lag
  for (let position = Math.max(-maximumLag, coarse - stride); position <= Math.min(maximumLag, coarse + stride); position++) {
    const score = correlation(position, Math.max(1, Math.floor(stride / 4)))
    if (score > best) {
      best = score
      lag = position
    }
  }
  const start = Math.max(0, -lag)
  const end = Math.min(reference.length, candidate.length - lag)
  let xx = 0
  let xy = 0
  let yy = 0
  for (let i = start; i < end; i++) {
    const x = reference[i]
    const y = candidate[i + lag]
    xx += x * x
    xy += x * y
    yy += y * y
  }
  const gain = xx ? xy / xx : 0
  let residual = 0
  let omitted = 0
  let referenceTotal = 0
  for (let i = 0; i < reference.length; i++) {
    referenceTotal += reference[i] ** 2
    if (i < start || i >= end)
      omitted += reference[i] ** 2
    else
      residual += (candidate[i + lag] - gain * reference[i]) ** 2
  }
  const signal = gain * gain * xx
  return {
    referenceFrames: reference.length,
    candidateFrames: candidate.length,
    durationDifferenceSeconds: (candidate.length - reference.length) / sampleRate,
    alignedDelaySeconds: lag / sampleRate,
    overlappingSeconds: (end - start) / sampleRate,
    fittedGain: gain,
    fittedGainDb: gain > 0 ? 20 * Math.log10(gain) : null,
    correlation: xx && yy ? xy / Math.sqrt(xx * yy) : null,
    residualRms: Math.sqrt(residual / (end - start)),
    gainCompensatedSnrDb: residual && signal ? 10 * Math.log10(signal / residual) : null,
    omittedReferenceEnergyRatio: referenceTotal ? omitted / referenceTotal : null,
    missingReferenceHeadSeconds: start / sampleRate,
    missingReferenceTailSeconds: (reference.length - end) / sampleRate,
    limitation: 'Numerical alignment and residual do not establish intelligibility, naturalness, timbre consistency or MOS.',
  }
}

export function parseFloat32Pcm(bytes) {
  if (!bytes.length || bytes.length % 4)
    throw new Error('AUDIO_QUALITY_PCM_INVALID')
  const samples = new Float32Array(bytes.length / 4)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < samples.length; i++)
    samples[i] = view.getFloat32(i * 4, true)
  return samples
}
