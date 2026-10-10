// @vitest-environment node
import type { AdvVoicePreviewRequest } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('../src/runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/runtime')>()
  return { ...original, executeCommand: mocks.execute }
})

const { createQwenTtsProvider } = await import('../src/index')
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!
const archDescriptor = Object.getOwnPropertyDescriptor(process, 'arch')!
const requirements = fileURLToPath(new URL('../python/requirements.txt', import.meta.url))
let root: string
let request: AdvVoicePreviewRequest

beforeEach(async () => {
  Object.defineProperty(process, 'platform', { value: 'darwin' })
  Object.defineProperty(process, 'arch', { value: 'arm64' })
  mocks.execute.mockReset()
  root = await mkdtemp(resolve(tmpdir(), 'advjs-qwen-'))
  const config = {
    version: 'test-v1',
    model: 'test/model',
    revision: 'a'.repeat(40),
    weightSha256: { 'model.safetensors': 'b'.repeat(64) },
    characters: [{ id: 'sample', text: 'Hello.', description: 'A quiet voice' }],
  }
  await writeFile(resolve(root, 'preset.json'), JSON.stringify(config))
  request = { root, configPath: resolve(root, 'preset.json'), preset: 'sample', seed: 42, offline: true }
})

afterEach(async () => {
  Object.defineProperty(process, 'platform', platformDescriptor)
  Object.defineProperty(process, 'arch', archDescriptor)
  await rm(root, { recursive: true, force: true })
})

async function readyEnvironment(): Promise<void> {
  await mkdir(resolve(root, '.advjs/voice/.venv/bin'), { recursive: true })
  await writeFile(resolve(root, '.advjs/voice/.venv/bin/python'), '')
  await writeFile(resolve(root, '.advjs/voice/requirements.sha256'), createHash('sha256').update(await readFile(requirements)).digest('hex'))
}

async function generateFakeResult(arguments_: string[], outside = false): Promise<void> {
  const output = resolve(root, '.advjs/voice/previews/test-run')
  await mkdir(output, { recursive: true })
  const audio = Buffer.from('generated audio fixture')
  await writeFile(resolve(output, 'sample.wav'), audio)
  const manifest = {
    preset: 'sample',
    model: 'test/model',
    revision: 'a'.repeat(40),
    seed: 42,
    generationMode: 'voice-design',
    samples: [{ id: 'sample', text: arguments_.includes('--text') ? arguments_[arguments_.indexOf('--text') + 1].trim() : 'Hello.', sampleRate: 24000, durationSeconds: 1, path: '.advjs/voice/previews/test-run/sample.wav', bytes: audio.length, sha256: createHash('sha256').update(audio).digest('hex') }],
  }
  const manifestPath = outside ? resolve(root, 'escaped-manifest.json') : resolve(output, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest))
  const resultFile = arguments_[arguments_.indexOf('--result-file') + 1]
  await mkdir(dirname(resultFile), { recursive: true })
  await writeFile(resultFile, JSON.stringify({ manifestPath, manifest }))
}

