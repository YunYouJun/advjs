// @vitest-environment node
import type { AdvProjectFileMap } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { compileFlowProgram } from '../../../packages/core/src/compiler'
import { applyFlowEdit, createFlowAuthoringService, createFlowEditHistory, createFlowNode, flowDocumentRevision, flowEditGraph, flowEditReferences, parseFlowDocument, projectRuntimeFlowChapter, reduceFlowEditHistory, serializeFlowDocument, validateFlowEdit } from '../../../packages/core/src/project'
import { createAdvRuntime } from '../../../packages/core/src/runtime'

const path = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
function document() {
  return parseFlowDocument(JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', author: { original: 'private' }, startNodeId: 'start', nodes: [
    { id: 'start', type: 'start', next: 'hello' },
    { id: 'hello', type: 'narration', text: 'Hello', lineId, next: 'choice', presentation: { opaque: true } },
    { id: 'choice', type: 'choices', next: null, choices: [{ id: 'yes', text: 'Yes', target: 'end', when: 'ready == true', rights: { keep: true } }] },
    { id: 'end', type: 'end' },
  ] }))
}
function files(): AdvProjectFileMap {
  return { 'adv.config.json': JSON.stringify({ id: 'native-flow', root: 'adv', format: 'flow' }), 'adv/settings/game.json': JSON.stringify({ title: 'Native', variables: { ready: true } }), [path]: serializeFlowDocument(document()) }
}

