import type { AdvConfig, AdvVoiceSynthesisProvider, AdvVoiceSynthesisRequest } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const editorJobLineIds = [1, 2].map(index => `line_019d137e-7abc-7000-8000-00000000000${index}`)

function wavBytes() {
  const dataSize = 4800
  const bytes = Buffer.alloc(44 + dataSize)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(36 + dataSize, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(24000, 24)
  bytes.writeUInt32LE(48000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(dataSize, 40)
  return bytes
}

/** Real registry adapter for host/UI tests. It never invokes a model or a network. */
export async function createEditorVoiceJobsFixture() {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'advjs-editor-voice-jobs-')))
  const root = join(directory, 'project')
  const publicRoot = join(directory, 'editor-public')
  const storeDirectory = join(directory, 'application-data')
  const profile = { intent: {}, locales: { 'zh-CN': { providers: { 'fixture-tts': { voiceId: 'system:fixture', model: 'fixture-model', source: 'system' } } } } }
  const files: Record<string, string> = {
    'adv.config.json': JSON.stringify({ id: 'editor-jobs', format: 'adv-md', root: './adv' }),
    'adv/settings/game.json': JSON.stringify({ title: '配音任务验收', characters: [{ id: 'hero', name: 'Hero', voiceProfile: profile }] }),
    'adv/chapters/intro.adv.md': `@Hero\n你好，世界。 {#${editorJobLineIds[0]}}\n\n（故事开始了。） {#${editorJobLineIds[1]}}`,
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'editor-jobs-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }),
    'adv/audio/voice-profiles.json': JSON.stringify({ schemaVersion: 1, revision: 1, narrator: profile }),
    'preset.json': JSON.stringify({ model: 'fixture-model', voiceId: 'system:fixture' }),
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), content)
  }
  await mkdir(join(root, 'public/media'), { recursive: true })
  await mkdir(publicRoot, { recursive: true })
  await writeFile(join(publicRoot, 'index.html'), '<main>Editor fixture</main>')
  const calls: AdvVoiceSynthesisRequest[] = []
  let beforeSynthesis: ((request: AdvVoiceSynthesisRequest) => Promise<void>) | undefined
  const bytes = wavBytes()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const provider: AdvVoiceSynthesisProvider = {
    id: 'fixture-tts',
    capabilities: { backend: 'local', synthesis: true, voiceCreation: false, offline: true, models: [{ id: 'fixture-model', modes: ['system'], formats: ['audio/wav'], streaming: false }] },
    async inspectPreset(request) {
      const presetBytes = await readFile(request.configPath)
      const preset = JSON.parse(presetBytes.toString())
      return { presetSha256: createHash('sha256').update(presetBytes).digest('hex'), characters: [{ id: request.character ?? 'hero', name: request.character ?? 'Hero', text: request.text ?? '你好，世界。', generation: { model: preset.model, providerVoiceId: preset.voiceId, source: 'system', mimeType: 'audio/wav', parameters: { fixture: true } } }] }
    },
    async synthesize(request) {
      calls.push(request)
      await beforeSynthesis?.(request)
      request.signal?.throwIfAborted()
      const path = `temporary/candidate-${calls.length}.wav`
      await mkdir(join(root, 'temporary'), { recursive: true })
      await writeFile(join(root, path), bytes)
      return { provider: provider.id, preset: request.preset, manifestPath: 'temporary/manifest.json', manifest: {}, candidates: [{ id: `candidate-${calls.length}`, provider: provider.id, characterId: request.character ?? 'hero', text: request.text ?? '', path, sha256, bytes: bytes.length, mimeType: 'audio/wav', durationSeconds: 0.1, sampleRate: 24000, model: 'fixture-model', providerVoiceId: 'system:fixture' }] }
    },
  }
  const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider], defaultProvider: provider.id, defaultPreset: 'fixture', presets: { fixture: 'preset.json' } } } }
  return { directory, root, publicRoot, storeDirectory, config, calls, provider, profile, bytes, sha256, setBeforeSynthesis(operation?: typeof beforeSynthesis) {
    beforeSynthesis = operation
  } }
}
