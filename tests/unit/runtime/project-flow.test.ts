// @vitest-environment node
import type { AdvChapter, AdvProjectFileMap, RuntimeChoice } from '@advjs/types'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileFlowProgram } from '../../../packages/core/src/compiler'
import { applyProjectPatches, compileProject, createProjectGameConfig, patchFlowAudioOperations, readFlowAudioTarget } from '../../../packages/core/src/project'
import { createAdvRuntime } from '../../../packages/core/src/runtime'

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const assetId = 'audio_019d137e-7abc-7000-8000-000000000001'
const voiceId = 'audio_019d137e-7abc-7000-8000-000000000002'
const takeId = 'take_019d137e-7abc-7000-8000-000000000001'
const digest = 'a'.repeat(64)
const path = 'adv/chapters/intro.chapter.json'

function chapter() {
  return {
    schemaVersion: 1,
    id: 'intro',
    title: 'Intro',
    startNodeId: 'music',
    privateAuthoring: { keep: 'original source bytes' },
    nodes: [
      { id: 'music', type: 'audio', operations: [{ type: 'bgm', action: 'set', asset: assetId, gain: 0.2 }], opaque: { original: true } },
      { id: 'hello', type: 'dialogues', imagePrompt: 'private production prompt', dialogues: [{ speakerId: 'hero', text: '你好。', lineId }] },
      { id: 'choice', type: 'choices', choices: [{ id: 'continue', text: 'Continue', target: { chapterId: 'ending', nodeId: 'bye' }, when: 'ready == true' }] },
    ],
  }
}

function files(): AdvProjectFileMap {
  return {
    'adv.config.json': JSON.stringify({ id: 'flow-project', root: 'adv', format: 'flow', entryChapterId: 'intro' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Flow', locale: 'zh-CN', variables: { ready: true }, characters: [{ id: 'hero', name: 'Hero' }] }),
    [path]: JSON.stringify(chapter()),
    'adv/chapters/ending.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'ending', title: 'Ending', nodes: [{ id: 'bye', type: 'narration', text: '再见。' }, { id: 'end', type: 'end' }] }),
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'flow-project', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: [{ id: assetId, type: 'audio', kind: 'bgm', path: 'music.wav', sha256: digest }, { id: voiceId, type: 'audio', kind: 'voice', path: 'voice.wav', sha256: digest }] }),
  }
}

function changeChapter(input: AdvProjectFileMap, mutate: (value: any) => void) {
  const value = JSON.parse(input[path]!)
  mutate(value)
  input[path] = JSON.stringify(value)
}

