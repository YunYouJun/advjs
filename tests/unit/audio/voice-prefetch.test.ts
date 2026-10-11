import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { followingVoiceLineIds } from '../../../packages/client/audio/prefetch'

function program(): RuntimeProgram {
  return {
    schemaVersion: 2,
    id: 'prefetch',
    hash: 'prefetch',
    requiredPlugins: {},
    entry: { chapterId: 'one', nodeId: 'a' },
    chapters: { one: { id: 'one', entry: 'a', order: ['a', 'b', 'c', 'd'], nodes: {
      a: { id: 'a', kind: 'dialog', data: { lineId: 'line-a' }, next: { chapterId: 'one', nodeId: 'b' } },
      b: { id: 'b', kind: 'audio', next: { chapterId: 'one', nodeId: 'c' } },
      c: { id: 'c', kind: 'narration', data: { lineId: 'line-c' }, next: { chapterId: 'one', nodeId: 'd' } },
      d: { id: 'd', kind: 'dialog', data: { lineId: 'line-d' }, next: { chapterId: 'one', nodeId: 'a' } },
    } } },
  }
}

describe('certain dialogue prefetch path', () => {
  it('collects current and two following lines with a bounded cycle-safe traversal', () => {
    const value = program()
    expect(followingVoiceLineIds(value, value.entry)).toEqual(['line-a', 'line-c', 'line-d'])
    expect(followingVoiceLineIds(value, value.entry, 10)).toEqual(['line-a', 'line-c', 'line-d'])
  })
  it('does not guess a route across interactive or conditional nodes', () => {
    const value = program()
    value.chapters.one!.nodes.b!.kind = 'choice'
    expect(followingVoiceLineIds(value, value.entry)).toEqual(['line-a'])
    value.chapters.one!.nodes.b!.kind = 'audio'
    value.chapters.one!.nodes.b!.when = { type: 'literal', value: false }
    expect(followingVoiceLineIds(value, value.entry)).toEqual(['line-a'])
  })
})
