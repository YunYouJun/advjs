// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram, createAdvRuntime } from '../../packages/core/src'
import { civilization, starMap } from '../../plugins/plugin-interactions/src'

const root = resolve(import.meta.dirname, '../..')

async function compileHamsterProgram() {
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
      await chapter('chapter-3', '03-common-life.adv.md'),
      await chapter('chapter-4', '04-dim-stars.adv.md'),
    ],
  })
}

async function createHamsterRuntime(variableOverrides: Record<string, any> = {}) {
  const result = await compileHamsterProgram()
  expect(result.diagnostics).toEqual([])
  const settings = JSON.parse(
    await readFile(resolve(root, 'demo/hamster/adv/settings/game.json'), 'utf8'),
  ) as { variables: Record<string, any> }
  return createAdvRuntime({
    program: result.program!,
    plugins: [starMap({ tolerance: 0.82 }), civilization({ defaultLevel: 1 })],
    initialVariables: {
      ...settings.variables,
      ...variableOverrides,
    },
  })
}

type HamsterRuntime = Awaited<ReturnType<typeof createHamsterRuntime>>

async function reachOpeningChoice(runtime: HamsterRuntime) {
  await runtime.start()
  expect(runtime.current?.data?.text).toContain('透明笼中的仓鼠')
  await runtime.next()
  await runtime.next()
  await runtime.next()
  expect(runtime.state.status).toBe('waiting-choice')
}

async function advanceUntil(
  runtime: HamsterRuntime,
  predicate: () => boolean,
) {
  for (let step = 0; step < 30; step++) {
    if (predicate())
      return
    if (runtime.state.status !== 'playing')
      throw new Error(`Cannot advance from ${runtime.state.status} at ${runtime.state.cursor.chapterId}#${runtime.state.cursor.nodeId}`)
    await runtime.next()
  }
  throw new Error('Runtime did not reach the expected state within 30 steps')
}

async function reachEndingChoice(runtime: HamsterRuntime) {
  await runtime.go('chapter-3#birth')
  await advanceUntil(runtime, () => runtime.state.status === 'waiting-activity')
  expect(runtime.state.pendingActivity?.type).toBe('civilization/initialize')

  await runtime.completeActivity({ name: '仓生', level: 2, principle: 'memory' })
  expect(runtime.state.variables).toMatchObject({
    civilizationLevel: 2,
    civilization: { name: '仓生', level: 2, principle: 'memory' },
  })
  expect(runtime.state.variables.memories).toContain('文明把短暂生命写进共同记忆')

  await advanceUntil(runtime, () => runtime.state.status === 'waiting-choice')
  await runtime.choose('enter-dim-stars')
  expect(runtime.state.cursor.chapterId).toBe('chapter-4')
  await advanceUntil(runtime, () => runtime.state.status === 'waiting-choice')
}

describe('hamster demo runtime', () => {
  it('runs chapters one and two through the curious star-map path', async () => {
    const runtime = await createHamsterRuntime()
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
    const runtime = await createHamsterRuntime()
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
    const runtime = await createHamsterRuntime()
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

  it.each([
    {
      name: 'still gazing',
      variables: { starMatched: true, curiosity: 2, empathy: 1, control: 1 },
      choiceId: 'continue-gazing',
      ending: 'still-gazing',
      marker: '我们仍在仰望',
    },
    {
      name: 'endless wheel',
      variables: { starMatched: false, curiosity: 0, empathy: 0, control: 2 },
      choiceId: 'continue-wheel',
      ending: 'endless-wheel',
      marker: '转轮没有停下',
    },
    {
      name: 'common hamster',
      variables: { starMatched: false, curiosity: 2, empathy: 1, control: 1 },
      choiceId: 'continue-common',
      ending: 'common-hamster',
      marker: '它只是一只普通仓鼠',
    },
  ])('reaches the $name ending deterministically', async ({ variables, choiceId, ending, marker }) => {
    const runtime = await createHamsterRuntime(variables)
    await reachEndingChoice(runtime)

    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: choiceId, label: '继续' }),
    ])
    await runtime.choose(choiceId)
    expect(runtime.state.variables.ending).toBe(ending)
    expect(runtime.current?.data?.text).toContain(marker)

    await advanceUntil(runtime, () => runtime.state.status === 'ended')
    const snapshot = runtime.snapshot()
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })
})
