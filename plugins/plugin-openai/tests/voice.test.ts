// @vitest-environment node
import type { AdvConfig } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runVoicePreview } from '../../../packages/advjs/node/commands/voice'
import { createOpenAiTtsProvider } from '../src/voice'

let root: string
const roots: string[] = []
const pcm = Buffer.alloc(48_000)
const create = vi.fn(async () => ({ arrayBuffer: async () => Uint8Array.from(pcm).buffer }))
const makeProvider = () => createOpenAiTtsProvider({ client: { audio: { speech: { create } } } })
const source = {
  schemaVersion: 1,
  model: 'gpt-4o-mini-tts',
  characters: [{ id: 'hero', name: 'Hero', text: '欢迎回来。', voice: 'echo', instructions: 'Speak calmly.' }],
}

async function request() {
  return { root, preset: 'sample', configPath: resolve(root, 'preset.json') }
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', '')
  root = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-openai-voice-')))
  roots.push(root)
  await writeFile(resolve(root, 'preset.json'), JSON.stringify(source))
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('openAI authoring TTS adapter', () => {
  it('prepares only finite built-in voice designs without invoking synthesis or creating permanent voices', async () => {
    const provider = makeProvider()
    expect(provider.capabilities.designSources).toEqual(['system'])
    const template = { schemaVersion: 1, model: 'gpt-4o-mini-tts', speed: 0.9, instructions: 'Private operator direction', characters: [] }
    const preset = await provider.buildDesignPreset!({ template, characterId: 'hero', text: '试听', locale: 'zh-CN', intent: { pace: 'slow' }, definition: { preset: 'approved', source: 'system', providerVoiceId: 'echo' } })
    expect(preset).toMatchObject({ model: template.model, speed: template.speed, instructions: template.instructions, characters: [{ id: 'hero', text: '试听', voice: 'echo' }] })
    await expect(provider.buildDesignPreset!({ template, characterId: 'hero', text: '试听', locale: 'zh-CN', intent: {}, definition: { preset: 'approved', source: 'designed', description: 'A quiet voice' } })).rejects.toThrow('UNSUPPORTED')
    expect(provider.createVoice).toBeUndefined()
    expect(create).not.toHaveBeenCalled()
  })
  it('imports, diagnoses and lists without credentials, writes, or API requests', async () => {
    const provider = createOpenAiTtsProvider()
    const diagnosis = await provider.doctor!({ root })
    expect(diagnosis.ready).toBe(false)
    expect(diagnosis.checks).toContainEqual(expect.objectContaining({ id: 'credentials', status: 'fail' }))
    const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider], presets: { sample: 'preset.json' }, defaultPreset: 'sample' } } }
    expect(await runVoicePreview({ root, config, list: true })).toMatchObject({ provider: 'openai-tts', characters: [{ id: 'hero', text: source.characters[0]!.text }] })
    expect(await readdir(root)).toEqual(['preset.json'])
    expect(create).not.toHaveBeenCalled()
  })

  it('routes through the shared service, writes verifiable WAV candidates and preserves supplier voice identity', async () => {
    const provider = makeProvider()
    const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider], presets: { sample: 'preset.json' }, defaultPreset: 'sample' } } }
    const result = await runVoicePreview({ root, config, character: 'hero', text: 'New line' })
    if (!('candidates' in result))
      throw new Error('Expected synthesis output')
    const candidate = result.candidates![0]!
    expect(candidate).toMatchObject({ characterId: 'hero', text: 'New line', providerVoiceId: 'echo', sampleRate: 24_000, durationSeconds: 1, mimeType: 'audio/wav' })
    expect(candidate.inputFingerprint).toMatch(/^[a-f0-9]{64}$/u)
    const audio = await readFile(resolve(root, candidate.path))
    expect(audio.subarray(0, 4).toString()).toBe('RIFF')
    expect(audio.subarray(44)).toEqual(pcm)
    expect(candidate.sha256).toBe(createHash('sha256').update(audio).digest('hex'))
    expect(candidate.bytes).toBe(audio.length)
    expect(create).toHaveBeenCalledWith({ model: source.model, voice: 'echo', input: 'New line', instructions: 'Speak calmly.', speed: 1, response_format: 'pcm' }, { signal: undefined, maxRetries: 0 })
    const receipt = JSON.parse(await readFile(resolve(root, result.manifestPath), 'utf8'))
    expect(receipt).toMatchObject({ state: 'candidate', samples: [{ providerVoiceId: 'echo' }] })
    expect(receipt.inputs).toEqual([{ characterId: 'hero', text: 'New line', providerVoiceId: 'echo', speed: 1, instructions: 'Speak calmly.' }])
    expect(await readdir(root)).not.toContain('assets.json')
    const next = await provider.synthesize(await request())
    expect(next.candidates[0]!.path).not.toBe(candidate.path)
  })

  it('supports cloud text lengths above the local Qwen limit', async () => {
    const inspected = await makeProvider().inspectPreset({ ...await request(), character: 'hero', text: '云'.repeat(1200) })
    expect(inspected).toMatchObject({ presetSha256: expect.stringMatching(/^[a-f0-9]{64}$/u), characters: [{ text: '云'.repeat(1200), generation: { model: source.model, providerVoiceId: 'echo', source: 'system', mimeType: 'audio/wav', parameters: { speed: 1 } } }] })
    expect(JSON.stringify(inspected)).not.toContain('Speak calmly.')
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    { seed: 42 },
    { referenceMode: 'icl' },
    { offline: true },
    { character: 'unknown' },
    { text: 'requires a character' },
    { character: 'hero', text: 'x'.repeat(4097) },
  ])('rejects unsupported or invalid request options before any request (case %#)', async (override) => {
    await expect(makeProvider().synthesize({ ...await request(), ...override })).rejects.toThrow()
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    { ...source, model: 'unknown' },
    { ...source, speed: 0 },
    { ...source, characters: [{ ...source.characters[0], voice: 'voice_custom' }] },
    { ...source, characters: [{ ...source.characters[0], voice: { id: 'voice_custom' } }] },
    { ...source, characters: [...source.characters, ...source.characters] },
    { ...source, model: 'tts-1' },
    { ...source, apiKey: 'must never enter the preset' },
  ])('validates the entire preset before billing (case %#)', async (invalid) => {
    await writeFile(resolve(root, 'preset.json'), JSON.stringify(invalid))
    await expect(makeProvider().synthesize(await request())).rejects.toThrow()
    expect(create).not.toHaveBeenCalled()
  })

  it('propagates cancellation and removes partial output without retrying', async () => {
    const controller = new AbortController()
    create.mockImplementationOnce(async () => {
      controller.abort(new Error('Cancelled'))
      return { arrayBuffer: async () => Uint8Array.from(pcm).buffer }
    })
    await expect(makeProvider().synthesize({ ...await request(), signal: controller.signal })).rejects.toThrow('Cancelled')
    expect(create).toHaveBeenCalledTimes(1)
    expect(await readdir(resolve(root, '.advjs/voice/previews/openai'))).toEqual([])
  })

  it('does not echo malformed private preset content in errors', async () => {
    await writeFile(resolve(root, 'preset.json'), '{"apiKey": private-credential }')
    await expect(makeProvider().inspectPreset(await request())).rejects.toThrow('must contain valid JSON')
    expect(create).not.toHaveBeenCalled()
  })

  it('refuses a preset changed while a request is running', async () => {
    create.mockImplementationOnce(async () => {
      await writeFile(resolve(root, 'preset.json'), '{}')
      return { arrayBuffer: async () => Uint8Array.from(pcm).buffer }
    })
    await expect(makeProvider().synthesize(await request())).rejects.toThrow('VOICE_CONFLICT')
    expect(await readdir(resolve(root, '.advjs/voice/previews/openai'))).toEqual([])
  })

  it('removes a partially generated batch and redacts supplier errors', async () => {
    await writeFile(resolve(root, 'preset.json'), JSON.stringify({ ...source, characters: [...source.characters, { ...source.characters[0], id: 'other' }] }))
    create.mockImplementationOnce(async () => ({ arrayBuffer: async () => Uint8Array.from(pcm).buffer }))
    create.mockRejectedValueOnce(new Error('Authorization: Bearer private-key; signed-url; private-text'))
    await expect(makeProvider().synthesize(await request())).rejects.toThrow('no automatic retry')
    expect(create).toHaveBeenCalledTimes(2)
    expect(await readdir(resolve(root, '.advjs/voice/previews/openai'))).toEqual([])
  })

  it.each([0, 3, 20 * 1024 * 1024])('rejects invalid PCM bytes and leaves no candidate: %i', async (size) => {
    create.mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(size) })
    await expect(makeProvider().synthesize(await request())).rejects.toThrow('PCM audio')
    expect(await readdir(resolve(root, '.advjs/voice/previews/openai'))).toEqual([])
  })

  it('rejects input and output symlinks that escape the project before billing', async () => {
    const outside = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-openai-outside-')))
    roots.push(outside)
    await writeFile(resolve(outside, 'outside.json'), JSON.stringify(source))
    await symlink(resolve(outside, 'outside.json'), resolve(root, 'outside.json'))
    await expect(makeProvider().inspectPreset({ ...await request(), configPath: resolve(root, 'outside.json') })).rejects.toThrow('outside the project')
    await symlink(outside, resolve(root, '.advjs'))
    await expect(makeProvider().synthesize(await request())).rejects.toThrow('outside the project')
    expect(await readdir(outside)).toEqual(['outside.json'])
    expect(create).not.toHaveBeenCalled()
  })
})
