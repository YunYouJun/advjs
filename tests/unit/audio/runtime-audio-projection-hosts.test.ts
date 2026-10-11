// @vitest-environment node

import type { AdvGameAudioConfig, AdvProjectFileMap, VoiceLedger, VoiceTake } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveBrowserPreviewConfig } from '../../../editor/core/app/adapters/browser/preview'
import { createEditorProjectModel } from '../../../editor/core/app/adapters/browser/project'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { loadProjectAudioConfig } from '../../../packages/advjs/node/config/audio'
import { loadProject } from '../../../packages/advjs/node/project'
import { compileProject, createProjectGameConfig } from '../../../packages/core/src/project'

const roots: string[] = []
const uuid = (index: number) => `019d137e-7abc-7000-8000-${String(index).padStart(12, '0')}`
const voiceId = (index: number) => `audio_${uuid(index)}`
const firstLine = `line_${uuid(1)}`
const inactiveLine = `line_${uuid(2)}`
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

async function fixture(withVariants = false) {
  const root = await mkdtemp(join(tmpdir(), 'advjs-audio-projection-'))
  roots.push(root)
  const media = [
    { id: voiceId(1), kind: 'voice', name: 'selected-zh', selected: true },
    { id: voiceId(2), kind: 'voice', name: 'selected-en', selected: true },
    { id: voiceId(3), kind: 'voice', name: 'history-zh', selected: false },
    { id: voiceId(4), kind: 'voice', name: 'history-en', selected: false },
    { id: voiceId(5), kind: 'voice', name: 'pending-de', selected: false },
    { id: voiceId(6), kind: 'voice', name: 'inactive-line-take', selected: false },
    { id: voiceId(7), kind: 'voice', name: 'unbound-voice', selected: false },
    { id: voiceId(8), kind: 'reference', name: 'private-reference', selected: false },
    ...(['bgm', 'ambience', 'sfx', 'ui'] as const).map(kind => ({ id: `${kind}/default`, kind, name: `playback-${kind}`, selected: true })),
  ].map(item => ({ ...item, path: `${item.name}.wav`, bytes: Buffer.from(`fixture audio bytes: ${item.name}`) }))
  const variants = withVariants ? media.flatMap(item => (['opus', 'aac'] as const).map(variant => ({ assetId: item.id, selected: item.selected, variant, path: `${item.name}.${variant === 'opus' ? 'webm' : 'm4a'}`, bytes: Buffer.from(`processed ${variant} bytes: ${item.name}`) }))) : []

  const take = (index: number, spokenText: string): VoiceTake => ({
    id: `take_${uuid(index)}`,
    assetId: voiceId(index),
    sha256: digest(media.find(item => item.id === voiceId(index))!.bytes),
    providerId: 'fixture-tts',
    voiceId: 'supplier-voice',
    model: 'fixture-model',
    modelRevision: 'fixture-model-revision',
    voiceProfileRevision: 'a'.repeat(64),
    inputFingerprint: 'b'.repeat(64),
    spokenText,
    createdAt: '2026-10-11T08:00:00.000Z',
    source: 'system',
  })
  const zh = take(1, '你好。')
  const en = take(2, 'Hello.')
  const ledger: VoiceLedger = {
    schemaVersion: 1,
    lines: {
      [firstLine]: { speakerId: 'hero', displayText: '你好。', locales: {
        'zh-CN': { selectedTake: zh.id, takes: [take(3, '过去的台词。'), zh] },
        'en': { displayText: 'Hello.', selectedTake: en.id, takes: [en, take(4, 'Earlier dialogue.')] },
        'de': { displayText: 'Hallo.', selectedTake: null, takes: [take(5, 'Hallo.')] },
      } },
      [inactiveLine]: { speakerId: 'hero', displayText: '尚未选择配音。', locales: { 'zh-CN': { selectedTake: null, takes: [take(6, '尚未选择配音。')] } } },
    },
  }
  const files: AdvProjectFileMap = {
    'adv.config.json': JSON.stringify({ id: 'host-projection', root: 'adv', format: 'adv-md' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Host projection', characters: [{ id: 'hero', name: 'Hero' }] }),
    'adv/chapters/intro.adv.md': `@Hero\n你好。 {#${firstLine}}\n\n@Hero\n尚未选择配音。 {#${inactiveLine}}`,
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'audio-hosts', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/audio' } }, assets: media.map(item => ({ id: item.id, type: 'audio', kind: item.kind, path: item.path, sha256: digest(item.bytes), mimeType: 'audio/wav', ...(withVariants ? { variants: Object.fromEntries(variants.filter(variant => variant.assetId === item.id).map(variant => [variant.variant, { path: variant.path, sha256: digest(variant.bytes), bytes: variant.bytes.length, mimeType: variant.variant === 'opus' ? 'audio/webm' : 'audio/mp4' }])) } : {}) })) }),
    'adv/audio/voice-ledger.json': JSON.stringify(ledger),
    'adv/audio/mixer.json': JSON.stringify({ schemaVersion: 1, ui: { confirm: 'ui/default' } }),
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), content)
  }
  await mkdir(join(root, 'public/audio'), { recursive: true })
  for (const item of media)
    await writeFile(join(root, 'public/audio', item.path), item.bytes)
  for (const item of variants)
    await writeFile(join(root, 'public/audio', item.path), item.bytes)
  return { root, files, ledger, media, variants, expectedIds: media.filter(item => item.selected).map(item => item.id).sort() }
}

