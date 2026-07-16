import type { AdvChapter } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { compileFlowProgram } from '../../src/compiler'

const chapters: AdvChapter[] = [{
  id: 'chapter-1',
  title: 'Flow',
  startNodeId: 'start',
  nodes: [
    { id: 'start', type: 'start', next: 'background' },
    { id: 'background', type: 'background', name: 'bedroom', src: 'bedroom.webp', next: 'dialogues' },
    {
      id: 'dialogues',
      type: 'dialogues',
      dialogues: [
        { speakerId: 'mitsuha', text: '早上好。' },
        { speakerId: 'taki', text: '这里是哪里？' },
      ],
      next: { chapterId: 'chapter-2', nodeId: 'arrival' },
    },
  ],
}, {
  id: 'chapter-2',
  title: 'Result',
  nodes: [
    { id: 'arrival', type: 'tachie', name: 'mitsuha', status: 'smile', action: 'enter', next: 'end' },
    { id: 'end', type: 'end' },
  ],
}]

describe('compileFlowProgram', () => {
  it('normalizes flow nodes and exact cross-chapter links', async () => {
    const result = await compileFlowProgram({ id: 'flow', chapters })

    expect(result.diagnostics).toEqual([])
    expect(result.program?.entry).toEqual({ chapterId: 'chapter-1', nodeId: 'start' })
    expect(result.program?.chapters['chapter-1'].order).toEqual([
      'start',
      'background',
      'dialogues',
      'dialogues.dialog-2',
    ])
    expect(result.program?.chapters['chapter-1'].nodes.background).toMatchObject({
      kind: 'effects',
      data: { operations: [{ type: 'background', name: 'bedroom', url: 'bedroom.webp' }] },
      next: { chapterId: 'chapter-1', nodeId: 'dialogues' },
    })
    expect(result.program?.chapters['chapter-1'].nodes.dialogues).toMatchObject({
      kind: 'dialog',
      data: { character: 'mitsuha', text: '早上好。' },
      next: { chapterId: 'chapter-1', nodeId: 'dialogues.dialog-2' },
    })
    expect(result.program?.chapters['chapter-1'].nodes['dialogues.dialog-2'].next).toEqual({
      chapterId: 'chapter-2',
      nodeId: 'arrival',
    })
    expect(result.program?.chapters['chapter-2'].nodes.arrival).toMatchObject({
      kind: 'effects',
      data: { operations: [{ type: 'tachie', enter: [{ name: 'mitsuha', status: 'smile' }] }] },
    })
  })

  it('reports empty chapters and unknown flow targets through the linker', async () => {
    const result = await compileFlowProgram({
      id: 'broken-flow',
      chapters: [
        { id: 'empty', title: 'Empty', nodes: [] },
        { id: 'broken', title: 'Broken', nodes: [{ id: 'start', type: 'start', next: 'missing' }] },
      ],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics.map(item => item.code)).toEqual([
      'ADV_RUNTIME_EMPTY_CHAPTER',
      'ADV_RUNTIME_UNKNOWN_TARGET',
    ])
  })
})
