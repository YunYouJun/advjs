import { expect, it } from 'vitest'
import { parsePreviewBounds, parsePreviewMode } from '../../apps/desktop/src/preview-presentation'

it('only accepts the two finite preview presentations', () => {
  expect(parsePreviewMode('embedded')).toBe('embedded')
  expect(parsePreviewMode('window')).toBe('window')
  for (const value of [undefined, 'url', { url: 'https://example.com' }])
    expect(() => parsePreviewMode(value)).toThrow('Invalid preview mode')
})

it('accepts finite panel rectangles and hides on absence, rejecting extra or unsafe values', () => {
  expect(parsePreviewBounds(undefined)).toBeUndefined()
  expect(parsePreviewBounds(null)).toBeUndefined()
  expect(parsePreviewBounds({ x: 1.2, y: 28.4, width: 320.6, height: 600 })).toEqual({ x: 1, y: 28, width: 321, height: 600 })
  for (const value of [{}, [], { x: -1, y: 0, width: 320, height: 600 }, { x: 0, y: 0, width: Number.NaN, height: 600 }, { x: 0, y: 0, width: 320, height: 20_001 }, { x: 0, y: 0, width: 320, height: 600, url: 'https://example.com' }])
    expect(() => parsePreviewBounds(value)).toThrow('Invalid preview bounds')
})
