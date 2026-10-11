import type { AdvVoiceCandidate, AdvVoiceSynthesisProvider, AdvVoiceSynthesisRequest, JsonObject } from '@advjs/types'
import type { SpeechCreateParams } from 'openai/resources/audio/speech'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import process from 'node:process'
import OpenAI from 'openai'
import { dirname, isAbsolute, relative, resolve } from 'pathe'

const providerId = 'openai-tts'
const models = ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-hd']
const voices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar']
const sampleRate = 24_000
const maxSampleBytes = 20 * 1024 * 1024

/** Injection seam for contract tests and trusted server-owned SDK clients. */
export interface OpenAiTtsClient {
  audio: { speech: { create: (body: SpeechCreateParams, options: { signal?: AbortSignal, maxRetries: number }) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }> } }
}

function object(value: unknown, allowed: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be a JSON object`)
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      throw new Error(`${label} contains an unsupported field`)
  }
  return value as Record<string, unknown>
}

function nonempty(value: unknown, label: string, maximum?: number): string {
  if (typeof value !== 'string' || !value.trim() || (maximum && Array.from(value).length > maximum))
    throw new Error(`${label} must be nonempty${maximum ? ` and at most ${maximum} characters` : ''}`)
  return value
}

function within(root: string, path: string): boolean {
  const name = relative(root, path)
  return name === '' || (!isAbsolute(name) && name !== '..' && !name.startsWith('../'))
}

async function projectFile(root: string, path: string): Promise<string> {
  const file = await realpath(resolve(root, path))
  if (!within(root, file))
    throw new Error('OpenAI voice input resolves outside the project')
  return file
}

async function outputDirectory(root: string): Promise<string> {
  const target = resolve(root, '.advjs/voice/previews/openai')
  // Check existing ancestors before mkdir can follow a project symlink.
  let ancestor = target
  for (;;) {
    try {
      if (!within(root, await realpath(ancestor)))
        throw new Error('OpenAI voice output resolves outside the project')
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
      ancestor = dirname(ancestor)
    }
  }
  await mkdir(target, { recursive: true })
  const canonical = await realpath(target)
  if (!within(root, canonical))
    throw new Error('OpenAI voice output resolves outside the project')
  return canonical
}

async function preset(request: AdvVoiceSynthesisRequest) {
  request.signal?.throwIfAborted()
  if (request.offline)
    throw new Error('OpenAI TTS does not support offline synthesis')
  if (request.seed !== undefined || request.referenceMode !== undefined)
    throw new Error('OpenAI TTS does not support seed or reference-mode options')
  if (request.text !== undefined && !request.character)
    throw new Error('A text override requires one character')
  const root = await realpath(request.root)
  const configPath = await projectFile(root, request.configPath)
  const source = await readFile(configPath, 'utf8')
  let value: unknown
  try {
    value = JSON.parse(source)
  }
  catch {
    throw new Error('OpenAI voice preset must contain valid JSON')
  }
  const config = object(value, ['schemaVersion', 'model', 'instructions', 'speed', 'characters'], 'OpenAI voice preset')
  if (config.schemaVersion !== 1 || typeof config.model !== 'string' || !models.includes(config.model))
    throw new Error('OpenAI voice preset requires schemaVersion 1 and a supported model')
  if (!Array.isArray(config.characters) || !config.characters.length)
    throw new Error('OpenAI voice preset requires characters')
  const ids = new Set<string>()
  const characters = config.characters.map((value) => {
    const item = object(value, ['id', 'name', 'card', 'text', 'voice', 'speed', 'instructions'], 'OpenAI voice character')
    const id = nonempty(item.id, 'Character ID')
    if (!/^[a-z0-9][\w-]*$/iu.test(id) || ids.has(id))
      throw new Error('OpenAI voice character IDs must be unique safe identifiers')
    ids.add(id)
    const voice = nonempty(item.voice, 'Built-in voice')
    if (!voices.includes(voice))
      throw new Error('OpenAI TTS requires a supported built-in voice; custom voices are not enabled')
    const speed = item.speed ?? config.speed ?? 1
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.25 || speed > 4)
      throw new Error('OpenAI TTS speed must be between 0.25 and 4')
    const instructions = item.instructions ?? config.instructions
    if (instructions !== undefined) {
      nonempty(instructions, 'Voice instructions', 4096)
      if (config.model === 'tts-1' || config.model === 'tts-1-hd')
        throw new Error('Voice instructions are unsupported by tts-1 and tts-1-hd')
    }
    return {
      id,
      name: item.name === undefined ? id : nonempty(item.name, 'Character name'),
      text: nonempty(request.character === id ? request.text ?? item.text : item.text, 'Target text', 4096),
      voice,
      speed,
      ...(item.card === undefined ? {} : { card: nonempty(item.card, 'Character card') }),
      ...(instructions === undefined ? {} : { instructions: instructions as string }),
    }
  }).filter(item => !request.character || item.id === request.character)
  if (!characters.length)
    throw new Error('Unknown OpenAI voice character')
  for (const character of characters) {
    if (character.card)
      await projectFile(root, character.card)
  }
  request.signal?.throwIfAborted()
  return { root, configPath, source, model: config.model, characters }
}

/** Wrap the API's 24kHz mono signed 16-bit PCM in a lossless WAV container. */
function wave(pcm: Buffer): Buffer {
  if (!pcm.length || pcm.length % 2 || pcm.length + 44 > maxSampleBytes)
    throw new Error('OpenAI TTS returned empty, incomplete, or oversized PCM audio')
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(pcm.length + 36, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/** Node-only cloud adapter. Importing and inspecting it never require a key. */
export function createOpenAiTtsProvider(options: { client?: OpenAiTtsClient } = {}): AdvVoiceSynthesisProvider {
  let client = options.client
  return {
    id: providerId,
    capabilities: {
      backend: 'cloud',
      synthesis: true,
      voiceCreation: false,
      offline: false,
      designSources: ['system'],
      models: models.map(id => ({ id, modes: ['built-in'], maxTextCharacters: 4096, formats: ['audio/wav'], streaming: false })),
    },
    async listVoices() { return voices.map(id => ({ id, label: id })) },
    async buildDesignPreset({ template, characterId, text, definition }) {
      if (definition.source !== 'system' || !definition.providerVoiceId || !voices.includes(definition.providerVoiceId) || typeof template.model !== 'string' || !models.includes(template.model))
        throw new Error('VOICE_DESIGN_SOURCE_UNSUPPORTED')
      return { ...template, characters: [{ id: characterId, text, voice: definition.providerVoiceId }] }
    },
    async doctor(context) {
      context.signal?.throwIfAborted()
      const configured = Boolean(client || process.env.OPENAI_API_KEY)
      return { provider: providerId, supported: true, ready: false, checks: [
        { id: 'credentials', status: configured ? 'pass' : 'fail', message: configured ? 'A server-owned client or OPENAI_API_KEY is configured' : 'Set OPENAI_API_KEY in the local process or trusted server' },
        { id: 'connectivity', status: 'warn', message: 'Read-only diagnosis does not verify network access, account permissions, or quota' },
      ] }
    },
    async inspectPreset(request) {
      const input = await preset(request)
      return { presetSha256: createHash('sha256').update(input.source).digest('hex'), characters: input.characters.map(({ id, name, text, card, voice, speed }) => ({ id, name, text, ...(card ? { card } : {}), generation: { model: input.model, providerVoiceId: voice, source: 'system' as const, mimeType: 'audio/wav', parameters: { speed } } })) }
    },
    async synthesize(request) {
      const input = await preset(request)
      const base = await outputDirectory(input.root)
      const runId = randomUUID()
      const directory = resolve(base, runId)
      await mkdir(directory)
      const candidates: AdvVoiceCandidate[] = []
      try {
        client ??= new OpenAI({ maxRetries: 0 })
        for (const character of input.characters) {
          request.signal?.throwIfAborted()
          if (await readFile(input.configPath, 'utf8') !== input.source)
            throw new Error('VOICE_CONFLICT: The OpenAI preset changed during synthesis')
          let pcm: Buffer
          try {
            const response = await client.audio.speech.create({
              model: input.model,
              voice: character.voice,
              input: character.text,
              speed: character.speed,
              response_format: 'pcm',
              ...(character.instructions ? { instructions: character.instructions } : {}),
            }, { signal: request.signal, maxRetries: 0 })
            pcm = Buffer.from(await response.arrayBuffer())
          }
          catch {
            request.signal?.throwIfAborted()
            throw new Error('OpenAI TTS request failed; no automatic retry was attempted. Check credentials, quota, and connectivity before retrying')
          }
          request.signal?.throwIfAborted()
          const bytes = wave(pcm)
          const file = resolve(directory, `${character.id}.wav`)
          await writeFile(file, bytes, { flag: 'wx' })
          candidates.push({
            id: `${runId}:${character.id}`,
            characterId: character.id,
            text: character.text,
            path: relative(input.root, file),
            sha256: createHash('sha256').update(bytes).digest('hex'),
            bytes: bytes.length,
            mimeType: 'audio/wav',
            durationSeconds: pcm.length / (sampleRate * 2),
            sampleRate,
            provider: providerId,
            model: input.model,
            providerVoiceId: character.voice,
            ...(request.voiceId ? { voiceId: request.voiceId } : {}),
            ...(request.voiceVersion ? { voiceVersion: request.voiceVersion } : {}),
          })
        }
        request.signal?.throwIfAborted()
        if (await readFile(input.configPath, 'utf8') !== input.source)
          throw new Error('VOICE_CONFLICT: The OpenAI preset changed during synthesis')
        const manifest: JsonObject = {
          schemaVersion: 1,
          provider: providerId,
          preset: request.preset,
          model: input.model,
          presetSha256: createHash('sha256').update(input.source).digest('hex'),
          createdAt: new Date().toISOString(),
          inputs: input.characters.map(({ id, text, voice, speed, instructions }) => ({
            characterId: id,
            text,
            providerVoiceId: voice,
            speed,
            ...(instructions ? { instructions } : {}),
          })),
          state: 'candidate',
          samples: candidates.map(candidate => ({ ...candidate })),
        }
        const manifestPath = resolve(directory, 'manifest.json')
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
        request.signal?.throwIfAborted()
        return { provider: providerId, preset: request.preset, manifestPath: relative(input.root, manifestPath), manifest, candidates }
      }
      catch (error) {
        await rm(directory, { recursive: true, force: true })
        throw error
      }
    },
  }
}
