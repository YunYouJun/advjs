import type { LocationInfo } from '../composables/useProjectContent'
import { describe, expect, it } from 'vitest'
import { matchLocationByText } from '../utils/locationMatch'

const locations: LocationInfo[] = [
  { file: 'adv/locations/cafe.md', name: '涩谷咖啡厅', id: 'shibuya-cafe' },
  { file: 'adv/locations/school.md', name: 'School Rooftop', id: 'school-rooftop' },
  { file: 'adv/locations/park.md', name: 'Central Park', id: 'central-park' },
]

describe('matchLocationByText', () => {
  it('returns null for empty text', () => {
    expect(matchLocationByText('', locations)).toBeNull()
  })

  it('returns null for empty locations', () => {
    expect(matchLocationByText('cafe', [])).toBeNull()
  })

  it('matches by exact id', () => {
    const result = matchLocationByText('shibuya-cafe', locations)
    expect(result?.id).toBe('shibuya-cafe')
  })

  it('matches by exact name (case-insensitive)', () => {
    const result = matchLocationByText('school rooftop', locations)
    expect(result?.id).toBe('school-rooftop')
  })

  it('matches by name contained in text', () => {
    const result = matchLocationByText('我在涩谷咖啡厅等你', locations)
    expect(result?.id).toBe('shibuya-cafe')
  })

  it('returns null when no match', () => {
    const result = matchLocationByText('unknown location xyz', locations)
    expect(result).toBeNull()
  })

  it('prefers exact id over name containment', () => {
    const locs: LocationInfo[] = [
      { file: 'a.md', name: 'park', id: 'central-park' },
      { file: 'b.md', name: 'Central Park Area', id: 'park' },
    ]
    const result = matchLocationByText('park', locs)
    // Should match id 'park' (exact id match) over name containment
    expect(result?.id).toBe('park')
  })
})
