/**
 * Lightweight CSV parser (RFC 4180 basic support).
 * No external dependencies — handles quoted fields, embedded commas, and newlines in quotes.
 */

// Module-level regex patterns (per e18e/prefer-static-regex)
const CRLF_RE = /\r\n/g
const CR_RE = /\r/g

/**
 * Parse a CSV string into an array of objects keyed by header row.
 * @param text Raw CSV string
 * @param separator Column separator (default: ',')
 * @returns Array of record objects
 */
export function parseCSV(text: string, separator = ','): Record<string, string>[] {
  const rows = parseCSVRows(text, separator)
  if (rows.length < 2)
    return []

  const headers = rows[0].map(h => h.trim())
  const results: Record<string, string>[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    // Skip empty rows
    if (row.length === 1 && row[0].trim() === '')
      continue

    const obj: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (row[j] ?? '').trim()
    }
    results.push(obj)
  }

  return results
}

/**
 * Parse CSV text into a 2D array of strings.
 */
export function parseCSVRows(text: string, separator = ','): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  const chars = text.replace(CRLF_RE, '\n').replace(CR_RE, '\n')

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < chars.length && chars[i + 1] === '"') {
          currentField += '"'
          i++ // skip next quote
        }
        else {
          inQuotes = false
        }
      }
      else {
        currentField += ch
      }
    }
    else {
      if (ch === '"') {
        inQuotes = true
      }
      else if (ch === separator) {
        currentRow.push(currentField)
        currentField = ''
      }
      else if (ch === '\n') {
        currentRow.push(currentField)
        currentField = ''
        rows.push(currentRow)
        currentRow = []
      }
      else {
        currentField += ch
      }
    }
  }

  // Flush last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

/**
 * Validate CSV headers against expected character fields.
 * Returns missing required headers and unknown headers.
 */
export function validateCharacterCSVHeaders(headers: string[]): {
  valid: boolean
  missingRequired: string[]
  unknownHeaders: string[]
} {
  const required = ['name']
  const known = new Set([
    'id',
    'name',
    'tags',
    'aliases',
    'personality',
    'appearance',
    'background',
    'concept',
    'speechStyle',
    'faction',
    'cv',
    'actor',
  ])

  const headerSet = new Set(headers.map(h => h.trim()))
  const missingRequired = required.filter(r => !headerSet.has(r))
  const unknownHeaders = headers.filter(h => !known.has(h.trim()))

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    unknownHeaders,
  }
}
