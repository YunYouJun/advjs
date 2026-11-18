// @vitest-environment node

import type { AdvGameConfig, AdvGameUnlockListConfig, RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram } from '../../../packages/core/src/compiler/markdown'
import {
  createRuntimeRouteGraph,
  isReplayAvailable,
  isReplayFinished,
  musicRoomTracks,
  parseGameExtras,
  replayStartAddress,
  unlockedExtraIds,
  validateGameExtras,
  visibleRuntimeRouteGraph,
} from '../../../packages/core/src/extras'
import { createAdvRuntime } from '../../../packages/core/src/runtime'

const endings: AdvGameUnlockListConfig = {
  items: [
    { id: 'true-end', title: 'True', hint: 'Finish the story' },
    { id: 'bad', title: 'Bad' },
  ],
}

const story = `# Opening {#opening}

Hello.

- [Stay](#stay)

  \`\`\`yaml
  actions:
    - type: variables/push-unique
      key: unlockedEndings
      value: true-end
  \`\`\`

- [Leave](second#hall)

## Stay {#stay}

Quiet ending.

## Epilogue {#epilogue}

The end.
`

const second = `# Hall {#hall}

\`\`\`yaml
type: actions
actions:
  - type: variables/push-unique
    key: unlockedAchievements
    value: hall-walker
\`\`\`

Another chapter.
`

async function compileStory(chapterOne = story) {
  const result = await compileMarkdownProgram({
    id: 'extras',
    chapters: [
      { id: 'first', title: 'First', content: chapterOne, sourcePath: 'adv/chapters/first.adv.md' },
      { id: 'second', title: 'Second', content: second, sourcePath: 'adv/chapters/second.adv.md' },
    ],
  })
  expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([])
  return result.program!
}

describe('game extras unlock logic', () => {
  it('reads declared unlocks from the progression variable in declaration order', () => {
    expect(unlockedExtraIds(endings, 'endings', { unlockedEndings: ['bad', 'missing', 3, 'true-end'] })).toEqual(['true-end', 'bad'])
    expect(unlockedExtraIds({ key: 'found', items: endings.items }, 'endings', { found: ['bad'], unlockedEndings: ['true-end'] })).toEqual(['bad'])
    expect(unlockedExtraIds(endings, 'endings', { unlockedEndings: 'true-end' })).toEqual([])
    expect(unlockedExtraIds(undefined, 'achievements', { unlockedAchievements: ['x'] })).toEqual([])
  })

  it('validates game.json extras without accepting unsafe keys or duplicate ids', () => {
    expect(parseGameExtras({
      endings: { items: [{ id: 'true', title: 'True', hint: 'h' }] },
      replays: [{ id: 'opening', title: 'Opening', chapterId: 'first', variables: { mode: 'replay' } }],
      musicRoom: {},
    })).toEqual({
      endings: { items: [{ id: 'true', title: 'True', hint: 'h' }] },
      replays: [{ id: 'opening', title: 'Opening', chapterId: 'first', variables: { mode: 'replay' } }],
      musicRoom: {},
    })
    expect(() => parseGameExtras({ endings: { key: '__proto__', items: [] } })).toThrow('top-level variable')
    expect(() => parseGameExtras({ achievements: { items: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }] } })).toThrow('duplicate id: a')
    expect(() => parseGameExtras({ replays: [{ id: 'r', title: '', chapterId: 'first' }] })).toThrow('title')
  })

  it('lists heard-candidate BGM from declared tracks or the whole catalog', () => {
    const audio: AdvGameConfig['audio'] = {
      assets: {
        'bgm/day': { kind: 'bgm', src: '/day.ogg', title: 'Day' },
        'bgm/night': { kind: 'bgm', src: '/night.ogg' },
        'sfx/door': { kind: 'sfx', src: '/door.ogg' },
      },
    }
    expect(musicRoomTracks({ audio })).toEqual([
      { id: 'bgm/day', title: 'Day' },
      { id: 'bgm/night', title: 'bgm/night' },
    ])
    expect(musicRoomTracks({ audio, musicRoom: { tracks: [{ id: 'bgm/night', title: 'Night', description: 'Calm' }, { id: 'sfx/door' }] } })).toEqual([
      { id: 'bgm/night', title: 'Night', description: 'Calm' },
    ])
  })
})

