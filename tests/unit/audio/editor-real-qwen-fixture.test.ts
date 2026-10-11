// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REAL_QWEN_MODELS, REAL_QWEN_PRESETS, REAL_QWEN_RECEIPT } from '../../../scripts/prepare-real-qwen.mjs'
import { assertRealQwenPreparedProject, realQwenLineId, resetEditorRealQwenScope } from '../../fixtures/audio/editor-real-qwen'

const root = '/dedicated/real-qwen'
const marker = { schemaVersion: 1, kind: 'advjs-real-qwen-acceptance', root }
const receipt = { ...marker, status: 'ready', providerId: 'qwen-tts', doctor: { ready: true }, models: REAL_QWEN_MODELS, presetsMap: REAL_QWEN_PRESETS }

describe('opt-in real Qwen fixture ownership guard', () => {
  it('accepts only the prepared dedicated project and the exact pinned models', () => {
    expect(() => assertRealQwenPreparedProject(root, marker, receipt)).not.toThrow()
  })

  it('refuses a ready unrelated game before its finite native sources can be replaced', () => {
    expect(() => assertRealQwenPreparedProject(root, undefined, receipt)).toThrow('REAL_QWEN_DEDICATED_PREPARED_PROJECT_REQUIRED')
    expect(() => assertRealQwenPreparedProject('/a/real/game', marker, receipt)).toThrow('REAL_QWEN_DEDICATED_PREPARED_PROJECT_REQUIRED')
    expect(() => assertRealQwenPreparedProject(root, marker, { ...receipt, status: 'running' })).toThrow('REAL_QWEN_DEDICATED_PREPARED_PROJECT_REQUIRED')
  })

  it('refuses changed model bytes, a moved preset and receipt roots', () => {
    const models = JSON.parse(JSON.stringify(REAL_QWEN_MODELS))
    models.base.weightSha256['model.safetensors'] = 'a'.repeat(64)
    for (const changed of [{ ...receipt, models }, { ...receipt, presetsMap: { ...REAL_QWEN_PRESETS, base: 'unreviewed.json' } }, { ...receipt, root: '/another/project' }])
      expect(() => assertRealQwenPreparedProject(root, marker, changed)).toThrow('REAL_QWEN_DEDICATED_PREPARED_PROJECT_REQUIRED')
  })

  it('backs up real prior bytes and resets only its own scope across repeated runs', async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'advjs-real-qwen-reset-')))
    const project = join(directory, 'project')
    const master = new TextEncoder().encode('Prior immutable generated media bytes')
    const sha256 = createHash('sha256').update(master).digest('hex')
    const studioLine = 'line_019d137e-7abc-7000-8000-00000000f001'
    const assetId = 'audio_019d137e-7abc-7000-8000-00000000e001'
    const takeId = 'take_019d137e-7abc-7000-8000-00000000e001'
    const line = { speakerId: 'hero', displayText: '旧对白', locales: { 'zh-CN': { selectedTake: takeId, takes: [{ id: takeId, assetId, sha256, providerId: 'qwen-tts', voiceId: 'design:old', model: REAL_QWEN_MODELS.design.model, voiceProfileRevision: sha256, inputFingerprint: sha256, spokenText: '旧对白', source: 'designed', createdAt: '2026-10-11T08:00:00.000Z' }] } } }
    const studio = { speakerId: 'hero', displayText: 'Studio 对白', locales: { 'zh-CN': { selectedTake: null, takes: [] } } }
    const voice = (id: string) => ({ id, version: '1', characterId: 'hero', label: 'Prior voice', implementations: {} })
    const files: Record<string, string> = {
      '.advjs/voice/real-qwen-project.json': JSON.stringify({ ...marker, root: project }),
      [REAL_QWEN_RECEIPT]: JSON.stringify({ ...receipt, root: project }),
      '.advjs/voice/huggingface/model.safetensors': 'untouched prepared model',
      '.advjs/voice/.venv/runtime': 'untouched prepared environment',
      [REAL_QWEN_PRESETS.design]: 'untouched operator preset',
      'adv/chapters/editor-real-ending.chapter.json': '{"schemaVersion":1,"id":"editor-real-ending","nodes":[]}',
      'adv/chapters/studio-real-ending.chapter.json': 'untouched Studio chapter',
      'adv/audio/voice-ledger.json': JSON.stringify({ schemaVersion: 1, lines: { [realQwenLineId]: line, [studioLine]: studio } }),
      'authoring/voices/library.json': JSON.stringify({ schemaVersion: 1, voices: [voice('editor-real-designed-123'), voice('studio-real-designed-123')], authorMetadata: 'preserved' }),
      'authoring/voices/designs/editor-real-designed-123/1/zh-CN/qwen-tts.json': '{"old":"immutable design input"}',
      'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'reset-test', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, includes: ['assets/audio.json'] }),
      'adv/assets/audio.json': JSON.stringify({ schemaVersion: 2, assets: [{ id: assetId, type: 'audio', kind: 'voice', path: 'old.wav', sha256, bytes: master.length }] }),
    }
    try {
      for (const [path, content] of Object.entries(files)) {
        await mkdir(join(project, path, '..'), { recursive: true })
        await writeFile(join(project, path), content)
      }
      await mkdir(join(project, 'public/media'), { recursive: true })
      await writeFile(join(project, 'public/media/old.wav'), master)
      for (const run of [1, 2]) {
        await resetEditorRealQwenScope(project, join(directory, `backup-${run}`))
        const ledger = JSON.parse(await readFile(join(project, 'adv/audio/voice-ledger.json'), 'utf8'))
        expect(ledger.lines[realQwenLineId]).toBeUndefined()
        expect(ledger.lines[studioLine]).toEqual(studio)
        const library = JSON.parse(await readFile(join(project, 'authoring/voices/library.json'), 'utf8'))
        expect(library.voices.map((entry: any) => entry.id)).toEqual(['studio-real-designed-123'])
        expect(library.authorMetadata).toBe('preserved')
        for (const path of ['.advjs/voice/huggingface/model.safetensors', '.advjs/voice/.venv/runtime', REAL_QWEN_PRESETS.design, 'adv/chapters/studio-real-ending.chapter.json', 'adv/assets.json', 'adv/assets/audio.json'])
          expect(await readFile(join(project, path), 'utf8')).toBe(files[path])
        expect(new Uint8Array(await readFile(join(project, 'public/media/old.wav')))).toEqual(master)
      }
      expect(new Uint8Array(await readFile(join(directory, 'backup-1/public/media/old.wav')))).toEqual(master)
      expect(await readFile(join(directory, 'backup-1/adv/audio/voice-ledger.json'), 'utf8')).toBe(files['adv/audio/voice-ledger.json'])
      expect(await readFile(join(directory, 'backup-1/authoring/voices/designs/editor-real-designed-123/1/zh-CN/qwen-tts.json'), 'utf8')).toBe(files['authoring/voices/designs/editor-real-designed-123/1/zh-CN/qwen-tts.json'])
      await expect(stat(join(project, 'adv/chapters/editor-real-ending.chapter.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
