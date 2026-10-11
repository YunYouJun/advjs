import { spawnSync } from 'node:child_process'
// @vitest-environment node
import { createHash } from 'node:crypto'
import { copyFile, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeAudioToolchain, processProjectAudio, runAudioProcess } from '../../../packages/advjs/node/audio/process'
import { audioProcessingArguments } from '../../../packages/audio/src/processing'

vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, copyFile: vi.fn(fs.copyFile) }
})

const roots: string[] = []
const available = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 5_000 }).status === 0 && spawnSync('ffprobe', ['-version'], { stdio: 'ignore', timeout: 5_000 }).status === 0
afterEach(async () => {
  vi.mocked(copyFile).mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('non-destructive audio processing', () => {
  it('keeps silence trimming specific to voice and requires the fixed codecs', () => {
    const voice = audioProcessingArguments('voice', 'opus', 'master.wav', 'out.webm')
    expect(voice).toContain('libopus')
    expect(voice.join(' ')).toContain('areverse')
    expect(voice.join(' ')).not.toContain('stop_periods=-1')
    expect(audioProcessingArguments('bgm', 'aac', 'master.wav', 'out.m4a').join(' ')).not.toContain('silenceremove')
  })
  it.runIf(available)('produces both real encoded variants with probe/loudness receipts while preserving the master', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-processing-'))
    roots.push(root)
    const master = join(root, 'master.wav')
    await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ar', '48000', master])
    const original = await readFile(master)
    const processed = await processProjectAudio({ root, inputPath: 'master.wav', outputDirectory: 'audio/processed', kind: 'voice' })
    expect(processed.purpose).toBe('preview')
    expect(processed.masterSha256).toBe(createHash('sha256').update(original).digest('hex'))
    for (const output of processed.outputs) {
      expect(output.metadata.codec).toBe(output.variant)
      expect(output.metadata.sampleRate).toBe(48000)
      expect(output.metadata.channels).toBe(1)
      expect(output.metadata.duration).toBeGreaterThan(1.8)
      expect(output.metadata.duration).toBeLessThan(2.2)
      expect(output.metadata.integratedLufs).toBeGreaterThan(-17)
      expect(output.metadata.integratedLufs).toBeLessThan(-15)
      expect(output.metadata.truePeakDb).toBeLessThanOrEqual(0)
      expect(createHash('sha256').update(await readFile(join(root, output.path))).digest('hex')).toBe(output.metadata.sha256)
    }
    expect(await readFile(master)).toEqual(original)
    const repeated = await processProjectAudio({ root, inputPath: 'master.wav', outputDirectory: 'audio/processed', kind: 'voice' })
    expect(repeated.outputs.map(output => output.path)).toEqual(processed.outputs.map(output => output.path))
    const externalRoot = await mkdtemp(join(tmpdir(), 'advjs-external-audio-'))
    roots.push(externalRoot)
    const target = join(root, repeated.outputs[0]!.path)
    const external = join(externalRoot, 'same-output.webm')
    await copyFile(target, external)
    await rm(target)
    await symlink(external, target)
    await expect(processProjectAudio({ root, inputPath: 'master.wav', outputDirectory: 'audio/processed', kind: 'voice' })).rejects.toThrow('IMMUTABLE_OUTPUT_CONFLICT')
    await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=0.12', '-ar', '48000', join(root, 'short.wav')])
    const short = await processProjectAudio({ root, inputPath: 'short.wav', outputDirectory: 'audio/processed', kind: 'ui' })
    expect(short.outputs.every(output => output.metadata.truePeakDb > -40 && output.metadata.duration < 0.3)).toBe(true)
    const toolchain = await probeAudioToolchain()
    expect(toolchain.ready).toBe(true)
    await expect(processProjectAudio({ root, inputPath: 'master.wav', outputDirectory: 'audio/release', kind: 'voice', purpose: 'release', toolchain: { schemaVersion: 1, profileId: 'unapproved', ffmpegBuildFingerprint: toolchain.fingerprint, workerImageDigest: `sha256:${'a'.repeat(64)}` } })).rejects.toThrow('UNAPPROVED')
    await expect(processProjectAudio({ root, inputPath: '../outside.wav', outputDirectory: 'audio/processed', kind: 'voice' })).rejects.toThrow('PATH_INVALID')
    await writeFile(join(root, 'playlist.m3u8'), '#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\nhttps://example.com/forbidden.wav\n#EXT-X-ENDLIST\n')
    await expect(processProjectAudio({ root, inputPath: 'playlist.m3u8', outputDirectory: 'audio/processed', kind: 'voice' })).rejects.toThrow('AUDIO_PROCESS_FAILED')
  }, 30_000)
  it.runIf(available)('preserves immutable output reused by another job when its creating job is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-concurrent-processing-'))
    roots.push(root)
    await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ar', '48000', join(root, 'master.wav')])
    const controller = new AbortController()
    const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    let notifyPromoted!: () => void
    let releaseFirst!: () => void
    const promoted = new Promise<void>((resolve) => {
      notifyPromoted = resolve
    })
    const completed = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let paused = false
    vi.mocked(copyFile).mockImplementation(async (...args) => {
      await fs.copyFile(...args)
      if (!paused && String(args[1]).endsWith('.webm')) {
        paused = true
        notifyPromoted()
        await completed
      }
    })
    const first = processProjectAudio({ root, inputPath: 'master.wav', outputDirectory: 'audio/processed', kind: 'voice', signal: controller.signal })
    // A has created its hash output; B must successfully reuse it before A
    // resumes and aborts at its receipt boundary.
    await promoted
    const second = await processProjectAudio({ root, inputPath: 'master.wav', outputDirectory: 'audio/processed', kind: 'voice' })
    controller.abort()
    releaseFirst()
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    for (const output of second.outputs)
      expect(createHash('sha256').update(await readFile(join(root, output.path))).digest('hex')).toBe(output.metadata.sha256)
  }, 30_000)
})
