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
    generationMode: arguments_.includes('--reference-mode') ? `reference-${arguments_[arguments_.indexOf('--reference-mode') + 1]}` : 'voice-design',
    samples: [{ id: 'sample', text: arguments_.includes('--text') ? arguments_[arguments_.indexOf('--text') + 1].trim() : 'Hello.', sampleRate: 24000, durationSeconds: 1, path: '.advjs/voice/previews/test-run/sample.wav', bytes: audio.length, sha256: createHash('sha256').update(audio).digest('hex') }],
  }
  const manifestPath = outside ? resolve(root, 'escaped-manifest.json') : resolve(output, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest))
  const resultFile = arguments_[arguments_.indexOf('--result-file') + 1]
  await mkdir(dirname(resultFile), { recursive: true })
  await writeFile(resultFile, JSON.stringify({ manifestPath, manifest }))
}

describe('qwen authoring provider', () => {
  it('builds conditioned sample presets from trusted pinned templates without permanent voice creation', async () => {
    const provider = createQwenTtsProvider()
    const base = { version: 'trusted', model: 'mlx/Qwen3-TTS-12Hz-1.7B-VoiceDesign', revision: 'a'.repeat(40), weightSha256: { 'model.safetensors': 'b'.repeat(64) }, characters: [] }
    const designed = await provider.buildDesignPreset!({ template: base, characterId: 'hero', text: '试听', locale: 'zh-CN', intent: { pitch: 'low' }, definition: { preset: 'approved', source: 'designed', description: 'A calm low voice' } })
    expect(designed).toMatchObject({ model: base.model, revision: base.revision, weightSha256: base.weightSha256, language: 'Chinese', characters: [{ id: 'hero', text: '试听', description: 'A calm low voice\n\nVoice characteristics:\nPreferred pitch: low' }] })
    const clone = { preset: 'approved', source: 'cloned' as const, reference: { assetId: 'reference/hero', sha256: 'c'.repeat(64), text: '参考语音' }, rights: { license: 'consented', subject: 'Hero performer', consentRecord: 'authoring/rights/hero.json' } }
    await expect(provider.buildDesignPreset!({ template: base, characterId: 'hero', text: '试听', locale: 'zh-CN', intent: {}, definition: clone })).rejects.toThrow('MODE_MISMATCH')
    expect(await provider.buildDesignPreset!({ template: { ...base, model: 'mlx/Qwen3-TTS-12Hz-1.7B-Base' }, characterId: 'hero', text: '试听', locale: 'zh-CN', intent: {}, definition: clone })).toMatchObject({ characters: [{ reference: clone.reference }] })
    expect(provider.capabilities.voiceCreation).toBe(false)
    expect(provider.createVoice).toBeUndefined()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('preserves the original description and adds nonempty author preferences in a fixed order', async () => {
    const provider = createQwenTtsProvider()
    const template = { model: 'mlx/Qwen3-TTS-12Hz-1.7B-VoiceDesign', language: 'Chinese' }
    const description = '  原始描述\n轻柔、清晰。  '
    const input = { template, characterId: 'hero', text: 'Hello.', locale: 'en-GB', definition: { preset: 'approved', source: 'designed' as const, description } }
    const preset = await provider.buildDesignPreset!({ ...input, intent: { pace: 'fast', pitch: 'low', speakingStyle: '清晰', temperament: ['温柔', '耐心'], genderExpression: '中性', ageImpression: '成年' } })
    expect(preset).toMatchObject({ language: 'English', characters: [{ description: `${description}\n\nVoice characteristics:\nAge impression: 成年\nGender expression: 中性\nTemperament: 温柔, 耐心\nSpeaking style: 清晰\nPreferred pitch: low\nPreferred pace: fast` }] })
    expect(await provider.buildDesignPreset!({ ...input, intent: { ageImpression: '成年', genderExpression: '中性', temperament: ['温柔', '耐心'], speakingStyle: '清晰', pitch: 'low', pace: 'fast' } })).toEqual(preset)
    expect(await provider.buildDesignPreset!({ ...input, intent: { temperament: [] } })).toMatchObject({ characters: [{ description }] })
    expect(template.language).toBe('Chinese')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it.each([
    ['zh-Hant-TW', 'Chinese'],
    ['en-US', 'English'],
    ['ja-JP', 'Japanese'],
    ['ko-KR', 'Korean'],
    ['de-DE', 'German'],
    ['fr-FR', 'French'],
    ['ru-RU', 'Russian'],
    ['pt-BR', 'Portuguese'],
    ['es-ES', 'Spanish'],
    ['it-IT', 'Italian'],
  ])('maps %s to the supported Qwen language %s for reference generation', async (locale, language) => {
    const preset = await createQwenTtsProvider().buildDesignPreset!({ template: { model: 'mlx/Qwen3-TTS-12Hz-1.7B-Base', language: 'Chinese' }, characterId: 'hero', text: '试听', locale, intent: {}, definition: { preset: 'approved', source: 'cloned', reference: { assetId: 'reference/hero', sha256: 'c'.repeat(64) }, rights: { license: 'original', subject: 'Original synthetic voice', consentRecord: 'authoring/rights/original.json' } } })
    expect(preset.language).toBe(language)
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it.each(['ar-SA', 'yue-HK', 'und', 'ja_JP', ''])('rejects unsupported or malformed locale %s before execution', async (locale) => {
    await expect(createQwenTtsProvider().buildDesignPreset!({ template: { model: 'mlx/Qwen3-TTS-12Hz-1.7B-VoiceDesign' }, characterId: 'hero', text: '试听', locale, intent: {}, definition: { preset: 'approved', source: 'designed', description: 'A calm voice' } })).rejects.toThrow('VOICE_DESIGN_LOCALE_UNSUPPORTED')
    expect(mocks.execute).not.toHaveBeenCalled()
  })
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
    expect(result).toMatchObject({ seed: 42, referenceMode: undefined, presetSha256: expect.stringMatching(/^[a-f0-9]{64}$/u), characters: [{ id: 'sample', text: 'Hello.', generation: { model: 'test/model', source: 'designed', providerVoiceId: expect.stringMatching(/^design:[a-f0-9]{64}$/u), revision: expect.stringMatching(/^[a-f0-9]{40}$/u), mimeType: 'audio/wav' } }] })
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual(['preset.json'])
  })

  it('inspects reference defaults without requiring cached reference audio', async () => {
    const config = JSON.parse(await readFile(request.configPath, 'utf8'))
    config.characters[0].reference = { assetId: 'sample-reference', sha256: 'c'.repeat(64) }
    await writeFile(request.configPath, JSON.stringify(config))
    const result = await createQwenTtsProvider().inspectPreset({ root, configPath: request.configPath, preset: request.preset })
    expect(result).toMatchObject({ referenceMode: 'embedding-only', requiresReferenceAssets: true, characters: [{ generation: { source: 'cloned', providerVoiceId: `reference:sample-reference:${'c'.repeat(64)}`, referenceAssetId: 'sample-reference', referenceSha256: 'c'.repeat(64) } }] })
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
    expect(result.candidates[0]?.providerVoiceId).toBe(`design:${createHash('sha256').update('A quiet voice').digest('hex')}`)
    expect(result.candidates[0]).toMatchObject({ provider: 'qwen-tts', characterId: 'sample', text: 'Hello.', mimeType: 'audio/wav', voiceId: 'sample-voice', voiceVersion: 'v1' })
    expect(JSON.parse(await readFile(result.manifestPath, 'utf8'))).toEqual(result.manifest)
  })

  it('freezes reference conditioning independently of the author voice identity', async () => {
    await readyEnvironment()
    const config = JSON.parse(await readFile(request.configPath, 'utf8'))
    delete config.characters[0].description
    config.characters[0].reference = { assetId: 'sample-reference', sha256: 'c'.repeat(64) }
    await writeFile(request.configPath, JSON.stringify(config))
    await writeFile(resolve(root, 'assets.json'), '{}')
    mocks.execute.mockImplementation(async (_command, arguments_) => {
      await generateFakeResult(arguments_)
      return ''
    })
    const result = await createQwenTtsProvider().synthesize({ ...request, assetManifestPath: resolve(root, 'assets.json'), voiceId: 'project-voice', voiceVersion: 'v1' })
    expect(result.candidates[0]?.providerVoiceId).toBe(`reference:sample-reference:${'c'.repeat(64)}`)
    expect(result.candidates[0]?.voiceId).toBe('project-voice')
  })

  it('rejects a preset changed during synthesis instead of attributing the new condition to an old output', async () => {
    await readyEnvironment()
    mocks.execute.mockImplementation(async (_command, arguments_) => {
      await generateFakeResult(arguments_)
      const config = JSON.parse(await readFile(request.configPath, 'utf8'))
      config.characters[0].description = 'A different voice'
      await writeFile(request.configPath, JSON.stringify(config))
      return ''
    })
    await expect(createQwenTtsProvider().synthesize(request)).rejects.toThrow('preset changed')
  })
})
