// @vitest-environment node
import type { AdvConfig, AdvVoiceSynthesisProvider } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runVoiceCreate, runVoiceDoctor, runVoicePreview, runVoiceProviders, runVoiceSetup } from '../../../packages/advjs/node/commands/voice'

let root: string
let config: Partial<AdvConfig>
let provider: AdvVoiceSynthesisProvider
const longText = 'x'.repeat(1200)

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-voice-registry-')))
  await writeFile(join(root, 'preset.json'), JSON.stringify({ characters: [{ id: 'hero', text: longText }] }))
  provider = {
    id: 'mock-cloud',
    capabilities: { backend: 'cloud', synthesis: true, voiceCreation: false, offline: false, models: [{ id: 'mock', modes: ['preset'], formats: ['audio/wav'], streaming: false }] },
    inspectPreset: vi.fn(async request => ({ characters: [{ id: 'hero', name: 'Hero', text: request.text ?? longText }], referenceMode: request.referenceMode })),
    synthesize: vi.fn(async (request) => {
      const bytes = Buffer.from('mock local audio output')
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      await writeFile(join(root, 'sample.wav'), bytes)
      return { provider: 'mock-cloud', preset: request.preset, manifestPath: 'manifest.json', manifest: {}, candidates: [{ id: 'sample', provider: 'mock-cloud', characterId: 'hero', text: request.text ?? longText, path: 'sample.wav', sha256, bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000 }] }
    }),
  }
  config = { authoring: { voice: { providers: [provider], defaultProvider: provider.id, presets: { sample: 'preset.json' }, defaultPreset: 'sample' } } }
})
afterEach(async () => await rm(root, { recursive: true, force: true }))

describe('multiple voice adapters', () => {
  it('lists cloud inputs over the Qwen limit without adding a seed, local directories, or setup', async () => {
    const result = await runVoicePreview({ root, config, list: true, referenceMode: 'cloud-specific-mode' })
    expect(result).toMatchObject({ provider: 'mock-cloud', referenceMode: 'cloud-specific-mode', characters: [{ text: longText }] })
    expect(provider.inspectPreset).toHaveBeenCalledWith(expect.objectContaining({ seed: undefined }))
    expect(provider.synthesize).not.toHaveBeenCalled()
    expect(await runVoiceProviders({ root, config })).toMatchObject({ providers: [{ id: provider.id, legacy: false, setup: false }] })
    expect(await runVoiceDoctor({ root, config })).not.toHaveProperty('environmentDirectory')
    await expect(runVoiceSetup({ root, config })).rejects.toThrow('does not support local setup')
    await expect(runVoicePreview({ root, config, offline: true, list: true })).rejects.toThrow('does not support offline')
  })

  it('selects an explicit or preset provider and rejects duplicate or unknown IDs before calling adapters', async () => {
    const other = { ...provider, id: 'other' }
    config.authoring!.voice!.providers!.push(other)
    config.authoring!.voice!.presetProviders = { sample: 'other' }
    expect(await runVoicePreview({ root, config, list: true })).toMatchObject({ provider: 'other' })
    expect(await runVoicePreview({ root, config, list: true, provider: 'mock-cloud' })).toMatchObject({ provider: 'mock-cloud' })
    await expect(runVoiceProviders({ root, config, provider: 'unknown' })).rejects.toThrow('Unknown voice provider')
    config.authoring!.voice!.providers!.push(provider)
    await expect(runVoiceProviders({ root, config })).rejects.toThrow('Duplicate voice provider')
  })

  it('resolves a stable voice identity and refuses a preset edited without a new voice version', async () => {
    const presetSha256 = createHash('sha256').update(await readFile(join(root, 'preset.json'))).digest('hex')
    config.authoring!.voice!.library = 'voices.json'
    await writeFile(join(root, 'voices.json'), JSON.stringify({ schemaVersion: 1, voices: [{ id: 'hero-v1', version: 'v1', characterId: 'hero', label: 'Hero', implementations: { 'mock-cloud': { preset: 'sample', presetSha256 } } }] }))
    await runVoicePreview({ root, config, voice: 'hero-v1', list: true })
    expect(provider.inspectPreset).toHaveBeenCalledWith(expect.objectContaining({ voiceId: 'hero-v1', voiceVersion: 'v1', character: 'hero' }))
    await writeFile(join(root, 'preset.json'), '{}')
    await expect(runVoicePreview({ root, config, voice: 'hero-v1', list: true })).rejects.toThrow('VOICE_CONFLICT')
    expect(provider.synthesize).not.toHaveBeenCalled()
  })

  it('verifies normalized outputs and changes the fingerprint when the effective text changes', async () => {
    const first = await runVoicePreview({ root, config })
    const second = await runVoicePreview({ root, config, character: 'hero', text: 'New line' })
    expect('candidates' in first && first.candidates?.[0]?.inputFingerprint).toMatch(/^[a-f0-9]{64}$/u)
    expect('candidates' in second && second.candidates?.[0]?.inputFingerprint).not.toBe('candidates' in first && first.candidates?.[0]?.inputFingerprint)
    const result = await provider.synthesize({ root, preset: 'sample', configPath: join(root, 'preset.json') })
    result.candidates[0]!.sha256 = 'a'.repeat(64)
    vi.mocked(provider.synthesize).mockResolvedValueOnce(result)
    await expect(runVoicePreview({ root, config })).rejects.toThrow('checksum or size')
  })

  it('refuses late results after cancellation or preset changes, without selecting or creating a voice', async () => {
    const controller = new AbortController()
    vi.mocked(provider.inspectPreset).mockImplementationOnce(async () => {
      controller.abort(new Error('Interrupted'))
      return { characters: [{ id: 'hero', name: 'Hero', text: longText }] }
    })
    await expect(runVoicePreview({ root, config, signal: controller.signal, list: true })).rejects.toThrow('Interrupted')
    expect(provider.synthesize).not.toHaveBeenCalled()
    const original = provider.synthesize
    provider.synthesize = async (request) => {
      const result = await original(request)
      await writeFile(join(root, 'preset.json'), '{}')
      return result
    }
    await expect(runVoicePreview({ root, config })).rejects.toThrow('preset changed')
    expect(await readFile(join(root, 'preset.json'), 'utf8')).toBe('{}')
    await expect(runVoiceCreate({ root, config, id: 'voice', version: 'v1', characterId: 'hero', parameters: {} })).rejects.toThrow('does not support voice creation')
  })
})
