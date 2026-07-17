// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram, createAdvRuntime } from '../../packages/core/src'
import { civilization, starMap } from '../../plugins/plugin-interactions/src'

const root = resolve(import.meta.dirname, '../..')

async function sourceChapters() {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'demo/hamster/adv/adaptation.json'), 'utf8'),
  ) as {
    sources: Array<{
      sections: Array<{ chapters: string[] }>
    }>
  }

  return Promise.all(manifest.sources.flatMap(source => source.sections).map(async (section) => {
    const file = section.chapters[0]
    return {
      id: file.replace(/^\d+-/u, '').replace(/\.adv\.md$/u, ''),
      sourcePath: `demo/hamster/public/md/chapters/${file}`,
      content: await readFile(resolve(root, `demo/hamster/public/md/chapters/${file}`), 'utf8'),
    }
  }))
}

async function compileHamsterProgram() {
  return compileMarkdownProgram({
    id: 'hamster-demo',
    requiredPlugins: {
      'star-map': '1.0.0',
      'civilization': '1.0.0',
    },
    chapters: await sourceChapters(),
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

async function advanceUntilPause(
  runtime: HamsterRuntime,
  status: 'waiting-choice' | 'waiting-activity' | 'ended',
  limit = 200,
) {
  for (let step = 0; step < limit; step++) {
    if (runtime.state.status === status)
      return
    if (runtime.state.status !== 'playing')
      throw new Error(`Unexpected ${runtime.state.status} at ${runtime.state.cursor.chapterId}#${runtime.state.cursor.nodeId}`)
    await runtime.next()
  }
  throw new Error(`Runtime did not reach ${status} within ${limit} steps`)
}

async function completeCurrentActivity(runtime: HamsterRuntime, matched = true) {
  if (runtime.state.pendingActivity?.type === 'star-map/compare') {
    await runtime.completeActivity({ matched, score: matched ? 0.91 : 0.61 })
    return 'star-map/compare'
  }
  if (runtime.state.pendingActivity?.type === 'civilization/initialize') {
    await runtime.completeActivity({ name: '仓人文明档案', level: 2, principle: 'memory' })
    return 'civilization/initialize'
  }
  throw new Error(`Unexpected activity: ${runtime.state.pendingActivity?.type}`)
}

async function playCanonical(runtime: HamsterRuntime, matched = true) {
  const chapters = new Set<string>()
  const activities: string[] = []

  for (let step = 0; step < 800; step++) {
    chapters.add(runtime.state.cursor.chapterId)
    if (runtime.state.status === 'ended')
      return { chapters: [...chapters], activities }
    if (runtime.state.status === 'playing') {
      await runtime.next()
      continue
    }
    if (runtime.state.status === 'waiting-choice') {
      const option = runtime.current?.data?.options?.[0]
      if (!option || typeof option !== 'object' || Array.isArray(option) || typeof option.id !== 'string')
        throw new Error('Canonical route exposed no selectable option')
      await runtime.choose(option.id)
      continue
    }
    if (runtime.state.status === 'waiting-activity') {
      activities.push(await completeCurrentActivity(runtime, matched))
      continue
    }
    throw new Error(`Unexpected Runtime status: ${runtime.state.status}`)
  }
  throw new Error('Canonical route did not end within 800 transitions')
}

describe('hamster demo runtime', () => {
  it('compiles all 19 source chapters into a linked runtime program', async () => {
    const result = await compileHamsterProgram()

    expect(result.diagnostics).toEqual([])
    expect(Object.keys(result.program!.chapters)).toEqual([
      'hamster-cage',
      'world-destruction',
      'starry-fantasy',
      'world-ending',
      'endless-symphony',
      'hamster-postscript',
      'common-hamster-preface',
      'daylight',
      'cocoon',
      'survival-or-destruction',
      'duelist-romance',
      'lizard-king',
      'third-kind',
      'evolution',
      'stars-sea',
      'encounter',
      'they-are-gods',
      'dim-stars',
      'common-hamster-postscript',
    ])
  })

  it('forces first-play canonical mode through every source chapter and both activities', async () => {
    const runtime = await createHamsterRuntime()
    await runtime.start()
    await advanceUntilPause(runtime, 'waiting-choice')

    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'start-canonical' }),
    ])

    const result = await playCanonical(runtime)

    expect(result.chapters).toHaveLength(19)
    expect(result.activities).toEqual(['star-map/compare', 'civilization/initialize'])
    expect(runtime.state.variables).toMatchObject({
      canonicalCompleted: true,
      storyMode: 'canonical',
      ending: 'canonical',
      starMatched: true,
      starMatchScore: 0.91,
      civilizationLevel: 2,
    })
    expect(runtime.state.variables.unlockedEndings).toEqual(['canonical'])
  })

  it('keeps the canonical story complete after an imperfect star-map comparison', async () => {
    const runtime = await createHamsterRuntime()
    await runtime.start()
    await advanceUntilPause(runtime, 'waiting-choice')
    const result = await playCanonical(runtime, false)

    expect(result.chapters).toHaveLength(19)
    expect(runtime.state.variables).toMatchObject({
      canonicalCompleted: true,
      starMatched: false,
      starMatchScore: 0.61,
    })
  })

  it('unlocks the labeled interpretive route only on a later playthrough', async () => {
    const runtime = await createHamsterRuntime({
      canonicalCompleted: true,
      unlockedEndings: ['canonical'],
    })
    await runtime.start()
    await advanceUntilPause(runtime, 'waiting-choice')

    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'start-canonical' }),
      expect.objectContaining({ id: 'start-interpretive' }),
    ])

    await runtime.choose('start-interpretive')
    await advanceUntilPause(runtime, 'waiting-activity')
    expect(await completeCurrentActivity(runtime)).toBe('star-map/compare')
    await advanceUntilPause(runtime, 'waiting-choice')
    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'unlock-still-gazing' }),
      expect.objectContaining({ id: 'unlock-endless-wheel' }),
      expect.objectContaining({ id: 'unlock-common-hamster' }),
    ])

    await runtime.choose('unlock-still-gazing')
    await advanceUntilPause(runtime, 'waiting-choice')
    await runtime.choose('close-still-gazing')
    await advanceUntilPause(runtime, 'ended')

    expect(runtime.state.variables).toMatchObject({
      canonicalCompleted: true,
      storyMode: 'interpretive',
      ending: 'still-gazing',
    })
    expect(runtime.state.variables.unlockedEndings).toEqual(['canonical', 'still-gazing'])
    expect(runtime.state.visited.every(address => address.startsWith('hamster-cage#'))).toBe(true)
  })

  it('does not duplicate a previously unlocked interpretive ending', async () => {
    const runtime = await createHamsterRuntime({
      canonicalCompleted: true,
      unlockedEndings: ['canonical', 'still-gazing'],
    })
    await runtime.start()
    await advanceUntilPause(runtime, 'waiting-choice')
    await runtime.choose('start-interpretive')
    await advanceUntilPause(runtime, 'waiting-activity')
    await completeCurrentActivity(runtime)
    await advanceUntilPause(runtime, 'waiting-choice')
    await runtime.choose('unlock-still-gazing')

    expect(runtime.state.variables.unlockedEndings).toEqual(['canonical', 'still-gazing'])
  })
})
