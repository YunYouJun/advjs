#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { comparePcm, observePcm, parseFloat32Pcm } from './lib/audio-quality.mjs'

const execute = promisify(execFile)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const args = process.argv.slice(2)
const manifestPath = args[args.indexOf('--manifest') + 1]
const output = args[args.indexOf('--output') + 1]
if (!args.includes('--manifest') || !args.includes('--output') || !isAbsolute(manifestPath) || !isAbsolute(output))
  throw new Error('Usage: node scripts/audit-audio-quality.mjs --manifest <absolute JSON> --output <new absolute directory>')
if ((await stat(manifestPath)).size > 2 * 1024 * 1024)
  throw new Error('AUDIO_QUALITY_MANIFEST_LIMIT')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 32 || !/^sha256:[a-f0-9]{64}$/u.test(manifest.toolchain?.workerImageDigest) || !/^[a-f0-9]{64}$/u.test(manifest.toolchain?.ffmpegBuildFingerprint) || !/^[a-z\d-]+$/u.test(manifest.toolchain?.context))
  throw new Error('AUDIO_QUALITY_MANIFEST_INVALID')
await mkdir(output, { recursive: false, mode: 0o700 })
const prefix = ['--context', manifest.toolchain.context, 'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '512m', '--cpus', '2', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m']
async function run(tool, parameters, input) {
  const mount = input ? ['--mount', `type=bind,src=${input},dst=/input/media,readonly`] : []
  return await execute('docker', [...prefix, ...mount, '--entrypoint', tool, manifest.toolchain.workerImageDigest, ...parameters], { encoding: 'buffer', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 })
}
async function save(name, value) {
  const target = resolve(output, name)
  await mkdir(dirname(target), { recursive: true, mode: 0o700 })
  await writeFile(target, value, { flag: 'wx', mode: 0o600 })
}
const version = (await run('ffmpeg', ['-hide_banner', '-version'])).stdout.toString().trim()
// Matches the shared audioFingerprint(string) canonical JSON encoding.
if (hash(JSON.stringify(version)) !== manifest.toolchain.ffmpegBuildFingerprint)
  throw new Error('AUDIO_QUALITY_TOOLCHAIN_CHANGED')
