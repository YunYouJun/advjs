import type { JsonObject, VoiceDesignSource } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createEditorVoiceJobsFixture } from './editor-voice-jobs'

/** Original audible waveform: exercises real media delivery without models or cloud charges. */
function originalWave() {
  const samples = 24000
  const bytes = Buffer.alloc(44 + samples * 2)
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
  bytes.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++)
    bytes.writeInt16LE(Math.round(9000 * Math.sin(index * 2 * Math.PI * 330 / samples)), 44 + index * 2)
  return bytes
}

export async function createEditorVoiceDesignFixture() {
  const fixture = await createEditorVoiceJobsFixture()
  const bytes = originalWave()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const provider = fixture.provider
  provider.capabilities.designSources = ['system', 'designed', 'cloned']
  provider.capabilities.models[0]!.modes = ['system', 'designed', 'cloned']
  provider.doctor = async () => ({ provider: provider.id, ready: true, supported: true, checks: [{ id: 'fixture', status: 'pass', message: 'Original local audio fixture' }] })
  provider.listVoices = async () => [{ id: 'system:fixture', label: '本地验收内置音色' }]
  provider.buildDesignPreset = async ({ template, characterId, intent, definition }) => ({
    model: template.model!,
    characterId,
    voiceId: definition.source === 'system' ? definition.providerVoiceId! : `${definition.source}:${createHash('sha256').update(JSON.stringify(definition)).digest('hex')}`,
    source: definition.source,
    intent: intent as JsonObject,
    ...(definition.description ? { description: definition.description } : {}),
    ...(definition.reference ? { reference: definition.reference } : {}),
  })
  provider.inspectPreset = async (request) => {
    const preset = await readFile(request.configPath)
    const document = JSON.parse(preset.toString())
    return { presetSha256: createHash('sha256').update(preset).digest('hex'), characters: [{ id: request.character ?? 'hero', name: request.character ?? 'Hero', text: request.text ?? '你好，世界。', generation: { model: document.model, providerVoiceId: document.voiceId, source: (document.source ?? 'system') as VoiceDesignSource, mimeType: 'audio/wav', parameters: { fixture: true } } }] }
  }
  provider.synthesize = async (request) => {
    fixture.calls.push(request)
    request.signal?.throwIfAborted()
    const preset = JSON.parse(await readFile(request.configPath, 'utf8'))
    const path = `temporary/design-${fixture.calls.length}.wav`
    await mkdir(join(request.root, 'temporary'), { recursive: true })
    await writeFile(join(request.root, path), bytes)
    return { provider: provider.id, preset: request.preset, manifestPath: 'temporary/manifest.json', manifest: {}, candidates: [{ id: `design-${fixture.calls.length}`, provider: provider.id, characterId: request.character!, text: request.text!, path, sha256, bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 24000, model: preset.model, providerVoiceId: preset.voiceId }] }
  }
  await writeFile(join(fixture.root, 'public/media/reference.wav'), bytes)
  await writeFile(join(fixture.root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'editor-jobs-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [{ id: 'reference/original', type: 'audio', kind: 'reference', title: '本地原创参考', path: 'reference.wav', sha256, bytes: bytes.length, mimeType: 'audio/wav', duration: 1, sampleRate: 24000, characterId: 'hero' }] }))
  await mkdir(join(fixture.root, 'authoring/rights'), { recursive: true })
  await writeFile(join(fixture.root, 'authoring/rights/original.json'), JSON.stringify({ subject: 'original fixture', consent: true }))
  return { ...fixture, bytes, sha256 }
}
