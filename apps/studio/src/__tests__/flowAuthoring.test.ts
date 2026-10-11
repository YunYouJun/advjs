import type { IFileSystem } from '../utils/fs'
import { applyFlowEdit, createFlowNode, flowDocumentRevision, parseFlowDocument } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { createStudioFlowAuthoringService } from '../utils/flowAuthoring'
import { commitStudioProjectFiles } from '../utils/nativeProjectMutation'

export function flowFilesystem() {
  const chapter = { schemaVersion: 1, id: 'intro', title: 'Intro', startNodeId: 'speech', nodes: [{ id: 'speech', type: 'dialogues', position: { x: 10, y: 20 }, notes: { untouched: true }, dialogues: [{ lineId: 'line_019d137e-7abc-7000-8000-000000000001', speakerId: 'narrator', text: 'Before', actorNote: 'Keep' }], next: 'end' }, { id: 'end', type: 'end' }], custom: { retained: true } }
  const files = new Map<string, string>([
    ['adv.config.json', JSON.stringify({ schemaVersion: 1, id: 'flow-native', root: 'adv', format: 'flow' })],
    ['adv/assets.json', JSON.stringify({ schemaVersion: 2, id: 'flow-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] })],
    ['adv/chapters/intro.chapter.json', `${JSON.stringify(chapter, null, 2)}\n`],
  ])
  const fs = {
    backend: 'memory',
    readFile: async (path: string) => files.get(path)!,
    exists: async (path: string) => files.has(path),
    writeFile: async (path: string, content: string) => {
      files.set(path, content)
    },
    deleteFile: async (path: string) => {
      files.delete(path)
    },
    collectAllFiles: async (root = '') => [...files].filter(([path]) => !root || path.startsWith(`${root}/`)).map(([path, content]) => ({ path, content, lastModified: new Date() })),
  } as IFileSystem
  return { files, fs }
}

describe('studio shared JSON Flow authoring', () => {
  it('saves an edited dialogue/layout through native compilation while preserving stable IDs and opaque author fields', async () => {
    const { fs, files } = flowFilesystem()
    const service = createStudioFlowAuthoringService(fs)
    const source = await service.read('adv/chapters/intro.chapter.json')
    const edited = applyFlowEdit(applyFlowEdit(source.document, { type: 'update-dialogue', nodeId: 'speech', index: 0, patch: { text: 'After' } }), { type: 'move-node', nodeId: 'speech', position: { x: 100, y: 200 } })
    expect((await service.validate({ path: source.path, document: edited })).valid).toBe(true)
    await service.save({ path: source.path, document: edited, expectedRevision: source.revision })
    const saved = parseFlowDocument(files.get(source.path)!)
    expect(saved.custom).toEqual({ retained: true })
    expect(saved.nodes[0]).toMatchObject({ id: 'speech', position: { x: 100, y: 200 }, notes: { untouched: true }, dialogues: [{ text: 'After', actorNote: 'Keep', lineId: 'line_019d137e-7abc-7000-8000-000000000001' }] })
    expect([...files.keys()].some(path => path.endsWith('.adv.md'))).toBe(false)
  })
  it('retains the draft and source when another host saves or a disconnected choice fails project validation', async () => {
    const { fs, files } = flowFilesystem()
    const service = createStudioFlowAuthoringService(fs)
    const source = await service.read('adv/chapters/intro.chapter.json')
    const own = applyFlowEdit(source.document, { type: 'set-title', title: 'My draft' })
    const external = applyFlowEdit(source.document, { type: 'set-title', title: 'Other host' })
    await service.save({ path: source.path, document: external, expectedRevision: source.revision })
    const content = files.get(source.path)
    await expect(service.save({ path: source.path, document: own, expectedRevision: source.revision })).rejects.toThrow('SOURCE_CONFLICT')
    expect(own.title).toBe('My draft')
    expect(files.get(source.path)).toBe(content)
    const current = await service.read(source.path)
    const invalid = applyFlowEdit(current.document, { type: 'add-node', node: { id: 'choice', type: 'choices', choices: [{ id: 'option', text: 'Missing target' }] } })
    await expect(service.save({ path: source.path, document: invalid, expectedRevision: current.revision })).rejects.toThrow('VALIDATION_FAILED')
    expect(files.get(source.path)).toBe(content)
  })
  it('creates a declared chapter atomically without changing the entry or author metadata', async () => {
    const { fs, files } = flowFilesystem()
    files.set('adv/settings/game.json', JSON.stringify({ title: 'Native', chapters: [{ id: 'intro', title: 'Intro', sources: ['chapters/intro.chapter.json'] }], custom: { retained: true } }))
    const service = createStudioFlowAuthoringService(fs)
    const node = createFlowNode('end')
    const document = { schemaVersion: 1 as const, id: 'aaa-new', title: 'New', nodes: [node] }
    const path = 'adv/chapters/aaa-new.chapter.json'
    expect((await service.validateCreate({ path, document })).valid).toBe(true)
    await service.create({ path, document, expectedRevision: await flowDocumentRevision(null) })
    expect(JSON.parse(files.get('adv/settings/game.json')!)).toMatchObject({ entryChapterId: 'intro', custom: { retained: true }, chapters: [{ id: 'intro' }, { id: 'aaa-new', sources: ['chapters/aaa-new.chapter.json'] }] })
    expect((await service.read(path)).document.nodes[0]!.id).toBe(node.id)
  })
  it('rolls back a partial native multi-document commit instead of exporting mixed revisions', async () => {
    const { fs, files } = flowFilesystem()
    files.set('first.json', 'before')
    const originalWrite = fs.writeFile
    fs.writeFile = async (path, content) => {
      if (path === 'fail.json')
        throw new Error('Write failed')
      await originalWrite(path, content)
    }
    await expect(commitStudioProjectFiles(fs, [{ path: 'first.json', expected: 'before', content: 'after' }, { path: 'fail.json', expected: null, content: '{}' }], { acceptsPath: () => true })).rejects.toThrow('Write failed')
    expect(files.get('first.json')).toBe('before')
    expect(files.has('fail.json')).toBe(false)
  })
})
