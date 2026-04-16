import type { AdvCharacter } from '@advjs/types'
import type { AudioInfo, ChapterInfo, LocationInfo, SceneInfo } from '../composables/useProjectContent'
import { describe, expect, it } from 'vitest'
import { validateProject } from '../utils/projectValidation'

function makeCharacter(id: string, name: string, opts?: Partial<AdvCharacter>): AdvCharacter {
  return { id, name, aliases: [], relationships: [], ...opts } as AdvCharacter
}

function makeChapter(file: string, content: string): ChapterInfo {
  return { file, content, name: file, preview: '' }
}

function makeScene(name: string, file?: string, opts?: Partial<SceneInfo>): SceneInfo {
  return { name, file: file || `scenes/${name}.md`, type: 'image', id: name, ...opts } as SceneInfo
}

function makeAudio(file: string, opts?: Partial<AudioInfo>): AudioInfo {
  return { file, name: file, ...opts } as AudioInfo
}

function makeLocation(id: string, name: string, file?: string, opts?: Partial<LocationInfo>): LocationInfo {
  return { id, name, file: file || `locations/${id}.md`, ...opts } as LocationInfo
}

describe('validateProject', () => {
  it('passes for an empty project', async () => {
    const result = await validateProject([], [], [], [])
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('reports missing character references as errors', async () => {
    // ADV.JS uses @CharacterName syntax for character references
    const chapters = [makeChapter('ch1.adv.md', '@小明\n你好')]
    const characters = [makeCharacter('xiaohong', '小红')]
    const result = await validateProject(chapters, characters, [], [])
    const charIssues = result.issues.filter(i => i.category === 'character')
    expect(charIssues.length).toBeGreaterThan(0)
    expect(result.passed).toBe(false)
  })

  it('passes when characters are referenced by alias', async () => {
    const chapters = [makeChapter('ch1.adv.md', '@Mike\nHello')]
    const characters = [makeCharacter('mike', 'Michael', { aliases: ['Mike'] })]
    const result = await validateProject(chapters, characters, [], [])
    const charIssues = result.issues.filter(i => i.category === 'character')
    expect(charIssues).toHaveLength(0)
  })

  it('reports broken audio linkedScenes as warnings', async () => {
    const audios = [makeAudio('bgm.md', { linkedScenes: ['nonexistent-scene'] })]
    const result = await validateProject([], [], [], audios)
    const audioIssues = result.issues.filter(i => i.category === 'audio')
    expect(audioIssues).toHaveLength(1)
    expect(audioIssues[0].type).toBe('warning')
  })

  it('reports broken location linkedScenes as warnings', async () => {
    const locations = [makeLocation('cafe', 'Cafe', undefined, { linkedScenes: ['ghost-scene'] })]
    const result = await validateProject([], [], [], [], locations)
    const locIssues = result.issues.filter(i => i.category === 'location')
    expect(locIssues).toHaveLength(1)
  })

  it('reports invalid relationship targetId as warnings', async () => {
    const characters = [
      makeCharacter('alice', 'Alice', {
        relationships: [{ targetId: 'nonexistent', type: 'friend', description: '' }],
      }),
    ]
    const result = await validateProject([], characters, [], [])
    const relIssues = result.issues.filter(i => i.message.includes('relationship targetId'))
    expect(relIssues).toHaveLength(1)
    expect(relIssues[0].type).toBe('warning')
  })

  it('passes valid relationship targetId', async () => {
    const characters = [
      makeCharacter('alice', 'Alice', {
        relationships: [{ targetId: 'bob', type: 'friend', description: '' }],
      }),
      makeCharacter('bob', 'Bob'),
    ]
    const result = await validateProject([], characters, [], [])
    const relIssues = result.issues.filter(i => i.message.includes('relationship targetId'))
    expect(relIssues).toHaveLength(0)
  })

  it('returns correct stats', async () => {
    const result = await validateProject(
      [makeChapter('ch1.adv.md', '')],
      [makeCharacter('a', 'A'), makeCharacter('b', 'B')],
      [makeScene('s1')],
      [makeAudio('bgm.md')],
      [makeLocation('loc1', 'Loc1')],
    )
    expect(result.stats).toEqual({
      scripts: 1,
      characters: 2,
      scenes: 1,
      audios: 1,
      locations: 1,
    })
  })
})
