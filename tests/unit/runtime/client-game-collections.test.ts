import type { AdvChapter, AdvCharacter, AdvScene } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { resolveVirtualGameCollections } from '../../../packages/client/compiler/collections'

const chapter: AdvChapter = { id: 'intro', nodes: [{ id: 'end', type: 'end' }] }
const character: AdvCharacter = { id: 'speaker', name: 'Speaker' }
const scene: AdvScene = { id: 'room', type: 'image', src: '/room.svg' }
const collections = { chapters: [chapter], characters: [character], scenes: [scene] }

describe('canonical client game collections', () => {
  it('keeps configured native collections once even when virtual exports contain the same records', () => {
    const configured = { ...collections, title: 'Native project' }
    const result = resolveVirtualGameCollections(configured, structuredClone(collections))
    expect(result).toEqual(configured)
    expect(result.chapters).toBe(configured.chapters)
    expect(result.characters).toBe(configured.characters)
    expect(result.scenes).toBe(configured.scenes)
    expect(configured.chapters).toHaveLength(1)
  })

  it('uses legacy virtual modules only for each missing collection', () => {
    const configured = { chapters: [], characters: [character], scenes: [] }
    const fallback = { ...collections, characters: [{ id: 'legacy', name: 'Legacy' }] }
    const result = resolveVirtualGameCollections(configured, fallback)
    expect(result.chapters).toEqual([chapter])
    expect(result.characters).toEqual([character])
    expect(result.scenes).toEqual([scene])
    expect(configured.chapters).toEqual([])
    expect(configured.scenes).toEqual([])
  })
})
