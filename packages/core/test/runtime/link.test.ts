import type { JsonObject } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { linkRuntimeProgram } from '../../src/compiler'

describe('linkRuntimeProgram', () => {
  it('indexes chapters and produces a stable semantic hash', async () => {
    const input = {
      id: 'demo',
      entry: { chapterId: 'chapter-1', nodeId: 'start' },
      chapters: [{
        id: 'chapter-1',
        entry: 'start',
        nodes: [
          { id: 'start', kind: 'text', data: { text: 'hello' }, next: { chapterId: 'chapter-1', nodeId: 'end' } },
          { id: 'end', kind: 'end' },
        ],
      }],
      requiredPlugins: {},
    }

    const first = await linkRuntimeProgram(input)
    const second = await linkRuntimeProgram(input)

    expect(first.diagnostics).toEqual([])
    expect(first.program?.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(second.program?.hash).toBe(first.program?.hash)
    expect(first.program?.chapters['chapter-1'].nodes.start.kind).toBe('text')
  })

  it('normalizes reactive configuration into a pure-data program', async () => {
    const result = await linkRuntimeProgram({
      id: 'reactive-config',
      entry: { chapterId: 'chapter-1', nodeId: 'start' },
      chapters: [{
        id: 'chapter-1',
        entry: 'start',
        nodes: [{ id: 'start', kind: 'end' }],
      }],
      requiredPlugins: reactive({ 'star-map': '1.0.0' }),
    })

    expect(result.diagnostics).toEqual([])
    expect(result.program?.requiredPlugins).toEqual({ 'star-map': '1.0.0' })
    expect(() => structuredClone(result.program)).not.toThrow()
  })

  it('ignores object key insertion order when hashing', async () => {
    const linkWithData = (data: JsonObject) => linkRuntimeProgram({
      id: 'canonical',
      entry: { chapterId: 'chapter-1', nodeId: 'start' },
      chapters: [{
        id: 'chapter-1',
        entry: 'start',
        nodes: [{ id: 'start', kind: 'text', data }],
      }],
    })

    const first = await linkWithData({
      text: 'hello',
      nested: { beta: 2, alpha: 1 },
    })
    const second = await linkWithData({
      nested: { alpha: 1, beta: 2 },
      text: 'hello',
    })

    expect(first.program?.hash).toBe(second.program?.hash)
  })

  it('reports duplicate ids and unresolved addresses without emitting a program', async () => {
    const result = await linkRuntimeProgram({
      id: 'broken',
      entry: { chapterId: 'missing', nodeId: 'start' },
      chapters: [
        { id: 'chapter-1', entry: 'start', nodes: [{ id: 'start', kind: 'text' }] },
        { id: 'chapter-1', entry: 'other', nodes: [{ id: 'other', kind: 'end' }] },
      ],
      requiredPlugins: {},
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics.map(item => item.code)).toEqual([
      'ADV_RUNTIME_DUPLICATE_CHAPTER',
      'ADV_RUNTIME_UNKNOWN_ENTRY',
    ])
  })

  it('rejects a node next address that does not exist', async () => {
    const result = await linkRuntimeProgram({
      id: 'broken-next',
      entry: { chapterId: 'chapter-1', nodeId: 'start' },
      chapters: [{
        id: 'chapter-1',
        entry: 'start',
        nodes: [{
          id: 'start',
          kind: 'text',
          next: { chapterId: 'chapter-1', nodeId: 'missing' },
        }],
      }],
    })

    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_UNKNOWN_TARGET')
  })

  it('resolves raw choice targets before emitting a program', async () => {
    const result = await linkRuntimeProgram({
      id: 'choice-targets',
      entry: { chapterId: 'chapter-1', nodeId: 'choose' },
      chapters: [
        {
          id: 'chapter-1',
          entry: 'choose',
          nodes: [{
            id: 'choose',
            kind: 'choices',
            data: {
              options: [
                { id: 'local', label: 'Local', target: '#choose' },
                { id: 'chapter', label: 'Chapter', target: 'chapter-2' },
                { id: 'exact', label: 'Exact', target: 'chapter-2#result' },
              ],
            },
          }],
        },
        {
          id: 'chapter-2',
          entry: 'start',
          nodes: [
            { id: 'start', kind: 'text' },
            { id: 'result', kind: 'end' },
          ],
        },
      ],
    })

    expect(result.diagnostics).toEqual([])
    expect(result.program?.chapters['chapter-1'].nodes.choose.data?.options).toEqual([
      { id: 'local', label: 'Local', target: { chapterId: 'chapter-1', nodeId: 'choose' } },
      { id: 'chapter', label: 'Chapter', target: { chapterId: 'chapter-2', nodeId: 'start' } },
      { id: 'exact', label: 'Exact', target: { chapterId: 'chapter-2', nodeId: 'result' } },
    ])
  })
})