describe('scene replay', () => {
  it('becomes available after its anchor was visited and stops at the end anchor or chapter boundary', async () => {
    const program = await compileStory()
    const replay = { id: 'stay', title: 'Stay', chapterId: 'first', nodeId: 'stay', endNodeId: 'epilogue' }
    const chapterReplay = { id: 'opening', title: 'Opening', chapterId: 'first' }

    expect(replayStartAddress(chapterReplay, program)).toEqual({ chapterId: 'first', nodeId: 'opening' })
    expect(isReplayAvailable(replay, ['first#opening'], program)).toBe(false)
    expect(isReplayAvailable(replay, new Set(['first#stay']), program)).toBe(true)

    const runtime = createAdvRuntime({ program, initialVariables: { unlockedEndings: [] } })
    await runtime.go({ chapterId: 'first', nodeId: 'stay' })
    expect(isReplayFinished(replay, runtime.state)).toBe(false)
    await runtime.next()
    expect(isReplayFinished(replay, runtime.state)).toBe(true)

    const opening = createAdvRuntime({ program })
    await opening.start()
    await opening.next()
    await opening.choose('choice-2')
    expect(isReplayFinished(chapterReplay, opening.state)).toBe(true)
    expect(isReplayFinished(chapterReplay, { status: 'playing', visited: ['first#opening'] })).toBe(false)
  })
})

describe('route graph', () => {
  it('connects chapter entries and anchors through choices and reveals only visited nodes', async () => {
    const program = await compileStory()
    const graph = createRuntimeRouteGraph(program)

    expect(graph.nodes.map(node => [node.id, node.title, node.entry])).toEqual([
      ['first#opening', 'Opening', true],
      ['first#stay', 'Stay', false],
      ['first#epilogue', 'Epilogue', false],
      ['second#hall', 'Hall', true],
    ])
    expect(graph.edges.map(edge => edge.id).sort()).toEqual([
      'first#opening->first#stay',
      'first#opening->second#hall',
      'first#stay->first#epilogue',
    ])

    const visible = visibleRuntimeRouteGraph(graph, new Set(['first#opening', 'second#hall']))
    expect(visible.nodes.map(node => node.id)).toEqual(['first#opening', 'second#hall'])
    expect(visible.edges.map(edge => edge.id)).toEqual(['first#opening->second#hall'])
  })
})

describe('extras project diagnostics', () => {
  const files = new Map([['adv/chapters/first.adv.md', story.replace('value: true-end', 'value: secret')]])

  it('reports unknown ending, achievement and replay ids with script locations', async () => {
    const program: RuntimeProgram = await compileStory(story.replace('value: true-end', 'value: secret'))
    const diagnostics = validateGameExtras({
      game: {
        progression: { id: 'test', keys: ['unlockedEndings'] },
        endings,
        achievements: { items: [{ id: 'other', title: 'Other' }] },
        replays: [
          { id: 'missing-chapter', title: 'A', chapterId: 'nowhere' },
          { id: 'not-anchor', title: 'B', chapterId: 'first', nodeId: 'node-1' },
          { id: 'ok', title: 'C', chapterId: 'first', nodeId: 'stay', endNodeId: 'epilogue' },
        ],
      },
      gamePath: 'adv/settings/game.json',
      program,
      chapterSources: { first: ['adv/chapters/first.adv.md'], second: ['adv/chapters/second.adv.md'] },
      files,
    })

    expect(diagnostics.map(item => [item.code, item.severity, item.path, item.line])).toEqual([
      ['ADV_PROJECT_UNKNOWN_ENDING', 'error', 'adv/chapters/first.adv.md', 11],
      ['ADV_PROJECT_UNREACHABLE_ENDING', 'warning', 'adv/settings/game.json', undefined],
      ['ADV_PROJECT_UNREACHABLE_ENDING', 'warning', 'adv/settings/game.json', undefined],
      ['ADV_PROJECT_EXTRAS_NOT_PERSISTED', 'warning', 'adv/settings/game.json', undefined],
      ['ADV_PROJECT_UNKNOWN_ACHIEVEMENT', 'error', 'adv/chapters/second.adv.md', undefined],
      ['ADV_PROJECT_UNREACHABLE_ACHIEVEMENT', 'warning', 'adv/settings/game.json', undefined],
      ['ADV_PROJECT_UNKNOWN_REPLAY_ANCHOR', 'error', 'adv/settings/game.json', undefined],
      ['ADV_PROJECT_UNKNOWN_REPLAY_ANCHOR', 'error', 'adv/settings/game.json', undefined],
    ])
    expect(diagnostics[0].message).toBe('Unknown ending "secret" unlocked at first#node-2')
    expect(diagnostics.at(-1)!.message).toContain('first#node-1')
  })

  it('reports invalid extras configuration once', () => {
    expect(validateGameExtras({ game: { replays: {} } })).toEqual([
      expect.objectContaining({ code: 'ADV_PROJECT_INVALID_EXTRAS', message: 'replays must be an array' }),
    ])
  })
})
