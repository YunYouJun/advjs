import { describe, expect, it } from 'vitest'
import { SLUG_RE, toSlug } from '../utils/slug'

describe('toSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(toSlug('Hello World')).toBe('hello-world')
  })

  it('replaces underscores with hyphens', () => {
    expect(toSlug('hello_world')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(toSlug('Hello@World!')).toBe('helloworld')
  })

  it('collapses multiple hyphens', () => {
    expect(toSlug('hello---world')).toBe('hello-world')
  })

  it('trims leading/trailing hyphens', () => {
    expect(toSlug('-hello-')).toBe('hello')
  })

  it('preserves CJK characters', () => {
    expect(toSlug('第一章 序幕')).toBe('第一章-序幕')
  })

  it('preserves Japanese characters', () => {
    expect(toSlug('はじめの一歩')).toBe('はじめの一歩')
  })

  it('handles mixed CJK and Latin', () => {
    expect(toSlug('Chapter 1 第一章')).toBe('chapter-1-第一章')
  })

  it('handles empty string', () => {
    expect(toSlug('')).toBe('')
  })

  it('handles whitespace-only string', () => {
    expect(toSlug('   ')).toBe('')
  })
})

describe('sLUG_RE', () => {
  it('matches valid slugs', () => {
    expect(SLUG_RE.test('hello-world')).toBe(true)
    expect(SLUG_RE.test('chapter_01')).toBe(true)
    expect(SLUG_RE.test('第一章')).toBe(true)
  })

  it('rejects invalid slugs', () => {
    expect(SLUG_RE.test('hello world')).toBe(false)
    expect(SLUG_RE.test('hello@world')).toBe(false)
    expect(SLUG_RE.test('')).toBe(false)
  })
})
