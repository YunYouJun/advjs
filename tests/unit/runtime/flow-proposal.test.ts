// @vitest-environment node
import type { AdvProjectFileMap } from '@advjs/types'
import type { FlowProposalCommand } from '../../../packages/core/src/project'
import { describe, expect, it } from 'vitest'
import { flowDocumentRevision, flowProjectRevision, parseFlowProposalRequest, planFlowProposal, readFlowProposalSnapshot } from '../../../packages/core/src/project'

const path = 'adv/chapters/intro.chapter.json'
const firstLine = 'line_019d137e-7abc-7000-8000-000000000001'
const secondLine = 'line_019d137e-7abc-7000-8000-000000000002'
const newLine = 'line_019d137e-7abc-7000-8000-000000000003'
function files(): AdvProjectFileMap {
  return {
    'adv.config.json': JSON.stringify({ id: 'proposal-fixture', format: 'flow', root: 'adv' }),
    'adv/settings/game.json': JSON.stringify({ title: 'A story', variables: { ready: true } }),
    [path]: JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', privateAuthor: { keep: true }, startNodeId: 'start', nodes: [
      { id: 'start', type: 'start', next: 'talk' },
      { id: 'talk', type: 'dialogues', next: 'choice', presentation: { keep: true }, dialogues: [
        { lineId: firstLine, speakerId: 'narrator', text: 'First', translation: { keep: 'one' } },
        { lineId: secondLine, speakerId: 'narrator', text: 'Second', translation: { keep: 'two' } },
      ] },
      { id: 'choice', type: 'choices', next: null, choices: [{ id: 'yes', text: 'Yes', target: 'end', when: 'ready == true', rights: { keep: true } }] },
      { id: 'end', type: 'end' },
    ] }),
  }
}
async function request(source = files(), commands: FlowProposalCommand[] = [{ type: 'set-title', title: 'Proposed' }]) {
  return { schemaVersion: 1 as const, path, expectedRevision: await flowDocumentRevision(source[path]!), projectRevision: await flowProjectRevision(source), commands }
}