describe('native serialized Flow projects', () => {
  it('normalizes a string tachie exit and clears the actual runtime stage after advancing', async () => {
    const result = await compileFlowProgram({ id: 'tachie-alias', chapters: [{ id: 'intro', title: 'Intro', nodes: [
      { id: 'enter', type: 'tachie', name: 'hero', action: 'enter', enter: 'hero' },
      { id: 'hello', type: 'narration', text: 'Entered' },
      { id: 'exit', type: 'tachie', name: 'hero', action: 'exit', exit: 'hero' },
      { id: 'bye', type: 'narration', text: 'Exited', next: null },
    ] }] })
    expect(result.diagnostics).toEqual([])
    expect(result.program?.chapters.intro.nodes.exit.data?.operations).toEqual([{ type: 'tachie', exit: ['hero'] }])
    const runtime = createAdvRuntime({ program: result.program! })
    await runtime.start()
    expect(runtime.current?.data?.text).toBe('Entered')
    expect(runtime.state.stage.tachies).toEqual({ hero: { status: '' } })
    await runtime.next()
    expect(runtime.current?.data?.text).toBe('Exited')
    expect(runtime.state.stage.tachies).toEqual({})
  })

  it('uses the same v2 linker, explicit entry, condition and sanitized player projection', async () => {
    const input = files()
    const compiled = await compileProject({ files: input })
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.sourceMap.chapters.intro).toEqual([path])
    expect(compiled.project.program?.entry).toEqual({ chapterId: 'intro', nodeId: 'music' })
    expect(compiled.project.program?.chapters.intro.nodes.hello.data).toMatchObject({ lineId, speakerId: 'hero', text: '你好。' })
    const choices = compiled.project.program?.chapters.intro.nodes.choice.data?.options as unknown as RuntimeChoice[]
    expect(choices[0]?.target).toEqual({ chapterId: 'ending', nodeId: 'bye' })
    const game = createProjectGameConfig(compiled, input)
    expect(game.entryChapterId).toBe('intro')
    expect(JSON.stringify(game)).not.toContain('private production prompt')
    expect(JSON.stringify(game)).not.toContain('original source bytes')
    const browser = await compileFlowProgram({ id: compiled.project.id, chapters: [game.chapters.find(item => item.id === 'intro')!, game.chapters.find(item => item.id === 'ending')!] })
    expect(browser.program?.hash).toBe(compiled.project.program?.hash)
    expect(compiled.project.chapters.find(item => item.id === 'intro')?.flow).toMatchObject({ privateAuthoring: { keep: 'original source bytes' } })
  })

  it('reads an explicit one-file declaration and pure inline chapters without executing modules', async () => {
    const input = files()
    input['adv/settings/game.json'] = JSON.stringify({ title: 'Flow', characters: [{ id: 'hero', name: 'Hero' }], chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }, { schemaVersion: 1, id: 'ending', title: 'Inline', nodes: [{ id: 'bye', type: 'end' }] }] })
    const compiled = await compileProject({ files: input })
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.sourceMap.chapters.ending).toEqual(['adv/settings/game.json'])
    const patches = applyProjectPatches(input, [{ kind: 'json-set', path, key: 'startNodeId', value: 'hello' }])
    expect(patches.changedPaths).toEqual([path])
    expect((await compileProject({ files: patches.files })).project.program?.entry.nodeId).toBe('hello')
  })

  it.each([
    ['malformed JSON', 'ADV_PROJECT_INVALID_JSON', (input: AdvProjectFileMap) => { input[path] = '{broken' }],
    ['wrong version', 'ADV_PROJECT_FLOW_SCHEMA', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.schemaVersion = 2 })],
    ['null node', 'ADV_RUNTIME_INVALID_FLOW_NODE', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes.push(null) })],
    ['unknown node', 'ADV_RUNTIME_UNKNOWN_FLOW_NODE', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[0].type = 'execute-javascript' })],
    ['invalid operations', 'ADV_RUNTIME_INVALID_FLOW_NODE', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[0].operations = {} })],
    ['unknown entry', 'ADV_RUNTIME_UNKNOWN_ENTRY', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.startNodeId = 'missing' })],
    ['unknown next', 'ADV_RUNTIME_UNKNOWN_TARGET', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[0].next = 'missing' })],
    ['unknown choice', 'ADV_RUNTIME_UNKNOWN_TARGET', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[2].choices[0].target = 'missing' })],
    ['invalid target', 'ADV_RUNTIME_INVALID_FLOW_NODE', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[0].next = { nodeId: 'hello' } })],
    ['unknown speaker', 'ADV_RUNTIME_UNKNOWN_CHARACTER', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[1].dialogues[0].speakerId = 'unregistered' })],
    ['duplicate line IDs', 'ADV_RUNTIME_DUPLICATE_LINE_ID', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[1].dialogues.push({ speakerId: 'hero', text: 'Duplicate', lineId }) })],
    ['unknown audio', 'ADV_AUDIO_UNKNOWN_ASSET', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[0].operations[0].asset = 'missing' })],
    ['wrong audio kind', 'ADV_AUDIO_ASSET_KIND_MISMATCH', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[0].operations[0].asset = voiceId })],
    ['unknown background', 'ADV_RUNTIME_UNKNOWN_BACKGROUND', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes.push({ id: 'background', type: 'background', name: 'missing' }) })],
    ['unknown dialogue scene', 'ADV_RUNTIME_UNKNOWN_BACKGROUND', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[1].sceneId = 'missing' })],
    ['unknown tachie exit', 'ADV_RUNTIME_UNKNOWN_CHARACTER', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes.push({ id: 'exit', type: 'tachie', name: 'missing', action: 'exit' }) })],
    ['legacy target', 'ADV_RUNTIME_LEGACY_FLOW_TARGET', (input: AdvProjectFileMap) => changeChapter(input, (value) => { value.nodes[0].target = 'hello' })],
  ] as const)('reports %s with a source path and no playable program', async (_name, code, mutate) => {
    const input = files()
    mutate(input)
    const result = await compileProject({ files: input })
    expect(result.project.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, path }))
  })

  it('rejects duplicate chapters, source ID mismatches and source traversal', async () => {
    const input = files()
    input['adv/chapters/duplicate.chapter.json'] = input[path]!
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_DUPLICATE_CHAPTER' }))
    delete input['adv/chapters/duplicate.chapter.json']
    input['adv/settings/game.json'] = JSON.stringify({ chapters: [{ id: 'wrong', sources: ['chapters/intro.chapter.json'] }] })
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_FLOW_CHAPTER_ID_MISMATCH' }))
    input['adv/settings/game.json'] = JSON.stringify({ chapters: [{ id: 'intro', sources: ['../intro.chapter.json'] }] })
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_INVALID_PATH' }))
  })

  it('binds selected voice through the existing ledger and detects speaker/hash mismatch', async () => {
    const input = files()
    const ledger = { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: '你好。', locales: { 'zh-CN': { selectedTake: takeId, takes: [{ id: takeId, assetId: voiceId, sha256: digest, providerId: 'fake', voiceId: 'fixture', model: 'fake', voiceProfileRevision: digest, inputFingerprint: digest, spokenText: '你好。', source: 'system', createdAt: '2026-10-11T08:00:00.000Z' }] } } } } }
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    const valid = await compileProject({ files: input })
    expect(valid.diagnostics).toEqual([])
    expect(createProjectGameConfig(valid, input).audio?.voiceLedger?.lines[lineId]?.locales['zh-CN']?.selectedTake).toBe(takeId)
    ledger.lines[lineId]!.speakerId = 'narrator'
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_VOICE_SPEAKER_MISMATCH' }))
    ledger.lines[lineId]!.speakerId = 'hero'
    ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!.sha256 = 'b'.repeat(64)
    input['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_INVALID_SELECTED_TAKE' }))
  })

  it('rejects scene references to missing or audio assets', async () => {
    const input = files()
    input['adv/scenes/room.md'] = `---\nid: room\ntype: image\nassetId: ${assetId}\n---\n`
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_INVALID_SCENE_ASSET' }))
    input['adv/scenes/room.md'] = input['adv/scenes/room.md']!.replace(assetId, 'missing')
    expect((await compileProject({ files: input })).diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_UNKNOWN_SCENE_ASSET' }))
  })

  it('patches a native audio node with conflict detection and preserves opaque source fields', async () => {
    const input = files()
    input[path] = `${JSON.stringify(chapter(), null, 2)}\n`
    const target = readFlowAudioTarget(input[path]!, 'music')
    const compiled = await compileProject({ files: input })
    const patched = patchFlowAudioOperations(input[path]!, target, [{ type: 'bgm', action: 'clear' }], compiled.project.assets)
    expect(JSON.parse(patched).nodes[0].opaque).toEqual({ original: true })
    expect(JSON.parse(patched).nodes[1].dialogues[0].lineId).toBe(lineId)
    expect(patched.split('"nodes"')[0]).toBe(input[path]!.split('"nodes"')[0])
    expect(() => patchFlowAudioOperations(patched, target, [])).toThrow('ADV_AUDIO_SOURCE_CONFLICT')
    expect(() => patchFlowAudioOperations(input[path]!, target, [{ type: 'bgm', action: 'set', asset: voiceId }], compiled.project.assets)).toThrow('ADV_AUDIO_OPERATION_ASSET_KIND')
  })

  it('compiles the actual demo native files, preserves every original speaker and validates three audio buses', async () => {
    const root = resolve('demo/flow')
    const input: AdvProjectFileMap = {}
    const visit = async (directory: string) => {
      for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
        const file = `${directory}/${entry.name}`.replace(/^\//u, '')
        if (entry.isDirectory())
          await visit(file)
        else if (file.endsWith('.json') || file.endsWith('.md'))
          input[file] = await readFile(resolve(root, file), 'utf8')
      }
    }
    await visit('adv')
    input['adv.config.json'] = await readFile(resolve(root, 'adv.config.json'), 'utf8')
    const result = await compileProject({ files: input })
    expect(result.diagnostics).toEqual([])
    expect(result.project.program?.schemaVersion).toBe(2)
    const nodes = Object.values(result.project.program!.chapters.intro.nodes)
    expect(nodes.filter(node => ['dialog', 'narration'].includes(node.kind))).toHaveLength(18)
    expect(new Set(nodes.filter(node => node.kind === 'dialog').map(node => node.data?.speakerId))).toEqual(new Set(['taki', 'friend', 'others']))
    expect(result.project.program?.chapters.intro.nodes['audio-start'].data?.operations).toMatchObject([{ type: 'bgm' }, { type: 'ambience' }])
    expect(result.project.program?.chapters.intro.nodes['phone-cue'].data?.operations).toMatchObject([{ type: 'sfx' }])
    expect(createProjectGameConfig(result, input).audio?.locale).toBe('en-US')
    expect(result.project.chapters[0]?.flow as AdvChapter).toBeDefined()
  })
})