function expectSelectedPlayback(audio: AdvGameAudioConfig | undefined, expectedIds: string[]) {
  expect(audio).toBeDefined()
  if (!audio)
    throw new Error('Missing projected audio configuration')
  expect(Object.keys(audio.assets).sort()).toEqual(expectedIds)
  expect(Object.keys(audio.voiceLedger?.lines ?? {})).toEqual([firstLine])
  const locales = audio.voiceLedger!.lines[firstLine]!.locales
  expect(Object.keys(locales).sort()).toEqual(['en', 'zh-CN'])
  expect(locales['zh-CN']!.takes.map(take => take.assetId)).toEqual([voiceId(1)])
  expect(locales.en!.takes.map(take => take.assetId)).toEqual([voiceId(2)])
  expect(locales.en!.displayText).toBe('Hello.')
  expect(locales.en!.takes[0]!.modelRevision).toBe('fixture-model-revision')
  expect(audio.mixer?.ui?.confirm).toBe('ui/default')
  for (let index = 3; index <= 8; index++)
    expect(JSON.stringify(audio)).not.toContain(voiceId(index))
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('shared runtime audio projection across real hosts', () => {
  it('preserves and resolves both processed transports in Core, module, Editor preview and static builds without publishing private takes', async () => {
    const input = await fixture(true)
    const compiled = await compileProject({ files: input.files })
    expect(compiled.diagnostics).toEqual([])
    const raw = createProjectGameConfig(compiled, input.files)
    expect(raw.audio!.assets[voiceId(1)]!.variants).toMatchObject({ opus: { src: 'selected-zh.webm', mime: 'audio/webm' }, aac: { src: 'selected-zh.m4a', mime: 'audio/mp4' } })
    const module = await loadProjectAudioConfig(input.root)
    expect(module!.assets[voiceId(1)]!.variants?.aac?.src).toBe('/audio/selected-zh.m4a')
    const model = { ...createEditorProjectModel(compiled, input.files), filePaths: [...Object.keys(input.files), ...[...input.media, ...input.variants].map(item => `public/audio/${item.path}`)] }
    const preview = await resolveBrowserPreviewConfig(model, async path => `blob:${path}`)
    expect(preview.audio!.assets[voiceId(1)]!.variants?.opus?.src).toBe('blob:public/audio/selected-zh.webm')
    expect(preview.audio!.assets[voiceId(1)]!.variants?.aac?.src).toBe('blob:public/audio/selected-zh.m4a')
    for (const item of [...input.media, ...input.variants].filter(item => !item.selected))
      await rm(join(input.root, 'public/audio', item.path))
    const loaded = await loadProject({ root: input.root })
    const prepared = await prepareProjectGame(loaded)
    for (const audio of [raw.audio, module, preview.audio, prepared.game.audio])
      expectSelectedPlayback(audio, input.expectedIds)
    expect([...prepared.resources.values()].map(bytes => bytes.toString()).sort()).toEqual([...input.media, ...input.variants].filter(item => item.selected).map(item => item.bytes.toString()).sort())
    expect(prepared.game.audio!.assets[voiceId(1)]!.variants?.opus?.src).toMatch(/^\.\/project-assets\/[a-f0-9]{64}\.webm$/u)
    expect(prepared.game.audio!.assets[voiceId(1)]!.variants?.aac?.src).toMatch(/^\.\/project-assets\/[a-f0-9]{64}\.m4a$/u)
    expect(prepared.game.audio!.assets[voiceId(1)]!.sha256).toBe(input.ledger.lines[firstLine]!.locales['zh-CN']!.takes.find(take => take.id === input.ledger.lines[firstLine]!.locales['zh-CN']!.selectedTake)!.sha256)
  })

  it('verifies each local variant against its own hash and byte count, preserving master verification even with valid variants', async () => {
    const input = await fixture(true)
    const loaded = await loadProject({ root: input.root })
    const selected = input.variants.find(item => item.assetId === voiceId(1) && item.variant === 'aac')!
    await writeFile(join(input.root, 'public/audio', selected.path), Buffer.alloc(selected.bytes.length, 9))
    await expect(prepareProjectGame(loaded)).rejects.toThrow('ADV_AUDIO_MEDIA_CHANGED')
    await expect(loadProjectAudioConfig(input.root)).rejects.toThrow('ADV_AUDIO_MEDIA_CHANGED')
    await writeFile(join(input.root, 'public/audio', selected.path), selected.bytes)
    loaded.result.project.assets!.assets.find(asset => asset.id === voiceId(1))!.variants!.aac.bytes! += 1
    await expect(prepareProjectGame(loaded)).rejects.toThrow('ADV_AUDIO_MEDIA_CHANGED')
    loaded.result.project.assets!.assets.find(asset => asset.id === voiceId(1))!.variants!.aac.bytes! -= 1
    await writeFile(join(input.root, 'public/audio/selected-zh.wav'), 'Master changed after review.')
    await expect(prepareProjectGame(loaded)).rejects.toThrow('ADV_AUDIO_MEDIA_CHANGED')
    await expect(loadProjectAudioConfig(input.root)).rejects.toThrow('ADV_AUDIO_MEDIA_CHANGED')
  })

  it('requires local processed transport identity before exporting and allows public variants to omit the private master location', async () => {
    const input = await fixture(true)
    const loaded = await loadProject({ root: input.root })
    const asset = loaded.result.project.assets!.assets.find(asset => asset.id === voiceId(1))!
    delete asset.variants!.opus.sha256
    await expect(prepareProjectGame(loaded)).rejects.toThrow('ADV_AUDIO_VARIANT_IDENTITY_REQUIRED')
    asset.variants!.opus.sha256 = digest(input.variants.find(item => item.assetId === voiceId(1) && item.variant === 'opus')!.bytes)
    const catalog = loaded.result.project.assets!
    catalog.defaultProfile = 'published'
    catalog.profiles = { published: { provider: 'http', baseUrl: 'https://media.example.test/project/' } }
    for (const entry of catalog.assets) {
      for (const [name, variant] of Object.entries(entry.variants ?? {}))
        variant.objectKey = `audio/${entry.id.replaceAll('/', '-')}.${name === 'opus' ? 'webm' : 'm4a'}`
    }
    const prepared = await prepareProjectGame(loaded)
    expect(prepared.resources.size).toBe(0)
    expect(prepared.remoteOrigins).toEqual(['https://media.example.test'])
    expect(prepared.game.audio!.assets[voiceId(1)]!.variants?.aac?.src).toBe(`https://media.example.test/project/audio/${voiceId(1)}.m4a`)
    expect(prepared.game.audio!.assets[voiceId(1)]!.src).toBe(`https://media.example.test/project/audio/${voiceId(1)}.webm`)
    expect(JSON.stringify(prepared.game.audio)).not.toContain('selected-zh.wav')
  })

  it('projects all selected locales in the Core preview without exposing authoring history or reference audio', async () => {
    const input = await fixture()
    const compiled = await compileProject({ files: input.files })
    expect(compiled.diagnostics).toEqual([])
    const game = createProjectGameConfig(compiled, input.files)
    expectSelectedPlayback(game.audio, input.expectedIds)
    expect(compiled.project.assets?.assets).toHaveLength(input.media.length)
    expect(JSON.parse(input.files['adv/audio/voice-ledger.json']!)).toEqual(input.ledger)
  })

  it('loads the same selected assets and ledger for module games while preserving every nonvoice playback kind', async () => {
    const input = await fixture()
    const audio = await loadProjectAudioConfig(input.root)
    expectSelectedPlayback(audio, input.expectedIds)
    expect(audio!.assets[voiceId(2)]!.src).toBe('/audio/selected-en.wav')
    expect(Object.values(audio!.assets).map(asset => asset.kind).sort()).toEqual(['ambience', 'bgm', 'sfx', 'ui', 'voice', 'voice'])
  })

  it('bundles exactly selected voice bytes across locales and playback audio, even when private unused media is absent', async () => {
    const input = await fixture()
    for (const item of input.media.filter(item => !item.selected))
      await rm(join(input.root, 'public/audio', item.path))
    const loaded = await loadProject({ root: input.root })
    expect(loaded.result.diagnostics).toEqual([])
    const prepared = await prepareProjectGame(loaded)
    expectSelectedPlayback(prepared.game.audio, input.expectedIds)
    expect([...prepared.resources.values()].map(bytes => bytes.toString()).sort()).toEqual(input.media.filter(item => item.selected).map(item => item.bytes.toString()).sort())
    expect(prepared.remoteOrigins).toEqual([])
    expect(JSON.stringify(prepared.game)).not.toContain(input.root)
    for (const asset of Object.values(prepared.game.audio!.assets))
      expect(asset.src).toMatch(/^\.\/project-assets\/[a-f0-9]{64}\.wav$/u)
  })

  it('refuses a selected native voice file whose bytes no longer match the reviewed ledger and catalog hash', async () => {
    const input = await fixture()
    const loaded = await loadProject({ root: input.root })
    expect(loaded.result.diagnostics).toEqual([])
    await writeFile(join(input.root, 'public/audio/selected-en.wav'), 'External change after selection.')
    await expect(prepareProjectGame(loaded)).rejects.toThrow(/ADV_AUDIO_MEDIA_CHANGED/u)
  })
})
