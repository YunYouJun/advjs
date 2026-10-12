import { describe, expect, it } from 'vitest'
import { comparePcm, observePcm, parseFloat32Pcm } from '../../../scripts/lib/audio-quality.mjs'

describe('objective audio observations', () => {
  it('detects actual rail clipping and DC without treating a bounded sine as clipped', () => {
    const clipped = observePcm(new Float32Array([1, 1, 1, -1, 0]), 1000)
    expect(clipped.clippedSamples).toBe(4)
    expect(clipped.longestClippedRun).toBe(4)
    expect(clipped.dcOffset).toBeCloseTo(0.4)
    const sine = Float32Array.from({ length: 1000 }, (_, i) => 0.5 * Math.sin(i * Math.PI / 50))
    const clean = observePcm(sine, 1000)
    expect(clean.clippedSamples).toBe(0)
    expect(clean.dcOffset).toBeCloseTo(0)
    expect(clean.rms).toBeCloseTo(Math.sqrt(0.125))
  })

  it('reports leading and trailing silence at its declared window resolution', () => {
    const samples = new Float32Array(1000)
    samples.fill(0.25, 100, 800)
    const observation = observePcm(samples, 1000)
    expect(observation.silence).toMatchObject({ leadingSeconds: 0.1, trailingSeconds: 0.2, totalSeconds: 0.3, resolutionMs: 10 })
  })

  it('separates alignment and gain from waveform loss', () => {
    const original = Float32Array.from({ length: 1000 }, (_, i) => 0.25 * Math.sin(i * i / 79))
    const delayed = new Float32Array(1020)
    for (let i = 0; i < original.length; i++)
      delayed[i + 20] = original[i] * 2
    const compared = comparePcm(original, delayed, 1000)
    expect(compared.alignedDelaySeconds).toBe(0.02)
    expect(compared.fittedGain).toBeCloseTo(2)
    expect(compared.correlation).toBeCloseTo(1)
    expect(compared.residualRms).toBeLessThan(1e-7)
    expect(compared.omittedReferenceEnergyRatio).toBe(0)
  })

  it('detects missing audible tail energy even when the retained prefix is identical', () => {
    const original = Float32Array.from({ length: 1000 }, (_, i) => 0.2 * Math.sin(i * i / 63))
    const compared = comparePcm(original, original.slice(0, 800), 1000)
    expect(compared.correlation).toBeCloseTo(1)
    expect(compared.missingReferenceTailSeconds).toBe(0.2)
    expect(compared.omittedReferenceEnergyRatio).toBeGreaterThan(0.15)
  })

  it('rejects malformed PCM and nonfinite decoded samples', () => {
    expect(() => parseFloat32Pcm(new Uint8Array(3))).toThrow('AUDIO_QUALITY_PCM_INVALID')
    expect(() => observePcm(new Float32Array([Number.NaN]), 48000)).toThrow('AUDIO_QUALITY_PCM_INVALID')
    expect(() => observePcm(new Float32Array(0), 48000)).toThrow('AUDIO_QUALITY_PCM_INVALID')
  })
})
