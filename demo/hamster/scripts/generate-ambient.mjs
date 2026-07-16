import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sampleRate = 22_050
const seconds = 12
const bitsPerSample = 16
const channels = 1
const sampleCount = sampleRate * seconds
const bytesPerSample = bitsPerSample / 8
const dataSize = sampleCount * channels * bytesPerSample
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../public/audio/observatory.wav')

let seed = 0x4156444A

function random() {
  seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
  return seed / 0x1_0000_0000
}

function clamp16(value) {
  return Math.max(-32_768, Math.min(32_767, Math.round(value * 32_767)))
}

const wav = Buffer.alloc(44 + dataSize)
wav.write('RIFF', 0, 'ascii')
wav.writeUInt32LE(36 + dataSize, 4)
wav.write('WAVE', 8, 'ascii')
wav.write('fmt ', 12, 'ascii')
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(channels, 22)
wav.writeUInt32LE(sampleRate, 24)
wav.writeUInt32LE(sampleRate * channels * bytesPerSample, 28)
wav.writeUInt16LE(channels * bytesPerSample, 32)
wav.writeUInt16LE(bitsPerSample, 34)
wav.write('data', 36, 'ascii')
wav.writeUInt32LE(dataSize, 40)

for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate
  const loopPhase = index / sampleCount
  const noiseEnvelope = Math.sin(Math.PI * loopPhase) ** 2
  const drone = Math.sin(2 * Math.PI * 55 * time) * 0.16
    + Math.sin(2 * Math.PI * 82.5 * time) * 0.08
    + Math.sin(2 * Math.PI * 110 * time) * 0.035
  const shimmer = Math.sin(2 * Math.PI * 220 * time)
    * (0.012 + 0.008 * Math.sin(2 * Math.PI * 0.25 * time))
  const seededAir = (random() * 2 - 1) * 0.025 * noiseEnvelope
  wav.writeInt16LE(clamp16(drone + shimmer + seededAir), 44 + index * bytesPerSample)
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, wav)

console.log(`Generated ${output} (${seconds}s, ${sampleRate}Hz mono PCM)`)
