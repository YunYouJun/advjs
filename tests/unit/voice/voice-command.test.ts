// @vitest-environment node

import type { AdvConfig, AdvVoiceProvider } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runVoiceDoctor, runVoicePreview, runVoiceSetup } from '../../../packages/advjs/node/commands/voice'

const roots: string[] = []

async function writeProjectConfig(root: string): Promise<void> {
  await writeFile(join(root, 'adv.config.ts'), `export default {
    authoring: { voice: {
      provider: {
        id: 'root-selection-provider',
        doctor: async () => { throw new Error('Doctor must not run while listing') },
        setup: async () => { throw new Error('Setup must not run while listing') },
        preview: async () => { throw new Error('Preview must not run while listing') },
      },
      defaultPreset: 'reference',
      defaultReferenceMode: 'embedding-only',
      presets: { reference: 'voice/reference.json' },
    } },
  }\n`)
}

async function runCli(args: string[]): Promise<{ code: number | null, stdout: string, stderr: string }> {
  return await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      '--import',
      import.meta.resolve('tsx'),
      resolve(import.meta.dirname, '../../../packages/advjs/node/cli/index.ts'),
      ...args,
    ], { cwd: resolve(import.meta.dirname, '../..'), stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => stdout += chunk)
    child.stderr.on('data', chunk => stderr += chunk)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolveResult({ code, stdout, stderr })
    })
  })
}