describe('shared native Flow editing protocol', () => {
  it('roundtrips all author fields and keeps movement separate from execution order and IDs', () => {
    const moved = applyFlowEdit(document(), { type: 'move-node', nodeId: 'hello', position: { x: 220, y: 330 } })
    expect(moved.nodes.map(node => node.id)).toEqual(document().nodes.map(node => node.id))
    expect(moved.nodes[1]).toMatchObject({ lineId, presentation: { opaque: true }, position: { x: 220, y: 330 } })
    expect(parseFlowDocument(serializeFlowDocument(moved))).toEqual(moved)
    expect(moved.author).toEqual({ original: 'private' })
    expect(() => applyFlowEdit(moved, { type: 'update-node', nodeId: 'hello', patch: { lineId: 'replacement' } })).toThrow('ADV_FLOW_IMMUTABLE_ID')
  })

  it('explicit disconnect compiles to no successor and survives player projection; omission remains sequential', async () => {
    const source = document()
    delete source.nodes[1]!.next
    expect(flowEditGraph(source).edges.find(edge => edge.source === 'hello')?.kind).toBe('implicit')
    const disconnected = applyFlowEdit(source, { type: 'disconnect', nodeId: 'hello' })
    const chapter = projectRuntimeFlowChapter(disconnected as any)
    expect(chapter.nodes[1]!.next).toBeNull()
    const stopped = await compileFlowProgram({ id: 'native-flow', chapters: [chapter] })
    expect(stopped.diagnostics).toEqual([])
    expect(stopped.program?.chapters.intro.nodes.hello.next).toBeUndefined()
    const runtime = createAdvRuntime({ program: stopped.program! })
    await runtime.start()
    expect(runtime.current?.data?.text).toBe('Hello')
    await runtime.next()
    expect(runtime.state.status).toBe('ended')
    expect(runtime.current?.kind).not.toBe('choices')
    const sequential = await compileFlowProgram({ id: 'native-flow', chapters: [source as any] })
    expect(sequential.program?.chapters.intro.nodes.hello.next).toEqual({ chapterId: 'intro', nodeId: 'choice' })
  })

  it('blocks deletion of entry, implicit and crosschapter references until authors repair routes', () => {
    const source = document()
    const other = parseFlowDocument(JSON.stringify({ schemaVersion: 1, id: 'other', title: 'Other', nodes: [{ id: 'jump', type: 'start', next: 'intro#hello' }] }))
    expect(flowEditReferences(source, 'hello', [other])).toEqual([{ chapterId: 'intro', nodeId: 'start', kind: 'next' }, { chapterId: 'other', nodeId: 'jump', kind: 'next' }])
    expect(() => applyFlowEdit(source, { type: 'delete-node', nodeId: 'start' })).toThrow('ADV_FLOW_NODE_REFERENCED')
    expect(() => applyFlowEdit(source, { type: 'delete-node', nodeId: 'hello' }, { otherChapters: [other] })).toThrow('ADV_FLOW_NODE_REFERENCED')
    delete source.nodes[0]!.next
    expect(flowEditReferences(source, 'hello')[0]?.kind).toBe('implicit')
    const repaired = applyFlowEdit(source, { type: 'disconnect', nodeId: 'start' })
    expect(applyFlowEdit(repaired, { type: 'delete-node', nodeId: 'hello' }).nodes.some(node => node.id === 'hello')).toBe(false)
  })

  it('retains a disconnected choice as an invalid repairable draft rather than losing its text or metadata', async () => {
    const disconnected = applyFlowEdit(document(), { type: 'disconnect', nodeId: 'choice', choiceId: 'yes' })
    expect((disconnected.nodes[2]!.choices as any[])[0]).toEqual({ id: 'yes', text: 'Yes', when: 'ready == true', rights: { keep: true } })
    expect((await validateFlowEdit({ files: files(), path, document: disconnected })).valid).toBe(false)
    const reconnected = applyFlowEdit(disconnected, { type: 'connect', nodeId: 'choice', choiceId: 'yes', target: 'end' })
    expect((await validateFlowEdit({ files: files(), path, document: reconnected })).valid).toBe(true)
  })

  it('preserves stable dialogue identities, uses new IDs only on explicit addition and validates unknown variable conditions', async () => {
    let source = applyFlowEdit(document(), { type: 'add-node', node: createFlowNode('dialogues', { id: 'dialogue' }) })
    const original = (source.nodes.at(-1)!.dialogues as any[])[0].lineId
    source = applyFlowEdit(source, { type: 'update-dialogue', nodeId: 'dialogue', index: 0, patch: { text: 'Changed' } })
    expect((source.nodes.at(-1)!.dialogues as any[])[0].lineId).toBe(original)
    expect(() => applyFlowEdit(source, { type: 'update-dialogue', nodeId: 'dialogue', index: 0, patch: { lineId } })).toThrow('ADV_FLOW_IMMUTABLE_ID')
    source = applyFlowEdit(source, { type: 'update-choice', nodeId: 'choice', choiceId: 'yes', patch: { when: 'missing_variable == true' } })
    const result = await validateFlowEdit({ files: files(), path, document: source })
    expect(result.diagnostics.some(issue => issue.message.includes('missing_variable'))).toBe(true)
  })

  it('arranges node positions as one undoable edit without changing story order or routes', () => {
    const original = document()
    const initial = createFlowEditHistory(original)
    const positions = Object.fromEntries(original.nodes.map((node, index) => [node.id, { x: index * 400, y: index * 120 }]))
    const changed = reduceFlowEditHistory(initial, { type: 'edit', command: { type: 'arrange-nodes', positions } })
    expect(changed.past).toHaveLength(1)
    expect(changed.present.nodes.map(node => node.id)).toEqual(original.nodes.map(node => node.id))
    expect(changed.present.nodes.map(({ position, ...node }) => node)).toEqual(original.nodes.map(({ position, ...node }) => node))
    expect(reduceFlowEditHistory(changed, { type: 'undo' }).present).toEqual(original)
    expect(() => applyFlowEdit(original, { type: 'arrange-nodes', positions: { missing: { x: 0, y: 0 } } })).toThrow('ADV_FLOW_NODE_NOT_FOUND')
    expect(() => applyFlowEdit(original, { type: 'arrange-nodes', positions: { [original.nodes[0]!.id]: { x: Infinity, y: 0 } } })).toThrow('ADV_FLOW_INVALID_POSITION')
  })

  it('undo and redo preserve complete JSON including layout, rows and opaque metadata', () => {
    const initial = createFlowEditHistory(document())
    const changed = reduceFlowEditHistory(initial, { type: 'edit', command: { type: 'move-node', nodeId: 'choice', position: { x: 1, y: 2 } } })
    const undone = reduceFlowEditHistory(changed, { type: 'undo' })
    expect(undone.present).toEqual(initial.present)
    expect(reduceFlowEditHistory(undone, { type: 'redo' }).present).toEqual(changed.present)
  })

  it('saves with exact source CAS, guards other chapter inputs and retains the draft on conflict', async () => {
    let current = files()
    const service = createFlowAuthoringService({ readFiles: async () => ({ ...current }), writeFiles: async (changes) => {
      expect(changes.find(change => change.path === 'adv/settings/game.json')?.content).toBe(current['adv/settings/game.json'])
      changes.forEach(change => expect(current[change.path] ?? null).toBe(change.expected))
      current = { ...current, ...Object.fromEntries(changes.filter(change => change.content !== null).map(change => [change.path, change.content!])) }
    } })
    const snapshot = await service.read(path)
    const draft = applyFlowEdit(snapshot.document, { type: 'update-node', nodeId: 'hello', patch: { text: 'Saved' } })
    const saved = await service.save({ path, document: draft, expectedRevision: snapshot.revision })
    expect(saved.document.nodes[1]!.text).toBe('Saved')
    current[path] += ' '
    await expect(service.save({ path, document: draft, expectedRevision: saved.revision })).rejects.toThrow('ADV_FLOW_SOURCE_CONFLICT')
    expect(draft.nodes[1]!.text).toBe('Saved')
  })

  it('refuses an unlisted chapter in explicitly configured projects before any write', async () => {
    const current = files()
    current['adv/settings/game.json'] = JSON.stringify({ chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }], variables: { ready: true } })
    const writeFiles = async () => {
      throw new Error('Unexpected write')
    }
    const service = createFlowAuthoringService({ readFiles: async () => current, writeFiles })
    const unlisted = parseFlowDocument(JSON.stringify({ schemaVersion: 1, id: 'unlisted', title: 'Unlisted', nodes: [{ id: 'end', type: 'end' }] }))
    const result = await service.validate({ path: 'adv/chapters/unlisted.chapter.json', document: unlisted })
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_FLOW_SOURCE_NOT_INCLUDED' }))
    await expect(service.save({ path: 'adv/chapters/unlisted.chapter.json', document: unlisted, expectedRevision: await flowDocumentRevision(null) })).rejects.toThrow('ADV_FLOW_SOURCE_NOT_INCLUDED')
  })

  it('creates a chapter and explicit source declaration in one CAS transaction, preserving metadata and entry', async () => {
    let current = files()
    const gamePath = 'adv/settings/game.json'
    const game = { entryChapterId: 'intro', privateNote: { keep: true }, variables: { ready: true }, chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'], author: 'Original chapter metadata' }] }
    current[gamePath] = JSON.stringify(game)
    const created = parseFlowDocument(JSON.stringify({ schemaVersion: 1, id: 'a-new-chapter', title: 'New chapter', nodes: [{ id: 'end', type: 'end' }] }))
    const newPath = 'adv/chapters/a-new-chapter.chapter.json'
    let writes = 0
    const service = createFlowAuthoringService({ readFiles: async () => ({ ...current }), writeFiles: async (changes) => {
      writes++
      expect(changes.filter(change => change.content !== change.expected).map(change => change.path).sort()).toEqual([newPath, gamePath].sort())
      changes.forEach(change => expect(current[change.path] ?? null).toBe(change.expected))
      current = { ...current, ...Object.fromEntries(changes.map(change => [change.path, change.content!])) }
    } })
    const preview = await service.validateCreate({ path: newPath, document: created })
    expect(preview.valid).toBe(true)
    expect(preview.compilation.project.entryChapterId).toBe('intro')
    await service.create({ path: newPath, document: created, expectedRevision: await flowDocumentRevision(null) })
    const saved = JSON.parse(current[gamePath]!)
    expect(saved).toEqual({ ...game, chapters: [...game.chapters, { id: 'a-new-chapter', title: 'New chapter', sources: ['chapters/a-new-chapter.chapter.json'] }] })
    expect(writes).toBe(1)
    expect(parseFlowDocument(current[newPath]!).id).toBe('a-new-chapter')
  })

  it('pins the original implicit entry during discovery creation and rejects an interleaved game edit before any write', async () => {
    const current = files()
    const gamePath = 'adv/settings/game.json'
    const created = parseFlowDocument(JSON.stringify({ schemaVersion: 1, id: 'aaa', title: 'Sorted before intro', nodes: [{ id: 'end', type: 'end' }] }))
    const newPath = 'adv/chapters/aaa.chapter.json'
    const service = createFlowAuthoringService({ readFiles: async () => ({ ...current }), writeFiles: async (changes) => {
      current[gamePath] += ' '
      for (const change of changes) {
        if ((current[change.path] ?? null) !== change.expected)
          throw new Error('HOST_CAS_CONFLICT')
      }
      throw new Error('Unexpected successful write')
    } })
    const preview = await service.validateCreate({ path: newPath, document: created })
    expect(preview.compilation.project.entryChapterId).toBe('intro')
    expect(preview.changes.find(change => change.path === gamePath)?.expected).toBe(current[gamePath])
    await expect(service.create({ path: newPath, document: created, expectedRevision: await flowDocumentRevision(null) })).rejects.toThrow('HOST_CAS_CONFLICT')
    expect(current[newPath]).toBeUndefined()
  })

  it('creates an absent chapter with a null-source revision and refuses invalid or traversal writes before host I/O', async () => {
    const current = files()
    let writes = 0
    const service = createFlowAuthoringService({ readFiles: async () => current, writeFiles: async () => {
      writes++
    } })
    const created = parseFlowDocument(JSON.stringify({ schemaVersion: 1, id: 'ending', title: 'Ending', nodes: [{ id: 'end', type: 'end' }] }))
    await service.save({ path: 'adv/chapters/ending.chapter.json', document: created, expectedRevision: await flowDocumentRevision(null) })
    expect(writes).toBe(1)
    await expect(service.save({ path: '../ending.chapter.json', document: created, expectedRevision: await flowDocumentRevision(null) })).rejects.toThrow('ADV_FLOW_INVALID_PATH')
    const invalid = applyFlowEdit(document(), { type: 'connect', nodeId: 'start', target: 'nonexistent' })
    await expect(service.save({ path, document: invalid, expectedRevision: await flowDocumentRevision(current[path]!) })).rejects.toThrow('ADV_FLOW_VALIDATION_FAILED')
    expect(writes).toBe(1)
  })
})
