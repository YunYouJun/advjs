// @vitest-environment node
import type { AdvConfig } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runVoicePreview } from '../../../packages/advjs/node/commands/voice'
import { createBreezeTtsProvider } from '../src'
import { inspectWave, responseBytes } from '../src/runtime'

let root: string
const roots: string[] = []
const source = { schemaVersion: 1, model: 'Breeze-TTS-2', cfgScale: 4, seed: 42, characters: [{ id: 'hero', name: 'Hero', text: '欢迎回来。', description: '年轻女声，开心地说话。' }] }
const info = { model_type: 'audio', model_name: source.model, model_family: source.model, model_revision: 'unverified-registry-revision' }

function wave() {
  const bytes = Buffer.alloc(44 + 4800)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(24000, 24)
  bytes.writeUInt32LE(48000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(4800, 40)
  return bytes
}
const fetcher = vi.fn<typeof fetch>(async (_url, init) => init?.method === 'POST' ? new Response(new Uint8Array(wave())) : Response.json(info))
const provider = () => createBreezeTtsProvider({ fetch: fetcher })
const request = () => ({ root, preset: 'breeze', configPath: resolve(root, 'preset.json') })

beforeEach(async () => {
  fetcher.mockReset()
  fetcher.mockImplementation(async (_url, init) => init?.method === 'POST' ? new Response(new Uint8Array(wave())) : Response.json(info))
  root = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-breeze-provider-')))
  roots.push(root)
  await writeFile(resolve(root, 'preset.json'), JSON.stringify(source))
})
afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('breeze native authoring provider', () => {
  it('inspects through the shared registry without network, installation or writes', async () => {
    const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider()], presets: { breeze: 'preset.json' }, defaultPreset: 'breeze' } } }
    expect(await runVoicePreview({ root, config, list: true })).toMatchObject({ provider: 'breeze-tts', seed: 42, characters: [{ id: 'hero', generation: { model: source.model, source: 'designed', parameters: { cfgScale: 4, seed: 42 } } }] })
    expect(fetcher).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual(['preset.json'])
    expect(provider().setup).toBeUndefined()
    expect(provider().createVoice).toBeUndefined()
    expect(provider().capabilities.designSources).toEqual(['designed', 'cloned'])
    expect(provider().capabilities.referenceModes).toEqual(['icl'])
  })

  it('maps the existing creative controls into deterministic Breeze instructions', async () => {
    const template = { ...source, instruct: '不要添加背景音乐。' }
    const input = { template, characterId: 'hero', text: '你好。', locale: 'zh-TW', intent: { speakingStyle: '欣喜，带笑意', temperament: ['温柔'], pitch: 'low' as const, pace: 'slow' as const }, definition: { preset: 'breeze', source: 'designed' as const, description: '成熟女声' } }
    const designed = await provider().buildDesignPreset!(input)
    expect(designed).toMatchObject({ ...template, characters: [{ id: 'hero', text: '你好。', description: '成熟女声\n气质与情绪：温柔；说话风格：欣喜，带笑意；音高：低；语速：慢' }] })
    expect(await provider().buildDesignPreset!({ ...input, intent: { pace: 'slow', pitch: 'low', temperament: ['温柔'], speakingStyle: '欣喜，带笑意' } })).toEqual(designed)
    expect(fetcher).not.toHaveBeenCalled()
    await expect(provider().buildDesignPreset!({ ...input, locale: 'fr-FR' })).rejects.toThrow('LOCALE_UNSUPPORTED')
    await expect(provider().buildDesignPreset!({ ...input, definition: { preset: 'breeze', source: 'system' } })).rejects.toThrow('SOURCE_UNSUPPORTED')
    await writeFile(resolve(root, 'preset.json'), JSON.stringify(designed))
    const inspected = await provider().inspectPreset(request())
    expect(inspected.characters[0]!.generation!.parameters!.instruct).toContain('不要添加背景音乐。\n成熟女声')
  })

  it('sends Xinference serialized kwargs, writes native WAV candidates and preserves exact dialogue text', async () => {
    const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider()], presets: { breeze: 'preset.json' }, defaultPreset: 'breeze' } } }
    const result = await runVoicePreview({ root, config, character: 'hero', text: '  新的台词。 ', seed: 7, offline: true })
    if (!('candidates' in result))
      throw new Error('Expected modern provider result')
    const candidate = result.candidates![0]!
    expect(candidate).toMatchObject({ provider: 'breeze-tts', characterId: 'hero', text: '  新的台词。 ', model: source.model, mimeType: 'audio/wav', durationSeconds: 0.1, sampleRate: 24_000 })
    expect(candidate.providerVoiceId).toMatch(/^design:[a-f0-9]{64}$/u)
    expect(candidate.inputFingerprint).toMatch(/^[a-f0-9]{64}$/u)
    expect(candidate.revision).toBeUndefined()
    const bytes = await readFile(resolve(root, candidate.path))
    expect(bytes).toEqual(wave())
    expect(candidate.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    const [url, init] = fetcher.mock.calls[1]!
    expect(url).toBe('http://127.0.0.1:9997/v1/audio/speech')
    expect(init!.redirect).toBe('error')
    const body = JSON.parse(init!.body as string)
    expect(body).toEqual({ model: 'breeze-bf16', input: '  新的台词。 ', voice: 'S0', response_format: 'wav', speed: 1, stream: false, kwargs: JSON.stringify({ instruct: source.characters[0]!.description, seed: 7, cfg_scale: 4 }) })
    expect(result.manifest).toMatchObject({ state: 'candidate', seed: 7, cfgScale: 4 })
    expect(JSON.stringify(result.manifest)).not.toContain(info.model_revision)
    expect(await readdir(root)).not.toContain('assets.json')
  })

  it('diagnoses only the loaded local model and rejects another model behind the UID', async () => {
    expect(await provider().doctor!({ root })).toMatchObject({ ready: true })
    fetcher.mockResolvedValueOnce(Response.json({ ...info, model_family: 'another-family' }))
    expect(await provider().doctor!({ root })).toMatchObject({ ready: false })
    fetcher.mockResolvedValueOnce(Response.json({ ...info, model_name: 'another-model' }))
    await expect(provider().synthesize(request())).rejects.toThrow('not a Breeze')
    expect(fetcher.mock.calls.every(([, init]) => init!.method === 'GET')).toBe(true)
  })

  it.each([
    { ...source, cfgScale: 0 },
    { ...source, seed: -1 },
    { ...source, endpoint: 'http://remote.invalid' },
    { ...source, characters: [...source.characters, ...source.characters] },
    { ...source, characters: [{ ...source.characters[0], description: '' }] },
    { ...source, characters: [{ ...source.characters[0], id: '../outside' }] },
  ])('rejects invalid presets before network and output (case %#)', async (invalid) => {
    await writeFile(resolve(root, 'preset.json'), JSON.stringify(invalid))
    await expect(provider().synthesize(request())).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual(['preset.json'])
  })

  it.each([{ seed: 1.5 }, { referenceMode: 'icl' }, { character: 'missing' }, { text: 'no character' }, { character: 'hero', text: '字'.repeat(501) }])('rejects unsupported request inputs (case %#)', async (invalid) => {
    await expect(provider().synthesize({ ...request(), ...invalid })).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each(['https://127.0.0.1:9997', 'http://remote.invalid', 'http://127.0.0.1:9997?key=private', 'http://name:secret@localhost:9997'])('rejects nonlocal or credential-bearing endpoints (%s)', (baseUrl) => {
    expect(() => createBreezeTtsProvider({ baseUrl })).toThrow('local HTTP')
  })

  it('rejects input and output symlink escapes', async () => {
    const outside = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-breeze-outside-')))
    roots.push(outside)
    await writeFile(resolve(outside, 'preset.json'), JSON.stringify(source))
    await symlink(resolve(outside, 'preset.json'), resolve(root, 'escape.json'))
    await expect(provider().inspectPreset({ ...request(), configPath: 'escape.json' })).rejects.toThrow('outside the project')
    await symlink(outside, resolve(root, '.advjs'))
    await expect(provider().synthesize(request())).rejects.toThrow('outside the project')
    expect(await readdir(outside)).toEqual(['preset.json'])
  })

  it('cleans partial output after preset conflicts without retrying', async () => {
    fetcher.mockImplementation(async (_url, init) => {
      if (init!.method !== 'POST')
        return Response.json(info)
      await writeFile(resolve(root, 'preset.json'), JSON.stringify({ ...source, cfgScale: 2 }))
      return new Response(new Uint8Array(wave()))
    })
    await expect(provider().synthesize(request())).rejects.toThrow('preset changed')
    expect(await readdir(resolve(root, '.advjs/voice/previews/breeze'))).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('propagates cancellation and removes unfinished candidates', async () => {
    const controller = new AbortController()
    fetcher.mockImplementation(async (_url, init) => {
      if (init!.method !== 'POST')
        return Response.json(info)
      controller.abort(new Error('Author cancelled'))
      return new Response(new Uint8Array(wave()))
    })
    await expect(provider().synthesize({ ...request(), signal: controller.signal })).rejects.toThrow('Author cancelled')
    expect(await readdir(resolve(root, '.advjs/voice/previews/breeze'))).toEqual([])
  })

  it('does not persist malformed audio or leak server error details', async () => {
    fetcher.mockImplementationOnce(async () => Response.json(info)).mockResolvedValueOnce(new Response('private backend traceback'))
    await expect(provider().synthesize(request())).rejects.toThrow('WAV')
    expect(await readdir(resolve(root, '.advjs/voice/previews/breeze'))).toEqual([])
    fetcher.mockResolvedValueOnce(new Response('private backend traceback', { status: 500 }))
    await expect(provider().synthesize(request())).rejects.toThrow('no retry')
  })

  it('bounds chunked responses and rejects malformed WAV chunk lengths', async () => {
    await expect(responseBytes(new Response(new Uint8Array(10)), 5)).rejects.toThrow('size limit')
    const truncated = wave()
    truncated.writeUInt32LE(9000, 40)
    expect(() => inspectWave(truncated)).toThrow('WAV')
    const stereo = wave()
    stereo.writeUInt16LE(2, 22)
    expect(() => inspectWave(stereo)).toThrow('WAV')
    expect(inspectWave(wave())).toEqual({ sampleRate: 24000, durationSeconds: 0.1 })
  })
})

async function clonePreset() {
  const bytes = wave()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const reference = { assetId: 'reference/hero', sha256, text: '这是参考录音的实际内容。' }
  const config = { ...source, characters: [{ id: 'hero', text: '你好，这是新的台词。', reference }] }
  await mkdir(resolve(root, 'adv'), { recursive: true })
  await mkdir(resolve(root, 'public/media'), { recursive: true })
  await writeFile(resolve(root, 'public/media/reference.wav'), bytes)
  const asset = { id: reference.assetId, type: 'audio', kind: 'reference', path: 'reference.wav', characterId: 'hero', mimeType: 'audio/wav', bytes: bytes.length, sha256 }
  const manifest = { schemaVersion: 2, id: 'breeze-clone-test', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [asset] }
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify(manifest))
  await writeFile(resolve(root, 'preset.json'), JSON.stringify(config))
  return { config, reference, bytes, asset, manifest }
}

describe('breeze registered reference cloning', () => {
  it('advertises and builds a clone without loading the model or reading reference bytes', async () => {
    const reference = { assetId: 'reference/missing', sha256: 'a'.repeat(64), text: '参考文本。', mode: 'icl' as const }
    const definition = { preset: 'breeze', source: 'cloned' as const, reference, rights: { license: 'original', subject: 'Fictional synthetic voice', consentRecord: 'authoring/rights/synthetic.json' } }
    const built = await provider().buildDesignPreset!({ template: source, characterId: 'hero', text: '试听。', locale: 'zh-CN', intent: { speakingStyle: '平静，轻声表达' }, definition })
    expect(built).toMatchObject({ model: source.model, characters: [{ id: 'hero', reference: { assetId: reference.assetId, sha256: reference.sha256, text: reference.text }, description: '说话风格：平静，轻声表达' }] })
    await writeFile(resolve(root, 'preset.json'), JSON.stringify(built))
    expect(await provider().inspectPreset(request())).toMatchObject({ requiresReferenceAssets: true, referenceMode: 'icl', characters: [{ generation: { source: 'cloned', providerVoiceId: `reference:${reference.assetId}:${reference.sha256}`, referenceAssetId: reference.assetId, referenceSha256: reference.sha256, parameters: { referenceText: reference.text, referenceMode: 'icl' } } }] })
    await expect(provider().buildDesignPreset!({ template: source, characterId: 'hero', text: '试听。', locale: 'zh-CN', intent: {}, definition: { ...definition, reference: { ...reference, mode: 'embedding-only' } } })).rejects.toThrow('REFERENCE_MODE_UNSUPPORTED')
    await expect(provider().buildDesignPreset!({ template: source, characterId: 'hero', text: '试听。', locale: 'zh-CN', intent: {}, definition: { ...definition, rights: undefined } })).rejects.toThrow('RIGHTS_REQUIRED')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('uploads verified reference bytes and their exact transcript using Xinference multipart fields', async () => {
    const { reference, bytes } = await clonePreset()
    const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider()], presets: { breeze: 'preset.json' }, defaultPreset: 'breeze' } } }
    const result = await runVoicePreview({ root, config, character: 'hero', referenceMode: 'icl', offline: true })
    if (!('candidates' in result))
      throw new Error('Expected voice candidates')
    expect(result.candidates![0]).toMatchObject({ providerVoiceId: `reference:${reference.assetId}:${reference.sha256}`, provider: 'breeze-tts' })
    const init = fetcher.mock.calls[1]![1]!
    expect(init.headers).toBeUndefined()
    const form = init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('model')).toBe('breeze-bf16')
    expect(form.get('stream')).toBe('false')
    expect(JSON.parse(form.get('kwargs') as string)).toMatchObject({ prompt_text: reference.text, cfg_scale: 4, seed: 42, instruct: '保持参考音色，自然清晰地说话。' })
    expect(Buffer.from(await (form.get('prompt_speech') as Blob).arrayBuffer())).toEqual(bytes)
    expect(result.manifest).toMatchObject({ inputs: [{ reference }] })
  })

  it('resolves catalog fragments using shared native asset semantics', async () => {
    const { manifest, asset } = await clonePreset()
    const { assets: _assets, ...base } = manifest
    await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ ...base, includes: ['references.json'] }))
    await writeFile(resolve(root, 'adv/references.json'), JSON.stringify({ schemaVersion: 2, assets: [asset] }))
    await expect(provider().synthesize(request())).resolves.toMatchObject({ candidates: [{ provider: 'breeze-tts' }] })
  })

  it.each(['missing-transcript', 'embedding-only', 'wrong-owner', 'changed-audio', 'missing-asset', 'duplicate-asset', 'path-escape'])('rejects invalid reference inputs before network (%s)', async (failure) => {
    const data = await clonePreset()
    if (failure === 'missing-transcript')
      data.config.characters[0]!.reference.text = ''
    if (failure === 'wrong-owner')
      data.manifest.assets[0]!.characterId = 'another-character'
    if (failure === 'changed-audio')
      await writeFile(resolve(root, 'public/media/reference.wav'), 'changed')
    if (failure === 'missing-asset')
      data.manifest.assets = []
    if (failure === 'duplicate-asset')
      data.manifest.assets.push(data.asset)
    if (failure === 'path-escape')
      data.manifest.assets[0]!.path = '../../../../outside.wav'
    await writeFile(resolve(root, 'preset.json'), JSON.stringify(data.config))
    await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify(data.manifest))
    await expect(provider().synthesize({ ...request(), ...(failure === 'embedding-only' ? { referenceMode: 'embedding-only' } : {}) })).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('discards output if reference bytes change during inference', async () => {
    await clonePreset()
    fetcher.mockImplementation(async (_url, init) => {
      if (init!.method !== 'POST')
        return Response.json(info)
      await writeFile(resolve(root, 'public/media/reference.wav'), 'changed during inference')
      return new Response(new Uint8Array(wave()))
    })
    await expect(provider().synthesize(request())).rejects.toThrow('changed')
    expect(await readdir(resolve(root, '.advjs/voice/previews/breeze'))).toEqual([])
  })
})