describe('bounded native Flow proposal planning', () => {
  it('reads revisions and stable line identities without changing any source', async () => {
    const source = files()
    const original = { ...source }
    const snapshot = await readFlowProposalSnapshot({ files: source, path })
    expect(snapshot).toMatchObject({ schemaVersion: 1, path, chapterId: 'intro', revision: await flowDocumentRevision(source[path]!), projectRevision: await flowProjectRevision(source) })
    expect(snapshot.document.nodes[1]!.dialogues).toEqual(expect.arrayContaining([expect.objectContaining({ lineId: firstLine })]))
    expect(snapshot.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
    expect(source).toEqual(original)
  })

  it('uses stable line identities after insertion and preserves all unrelated metadata', async () => {
    const source = files()
    const original = { ...source }
    const proposal = await request(source, [
      { type: 'add-dialogue', nodeId: 'talk', index: 0, dialogue: { lineId: newLine, speakerId: 'narrator', text: 'New' } },
      { type: 'update-dialogue', nodeId: 'talk', lineId: firstLine, patch: { text: 'Changed first' } },
      { type: 'delete-dialogue', nodeId: 'talk', lineId: secondLine },
      { type: 'move-node', nodeId: 'talk', position: { x: 300, y: 100 } },
      { type: 'update-choice', nodeId: 'choice', choiceId: 'yes', patch: { text: 'Absolutely' } },
    ])
    const plan = await planFlowProposal({ files: Object.freeze(source), request: proposal })
    expect(plan.valid).toBe(true)
    expect(plan.before).toBe(original[path])
    expect(JSON.parse(plan.after)).toEqual(plan.proposed)
    expect(plan.proposed.privateAuthor).toEqual({ keep: true })
    expect(plan.proposed.nodes[1]).toMatchObject({ presentation: { keep: true }, dialogues: [
      { lineId: newLine, text: 'New' },
      { lineId: firstLine, text: 'Changed first', translation: { keep: 'one' } },
    ] })
    expect(plan.proposed.nodes[2]!.choices).toEqual([expect.objectContaining({ id: 'yes', rights: { keep: true }, when: 'ready == true' })])
    expect(plan.changes.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'talk', lineId: firstLine, kind: 'updated', fields: ['text', '$index'] }),
      expect.objectContaining({ nodeId: 'talk', lineId: secondLine, kind: 'deleted' }),
      expect.objectContaining({ nodeId: 'talk', lineId: newLine, kind: 'added' }),
    ]))
    expect(plan.changes.nodes).toContainEqual(expect.objectContaining({ nodeId: 'talk', fields: ['dialogues', 'position'] }))
    expect(source).toEqual(original)
    expect(proposal.commands[1]).toEqual({ type: 'update-dialogue', nodeId: 'talk', lineId: firstLine, patch: { text: 'Changed first' } })
  })

  it('reports invalid routes and unknown conditions without writing or accepting the draft', async () => {
    const source = files()
    const plan = await planFlowProposal({ files: source, request: await request(source, [
      { type: 'connect', nodeId: 'start', target: 'missing' },
      { type: 'update-choice', nodeId: 'choice', choiceId: 'yes', patch: { when: 'unknown_flag == true' } },
    ]) })
    expect(plan.valid).toBe(false)
    expect(plan.proposed.nodes[0]!.next).toBe('missing')
    expect(plan.diagnostics.some(issue => issue.severity === 'error' && issue.message.includes('missing'))).toBe(true)
    expect(plan.diagnostics.some(issue => issue.message.includes('unknown_flag'))).toBe(true)
    expect(source).toEqual(files())
  })

  it('rejects changed file bytes and changed dependencies against the original proposal', async () => {
    const source = files()
    const proposal = await request(source)
    await expect(planFlowProposal({ files: { ...source, [path]: `${source[path]} ` }, request: proposal })).rejects.toThrow('ADV_FLOW_SOURCE_CONFLICT')
    await expect(planFlowProposal({ files: { ...source, 'adv/settings/game.json': '{"title":"Changed"}' }, request: proposal })).rejects.toThrow('ADV_FLOW_SOURCE_CONFLICT')
    await expect(planFlowProposal({ files: { ...source, 'adv/chapters/new.chapter.json': '{}' }, request: proposal })).rejects.toThrow('ADV_FLOW_SOURCE_CONFLICT')
  })

  it('captures files and commands before asynchronous hashing and does not mutate the caller', async () => {
    const source = files()
    const proposal = await request(source)
    const pending = planFlowProposal({ files: source, request: proposal })
    source[path] = '{}'
    proposal.commands[0] = { type: 'set-title', title: 'Changed after invocation' }
    const plan = await pending
    expect(plan.proposed.title).toBe('Proposed')
    expect(plan.baseline.title).toBe('Intro')
  })

  it.each([
    { type: 'publish' },
    { type: 'set-title', title: 'Oops', content: 'replacement story' },
    { type: 'update-dialogue', nodeId: 'talk', index: 0, patch: { text: 'Fragile' } },
    { type: 'delete-dialogue', nodeId: 'talk', lineId: firstLine, index: 0 },
    { type: 'update-node', nodeId: 'talk', patch: { id: 'replacement' } },
    { type: 'update-node', nodeId: 'talk', patch: { dialogues: [] } },
    { type: 'update-node', nodeId: 'talk', patch: {}, remove: ['type'] },
    { type: 'update-dialogue', nodeId: 'talk', lineId: firstLine, patch: { lineId: newLine } },
    { type: 'update-choice', nodeId: 'choice', choiceId: 'yes', patch: {}, remove: ['id'] },
    { type: 'update-node', nodeId: 'talk', patch: [] },
    { type: 'update-node', nodeId: 'talk', patch: {}, remove: [1] },
    { type: 'move-node', nodeId: 'talk', position: { x: Infinity, y: 0 } },
    { type: 'connect', nodeId: 'start', target: { chapterId: 'intro', nodeId: 'end', hidden: true } },
    { type: 'add-dialogue', nodeId: 'talk', dialogue: { text: 'No stable identity' } },
    { type: 'add-node', node: { id: 'new', type: 'narration', text: 'No stable identity' } },
    { type: 'reorder-node', nodeId: 'talk', index: -1 },
  ])('rejects malformed or unsafe command %j', async (command) => {
    const proposal = await request()
    expect(() => parseFlowProposalRequest({ ...proposal, commands: [command] })).toThrow('ADV_FLOW_PROPOSAL_INVALID')
  })

  it('bounds envelopes and rejects non-JSON, cyclic and deep inputs', async () => {
    const proposal = await request()
    expect(() => parseFlowProposalRequest({ ...proposal, commands: Array.from({ length: 101 }, () => ({ type: 'set-title', title: 'x' })) })).toThrow('ADV_FLOW_PROPOSAL_LIMIT')
    expect(() => parseFlowProposalRequest({ ...proposal, commands: [{ type: 'set-title', title: 'x'.repeat(256 * 1024) }] })).toThrow('ADV_FLOW_PROPOSAL_LIMIT')
    const repeated = Array.from({ length: 100 }, () => ({ type: 'set-title', title: 'x'.repeat(128 * 1024) }))
    expect(() => parseFlowProposalRequest({ ...proposal, commands: repeated })).toThrow('ADV_FLOW_PROPOSAL_LIMIT')
    expect(() => parseFlowProposalRequest({ ...proposal, commands: [{ type: 'set-title', title: undefined }] })).toThrow('ADV_FLOW_PROPOSAL_INVALID')
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => parseFlowProposalRequest(cyclic)).toThrow('ADV_FLOW_PROPOSAL_INVALID')
    const deep = Array.from({ length: 35 }).reduce<unknown>(value => ({ value }), true)
    expect(() => parseFlowProposalRequest(deep)).toThrow('ADV_FLOW_PROPOSAL_LIMIT')
    const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: () => {
      throw new Error('Getter must not run')
    } })
    expect(() => parseFlowProposalRequest(accessor)).toThrow('ADV_FLOW_PROPOSAL_INVALID')
    expect(() => parseFlowProposalRequest({ ...proposal, futureField: true })).toThrow('ADV_FLOW_PROPOSAL_INVALID')
    expect(() => parseFlowProposalRequest({ ...proposal, projectRevision: undefined })).toThrow('ADV_FLOW_PROPOSAL_INVALID')
  })

  it.each(['../intro.chapter.json', '/intro.chapter.json', 'adv//intro.chapter.json', 'adv/./intro.chapter.json', 'C:/intro.chapter.json', 'adv\\intro.chapter.json', '.git/intro.chapter.json', 'adv/intro.adv.md'])('rejects unsafe or non-native path %s', async (badPath) => {
    await expect(readFlowProposalSnapshot({ files: files(), path: badPath })).rejects.toThrow('ADV_FLOW_INVALID_PATH')
  })

  it('refuses absent, unlisted and non-native sources and never creates a chapter', async () => {
    const source = files()
    await expect(readFlowProposalSnapshot({ files: source, path: 'adv/chapters/absent.chapter.json' })).rejects.toThrow('ADV_FLOW_FILE_NOT_FOUND')
    source['adv/settings/game.json'] = JSON.stringify({ chapters: [{ id: 'other', sources: ['chapters/other.chapter.json'] }] })
    await expect(readFlowProposalSnapshot({ files: source, path })).rejects.toThrow('ADV_FLOW_SOURCE_NOT_INCLUDED')
    source['adv.config.json'] = JSON.stringify({ format: 'adv-md', root: 'adv' })
    await expect(readFlowProposalSnapshot({ files: source, path })).rejects.toThrow('ADV_FLOW_SOURCE_NOT_INCLUDED')
  })

  it('allows reading and repairing malformed semantic properties in a declared native chapter', async () => {
    const source = files()
    const document = JSON.parse(source[path]!)
    document.nodes[1].dialogues[0].text = 123
    source[path] = JSON.stringify(document)
    source['adv/settings/game.json'] = JSON.stringify({ variables: { ready: true }, chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }] })
    const snapshot = await readFlowProposalSnapshot({ files: source, path })
    expect(snapshot.diagnostics.some(issue => issue.severity === 'error')).toBe(true)
    const plan = await planFlowProposal({ files: source, request: await request(source, [{ type: 'update-dialogue', nodeId: 'talk', lineId: firstLine, patch: { text: 'Repaired' } }]) })
    expect(plan.valid).toBe(true)
  })

  it('refuses missing or ambiguous stable line targets and flags duplicate line identity additions', async () => {
    const source = files()
    await expect(planFlowProposal({ files: source, request: await request(source, [{ type: 'delete-dialogue', nodeId: 'talk', lineId: newLine }]) })).rejects.toThrow('ADV_FLOW_LINE_ID_NOT_FOUND')
    const plan = await planFlowProposal({ files: source, request: await request(source, [{ type: 'add-dialogue', nodeId: 'talk', dialogue: { lineId: firstLine, text: 'Duplicate' } }]) })
    expect(plan.valid).toBe(false)
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_FLOW_DUPLICATE_LINE_ID' }))
    await expect(planFlowProposal({ files: source, request: await request(source, [
      { type: 'add-dialogue', nodeId: 'talk', dialogue: { lineId: firstLine, text: 'Duplicate' } },
      { type: 'delete-dialogue', nodeId: 'talk', lineId: firstLine },
    ]) })).rejects.toThrow('ADV_FLOW_LINE_ID_NOT_FOUND')
  })

  it('retains incoming cross-chapter reference protection', async () => {
    const source = files()
    source['adv/chapters/other.chapter.json'] = JSON.stringify({ schemaVersion: 1, id: 'other', title: 'Other', nodes: [{ id: 'start', type: 'start', next: 'intro#talk' }] })
    await expect(planFlowProposal({ files: source, request: await request(source, [{ type: 'disconnect', nodeId: 'start' }, { type: 'delete-node', nodeId: 'talk' }]) })).rejects.toThrow('ADV_FLOW_NODE_REFERENCED')
  })

  it('hashes project entries independently of insertion order and includes every byte', async () => {
    expect(await flowProjectRevision({ 'adv/a.json': '1', 'adv/b.md': '2' })).toBe(await flowProjectRevision({ 'adv/b.md': '2', 'adv/a.json': '1' }))
    expect(await flowProjectRevision({ 'adv/a.json': '1' })).not.toBe(await flowProjectRevision({ 'adv/a.json': '1 ' }))
    // Codepoint sorting keeps distinct canonical Unicode spellings deterministic.
    expect(await flowProjectRevision({ 'adv/é.json': '1', 'adv/é.json': '2' })).toBe(await flowProjectRevision({ 'adv/é.json': '2', 'adv/é.json': '1' }))
  })
})
