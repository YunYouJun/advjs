import type { LocationInfo } from '../composables/useProjectContent'

/**
 * Match a free-text location string (e.g. from AI character state extraction)
 * against a list of LocationInfo entries.
 *
 * Matching priority:
 * 1. Exact match on id
 * 2. Exact match on name (case-insensitive)
 * 3. Name contained in text (case-insensitive)
 * 4. null (no match)
 */
export function matchLocationByText(
  text: string,
  locations: LocationInfo[],
): LocationInfo | null {
  if (!text || locations.length === 0)
    return null

  const lower = text.toLowerCase()

  // 1. Exact match on id
  for (const loc of locations) {
    if (loc.id && loc.id === text)
      return loc
  }

  // 2. Exact match on name (case-insensitive)
  for (const loc of locations) {
    if (loc.name.toLowerCase() === lower)
      return loc
  }

  // 3. Name contained in text
  for (const loc of locations) {
    if (lower.includes(loc.name.toLowerCase()))
      return loc
  }

  return null
}
