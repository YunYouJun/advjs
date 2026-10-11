import type { AudioProcessingKind } from '@advjs/audio'
import type { AudioApprovedToolchainProfile, AudioMediaMetadata, AudioProcessingReceipt, AudioToolchainLock } from '@advjs/types'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { assertAudioProcessingReceipt, assertAudioReleaseToolchain, audioFingerprint, audioInputArguments, audioProcessingArguments, audioProcessingPresets } from '@advjs/audio'

export type AudioProcessRunner = (command: string, args: readonly string[], signal?: AbortSignal) => Promise<{ stdout: string, stderr: string }>

/** Bounded argv execution; no shell, provider credentials, or unredacted child errors. */
export const runAudioProcess: AudioProcessRunner = async (command, args, signal) => {
  signal?.throwIfAborted()
  return await new Promise((resolveResult, reject) => {
    const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let exceeded = false
    let interrupted = false
    let hardStop: ReturnType<typeof setTimeout> | undefined
    function stop() {
      if (interrupted)
        return
      interrupted = true
      child.kill('SIGTERM')
      hardStop = setTimeout(() => child.kill('SIGKILL'), 5_000)
    }
    const timer = setTimeout(stop, 20 * 60 * 1000)
    signal?.addEventListener('abort', stop, { once: true })
    function cleanup() {
      clearTimeout(timer)
      clearTimeout(hardStop)
      signal?.removeEventListener('abort', stop)
    }
    function chunk(type: 'stdout' | 'stderr', value: string) {
      if (exceeded)
        return
      if (type === 'stdout')
        stdout += value
      else stderr += value
      if (stdout.length + stderr.length > 4 * 1024 * 1024) {
        exceeded = true
        stop()
      }
    }
    child.stdout.setEncoding('utf8').on('data', value => chunk('stdout', value))
    child.stderr.setEncoding('utf8').on('data', value => chunk('stderr', value))
    child.once('error', () => {
      cleanup()
      reject(new Error(signal?.aborted ? 'AUDIO_PROCESS_CANCELLED' : 'AUDIO_PROCESS_UNAVAILABLE'))
    })
    child.once('close', (code) => {
      cleanup()
      if (code !== 0 || exceeded || interrupted || signal?.aborted)
        reject(new Error(signal?.aborted ? 'AUDIO_PROCESS_CANCELLED' : 'AUDIO_PROCESS_FAILED'))
      else resolveResult({ stdout, stderr })
    })
  })
}

export async function probeAudioToolchain(runner: AudioProcessRunner = runAudioProcess, signal?: AbortSignal) {
  const [version, probe, encoders, filters] = await Promise.all([
    runner('ffmpeg', ['-hide_banner', '-version'], signal),
    runner('ffprobe', ['-hide_banner', '-version'], signal),
    runner('ffmpeg', ['-hide_banner', '-encoders'], signal),
    runner('ffmpeg', ['-hide_banner', '-filters'], signal),
  ])
  const capabilities = {
    ffprobe: probe.stdout.startsWith('ffprobe version'),
    opus: /\blibopus\b/u.test(encoders.stdout),
    aac: /\baac\b/u.test(encoders.stdout),
    loudnorm: /\bloudnorm\b/u.test(filters.stdout) && /\balimiter\b/u.test(filters.stdout),
    trim: /\bsilenceremove\b/u.test(filters.stdout) && /\bareverse\b/u.test(filters.stdout),
  }
  return { fingerprint: await audioFingerprint(version.stdout.trim()), capabilities, ready: Object.values(capabilities).every(Boolean) }
}

