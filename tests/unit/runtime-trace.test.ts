// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { diffRuntimeVariables } from '../../packages/core/src/runtime'

describe('runtime trace variable diff', () => {
  it('reports created and changed scalar paths in sorted order', () => {
    expect(diffRuntimeVariables(
      { score: 1, profile: { mood: 'calm' } },
      { score: 2, profile: { mood: 'curious' }, unlocked: true },
    )).toEqual([
      { path: 'profile.mood', before: 'calm', after: 'curious' },
      { path: 'score', before: 1, after: 2 },
      { path: 'unlocked', after: true },
    ])
  })

  it('reports deletions without an after value', () => {
    expect(diffRuntimeVariables(
      { profile: { mood: 'calm', note: 'old' } },
      { profile: { mood: 'calm' } },
    )).toEqual([
      { path: 'profile.note', before: 'old' },
    ])
  })

  it('treats arrays and value type changes as path replacements', () => {
    expect(diffRuntimeVariables(
      { memories: ['one'], profile: { mood: 'calm' } },
      { memories: ['one', 'two'], profile: 'hidden' },
    )).toEqual([
      { path: 'memories', before: ['one'], after: ['one', 'two'] },
      { path: 'profile', before: { mood: 'calm' }, after: 'hidden' },
    ])
  })

  it('escapes literal dots and backslashes in object keys', () => {
    expect(diffRuntimeVariables(
      { 'a.b': 1, 'a\\b': 1 },
      { 'a.b': 2, 'a\\b': 2 },
    )).toEqual([
      { path: 'a\\.b', before: 1, after: 2 },
      { path: 'a\\\\b', before: 1, after: 2 },
    ])
  })

  it('returns no changes for deeply equal JSON with different key order', () => {
    expect(diffRuntimeVariables(
      { profile: { mood: 'calm', score: 1 }, memories: ['one'] },
      { memories: ['one'], profile: { score: 1, mood: 'calm' } },
    )).toEqual([])
  })
})
