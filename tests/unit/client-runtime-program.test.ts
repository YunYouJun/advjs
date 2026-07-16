import type { AdvChapter } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { compileClientRuntimeProgram } from '../../packages/client/runtime/program'

describe('client runtime program compiler', () => {
  it('fetches every Fountain chapter and links one browser program', async () => {
    const sources: Record<string, string> = {
      '/one.adv.md': ['## Start {#start}', '', '- [Go](chapter-2#result)'].join('\n'),
      '/two.adv.md': ['## Result {#result}', '', '完成。'].join('\n'),
    }
    const chapters: AdvChapter[] = [
      { id: 'chapter-1', title: 'One', nodes: [{ id: 'one', type: 'fountain', src: '/one.adv.md' }] },
      { id: 'chapter-2', title: 'Two', nodes: [{ id: 'two', type: 'fountain', src: '/two.adv.md' }] },
    ]

    const result = await compileClientRuntimeProgram({
      id: 'browser',
      chapters,
      fetcher: async url => ({
        ok: true,
        status: 200,
        text: async () => sources[url],
      }),
    })

    expect(result.diagnostics).toEqual([])
    expect(result.program?.chapters['chapter-1'].nodes['node-1'].data?.options).toEqual([{
      id: 'choice-1',
      label: 'Go',
      target: { chapterId: 'chapter-2', nodeId: 'result' },
    }])
  })

  it('uses the same core Flow compiler for Flow projects', async () => {
    const result = await compileClientRuntimeProgram({
      id: 'flow-browser',
      chapters: [{
        id: 'chapter-1',
        title: 'Flow',
        nodes: [
          { id: 'start', type: 'start', next: 'dialogues' },
          { id: 'dialogues', type: 'dialogues', dialogues: [{ speakerId: 'me', text: 'Hello' }] },
        ],
      }],
      fetcher: async () => {
        throw new Error('Flow projects must not fetch Markdown')
      },
    })

    expect(result.diagnostics).toEqual([])
    expect(result.program?.chapters['chapter-1'].nodes.dialogues).toMatchObject({
      kind: 'dialog',
      data: { character: 'me', text: 'Hello' },
    })
  })

  it('returns a source diagnostic for failed chapter fetches', async () => {
    const result = await compileClientRuntimeProgram({
      id: 'failed-browser',
      chapters: [{
        id: 'chapter-1',
        title: 'Missing',
        nodes: [{ id: 'missing', type: 'fountain', src: '/missing.adv.md' }],
      }],
      fetcher: async () => ({ ok: false, status: 404, text: async () => '' }),
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics).toEqual([{
      code: 'ADV_RUNTIME_CHAPTER_FETCH_FAILED',
      severity: 'error',
      message: 'Failed to fetch /missing.adv.md: HTTP 404',
      source: { file: '/missing.adv.md' },
    }])
  })
})