async function project() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-voice-')))
  roots.push(root)
  await mkdir(join(root, 'adv/characters'), { recursive: true })
  await mkdir(join(root, 'adv/assets/audio'), { recursive: true })
  await mkdir(join(root, 'voice'), { recursive: true })
  await writeFile(join(root, 'adv/characters/speaker.character.md'), '---\nid: speaker\nname: Speaker\n---\n')
  const audio = Buffer.alloc(44 + 24_000 * 3 * 2)
  audio.write('RIFF', 0)
  audio.writeUInt32LE(audio.length - 8, 4)
  audio.write('WAVEfmt ', 8)
  audio.writeUInt32LE(16, 16)
  audio.writeUInt16LE(1, 20)
  audio.writeUInt16LE(1, 22)
  audio.writeUInt32LE(24_000, 24)
  audio.writeUInt32LE(48_000, 28)
  audio.writeUInt16LE(2, 32)
  audio.writeUInt16LE(16, 34)
  audio.write('data', 36)
  audio.writeUInt32LE(audio.length - 44, 40)
  const sha256 = createHash('sha256').update(audio).digest('hex')
  await writeFile(join(root, 'adv/assets/audio/reference.wav'), audio)
  const asset = {
    id: 'speaker-reference',
    kind: 'reference',
    type: 'audio',
    characterId: 'speaker',
    path: 'audio/reference.wav',
    sha256,
    bytes: audio.length,
  }
  const manifest = {
    schemaVersion: 2,
    id: 'voice-test',
    defaultProfile: 'local',
    profiles: { local: { provider: 'project', root: 'adv/assets' } },
    assets: [asset],
  }
  await writeFile(join(root, 'adv/assets.json'), JSON.stringify(manifest))
  const character = {
    id: 'speaker',
    name: 'Speaker',
    card: 'adv/characters/speaker.character.md',
    text: 'A representative line.',
    reference: { assetId: asset.id, sha256, text: 'An accurately transcribed reference.' },
  }
  const preset = { version: 'voices-v1', model: 'model', revision: 'pinned', characters: [character] }
  await writeFile(join(root, 'voice/reference.json'), JSON.stringify(preset))
  const { reference: _reference, ...designedCharacter } = character
  await writeFile(join(root, 'voice/design.json'), JSON.stringify({ ...preset, characters: [designedCharacter] }))
  const provider: AdvVoiceProvider = {
    id: 'test-provider',
    doctor: vi.fn(async () => ({
      provider: 'test-provider',
      supported: true,
      ready: false,
      environmentDirectory: join(root, '.voice'),
      modelCacheDirectory: join(root, '.voice/models'),
      checks: [{ id: 'runtime', status: 'warn', message: 'Setup is required.' }],
    })),
    setup: vi.fn(async () => ({ provider: 'test-provider', ready: true, environmentDirectory: join(root, '.voice') })),
    preview: vi.fn(async request => ({
      provider: 'test-provider',
      preset: request.preset,
      manifestPath: join(root, '.voice/manifest.json'),
      manifest: { status: 'candidate', generationMode: request.referenceMode ?? 'voice-design' },
    })),
  }
  const config: Partial<AdvConfig> = {
    authoring: {
      voice: {
        provider,
        defaultPreset: 'reference',
        defaultReferenceMode: 'embedding-only',
        presets: { reference: 'voice/reference.json', design: 'voice/design.json' },
      },
    },
  }
  return { root, config, provider, preset, character, manifest, asset }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('provider-neutral voice authoring commands', () => {
  it('lists reference candidates before assets or the synthesis environment are available', async () => {
    const fixture = await project()
    await rm(join(fixture.root, 'adv/assets.json'))
    await rm(join(fixture.root, 'adv/assets'), { recursive: true })
    const before = await readFile(join(fixture.root, 'voice/reference.json'), 'utf8')
    const result = await runVoicePreview({ root: fixture.root, config: fixture.config, list: true })
    expect(result).toMatchObject({
      provider: 'test-provider',
      preset: 'reference',
      referenceMode: 'embedding-only',
      seed: 42,
      characters: [{ id: 'speaker', text: fixture.character.text, referenceAssetId: 'speaker-reference' }],
    })
    expect(fixture.provider.doctor).not.toHaveBeenCalled()
    expect(fixture.provider.setup).not.toHaveBeenCalled()
    expect(fixture.provider.preview).not.toHaveBeenCalled()
    expect(await readFile(join(fixture.root, 'voice/reference.json'), 'utf8')).toBe(before)
  })

  it('loads --root configuration independently of the current working directory', async () => {
    const fixture = await project()
    await writeProjectConfig(fixture.root)
    await expect(runVoicePreview({ root: fixture.root, list: true })).resolves.toMatchObject({
      provider: 'root-selection-provider',
      preset: 'reference',
      referenceMode: 'embedding-only',
    })
  })

  it('emits one voice JSON envelope and classifies strict CLI failures under the voice subcommand', async () => {
    const fixture = await project()
    await writeProjectConfig(fixture.root)
    await rm(join(fixture.root, 'adv/assets.json'))
    const success = await runCli(['voice', 'preview', '--root', fixture.root, '--list', '--json'])
    expect(success.code, success.stderr).toBe(0)
    expect(success.stdout.trim().split('\n')).toHaveLength(1)
    expect(JSON.parse(success.stdout)).toMatchObject({
      command: 'voice.preview',
      ok: true,
      data: { provider: 'root-selection-provider', referenceMode: 'embedding-only' },
      warnings: [],
      errors: [],
    })
    const failure = await runCli(['voice', 'preview', '--root', fixture.root, '--list', '--unknown', '--json'])
    expect(failure.code).toBe(1)
    expect(failure.stdout.trim().split('\n')).toHaveLength(1)
    expect(JSON.parse(failure.stdout)).toMatchObject({ command: 'voice.preview', ok: false, errors: [{ code: 'ADV_USAGE' }] })
  }, 20_000)

  it('emits correctly named envelopes for new read-only actions and strict selection failures', async () => {
    const fixture = await project()
    await writeProjectConfig(fixture.root)
    for (const action of ['providers', 'samples']) {
      const success = await runCli(['voice', action, '--root', fixture.root, '--json'])
      expect(success.code, success.stderr).toBe(0)
      expect(success.stdout.trim().split('\n')).toHaveLength(1)
      expect(JSON.parse(success.stdout)).toMatchObject({ command: `voice.${action}`, ok: true })
    }
    for (const action of ['providers', 'samples', 'select']) {
      const failure = await runCli(['voice', action, '--root', fixture.root, '--unknown', '--json'])
      expect(failure.code).toBe(1)
      expect(failure.stdout.trim().split('\n')).toHaveLength(1)
      expect(JSON.parse(failure.stdout)).toMatchObject({ command: `voice.${action}`, ok: false, errors: [{ code: 'ADV_USAGE' }] })
    }
  }, 30_000)

  it('supports generic presets without project character cards or display names', async () => {
    const fixture = await project()
    const { card: _card, name: _name, ...character } = fixture.character
    await writeFile(join(fixture.root, 'voice/reference.json'), JSON.stringify({ ...fixture.preset, characters: [character] }))
    await rm(join(fixture.root, fixture.character.card))
    const result = await runVoicePreview({ root: fixture.root, config: fixture.config, list: true })
    expect(result).toMatchObject({ characters: [{ id: 'speaker', name: 'speaker', text: fixture.character.text }] })
    expect('characters' in result && result.characters[0]).not.toHaveProperty('card')
  })

  it('passes project defaults and explicit overrides through the generic provider request', async () => {
    const fixture = await project()
    const signal = new AbortController().signal
    const onProgress = vi.fn()
    await runVoicePreview({ root: fixture.root, config: fixture.config, signal, onProgress, offline: true })
    expect(fixture.provider.preview).toHaveBeenLastCalledWith({
      root: fixture.root,
      configPath: join(fixture.root, 'voice/reference.json'),
      assetManifestPath: join(fixture.root, 'adv/assets.json'),
      preset: 'reference',
      character: undefined,
      text: undefined,
      seed: 42,
      referenceMode: 'embedding-only',
      offline: true,
      signal,
      onProgress,
    })
    await runVoicePreview({ root: fixture.root, config: fixture.config, referenceMode: 'icl', character: 'speaker', text: 'A new line.', seed: 7 })
    expect(fixture.provider.preview).toHaveBeenLastCalledWith(expect.objectContaining({
      referenceMode: 'icl',
      character: 'speaker',
      text: 'A new line.',
      seed: 7,
    }))
  })

  it('ignores the reference default for a voice design preset and refuses an explicit reference mode', async () => {
    const fixture = await project()
    const result = await runVoicePreview({ root: fixture.root, config: fixture.config, preset: 'design', list: true })
    expect(result).toMatchObject({ preset: 'design', referenceMode: undefined })
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config, preset: 'design', referenceMode: 'icl', list: true }))
      .rejects
      .toMatchObject({ code: 'ADV_USAGE', message: '--reference-mode requires a reference voice preset' })
    expect(fixture.provider.preview).not.toHaveBeenCalled()
  })

  it('selects one mode from a mixed preset while rejecting a mixed preview batch', async () => {
    const fixture = await project()
    const { reference: _reference, ...designed } = fixture.character
    await writeFile(join(fixture.root, 'voice/reference.json'), JSON.stringify({
      ...fixture.preset,
      characters: [fixture.character, { ...designed, id: 'designed', description: 'A warm voice' }],
    }))
    const base = { root: fixture.root, config: fixture.config }
    await expect(runVoicePreview(base)).rejects.toMatchObject({
      code: 'ADV_VALIDATION',
      message: 'A voice preview batch must use one generation mode; select a character with --character',
    })
    expect(fixture.provider.preview).not.toHaveBeenCalled()
    await runVoicePreview({ ...base, character: 'speaker' })
    expect(fixture.provider.preview).toHaveBeenLastCalledWith(expect.objectContaining({
      character: 'speaker',
      referenceMode: 'embedding-only',
      assetManifestPath: join(fixture.root, 'adv/assets.json'),
    }))
    await rm(join(fixture.root, 'adv/assets.json'))
    await runVoicePreview({ ...base, character: 'designed' })
    const designRequest = vi.mocked(fixture.provider.preview).mock.lastCall![0]
    expect(designRequest).toMatchObject({ character: 'designed', referenceMode: undefined })
    expect(designRequest).not.toHaveProperty('assetManifestPath')
    await expect(runVoicePreview({ ...base, character: 'designed', referenceMode: 'embedding-only', list: true }))
      .rejects
      .toMatchObject({ code: 'ADV_USAGE', message: '--reference-mode requires a reference voice preset' })
    expect(fixture.provider.preview).toHaveBeenCalledTimes(2)
  })

  it('validates target overrides, characters and seeds before invoking any provider method', async () => {
    const fixture = await project()
    const base = { root: fixture.root, config: fixture.config, list: true }
    await expect(runVoicePreview({ ...base, text: 'A new line.' })).rejects.toMatchObject({ code: 'ADV_USAGE' })
    await expect(runVoicePreview({ ...base, character: 'unknown' })).rejects.toMatchObject({ code: 'ADV_USAGE' })
    await expect(runVoicePreview({ ...base, character: 'speaker', text: ' ' })).rejects.toMatchObject({ code: 'ADV_VALIDATION' })
    await expect(runVoicePreview({ ...base, character: 'speaker', text: 'x'.repeat(501) })).rejects.toMatchObject({ code: 'ADV_VALIDATION' })
    for (const seed of [-1, 1.5, 0x1_0000_0000])
      await expect(runVoicePreview({ ...base, seed })).rejects.toMatchObject({ code: 'ADV_USAGE' })
    expect(fixture.provider.preview).not.toHaveBeenCalled()
  })

  it('requires the transcript only for ICL and accepts embedding-only without a transcript', async () => {
    const fixture = await project()
    await writeFile(join(fixture.root, 'voice/reference.json'), JSON.stringify({
      ...fixture.preset,
      characters: [{ ...fixture.character, reference: { ...fixture.character.reference, text: '' } }],
    }))
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config, referenceMode: 'icl', list: true }))
      .rejects
      .toMatchObject({ code: 'ADV_VALIDATION', message: 'ICL requires a reference transcription for speaker' })
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config, list: true })).resolves.toMatchObject({ referenceMode: 'embedding-only' })
  })

  it('rejects missing references, wrong character ownership and corrupt cached audio before synthesis', async () => {
    const fixture = await project()
    const base = { root: fixture.root, config: fixture.config }
    await writeFile(join(fixture.root, 'adv/assets.json'), JSON.stringify({ ...fixture.manifest, assets: [{ ...fixture.asset, characterId: 'different' }] }))
    await expect(runVoicePreview(base)).rejects.toThrow('belongs to a different character')
    await writeFile(join(fixture.root, 'adv/assets.json'), JSON.stringify(fixture.manifest))
    await writeFile(join(fixture.root, 'adv/assets/audio/reference.wav'), 'corrupt')
    await expect(runVoicePreview(base)).rejects.toThrow('checksum mismatch')
    await rm(join(fixture.root, 'adv/assets/audio/reference.wav'))
    await expect(runVoicePreview(base)).rejects.toThrow('prepare the project asset cache')
    expect(fixture.provider.preview).not.toHaveBeenCalled()
  })

  it('resolves references from native split asset manifests', async () => {
    const fixture = await project()
    await writeFile(join(fixture.root, 'adv/assets/audio.json'), JSON.stringify({ schemaVersion: 2, assets: [fixture.asset] }))
    const { assets: _assets, ...manifestBase } = fixture.manifest
    await writeFile(join(fixture.root, 'adv/assets.json'), JSON.stringify({ ...manifestBase, includes: ['assets/audio.json'] }))
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config })).resolves.toMatchObject({ provider: 'test-provider' })
    expect(fixture.provider.preview).toHaveBeenCalledOnce()
  })

  it('rejects escaping preset, card and cached reference symbolic links', async () => {
    const fixture = await project()
    const outside = await mkdtemp(join(tmpdir(), 'advjs-voice-outside-'))
    roots.push(outside)
    await writeFile(join(outside, 'preset.json'), JSON.stringify(fixture.preset))
    await symlink(join(outside, 'preset.json'), join(fixture.root, 'voice/escape.json'))
    fixture.config.authoring!.voice!.presets.escape = 'voice/escape.json'
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config, preset: 'escape', list: true }))
      .rejects
      .toThrow('resolves outside the project root')
    await rm(join(fixture.root, fixture.character.card))
    await symlink(join(outside, 'preset.json'), join(fixture.root, fixture.character.card))
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config, list: true }))
      .rejects
      .toThrow('resolves outside the project root')
    await rm(join(fixture.root, fixture.character.card))
    await writeFile(join(fixture.root, fixture.character.card), '# Speaker')
    await rm(join(fixture.root, 'adv/assets/audio/reference.wav'))
    await symlink(join(outside, 'preset.json'), join(fixture.root, 'adv/assets/audio/reference.wav'))
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config })).rejects.toThrow('resolves outside the project root')
    expect(fixture.provider.preview).not.toHaveBeenCalled()
  })

  it('rejects invalid provider configuration and forwards provider failures without reporting success', async () => {
    const fixture = await project()
    await expect(runVoiceDoctor({ root: fixture.root, config: { authoring: {} } })).rejects.toMatchObject({ code: 'ADV_VALIDATION' })
    const voice = fixture.config.authoring!.voice!
    const badConfig = { authoring: { voice: { ...voice, provider: 'unknown' } } } as unknown as Partial<AdvConfig>
    await expect(runVoiceDoctor({ root: fixture.root, config: badConfig })).rejects.toThrow('installed provider object')
    vi.mocked(fixture.provider.preview).mockRejectedValueOnce(new Error('Provider subprocess failed'))
    await expect(runVoicePreview({ root: fixture.root, config: fixture.config })).rejects.toThrow('Provider subprocess failed')
  })

  it('keeps doctor read-only and delegates setup only when explicitly requested', async () => {
    const fixture = await project()
    await expect(runVoiceDoctor({ root: fixture.root, config: fixture.config })).resolves.toMatchObject({ ready: false })
    expect(fixture.provider.doctor).toHaveBeenCalledOnce()
    expect(fixture.provider.setup).not.toHaveBeenCalled()
    expect(fixture.provider.preview).not.toHaveBeenCalled()
    await expect(runVoiceSetup({ root: fixture.root, config: fixture.config })).resolves.toMatchObject({ ready: true })
    expect(fixture.provider.setup).toHaveBeenCalledOnce()
  })
})