describe('qwen authoring provider', () => {
  it('creates no files on import or provider creation', async () => {
    expect(createQwenTtsProvider().id).toBe('qwen-tts')
    expect(await readdir(root)).toEqual(['preset.json'])
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('diagnoses a missing environment without installing or creating directories', async () => {
    mocks.execute.mockResolvedValue('uv 0.12.3\n')
    const report = await createQwenTtsProvider().doctor({ root })
    expect(report.ready).toBe(false)
    expect(report.checks.find(check => check.id === 'environment')?.status).toBe('fail')
    expect(await readdir(root)).toEqual(['preset.json'])
    expect(mocks.execute.mock.calls).toHaveLength(1)
    expect(mocks.execute.mock.calls[0]?.slice(0, 2)).toEqual(['uv', ['--version']])
  })

  it('fails an offline preview before any installation or model download', async () => {
    await expect(createQwenTtsProvider().preview(request)).rejects.toThrow('no installation was attempted')
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual(['preset.json'])
  })

  it('rejects escaped config paths and symlinked output directories', async () => {
    await expect(createQwenTtsProvider().preview({ ...request, configPath: resolve(root, '../preset.json') })).rejects.toThrow('inside the project root')
    await mkdir(resolve(root, '.advjs'))
    await symlink(tmpdir(), resolve(root, '.advjs/voice'))
    await expect(createQwenTtsProvider().preview(request)).rejects.toThrow('inside the project root')
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('allows uv interpreter symlinks while keeping its environment directory inside the project', async () => {
    await readyEnvironment()
    await rm(resolve(root, '.advjs/voice/.venv/bin/python'))
    await symlink(process.execPath, resolve(root, '.advjs/voice/.venv/bin/python'))
    mocks.execute.mockImplementation(async (_command: string, arguments_: string[]) => {
      await generateFakeResult(arguments_)
      return ''
    })
    await expect(createQwenTtsProvider().preview(request)).resolves.toMatchObject({ provider: 'qwen-tts' })
  })

  it('passes text as a literal argument and returns verified structured provenance', async () => {
    await readyEnvironment()
    mocks.execute.mockImplementation(async (_command: string, arguments_: string[]) => {
      await generateFakeResult(arguments_)
      return ''
    })
    const text = '$(touch unsafe); `echo literal`'
    const result = await createQwenTtsProvider().preview({ ...request, character: 'sample', text })
    const arguments_ = mocks.execute.mock.calls[0]![1] as string[]
    expect(arguments_[arguments_.indexOf('--text') + 1]).toBe(text)
    expect(arguments_).toContain('--offline')
    expect(result.manifest.samples).toHaveLength(1)
    expect(await readdir(resolve(root, '.advjs/voice/results'))).toEqual([])
  })

  it('rejects a process result that points outside the voice cache', async () => {
    await readyEnvironment()
    mocks.execute.mockImplementation(async (_command: string, arguments_: string[]) => {
      await generateFakeResult(arguments_, true)
      return ''
    })
    await expect(createQwenTtsProvider().preview(request)).rejects.toThrow('inside the project root')
    expect(await readdir(resolve(root, '.advjs/voice/results'))).toEqual([])
  })

  it('preserves child failures and does not return a partial result', async () => {
    await readyEnvironment()
    mocks.execute.mockRejectedValue(new Error('Python exited with 1'))
    await expect(createQwenTtsProvider().preview(request)).rejects.toThrow('Python exited with 1')
  })

  it('honors a cancellation before creating anything', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Cancelled by the caller'))
    await expect(createQwenTtsProvider().preview({ ...request, signal: controller.signal })).rejects.toThrow('Cancelled by the caller')
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual(['preset.json'])
  })
})

describe('qwen adapter contract', () => {
  it('inspects design defaults without executing Python or creating an environment', async () => {
    const result = await createQwenTtsProvider().inspectPreset({ root, configPath: request.configPath, preset: request.preset })
    expect(result).toMatchObject({ seed: 42, referenceMode: undefined, characters: [{ id: 'sample', text: 'Hello.' }] })
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual(['preset.json'])
  })

  it('inspects reference defaults without requiring cached reference audio', async () => {
    const config = JSON.parse(await readFile(request.configPath, 'utf8'))
    config.characters[0].reference = { assetId: 'sample-reference', sha256: 'c'.repeat(64) }
    await writeFile(request.configPath, JSON.stringify(config))
    const result = await createQwenTtsProvider().inspectPreset({ root, configPath: request.configPath, preset: request.preset })
    expect(result).toMatchObject({ referenceMode: 'embedding-only', requiresReferenceAssets: true })
    await expect(createQwenTtsProvider().inspectPreset({ root, configPath: request.configPath, preset: request.preset, referenceMode: 'icl' })).rejects.toThrow('transcript')
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('returns normalized synthesis candidates while preserving the legacy saved manifest', async () => {
    await readyEnvironment()
    mocks.execute.mockImplementation(async (_command, arguments_) => {
      await generateFakeResult(arguments_)
      return ''
    })
    const result = await createQwenTtsProvider().synthesize({ ...request, voiceId: 'sample-voice', voiceVersion: 'v1' })
    expect(result.candidates[0]).toMatchObject({ provider: 'qwen-tts', characterId: 'sample', text: 'Hello.', mimeType: 'audio/wav', voiceId: 'sample-voice', voiceVersion: 'v1' })
    expect(JSON.parse(await readFile(result.manifestPath, 'utf8'))).toEqual(result.manifest)
  })
})
