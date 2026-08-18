import { describe, expect, it } from 'vitest'
import {
  parseManagedCapabilityResult,
  selectManagedAgentProjectFiles,
  toManagedChapterPath,
} from '../agent/capabilities'
import { clearLegacyStudioAiCredentials } from '../agent/managed'

const files = {
  'README.md': 'private project note',
  'adv/characters/alice.character.md': '# Alice',
  'adv/characters/bob.character.md': '# Bob',
  'adv/chapters/01.adv.md': '@alice: hello',
  'adv/chapters/02.adv.md': '@bob: bye',
  'adv/outline.md': '# Outline',
  'adv/world.md': '# World',
}

describe('managed authoring project context', () => {
  it('deletes legacy BYOK storage without reading its value', () => {
    const removed: string[] = []
    clearLegacyStudioAiCredentials({ removeItem: key => removed.push(key) })
    expect(removed).toEqual(['advjs-studio-ai'])
  })

  it('normalizes safe chapter filenames', () => {
    expect(toManagedChapterPath('01')).toBe('adv/chapters/01.adv.md')
    expect(toManagedChapterPath('adv/chapters/01.adv.md')).toBe('adv/chapters/01.adv.md')
    expect(() => toManagedChapterPath('../secret')).toThrow()
  })

  it('sends only outline capability context', () => {
    expect(selectManagedAgentProjectFiles('generate-outline', { hint: 'more suspense' }, files)).toEqual({
      'adv/characters/alice.character.md': '# Alice',
      'adv/characters/bob.character.md': '# Bob',
      'adv/outline.md': '# Outline',
      'adv/world.md': '# World',
    })
  })

  it('sends only the selected chapter with shared authoring context', () => {
    const selected = selectManagedAgentProjectFiles('generate-chapter-draft', {
      chapterPath: 'adv/chapters/01.adv.md',
    }, files)
    expect(selected['adv/chapters/01.adv.md']).toBe('@alice: hello')
    expect(selected).not.toHaveProperty('adv/chapters/02.adv.md')
    expect(selected).not.toHaveProperty('README.md')
  })

  it('limits roleplay character context to selected saved characters', () => {
    expect(selectManagedAgentProjectFiles('simulate-roleplay', {
      characterIds: ['alice'],
      goal: 'Resolve the dispute',
    }, files)).toEqual({
      'adv/characters/alice.character.md': '# Alice',
      'adv/outline.md': '# Outline',
      'adv/world.md': '# World',
    })
  })

  it('fails closed when a required saved source is absent', () => {
    expect(() => selectManagedAgentProjectFiles('check-consistency', {
      chapterPath: 'adv/chapters/missing.adv.md',
    }, files)).toThrow(/saved/i)
    expect(() => selectManagedAgentProjectFiles('simulate-roleplay', {
      characterIds: ['missing'],
      goal: 'Talk',
    }, files)).toThrow(/saved/i)
  })

  it('parses server-validated plot and roleplay results for the task rail', () => {
    expect(parseManagedCapabilityResult('suggest-plot', JSON.stringify({
      suggestions: [{ label: 'A', synopsis: 'B', hook: 'C' }],
    }))).toEqual({
      kind: 'plot-suggestions',
      suggestions: [{ label: 'A', synopsis: 'B', hook: 'C' }],
    })
    expect(parseManagedCapabilityResult('simulate-roleplay', JSON.stringify({
      lines: [{ speakerId: 'alice', speakerName: 'Alice', content: 'Hello' }],
    }))).toEqual({
      kind: 'roleplay-lines',
      lines: [{ speakerId: 'alice', speakerName: 'Alice', content: 'Hello' }],
    })
    expect(parseManagedCapabilityResult('suggest-plot', '{invalid')).toBeUndefined()
  })
})
