import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram, createAdvRuntime } from '../../packages/core/src'
import { civilization, starMap } from '../../plugins/plugin-interactions/src'

describe('hamster demo runtime', () => {
  it('runs exact links, conditions, actions, and both activities', async () => {
    const root = resolve(import.meta.dirname, '../..')
    const result = await compileMarkdownProgram({
      id: 'hamster-demo',
      requiredPlugins: {
        'star-map': '1.0.0',
        'civilization': '1.0.0',
      },
      chapters: [
        {
          id: 'chapter-1',
          content: await readFile(resolve(root, 'demo/hamster/public/md/chapters/1/仓鼠的笼子.adv.md'), 'utf8'),
        },
        {
          id: 'chapter-2',
          content: await readFile(resolve(root, 'demo/hamster/public/md/chapters/2/仓生.adv.md'), 'utf8'),
        },
      ],
    })
    expect(result.diagnostics).toEqual([])
    const runtime = createAdvRuntime({
      program: result.program!,
      plugins: [starMap(), civilization()],
      initialVariables: {
        observationCount: 0,
        starMatched: false,
        starMatchScore: 0,
        civilizationLevel: 0,
      },
    })

    await runtime.start()
    await runtime.go('chapter-1#star-map')
    expect(runtime.current?.kind).toBe('dialog')
    await runtime.next()
    expect(runtime.state.status).toBe('waiting-activity')
    await runtime.completeActivity({ matched: true, score: 0.91 })
    expect(runtime.current?.data?.text).toContain('轮廓重合')
    await runtime.next()
    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'choice-1', label: '用这份回声初始化新文明' }),
    ])

    await runtime.choose('choice-1')
    expect(runtime.state.cursor.chapterId).toBe('chapter-2')
    expect(runtime.current?.data?.text).toContain('若把旧人类的记忆')
    await runtime.next()
    expect(runtime.current?.data?.text).toContain('先别替它们写好结局')
    await runtime.next()
    expect(runtime.state.status).toBe('waiting-activity')
    await runtime.completeActivity({ name: '仓生', level: 2, principle: 'memory' })
    expect(runtime.state.variables).toMatchObject({
      starMatched: true,
      civilizationLevel: 2,
      civilization: { name: '仓生', level: 2, principle: 'memory' },
    })
    const snapshot = runtime.snapshot()
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })
})
