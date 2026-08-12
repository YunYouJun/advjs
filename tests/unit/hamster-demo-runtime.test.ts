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
      sections: Array<{ required: boolean, chapters: string[] }>
    }>
  }

  const files = manifest.sources
    .flatMap(source => source.sections)
    .filter(section => section.required)
    .flatMap(section => section.chapters)
  return Promise.all(files.map(async file => ({
    id: file.replace(/^\d+-/u, '').replace(/\.adv\.md$/u, ''),
    sourcePath: `demo/hamster/public/md/chapters/${file}`,
    content: await readFile(resolve(root, `demo/hamster/public/md/chapters/${file}`), 'utf8'),
  })))
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

async function playUntilEnd(runtime: HamsterRuntime, matched = true) {
  const chapters = new Set<string>()
  const activities: string[] = []

  for (let step = 0; step < 900; step++) {
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
        throw new Error('Route exposed no selectable option')
      await runtime.choose(option.id)
      continue
    }
    if (runtime.state.status === 'waiting-activity') {
      activities.push(await completeCurrentActivity(runtime, matched))
      continue
    }
    throw new Error(`Unexpected Runtime status: ${runtime.state.status}`)
  }
  throw new Error('Route did not end within 900 transitions')
}

async function advanceUntilChoice(runtime: HamsterRuntime, limit = 200) {
  for (let step = 0; step < limit; step++) {
    if (runtime.state.status === 'waiting-choice')
      return
    if (runtime.state.status === 'playing')
      await runtime.next()
    else if (runtime.state.status === 'waiting-activity')
      await completeCurrentActivity(runtime)
    else
      throw new Error(`Unexpected ${runtime.state.status}`)
  }
  throw new Error('Choice was not reached')
}

describe('hamster demo runtime', () => {
  it('compiles the seamless 16-chapter route', async () => {
    const result = await compileHamsterProgram()

    expect(result.diagnostics).toEqual([])
    expect(Object.keys(result.program!.chapters)).toEqual([
      'hamster-cage',
      'world-destruction',
      'starry-fantasy',
      'world-ending',
      'endless-symphony',
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
    ])
  })

  it('finishes all 16 chapters and both interactive activities in one run', async () => {
    const runtime = await createHamsterRuntime()
    await runtime.start()
    const result = await playUntilEnd(runtime)

    expect(result.chapters).toHaveLength(16)
    expect(result.activities).toEqual(['star-map/compare', 'civilization/initialize'])
    expect(runtime.state.variables).toMatchObject({
      canonicalCompleted: true,
      storyMode: 'main',
      ending: 'starlight-echo',
      starMatched: true,
      starMatchScore: 0.91,
      civilizationLevel: 2,
    })
    expect(runtime.state.variables.unlockedEndings).toEqual(['starlight-echo'])
  })

  it('keeps the complete route reachable after an imperfect star-map comparison', async () => {
    const runtime = await createHamsterRuntime()
    await runtime.start()
    const result = await playUntilEnd(runtime, false)

    expect(result.chapters).toHaveLength(16)
    expect(runtime.state.variables).toMatchObject({
      canonicalCompleted: true,
      starMatched: false,
      starMatchScore: 0.61,
    })
  })

  it('runs the postgame echo simulation as an independent world-internal route', async () => {
    const runtime = await createHamsterRuntime({
      canonicalCompleted: true,
      unlockedEndings: ['starlight-echo'],
    })
    await runtime.go('hamster-cage#echo-simulation')
    await advanceUntilChoice(runtime)

    expect(runtime.current?.data?.options).toEqual([
      expect.objectContaining({ id: 'unlock-still-gazing' }),
      expect.objectContaining({ id: 'unlock-endless-wheel' }),
      expect.objectContaining({ id: 'unlock-common-hamster' }),
    ])
    await runtime.choose('unlock-still-gazing')
    await advanceUntilChoice(runtime)
    await runtime.choose('close-still-gazing')
    await playUntilEnd(runtime)

    expect(runtime.state.variables).toMatchObject({
      canonicalCompleted: true,
      storyMode: 'echo',
      ending: 'still-gazing',
    })
    expect(runtime.state.variables.unlockedEndings).toEqual(['starlight-echo', 'still-gazing'])
    expect(runtime.state.visited.every(address => address.startsWith('hamster-cage#'))).toBe(true)
  })

  it('does not duplicate an already unlocked echo ending', async () => {
    const runtime = await createHamsterRuntime({
      canonicalCompleted: true,
      unlockedEndings: ['starlight-echo', 'still-gazing'],
    })
    await runtime.go('hamster-cage#echo-simulation')
    await advanceUntilChoice(runtime)
    await runtime.choose('unlock-still-gazing')

    expect(runtime.state.variables.unlockedEndings).toEqual(['starlight-echo', 'still-gazing'])
  })
})
