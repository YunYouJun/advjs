import type { AdvCharacter } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { exportCharactersToCSV, exportRelationshipsToCSV, exportTimelineToCSV, stringifyCSV } from '../utils/csvExport'

describe('stringifyCSV', () => {
  it('generates header and rows', () => {
    const result = stringifyCSV(['a', 'b'], [['1', '2'], ['3', '4']])
    expect(result).toBe('a,b\n1,2\n3,4\n')
  })

  it('escapes fields with commas', () => {
    const result = stringifyCSV(['name'], [['hello, world']])
    expect(result).toBe('name\n"hello, world"\n')
  })

  it('escapes fields with quotes', () => {
    const result = stringifyCSV(['name'], [['He said "hi"']])
    expect(result).toBe('name\n"He said ""hi"""\n')
  })

  it('escapes fields with newlines', () => {
    const result = stringifyCSV(['name'], [['line1\nline2']])
    expect(result).toBe('name\n"line1\nline2"\n')
  })

  it('handles empty rows', () => {
    const result = stringifyCSV(['a', 'b'], [])
    expect(result).toBe('a,b\n')
  })
})

describe('exportCharactersToCSV', () => {
  it('exports characters with all fields', () => {
    const chars: AdvCharacter[] = [
      {
        id: 'alice',
        name: 'Alice',
        tags: ['main', 'hero'],
        aliases: ['Ali'],
        faction: 'good',
        personality: 'brave',
        appearance: 'tall',
        background: 'knight',
      },
    ]
    const csv = exportCharactersToCSV(chars)
    expect(csv).toContain('id,name,tags')
    expect(csv).toContain('alice,Alice,main;hero,Ali,good,brave,tall,knight')
  })

  it('handles missing optional fields', () => {
    const chars: AdvCharacter[] = [{ id: 'bob', name: 'Bob' }]
    const csv = exportCharactersToCSV(chars)
    expect(csv).toContain('bob,Bob,,,,,,,')
  })
})

describe('exportTimelineToCSV', () => {
  it('exports timeline entries with period and full content', () => {
    const entries = [
      { date: '2024-01-01', period: 'morning', kind: 'event', type: 'daily', summary: 'A normal day', characterId: 'alice', characterIds: ['alice', 'bob'] },
      { date: '2024-01-01', period: 'evening', kind: 'diary', mood: 'happy', summary: 'I feel great', characterId: 'bob', diaryContent: 'I feel great today and the sun was shining' },
    ]
    const csv = exportTimelineToCSV(entries)
    expect(csv).toContain('date,period,kind,type,characterIds,mood,content')
    expect(csv).toContain('2024-01-01,morning,event,daily,alice;bob,,A normal day')
    expect(csv).toContain('2024-01-01,evening,diary,,bob,happy,I feel great today and the sun was shining')
  })

  it('falls back to summary when diaryContent is missing', () => {
    const entries = [
      { date: '2024-01-02', kind: 'event', type: 'social', summary: 'Met a friend', characterId: 'alice' },
    ]
    const csv = exportTimelineToCSV(entries)
    expect(csv).toContain(',Met a friend')
  })
})

describe('exportRelationshipsToCSV', () => {
  it('exports relationship edges', () => {
    const chars: AdvCharacter[] = [
      {
        id: 'alice',
        name: 'Alice',
        relationships: [
          { targetId: 'bob', type: 'friend', description: 'best friends' },
        ],
      },
    ]
    const csv = exportRelationshipsToCSV(chars)
    expect(csv).toContain('sourceId,sourceName,targetId,type,description')
    expect(csv).toContain('alice,Alice,bob,friend,best friends')
  })

  it('returns only header for characters without relationships', () => {
    const chars: AdvCharacter[] = [{ id: 'alice', name: 'Alice' }]
    const csv = exportRelationshipsToCSV(chars)
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(1) // header only
  })
})
