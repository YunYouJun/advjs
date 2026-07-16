import type { ChapterInfo } from '../composables/useProjectContent'
import { describe, expect, it } from 'vitest'
import { compileRuntimeAuthoringProject } from '../utils/runtimeAuthoring'

function chapter(file: string, content: string): ChapterInfo {
  return { file, content, name: file, preview: '' }
}

describe('compileRuntimeAuthoringProject', () => {
  it('compiles the whole project and exposes source-aware program rows', async () => {
    const result = await compileRuntimeAuthoringProject([
      chapter('adv/chapters/one.adv.md', [
        '# One {#start}',
        '',
        '- [Continue](two#arrival)',
      ].join('\n')),
      chapter('adv/chapters/two.adv.md', '# Two {#arrival}\n\nArrived.'),
    ], {})

    expect(result.diagnostics).toEqual([])
    expect(result.program?.entry).toEqual({ chapterId: 'one', nodeId: 'start' })
    expect(result.rows).toContainEqual(expect.objectContaining({
      chapterId: 'two',
      nodeId: 'arrival',
      kind: 'anchor',
      source: { file: 'adv/chapters/two.adv.md', line: 1, column: 1 },
    }))
  })

  it('overlays an unsaved buffer and reports its broken target location', async () => {
    const file = 'adv/chapters/one.adv.md'
    const result = await compileRuntimeAuthoringProject([
      chapter(file, '# One {#start}\n\n- [Continue](two#arrival)'),
      chapter('adv/chapters/two.adv.md', '# Two {#arrival}'),
    ], {}, {
      file,
      content: '# One {#start}\n\n- [Broken](missing#ending)',
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_UNKNOWN_TARGET',
      source: expect.objectContaining({ file, line: 3 }),
    }))
  })

  it('reports unavailable required plugins', async () => {
    const result = await compileRuntimeAuthoringProject([
      chapter('adv/chapters/one.adv.md', '# One {#start}'),
    ], {
      requiredPlugins: { unavailable: '1.0.0' },
    })

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_MISSING_PLUGIN',
      message: expect.stringContaining('unavailable@1.0.0'),
    }))
  })

  it('adds an unsaved new chapter that is not in the loaded project', async () => {
    const result = await compileRuntimeAuthoringProject([], {}, {
      file: 'adv/chapters/draft.adv.md',
      content: '# Draft {#start}',
    })

    expect(Object.keys(result.program?.chapters ?? {})).toEqual(['draft'])
    expect(result.rows[0]).toMatchObject({
      chapterId: 'draft',
      source: { file: 'adv/chapters/draft.adv.md', line: 1, column: 1 },
    })
  })
})