function bounded(root: string, coordinate: string) {
  if (!coordinate || isAbsolute(coordinate) || coordinate.includes('\\') || coordinate.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
    throw new Error('AUDIO_PROCESS_PATH_INVALID')
  const target = resolve(root, coordinate)
  const path = relative(root, target)
  if (path.startsWith('../') || path === '..' || isAbsolute(path))
    throw new Error('AUDIO_PROCESS_PATH_INVALID')
  return target
}
function inside(root: string, target: string) {
  const path = relative(root, target)
  if (path === '..' || path.startsWith('../') || isAbsolute(path) || path.split(/[\\/]/u).some(part => ['.git', 'node_modules'].includes(part.toLowerCase())))
    throw new Error('AUDIO_PROCESS_PATH_INVALID')
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

async function metadata(path: string, variant: 'opus' | 'aac', runner: AudioProcessRunner, signal?: AbortSignal): Promise<AudioMediaMetadata> {
  const [probed, measured, bytes] = await Promise.all([
    runner('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels,duration:format=duration', '-of', 'json', path], signal),
    runner('ffmpeg', ['-nostdin', '-hide_banner', '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], signal),
    readFile(path),
  ])
  const data = JSON.parse(probed.stdout)
  const stream = data.streams?.[0]
  const measurement = measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/u)?.[0]
  if (!stream || !measurement)
    throw new Error('AUDIO_PROCESS_METADATA_INVALID')
  const loudness = JSON.parse(measurement)
  const integrated = Number(loudness.input_i)
  return { sha256: hash(bytes), bytes: bytes.byteLength, mimeType: variant === 'opus' ? 'audio/webm' : 'audio/mp4', codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: Number(stream.channels), duration: Number(data.format?.duration ?? stream.duration), integratedLufs: Number.isFinite(integrated) ? integrated : null, truePeakDb: Number(loudness.input_tp) }
}

/** Explicit trusted-host operation. Builds never invoke it; masters are never overwritten. */
export async function processProjectAudio(options: {
  root: string
  inputPath: string
  outputDirectory: string
  kind: AudioProcessingKind
  purpose?: 'preview' | 'release'
  toolchain?: AudioToolchainLock
  approvedProfiles?: readonly AudioApprovedToolchainProfile[]
  runner?: AudioProcessRunner
  signal?: AbortSignal
}): Promise<AudioProcessingReceipt> {
  const purpose = options.purpose ?? 'preview'
  const runner = options.runner ?? runAudioProcess
  const root = await realpath(options.root)
  const input = await realpath(bounded(root, options.inputPath))
  inside(root, input)
  const inputInfo = await stat(input)
  if (!inputInfo.isFile() || inputInfo.size > 512 * 1024 * 1024)
    throw new Error('AUDIO_MASTER_INVALID: Processing accepts bounded local masters only')
  const toolchain = await probeAudioToolchain(runner, options.signal)
  if (!toolchain.ready)
    throw new Error('AUDIO_PROCESS_CAPABILITY_MISSING: FFprobe, Opus, AAC, loudnorm and silence filters are required')
  const lock = purpose === 'release' ? assertAudioReleaseToolchain(options.toolchain, toolchain.fingerprint, options.approvedProfiles ?? []) : undefined
  const masterSha256 = hash(await readFile(input))
  const inputProbe = JSON.parse((await runner('ffprobe', ['-v', 'error', ...audioInputArguments, '-show_entries', 'format=duration', '-of', 'json', input], options.signal)).stdout)
  const duration = Number(inputProbe.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0 || duration > (options.kind === 'voice' ? 600 : 14_400))
    throw new Error('AUDIO_MASTER_DURATION_INVALID: Voice masters are bounded to ten minutes, other audio to four hours')
  const outputRoot = bounded(root, options.outputDirectory)
  // Walk parent directories before creating them, guarding symlinked ancestors.
  let parent = root
  for (const part of relative(root, outputRoot).split(/[\\/]/u)) {
    const next = join(parent, part)
    await mkdir(next).catch((error) => {
      if (error.code !== 'EEXIST')
        throw error
    })
    parent = await realpath(next)
    inside(root, parent)
  }
  const temporary = await mkdtemp(join(parent, '.audio-process-'))
  try {
    const outputs: AudioProcessingReceipt['outputs'] = []
    for (const variant of ['opus', 'aac'] as const) {
      options.signal?.throwIfAborted()
      const extension = variant === 'opus' ? 'webm' : 'm4a'
      const path = join(temporary, `variant.${extension}`)
      await runner('ffmpeg', audioProcessingArguments(options.kind, variant, input, path, { short: duration < 0.4 }), options.signal)
      const inspected = await metadata(path, variant, runner, options.signal)
      outputs.push({ variant, path, metadata: inspected })
    }
    const receipt: AudioProcessingReceipt = { schemaVersion: 1, purpose, presetId: audioProcessingPresets[options.kind].id, masterSha256, ffmpegBuildFingerprint: toolchain.fingerprint, ...(lock ? { toolchain: lock } : {}), outputs }
    assertAudioProcessingReceipt(receipt)
    if (hash(await readFile(input)) !== masterSha256)
      throw new Error('AUDIO_MASTER_CHANGED: Original media changed during processing')
    for (const output of outputs) {
      const target = join(parent, `${options.kind}.${output.metadata.sha256}.${output.variant === 'opus' ? 'webm' : 'm4a'}`)
      try {
        await copyFile(output.path, target, constants.COPYFILE_EXCL)
      }
      catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST')
          throw new Error('AUDIO_IMMUTABLE_OUTPUT_CONFLICT')
        const existing = await lstat(target)
        if (!existing.isFile() || existing.isSymbolicLink())
          throw new Error('AUDIO_IMMUTABLE_OUTPUT_CONFLICT')
        inside(root, await realpath(target))
        if (hash(await readFile(target)) !== output.metadata.sha256)
          throw new Error('AUDIO_IMMUTABLE_OUTPUT_CONFLICT')
      }
      output.path = relative(root, target).split('\\').join('/')
    }
    options.signal?.throwIfAborted()
    return receipt
  }
  finally {
    // Published hash files may already have been reused by another job. Keep
    // validated immutable outputs; explicit GC owns unreferenced final objects.
    await rm(temporary, { recursive: true, force: true })
  }
}
