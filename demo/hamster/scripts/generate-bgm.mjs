import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptRoot = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptRoot, '../../..')
const outputRoot = join(repoRoot, 'temp/hamster-art/audio/bgm')
const sampleRate = 44_100
const duration = 24
const sampleCount = sampleRate * duration

const themes = [
  { id: 'summer-day', bpm: 80, root: 57, mode: [0, 2, 4, 7, 9], pattern: [0, 2, 4, 2, 1, 3, 4, 2], warmth: 0.8 },
  { id: 'terminal-doubt', bpm: 72, root: 50, mode: [0, 1, 3, 7, 8], pattern: [0, 2, 1, 3, 0, 4, 1, 2], warmth: 0.3 },
  { id: 'star-revelation', bpm: 76, root: 55, mode: [0, 2, 5, 7, 11], pattern: [0, 1, 3, 4, 2, 3, 1, 4], warmth: 0.64 },
  { id: 'world-restart', bpm: 68, root: 48, mode: [0, 2, 4, 7, 11], pattern: [0, 3, 2, 4, 1, 2, 3, 4], warmth: 0.7 },
  { id: 'prehistoric', bpm: 96, root: 45, mode: [0, 3, 5, 7, 10], pattern: [0, 2, 0, 3, 1, 4, 2, 3], warmth: 0.74 },
  { id: 'civilization-rise', bpm: 92, root: 52, mode: [0, 2, 4, 7, 9], pattern: [0, 1, 2, 4, 3, 2, 1, 4], warmth: 0.78 },
  { id: 'deep-space', bpm: 64, root: 43, mode: [0, 1, 5, 7, 10], pattern: [0, 3, 1, 4, 0, 2, 1, 3], warmth: 0.25 },
  { id: 'final-echo', bpm: 60, root: 46, mode: [0, 2, 5, 7, 9], pattern: [0, 1, 3, 2, 4, 3, 1, 0], warmth: 0.52 },
]

function midiFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12)
}

function periodicSine(frequency, time) {
  const cycles = Math.round(frequency * duration)
  return Math.sin(2 * Math.PI * cycles * time / duration)
}

function noteEnvelope(phase) {
  const attack = Math.min(1, phase / 0.08)
  const release = Math.min(1, (1 - phase) / 0.18)
  return Math.max(0, Math.min(attack, release)) ** 1.35
}

function render(theme) {
  const left = new Float32Array(sampleCount)
  const right = new Float32Array(sampleCount)
  const beats = theme.pattern.length * 2

  for (let index = 0; index < sampleCount; index++) {
    const time = index / sampleRate
    const loopPhase = time / duration
    const phrase = loopPhase * beats
    const beat = Math.floor(phrase) % theme.pattern.length
    const beatPhase = phrase - Math.floor(phrase)
    const degree = theme.mode[theme.pattern[beat]]
    const note = midiFrequency(theme.root + degree + 12)
    const bass = midiFrequency(theme.root + theme.mode[theme.pattern[Math.floor(beat / 2) * 2 % theme.pattern.length]] - 12)
    const envelope = noteEnvelope(beatPhase)
    const globalBreath = Math.sin(Math.PI * loopPhase) ** 2
    const pad = periodicSine(midiFrequency(theme.root), time) * 0.12
      + periodicSine(midiFrequency(theme.root + 7), time) * 0.07
    const lead = periodicSine(note, time) * envelope * 0.2
      + periodicSine(note * 2, time) * envelope * 0.035
    const low = periodicSine(bass, time) * noteEnvelope((phrase / 2) % 1) * 0.13
    const orbital = periodicSine(880 + theme.root * 2, time)
      * (0.012 + 0.008 * Math.sin(2 * Math.PI * loopPhase * 4))
      * globalBreath
    const pulse = theme.id === 'prehistoric' || theme.id === 'civilization-rise'
      ? Math.sin(2 * Math.PI * beatPhase) ** 9 * 0.075
      : 0
    const mix = (pad * globalBreath + lead + low + orbital + pulse) * 0.9
    const pan = Math.sin(2 * Math.PI * loopPhase * 2) * 0.12
    left[index] = mix * (1 - pan) * (0.82 + theme.warmth * 0.1)
    right[index] = mix * (1 + pan) * (0.9 - theme.warmth * 0.05)
  }

  let peak = 0
  for (let index = 0; index < sampleCount; index++)
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]))
  const scale = 0.78 / Math.max(peak, 0.01)
  return { left, right, scale, peak: peak * scale }
}

function wavBuffer(rendered) {
  const channels = 2
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = sampleCount * channels * bytesPerSample
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVEfmt ', 8, 'ascii')
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
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, rendered.left[index] * rendered.scale)) * 32767), 44 + index * 4)
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, rendered.right[index] * rendered.scale)) * 32767), 46 + index * 4)
  }
  return wav
}

await mkdir(outputRoot, { recursive: true })

const report = []
for (const theme of themes) {
  const rendered = render(theme)
  const wavPath = join(outputRoot, `${theme.id}.wav`)
  const oggPath = join(outputRoot, `${theme.id}.ogg`)
  await writeFile(wavPath, wavBuffer(rendered))
  const encoded = spawnSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    wavPath,
    '-c:a',
    'vorbis',
    '-strict',
    'experimental',
    '-q:a',
    '5',
    '-metadata',
    'title=仓鼠：星海回声',
    '-metadata',
    `comment=ADV.JS deterministic theme ${theme.id}`,
    oggPath,
  ], { encoding: 'utf8' })
  if (encoded.status !== 0)
    throw new Error(encoded.stderr || `ffmpeg failed for ${theme.id}`)
  await rm(wavPath)
  report.push({ id: theme.id, duration, sampleRate, channels: 2, normalizedPeak: rendered.peak })
}

await writeFile(join(outputRoot, 'audio-report.json'), `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`Generated ${themes.length} loopable OGG themes at ${duration}s each.\n`)
