// @vitest-environment node

import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultRealQwenRoot, initializeRealQwenProject, inspectRealQwenWav, parseRealQwenArgs, prepareRealQwen, REAL_QWEN_MODELS } from '../../../scripts/prepare-real-qwen.mjs'

describe('explicit real Qwen preparation', () => {
  let root: string
  afterEach(async () => {
    if (root)
      await rm(root, { recursive: true, force: true })
  })

  it('requires opt-in before any provider import, filesystem write or setup', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'advjs-qwen-gate-'))
    const destination = resolve(root, 'uncreated')
    await expect(prepareRealQwen({ root: destination, env: {} })).rejects.toThrow('REAL_QWEN_OPT_IN_REQUIRED')
    await expect(stat(destination)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(parseRealQwenArgs([], {}).action).toBe('help')
    expect(parseRealQwenArgs([], { ADVJS_REAL_QWEN: '1' }).action).toBe('prepare')
    expect(parseRealQwenArgs(['prepare'], {}).explicit).toBe(true)
    expect(parseRealQwenArgs(['doctor'], { ADVJS_REAL_QWEN: '1' }).action).toBe('doctor')
  })

  it('doctor/list remain read-only and never invoke setup or synthesis', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'advjs-qwen-readonly-'))
    const destination = resolve(root, 'uncreated')
    const runtime = { provider: { id: 'qwen-tts' }, runVoiceDoctor: vi.fn(async () => ({ ready: false })), runVoicePreview: vi.fn(async () => ({ characters: [] })), runVoiceSetup: vi.fn() }
    await prepareRealQwen({ action: 'doctor', root: destination, runtime })
    await prepareRealQwen({ action: 'list', root: destination, runtime })
    expect(runtime.runVoicePreview).toHaveBeenCalledWith(expect.objectContaining({ list: true }))
    expect(runtime.runVoiceSetup).not.toHaveBeenCalled()
    await expect(stat(destination)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses to initialize an existing user game and preserves its exact bytes', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'advjs-qwen-owned-'))
    const config = resolve(root, 'adv.config.json')
    const source = '{ "id": "user-game", "root": "adv" }\n'
    await writeFile(config, source)
    await expect(initializeRealQwenProject(root)).rejects.toThrow('REAL_QWEN_EXISTING_PROJECT_REFUSED')
    expect(await readFile(config, 'utf8')).toBe(source)
    await expect(stat(resolve(root, '.advjs'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('uses the OS cache and env root while a CLI root takes precedence', () => {
    expect(defaultRealQwenRoot({}, 'darwin', '/example/home')).toBe('/example/home/Library/Caches/ADV.JS/real-qwen-20261011')
    expect(defaultRealQwenRoot({ ADVJS_REAL_QWEN_ROOT: '/example/custom' }, 'darwin', '/example/home')).toBe('/example/custom')
    expect(parseRealQwenArgs(['prepare', '--root', '/example/cli'], { ADVJS_REAL_QWEN_ROOT: '/example/custom' }).root).toBe('/example/cli')
    for (const item of Object.values(REAL_QWEN_MODELS)) {
      expect(item.revision).toMatch(/^[a-f0-9]{40}$/u)
      expect(Object.keys(item.weightSha256).sort()).toEqual(['model.safetensors', 'speech_tokenizer/model.safetensors'])
      expect(Object.values(item.weightSha256).every(value => /^[a-f0-9]{64}$/u.test(value))).toBe(true)
    }
  })

  it('preserves later author edits when revisiting the marked acceptance project', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'advjs-qwen-resume-'))
    await initializeRealQwenProject(root)
    const path = resolve(root, 'adv/settings/game.json')
    const edited = '{"id":"edited-acceptance","characters":[],"future":"keep"}\n'
    await writeFile(path, edited)
    await initializeRealQwenProject(root)
    expect(await readFile(path, 'utf8')).toBe(edited)
  })

  it('rejects an external symlink into the repository after canonicalizing the root', async () => {
    root = await mkdtemp(resolve(tmpdir(), 'advjs-qwen-symlink-'))
    const alias = resolve(root, 'workspace')
    await symlink(resolve(import.meta.dirname, '../../..'), alias, 'dir')
    await expect(initializeRealQwenProject(alias)).rejects.toThrow('REAL_QWEN_DEDICATED_PROJECT_REQUIRED')
  })

  it('verifies real PCM amplitude and rejects silent or malformed candidate media', () => {
    const wav = Buffer.alloc(44 + 48000)
    wav.write('RIFF', 0)
    wav.writeUInt32LE(wav.length - 8, 4)
    wav.write('WAVEfmt ', 8)
    wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(24000, 24)
    wav.writeUInt16LE(16, 34)
    wav.write('data', 36)
    wav.writeUInt32LE(48000, 40)
    expect(() => inspectRealQwenWav(wav)).toThrow('REAL_QWEN_WAV_SILENT')
    for (let offset = 44; offset < wav.length; offset += 2)
      wav.writeInt16LE(3277, offset)
    expect(inspectRealQwenWav(wav)).toMatchObject({ sampleRate: 24000, durationSeconds: 1, rms: expect.closeTo(0.1, 3) })
    expect(() => inspectRealQwenWav(wav.subarray(0, 100))).toThrow('REAL_QWEN_WAV_INVALID')
  })
})
