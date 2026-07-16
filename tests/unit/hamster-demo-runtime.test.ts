// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram, createAdvRuntime } from '../../packages/core/src'
import { civilization, starMap } from '../../plugins/plugin-interactions/src'

const root = resolve(import.meta.dirname, '../..')

async function compileOpeningChapters() {
  const chapter = async (id: string, file: string) => ({
    id,
    sourcePath: `demo/hamster/public/md/chapters/${file}`,
    content: await readFile(resolve(root, `demo/hamster/public/md/chapters/${file}`), 'utf8'),
  })
  return compileMarkdownProgram({
    id: 'hamster-demo',
    requiredPlugins: {
      'star-map': '1.0.0',
      'civilization': '1.0.0',
    },
    chapters: [
      await chapter('chapter-1', '01-cage.adv.md'),
      await chapter('chapter-2', '02-last-night.adv.md'),
      {
        id: 'chapter-3',
        sourcePath: 'chapter-3-stub.adv.md',
        content: '## 出生 {#birth}\n\n> 第三章占位。',
      },
    ],
  })
}

async function createOpeningRuntime() {
  const result = await compileOpeningChapters()
  expect(result.diagnostics).toEqual([])
  const settings = JSON.parse(
    await readFile(resolve(root, 'demo/hamster/adv/settings/game.json'), 'utf8'),
  ) as { variables: Record<string, any> }
  return createAdvRuntime({
    program: result.program!,
    plugins: [starMap({ tolerance: 0.82 }), civilization({ defaultLevel: 1 })],
    initialVariables: settings.variables,
  })
}

async function reachOpeningChoice(runtime: Awaited<ReturnType<typeof createOpeningRuntime>>) {
  await runtime.start()
  expect(runtime.current?.data?.text).toContain('透明笼中的仓鼠')
  await runtime.next()
  await runtime.next()
  await runtime.next()
  expect(runtime.state.status).toBe('waiting-choice')
}

describe('hamster demo runtime', () => {
  it('runs chapters one and two through the curious star-map path', async () => {
    const runtime = await createOpeningRuntime()
    await reachOpeningChoice(runtime)

    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'continue-observing' }),
      expect.objectContaining({ id: 'leave-room' }),
    ])
    await runtime.choose('continue-observing')
    expect(runtime.current?.data?.text).toContain('不属于今天的天空')
    await runtime.next()
    expect(runtime.state.status).toBe('waiting-activity')
    expect(runtime.state.pendingActivity?.type).toBe('star-map/compare')

    await runtime.completeActivity({ matched: true, score: 0.91 })
    expect(runtime.current?.data?.text).toContain('轮廓重合')
    expect(runtime.state.variables).toMatchObject({
      curiosity: 1,
      observationCount: 2,
      starMatched: true,
      starMatchScore: 0.91,
    })

    await runtime.next()
    await runtime.choose('carry-signal-forward')
    expect(runtime.state.cursor.chapterId).toBe('chapter-2')
    expect(runtime.state.status).not.toBe('waiting-activity')

    await runtime.next()
    await runtime.next()
    await runtime.next()
    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'open-the-door' }),
      expect.objectContaining({ id: 'keep-observing' }),
      expect.objectContaining({ id: 'preserve-control' }),
    ])
    await runtime.choose('keep-observing')
    expect(runtime.state.cursor.chapterId).toBe('chapter-3')
    expect(runtime.state.variables).toMatchObject({
      curiosity: 2,
      observationCount: 3,
    })
  })

  it('can leave the room without entering the star-map activity', async () => {
    const runtime = await createOpeningRuntime()
    await reachOpeningChoice(runtime)

    await runtime.choose('leave-room')

    expect(runtime.state.cursor.chapterId).toBe('chapter-2')
    expect(runtime.state.variables).toMatchObject({
      control: 1,
      observationCount: 1,
      starMatched: false,
    })
    expect(runtime.state.pendingActivity).toBeUndefined()
    expect(runtime.state.status).not.toBe('waiting-activity')
  })

  it('continues after an unsuccessful star-map comparison', async () => {
    const runtime = await createOpeningRuntime()
    await reachOpeningChoice(runtime)

    await runtime.choose('continue-observing')
    await runtime.next()
    await runtime.completeActivity({ matched: false, score: 0.61 })

    expect(runtime.current?.data?.text).toContain('误差同样是一条消息')
    await runtime.next()
    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'carry-signal-forward-failed' }),
    ])
    await runtime.choose('carry-signal-forward-failed')
    expect(runtime.state.cursor.chapterId).toBe('chapter-2')
    expect(runtime.state.status).not.toBe('waiting-activity')
  })
})