await save('ffmpeg-version.txt', `${version}\n`)
const observations = []
const decoded = new Map()
const inputArguments = ['-protocol_whitelist', 'file', '-format_whitelist', 'aac,aiff,flac,mp3,ogg,wav,mov,matroska,webm']
for (const item of manifest.files) {
  if (!/^[a-z\d-]+$/u.test(item.id) || decoded.has(item.id) || !isAbsolute(item.path) || /[,\r\n]/u.test(item.path) || !/^[a-f0-9]{64}$/u.test(item.sha256))
    throw new Error('AUDIO_QUALITY_FILE_INVALID')
  const input = await realpath(item.path)
  const sourceInfo = await stat(input)
  if (!sourceInfo.isFile() || sourceInfo.size > 64 * 1024 * 1024)
    throw new Error('AUDIO_QUALITY_SOURCE_LIMIT')
  const bytes = await readFile(input)
  if (hash(bytes) !== item.sha256 || bytes.length !== item.bytes)
    throw new Error('AUDIO_QUALITY_SOURCE_CHANGED')
  const probe = JSON.parse((await run('ffprobe', ['-v', 'error', ...inputArguments, '-show_entries', 'stream=codec_name,sample_rate,channels,duration:format=duration', '-of', 'json', '/input/media'], input)).stdout.toString())
  const duration = Number(probe.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60 || probe.streams?.length !== 1 || Number(probe.streams[0].channels) !== 1)
    throw new Error('AUDIO_QUALITY_DURATION_OR_CHANNELS_INVALID')
  const measurement = await run('ffmpeg', ['-nostdin', '-hide_banner', ...inputArguments, '-i', '/input/media', '-af', 'loudnorm=I=-16:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], input)
  const loudness = JSON.parse(measurement.stderr.toString().match(/\{\s*"input_i"[\s\S]*?\}/u)?.[0] ?? 'null')
  if (!loudness)
    throw new Error('AUDIO_QUALITY_LOUDNESS_UNAVAILABLE')
  const pcm = (await run('ffmpeg', ['-nostdin', '-hide_banner', '-v', 'error', ...inputArguments, '-i', '/input/media', '-map', '0:a:0', '-vn', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'], input)).stdout
  const samples = parseFloat32Pcm(pcm)
  decoded.set(item.id, samples)
  const asrPcm = (await run('ffmpeg', ['-nostdin', '-hide_banner', '-v', 'error', ...inputArguments, '-i', '/input/media', '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'], input)).stdout
  await save(`decoded/${item.id}.f32le`, pcm)
  await save(`asr-input/${item.id}.wav`, asrPcm)
  await save(`logs/${item.id}.loudnorm.txt`, measurement.stderr)
  observations.push({ id: item.id, source: { path: input, sha256: hash(bytes), bytes: bytes.length }, role: item.role, format: probe, analysis: observePcm(samples, 48000), loudness: { integratedLufs: Number.isFinite(Number(loudness.input_i)) ? Number(loudness.input_i) : null, truePeakDbtp: Number.isFinite(Number(loudness.input_tp)) ? Number(loudness.input_tp) : null, loudnessRangeLu: Number(loudness.input_lra), measuredMono: true, dualMonoCompensation: false }, asrInput: { path: resolve(output, `asr-input/${item.id}.wav`), sha256: hash(asrPcm), bytes: asrPcm.length } })
  if (hash(await readFile(input)) !== item.sha256)
    throw new Error('AUDIO_QUALITY_SOURCE_CHANGED')
}
const comparisons = []
for (const item of manifest.comparisons ?? []) {
  if (!decoded.has(item.referenceId) || !decoded.has(item.candidateId))
    throw new Error('AUDIO_QUALITY_COMPARISON_INVALID')
  comparisons.push({ referenceId: item.referenceId, candidateId: item.candidateId, purpose: item.purpose, ...comparePcm(decoded.get(item.referenceId), decoded.get(item.candidateId), 48000) })
}
if (manifest.processingReference) {
  const item = manifest.files.find(file => file.id === manifest.processingReference.masterId)
  if (!item || manifest.processingReference.presetId !== 'advjs-voice-v1')
    throw new Error('AUDIO_QUALITY_PROCESSING_REFERENCE_INVALID')
  const { audioProcessingArguments } = await import(pathToFileURL(resolve(import.meta.dirname, '../packages/audio/dist/index.mjs')).href)
  const template = audioProcessingArguments('voice', 'opus', '/input/media', '/unused')
  const filter = template[template.indexOf('-af') + 1]
  const reference = (await run('ffmpeg', ['-nostdin', '-hide_banner', '-v', 'error', ...inputArguments, '-i', '/input/media', '-af', filter, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'], item.path)).stdout
  await save('decoded/processing-reference.f32le', reference)
  const pcm = parseFloat32Pcm(reference)
  for (const candidateId of manifest.processingReference.candidateIds) {
    if (!decoded.has(candidateId))
      throw new Error('AUDIO_QUALITY_COMPARISON_INVALID')
    comparisons.push({ referenceId: 'processing-reference', candidateId, purpose: 'codec difference after the exact existing voice processing filter (trim and loudness separated from codec distortion)', referenceFilter: filter, ...comparePcm(pcm, decoded.get(candidateId), 48000) })
  }
  observations.push({ id: 'processing-reference', role: 'analysis-derived lossless reference; not a new TTS recording or golden sample', sourceMasterSha256: item.sha256, analysis: observePcm(pcm, 48000), filter })
}
const report = { schemaVersion: 1, scope: 'Objective numerical observations only; no human MOS/listening or ASR conclusion', toolchain: manifest.toolchain, network: 'none inside all analysis containers; image pull disabled', newTtsCalls: 0, cloudWrites: 0, sourcesPreserved: true, observations, comparisons }
await save('objective-quality.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ report: resolve(output, 'objective-quality.json'), files: manifest.files.length, comparisons: comparisons.length, newTtsCalls: 0, cloudWrites: 0 }))
