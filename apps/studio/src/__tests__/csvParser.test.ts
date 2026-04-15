import { describe, expect, it } from 'vitest'
import { parseCSV, parseCSVRows, validateCharacterCSVHeaders } from '../utils/csvParser'

describe('parseCSVRows', () => {
  it('parses simple rows', () => {
    const rows = parseCSVRows('a,b,c\n1,2,3')
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles quoted fields with commas', () => {
    const rows = parseCSVRows('name,tags\n"John Doe","tag1,tag2"')
    expect(rows).toEqual([['name', 'tags'], ['John Doe', 'tag1,tag2']])
  })

  it('handles escaped quotes', () => {
    const rows = parseCSVRows('name\n"He said ""hello"""')
    expect(rows).toEqual([['name'], ['He said "hello"']])
  })

  it('handles newlines in quoted fields', () => {
    const rows = parseCSVRows('name,bio\n"Alice","Line 1\nLine 2"')
    expect(rows).toEqual([['name', 'bio'], ['Alice', 'Line 1\nLine 2']])
  })

  it('handles CRLF line endings', () => {
    const rows = parseCSVRows('a,b\r\n1,2\r\n')
    expect(rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('handles empty input', () => {
    const rows = parseCSVRows('')
    expect(rows).toEqual([])
  })
})

describe('parseCSV', () => {
  it('parses CSV with headers into objects', () => {
    const result = parseCSV('name,id,tags\nAlice,alice,"tag1;tag2"\nBob,bob,tag3')
    expect(result).toEqual([
      { name: 'Alice', id: 'alice', tags: 'tag1;tag2' },
      { name: 'Bob', id: 'bob', tags: 'tag3' },
    ])
  })

  it('returns empty array for header-only CSV', () => {
    const result = parseCSV('name,id')
    expect(result).toEqual([])
  })

  it('skips empty rows', () => {
    const result = parseCSV('name,id\nAlice,alice\n\nBob,bob')
    expect(result).toHaveLength(2)
  })

  it('trims whitespace from headers and values', () => {
    const result = parseCSV(' name , id \n Alice , alice ')
    expect(result).toEqual([{ name: 'Alice', id: 'alice' }])
  })

  it('handles missing columns gracefully', () => {
    const result = parseCSV('name,id,tags\nAlice,alice')
    expect(result[0]).toEqual({ name: 'Alice', id: 'alice', tags: '' })
  })
})

describe('validateCharacterCSVHeaders', () => {
  it('validates with all required headers present', () => {
    const result = validateCharacterCSVHeaders(['name', 'id', 'tags'])
    expect(result.valid).toBe(true)
    expect(result.missingRequired).toEqual([])
  })

  it('detects missing required headers', () => {
    const result = validateCharacterCSVHeaders(['id', 'tags'])
    expect(result.valid).toBe(false)
    expect(result.missingRequired).toContain('name')
  })

  it('detects unknown headers', () => {
    const result = validateCharacterCSVHeaders(['name', 'id', 'unknownField'])
    expect(result.unknownHeaders).toContain('unknownField')
  })

  it('accepts all known character fields', () => {
    const allKnown = ['id', 'name', 'tags', 'aliases', 'personality', 'appearance', 'background', 'concept', 'speechStyle', 'faction', 'cv', 'actor']
    const result = validateCharacterCSVHeaders(allKnown)
    expect(result.valid).toBe(true)
    expect(result.unknownHeaders).toEqual([])
  })
})
